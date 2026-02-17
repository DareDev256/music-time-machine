<div align="center">

# 🎵 Music Time Machine

**The full picture of any song's impact — from release day to today.**

One search. Four platforms. Every metric that matters.

[![Version](https://img.shields.io/badge/version-1.11.1-blue?style=flat-square)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/tests-194_passing-brightgreen?style=flat-square)](src/lib/__tests__)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![Deploy](https://img.shields.io/badge/Live-Vercel-black?style=flat-square&logo=vercel)](https://music-time-machine.vercel.app)

[**Try It Live →**](https://music-time-machine.vercel.app) &nbsp;·&nbsp; [Architecture](docs/ARCHITECTURE.md) &nbsp;·&nbsp; [API Setup](docs/API_SETUP.md) &nbsp;·&nbsp; [Changelog](CHANGELOG.md)

<br>

<table>
<tr>
<td align="center"><strong>21</strong><br><sub>Components</sub></td>
<td align="center"><strong>177</strong><br><sub>Tests</sub></td>
<td align="center"><strong>6</strong><br><sub>API Routes</sub></td>
<td align="center"><strong>4</strong><br><sub>Platforms</sub></td>
<td align="center"><strong>18</strong><br><sub>Curated Songs</sub></td>
<td align="center"><strong>0</strong><br><sub>Config Required</sub></td>
</tr>
</table>

</div>

---

## The Problem

Music data lives in silos. Spotify knows streams but not chart history. YouTube has views but no audio features. Billboard tracks positions but not engagement. Genius adds cultural context but no playback data.

**Music Time Machine bridges all four** — so when you look up "Blinding Lights," you see 4.6B Spotify streams *and* 770M YouTube views *and* 90 weeks on Billboard *and* the Genius backstory, all on one screen.

---

## Quick Start

```bash
git clone https://github.com/DareDev256/music-time-machine.git
cd music-time-machine
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). Works immediately with 18 curated songs — **no API keys required**.

> Want live data from any song on Spotify? Set `USE_MOCK_DATA=false` and add your keys. See the [API Setup Guide](docs/API_SETUP.md).

---

## Features

### 🔍 Search & Discover
Real-time autocomplete with debounced API calls and keyboard navigation. Results appear instantly with album art thumbnails. The home page shows a trending grid of all 18 curated tracks with **genre and era filters** — tap any pill (Pop, R&B, Country, K-Pop, Alt/Indie, Disco/Dance, Funk) or era (2010s, 2020s) to slice the catalog with animated transitions.

### 📊 Song Dashboard
Every song gets a detail page with:
- **Quick Stats bar** — at-a-glance cross-platform metrics (streams, views, chart peak, weeks, page views) with smart abbreviation (2.4B, 770M) and color-coded icons
- **4 platform cards** — Spotify, YouTube, Billboard, Genius
- **Performance timeline** — multi-line chart tracking metrics over time
- **Audio DNA radar** — auto-detects the song's "vibe" (Groovy, High Energy, Mellow...)
- **Similar Songs** — powered by weighted Euclidean distance across 4D audio features, with color-coded **match score badges** (emerald ≥80%, sky ≥60%, amber ≥40%) and a **diversity indicator** showing genre spread, era span, and a scored label (Wide mix / Good variety / Similar vibe)
- **30-second preview** — seekable audio playback from Spotify

### ⚔️ Compare Tracks
Pick any two songs for a head-to-head metrics battle. Winner highlighting across streams, views, chart peak, weeks on chart, and page views. Tied metrics display with amber highlighting and a summary count.

### ⏰ Time Machine
*"What was #1 on your birthday?"* Enter any date and see the Billboard chart-topper for that month, with historical data spanning 2019–2024.

### 🎤 Artist Profiles
Explore any artist's top tracks, full discography grid, career timeline, and aggregate stats (monthly listeners, total streams).

### 📤 Social Sharing
Dynamic OG image generation via Edge Runtime. Share modal with copy-to-clipboard, X, and Facebook — each shared link renders a rich social preview card with album art and stats.

### 🌓 Theme Toggle
Light/dark mode with Apple Music–inspired design tokens. A blocking `<script>` applies the theme before first paint — zero FOUC.

---

## Engineering Highlights

These are the design decisions that make this more than a CRUD app:

| Pattern | What & Why |
|---------|-----------|
| **Mock-First Architecture** | Starts with realistic mock data for all 18 songs across 4 platforms. Real APIs enrich via `Promise.all` — if any call fails, mock data stays. Zero-config works perfectly, partial config works partially, full config works fully. The consumer never sees an empty state. |
| **Token Bucket Rate Limiting** | Each API gets a token bucket with burst capacity and continuous refill — one multiplication, one comparison per request. Per-IP route limits return 429 with `Retry-After`. Stale buckets auto-evict to prevent memory leaks. |
| **TTL Cache + LRU Eviction** | Generic `TTLCache` using `Map` insertion-order semantics for oldest-first eviction. Search cached 5 min (200 entries), songs cached 30 min (100 entries). Zero external dependencies. |
| **Shared `formatCompact` Utility** | Unified B/M/K number formatting across all 3 API clients (Spotify, YouTube, Genius). Handles `number`, numeric `string`, `undefined`, and `null` inputs — one function instead of three with identical logic. |
| **Content-Based Recommendations** | Weighted Euclidean distance across danceability, energy ×1.5, valence ×1.5, and normalized tempo. Same-era bonus for songs within 2 years. **Diversity-aware selection** pre-seeds the target song's artists and caps at one song per artist — recommendations always surface *new* artists. Match scores (0–99%) rendered as color-coded circular progress badges. |
| **Edge OG Images** | `/api/og/[id]` renders JSX to a 1200×630 PNG via `@vercel/og` (Satori). Sub-100ms, no headless browser. |
| **Route Middleware** | `withRouteHandler()` wraps all 6 API routes with rate limiting, error handling, and consistent responses — zero boilerplate per route. |

---

## Architecture

```
Client Request
     │
     ▼
API Route ──── Validate input (regex ID check, 200-char max)
     │          Sanitize query (strip HTML, remove < > " ' &)
     ▼
dataFetcher ──── TTL Cache hit? ──── YES ──► Return cached
     │
     │ MISS
     ▼
USE_MOCK_DATA?
  ┌──┴──┐
  YES   NO
  │     │
  ▼     ▼
Mock   Real APIs ── Token Bucket Rate Limiting
Data   ┌──────────┬────────────┬──────────┐
       │ Spotify  │  YouTube   │  Genius  │
       │ 30/30s   │  100/hr    │  50/min  │
       └──────────┴────────────┴──────────┘
              │
              ▼
        Merge with mock fallback
              │
              ▼
        Cache result ──► Return
```

### API Routes

| Route | Purpose | Rate Limit |
|-------|---------|-----------|
| `GET /api/search?q=` | Autocomplete search, trending when empty | 20/min |
| `GET /api/song/:id` | Full song data across all four platforms | 30/min |
| `GET /api/compare?song1=&song2=` | Head-to-head metrics with winner analysis | 15/min |
| `GET /api/artist/:id` | Artist profile, top tracks, discography | 30/min |
| `GET /api/catalog` | Full song catalog for recommendations | 10/min |
| `GET /api/og/:id` | Dynamic OG image generation (Edge Runtime) | 10/min |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Next.js 16** | App Router, Turbopack, Edge Runtime for OG images |
| Runtime | **React 19** | `use()` hook for async params (Next.js 16 requirement) |
| Language | **TypeScript 5** | Strict mode — every API boundary is typed |
| Styling | **Tailwind CSS 4** | `@theme inline` design tokens, no config file needed |
| Charts | **Recharts 3** | Responsive timeline + radar chart with custom tooltips |
| Animation | **Framer Motion 11** | Page transitions, staggered card reveals, scroll-aware nav |
| OG Images | **@vercel/og** | JSX-to-PNG at the edge, sub-100ms |
| Testing | **Vitest 3** | + Testing Library + jsdom, fast offline execution |
| Deploy | **Vercel** | Edge Functions, automatic preview deploys |

---

## Security

| Layer | Implementation |
|-------|---------------|
| **HTTP Headers** | Nonce-based CSP (no `unsafe-inline`, no `unsafe-eval`, `strict-dynamic`), HSTS (2yr + preload), X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP `same-origin`, X-Permitted-Cross-Domain-Policies `none` |
| **Input Validation** | Shared `isValidId()` / `sanitizeQuery()` — regex ID check, HTML stripping, dangerous char removal, prototype pollution blocking, 200-char max |
| **Rate Limiting** | Per-IP token bucket on all 6 routes (429 + Retry-After), per-upstream-API token buckets, stale bucket eviction, IP format validation to prevent rate limit bypass via spoofed headers |
| **CDN Allowlists** | Remote images restricted to Spotify/YouTube/Genius CDNs; `media-src` locked to `p.scdn.co`; audio URLs validated against origin allowlist |
| **Accessibility** | ARIA combobox pattern on search (listbox + options + activedescendant), focus-trapped modal dialogs with Escape dismiss, keyboard-navigable audio seek slider, dynamic aria-labels on all interactive controls |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home — search + time machine + trending grid
│   ├── layout.tsx                  # Root layout (ThemeProvider, nav, FOUC script)
│   ├── song/[id]/page.tsx          # Song detail dashboard
│   ├── compare/page.tsx            # Side-by-side song comparison
│   ├── artist/[id]/page.tsx        # Artist profile + discography
│   └── api/                        # 6 routes, all using withRouteHandler middleware
├── components/                     # 21 single-responsibility UI components
├── lib/
│   ├── timeMachine.ts              # Date-to-chart-#1 matching engine
│   ├── recommendations.ts          # Audio feature similarity engine
│   ├── dataFetcher.ts              # Unified data layer (mock + real + cache)
│   ├── cache.ts                    # TTL cache with max-size eviction
│   ├── rateLimit.ts                # Token bucket rate limiter + input validators
│   ├── apiHandler.ts               # Route middleware (rate limit + error handling)
│   ├── formatNumber.ts              # Shared B/M/K compact number formatter
│   ├── spotify.ts / youtube.ts / genius.ts
│   └── __tests__/                  # 150 tests across 11 suites
└── types/index.ts                  # TypeScript interfaces for all data shapes
```

---

## Environment Variables

All optional — the app works with zero configuration.

```bash
cp .env.example .env.local
```

```env
SPOTIFY_CLIENT_ID=          # developer.spotify.com/dashboard
SPOTIFY_CLIENT_SECRET=      # same
YOUTUBE_API_KEY=            # console.cloud.google.com
GENIUS_ACCESS_TOKEN=        # genius.com/api-clients
USE_MOCK_DATA=true          # false = real APIs with mock fallback
```

See [docs/API_SETUP.md](docs/API_SETUP.md) for step-by-step setup with troubleshooting.

---

## Testing

```bash
npm test              # Run all tests
npx vitest --watch    # Watch mode
```

**186 tests** across **13 suites** covering:

| Suite | What's Tested |
|-------|--------------|
| **TTLCache** | Expiry, eviction, CRUD operations |
| **dataFetcher** | Search, comparison engine, `lowerWins` inversion, `parseMetric` edge cases, artist lookup, catalog |
| **mockData** | Catalog integrity, search matching, artist slug resolution, timeline sorting |
| **recommendations** | Distance ranking, artist/era bonuses, reason labeling, match score validation, artist diversity enforcement |
| **rateLimit** | Token bucket consumption/refill, per-IP route isolation, stale eviction |
| **input validation** | `isValidId`, `sanitizeQuery` |
| **Time Machine** | Exact month lookup, zero-padding, closest-month fallback, boundary snapping, data integrity |
| **AudioPlayer** | Play/pause, unmount cleanup, seek behavior |
| **SearchBar** | Autocomplete rendering, keyboard navigation |
| **formatCompact** | B/M/K thresholds, numeric string parsing, undefined/null/NaN handling, sub-1000 passthrough |
| **QuickStats** | Empty state, per-platform rendering, number abbreviation, full-data grid, accessibility |

External API clients fully mocked — tests run fast and offline.

---

## Contributing

```bash
git checkout -b feature/your-feature
npm test                    # All 141 tests must pass
npm run lint                # Zero warnings
npm run build               # Clean production build
```

The codebase follows strict patterns:
- **API routes** — wrap with `withRouteHandler()`, no raw try/catch
- **Data fetching** — all reads go through `dataFetcher.ts`, never direct API calls from components
- **Styling** — semantic tokens (`bg-background`, `text-foreground`), never hardcoded colors
- **Types** — every API boundary typed in `types/index.ts`

---

## Roadmap

- [ ] Billboard chart scraping (historical data beyond mock)
- [ ] User accounts + saved songs
- [ ] Real-time trending from Spotify/YouTube APIs
- [ ] Playlist generation from comparison results
- [x] Audio feature radar chart visualization
- [ ] PWA support (offline mode, install prompt)

---

## License

MIT

---

<div align="center">

Built with [Claude Code](https://claude.ai/claude-code)

</div>
