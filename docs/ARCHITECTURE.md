# Architecture Guide

How data flows through Music Time Machine — from user input to rendered dashboard.

---

## Data Flow

```
User types query
      │
      ▼
SearchBar ──► /api/search?q= ──► dataFetcher.searchSongs()
                                        │
                                   Cache hit? ──► Return
                                        │ MISS
                                        ▼
                                  USE_MOCK_DATA?
                                   ┌────┴────┐
                                  YES        NO
                                   │          │
                                   ▼          ▼
                              Mock search   Spotify search ──► Genius fallback
                                   │          │
                                   │          ▼
                                   │   mergeWithMock() ─── dedup by title
                                   │          │           ─── mock-first order
                                   ▼          ▼
                               Cache result, return
```

The same pattern applies to `getSongData()` — check cache, check mock, enrich with real APIs, cache the result. Every code path ends with data; no branch returns empty.

---

## Mock-First Strategy

The core architectural bet: **mock data is not test data — it's the default product.**

```
dataFetcher.ts
├── searchSongs()     → mock results always present, API results merged on top
├── getSongData()     → mock song returned if exists; enriched with live data if APIs configured
├── enrichMockSong()  → replaces individual platform blocks with real data via Promise.all
└── compareSongs()    → delegates to getSongData(), so inherits the same fallback chain
```

This means:
- **Zero-config works.** Clone, install, run. 18 songs with full platform data.
- **Partial config works.** Set only Spotify keys → real Spotify data, mock YouTube/Genius/Billboard.
- **Full config works.** All APIs configured → real data everywhere, mock as error fallback.
- **Failures are invisible.** If Spotify goes down mid-request, mock data fills in. The UI never shows empty cards.

The `USE_MOCK_DATA` env var is a hard override — when `true`, no API calls are made regardless of configured keys.

---

## Caching Layer

`lib/cache.ts` implements a TTL cache using `Map` insertion-order semantics for oldest-first eviction:

```
TTLCache
├── get(key)    → return data if not expired, else delete and return null
├── set(key)    → evict oldest entry if at maxSize, then insert
├── has(key)    → delegates to get() (expired entries return false)
└── delete/clear/size
```

Two instances:

| Cache | TTL | Max Size | Key Format |
|-------|-----|----------|------------|
| `searchCache` | 5 min | 200 entries | `search:{query}` |
| `songCache` | 30 min | 100 entries | `song:{id}` |

**Why not LRU?** True LRU requires moving accessed entries to the tail on every read, which means a `delete` + `set` on every `get`. The simpler oldest-first eviction is good enough when TTLs are short and cache sizes are bounded — expired entries self-evict on access anyway.

---

## Rate Limiting

`lib/rateLimit.ts` implements token bucket rate limiting at two levels:

### Upstream API Limits (per-process)

Prevents overwhelming external APIs. One bucket per service:

| Service | Capacity | Refill Window |
|---------|----------|---------------|
| Spotify | 30 tokens | 30 seconds |
| YouTube | 100 tokens | 1 hour |
| Genius | 50 tokens | 1 minute |

### Route-Level Limits (per-IP)

Prevents individual clients from abusing endpoints. Key format: `route:{name}:{ip}`.

| Route | Capacity | Window |
|-------|----------|--------|
| `/api/search` | 20 | 1 min |
| `/api/song/:id` | 30 | 1 min |
| `/api/compare` | 15 | 1 min |
| `/api/artist/:id` | 30 | 1 min |
| `/api/og/:id` | 10 | 1 min |

**Stale bucket eviction** runs every 5 minutes, pruning buckets idle for >10 minutes. This prevents unbounded `Map` growth from rotating client IPs.

### Token Bucket Algorithm

```
refill(bucket):
  elapsed = now - lastRefill
  tokens = min(maxTokens, tokens + elapsed × refillRate)
  lastRefill = now

tryConsume(name, maxTokens, refillPeriodMs):
  bucket = getBucket(name)  // creates if missing
  refill(bucket)
  if tokens ≥ 1: tokens -= 1, return true
  else: return false
```

One multiplication, one comparison per request. No arrays, no timers, no sliding windows.

---

## Input Validation

All API routes share two validators from `rateLimit.ts`:

- **`isValidId(id)`** — Regex `/^[a-zA-Z0-9\-:]+$/`, max 200 chars. The colon allows composite IDs like `spotify:4cOdK2wGLETKBW3PvgPWqT`.
- **`sanitizeQuery(input)`** — Strips HTML tags via `/<[^>]*>/g`, removes `< > " ' &`, trims whitespace, enforces 200-char max.

Every API route follows the same guard pattern:

```typescript
// 1. Rate limit check
if (!checkRouteLimit("song", extractClientIp(request))) {
  return rateLimitResponse();  // 429 + Retry-After: 60
}
// 2. Input validation
if (!isValidId(id)) {
  return Response.json({ error: "Invalid ID" }, { status: 400 });
}
// 3. Business logic
const data = await getSongData(id);
```

---

## Component Architecture

20 client components, each with a single responsibility:

```
Layout (ThemeProvider + Navigation)
├── Home (page.tsx)
│   ├── SearchBar ─── debounced input, keyboard nav, autocomplete dropdown
│   ├── DateSearch ─── "What was #1 on your birthday?" picker
│   ├── FilterBar ─── genre + era filter pills for the trending grid
│   └── Trending Grid ─── 18 curated song cards with SafeImage
│
├── Song Detail (song/[id]/page.tsx)
│   ├── PageStates ─── shared loading spinner + error-with-back-link states
│   ├── SongHeader ─── title, artist, album art, share button
│   ├── PlatformCard ─── card shell with icon utilities (shared by all 4 cards)
│   ├── SpotifyCard / YouTubeCard / BillboardCard / GeniusCard
│   ├── TimelineChart ─── Recharts multi-line performance over time
│   ├── AudioRadarChart ─── Recharts radar (danceability, energy, valence, tempo)
│   ├── SimilarSongs ─── content-based recommendations with match score badges
│   ├── AudioPlayer ─── HTML5 audio with seek bar (Spotify 30s previews)
│   └── ShareCard ─── copy link, X, Facebook + OG preview
│
├── Compare (compare/page.tsx)
│   └── ComparisonView ─── dual song selectors + winner-highlighted metrics table
│
└── Artist (artist/[id]/page.tsx)
    ├── PageStates ─── reused loading/error states (shared with song detail)
    └── ArtistHeader ─── image, stats, top tracks, discography grid, career timeline

Shared utilities:
├── SafeImage ─── next/image wrapper with error fallback to placeholder
└── PlatformCard ─── reusable card frame + platform icon resolver
```

**Dynamic imports**: `AudioRadarChart` is loaded via `next/dynamic` to code-split Recharts' radar dependencies from the main bundle.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/dataFetcher.ts` | Unified data layer — search, retrieve, compare, artist lookup |
| `src/lib/cache.ts` | TTLCache class + search/song cache instances |
| `src/lib/rateLimit.ts` | Token bucket + route limits + input validators |
| `src/lib/spotify.ts` | Spotify OAuth + track/artist/search API client |
| `src/lib/youtube.ts` | YouTube Data API v3 client |
| `src/lib/genius.ts` | Genius API client |
| `src/lib/mockData.ts` | 18 curated songs with full platform data |
| `src/types/index.ts` | TypeScript interfaces for all data shapes |
| `next.config.ts` | Security headers, image CDN allowlists |
