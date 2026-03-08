<div align="center">

# 🎵 Music Time Machine

**The full picture of any song's impact — from release day to today.**

One search. Four platforms. Every metric that matters.

[![Version](https://img.shields.io/badge/version-1.21.0-blue?style=flat-square)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/tests-281_passing-brightgreen?style=flat-square)](src/lib/__tests__)
[![Health](https://img.shields.io/badge/health-/api/health-brightgreen?style=flat-square)](src/app/api/health/route.ts)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![Deploy](https://img.shields.io/badge/Live-Vercel-black?style=flat-square&logo=vercel)](https://music-time-machine.vercel.app)

[**Try It Live →**](https://music-time-machine.vercel.app) &nbsp;·&nbsp; [Architecture](docs/ARCHITECTURE.md) &nbsp;·&nbsp; [API Setup](docs/API_SETUP.md) &nbsp;·&nbsp; [Changelog](CHANGELOG.md)

<br>

<table>
<tr>
<td align="center"><strong>30</strong><br><sub>Components</sub></td>
<td align="center"><strong>281</strong><br><sub>Tests</sub></td>
<td align="center"><strong>7</strong><br><sub>API Routes</sub></td>
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
- **Song Journey** — animated vertical milestone timeline showing key moments: release date, music video drop, Billboard chart entry, peak position, and Genius community engagement. Each milestone is chronologically sorted with platform-colored icons and staggered entrance animations
- **Similar Songs** — content-based recommendations powered by weighted Euclidean distance across 4D audio features (danceability, energy ×1.5, valence ×1.5, normalized tempo), with same-era bonus (+8). Color-coded **match score badges** (emerald ≥80%, sky ≥60%, amber ≥40%) render as circular SVG progress rings on each card. **User-configurable preferences** let you tune results by preferred genres, era range (2015–2025), and mood (Upbeat / Chill / Melancholy / Energetic) — persisted to localStorage
- **Diversity-Aware Picks** — same-artist candidates are early-skipped before scoring (parsing `ft.`, `feat.`, `&`, `,`, `with` collaborations), avoiding wasted distance calculations. A greedy selection loop then caps results at one song per artist, ensuring recommendations always surface *new* artists. **Three selection strategies** are available via a toggle: **Auto** (default — inspects top candidates' genre diversity and intelligently switches between best-match and diverse), **Best match** (greedy by score), and **Diverse** (greedy set-cover with marginal diversity bonuses — +25 unseen genre, +15 unseen decade — plus a popularity quality signal that prevents obscure filler from outranking well-known tracks). An **auto-insight indicator** reveals the engine's decision when Auto is active — showing the resolved strategy and genre count detected, with color-coded labels and smooth height-reveal animation. Both the scoring pipeline and diversity metadata are memoized to prevent redundant recomputation on re-renders. A **diversity indicator** bar analyzes the final picks by genre spread (60% weight) and era spread (40% weight, normalized against a fixed 2-decade spread instead of pick count), displaying genre chips with per-genre colors, era span tags, and a scored label (Wide mix / Good variety / Similar vibe / Narrow focus)
- **30-second preview** — seekable audio playback from Spotify

### ⚔️ Compare Tracks
Pick any two songs for a head-to-head metrics battle. Winner highlighting across streams, views, chart peak, weeks on chart, and page views. Tied metrics display with amber highlighting and a summary count.

### ⏰ Time Machine
*"What was #1 on your birthday?"* Enter any date and see the Billboard chart-topper for that month, with historical data spanning 2019–2024.

### 🎤 Artist Profiles
Explore any artist's top tracks, full discography grid, career timeline, and aggregate stats (monthly listeners, total streams).

### 📤 Social Sharing
Dynamic OG image generation via Edge Runtime. Share modal with copy-to-clipboard, X, and Facebook — each shared link renders a rich social preview card with album art and stats.

### 🧭 Responsive Navigation
Full navigation bar with route links (Home, Compare) and active-state highlighting. Desktop shows inline pill-style links; mobile gets a hamburger menu with animated dropdown, backdrop overlay, body scroll lock, and Escape-to-close. WCAG-accessible with `aria-expanded`, `aria-controls`, and keyboard support.

### Keyboard Shortcuts
Press `?` anywhere to reveal a shortcut cheat sheet. Power-user navigation: `/` focuses search, `h` returns home, `t` toggles theme, and on song pages `s` opens share and `c` starts a comparison. A keyboard icon in the nav bar provides discoverability for mouse users. Context-aware — song-page shortcuts are dimmed when not on a song page, and all shortcuts are suppressed when typing in form fields.

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
| **Content-Based Recommendations** | 4D audio feature similarity via extracted `featureDistance()` function with named weight constants (`FEATURE_WEIGHTS`: danceability ×1.0, energy ×1.5, valence ×1.5, tempo ×0.8). Additive bonuses (`SAME_ARTIST_BONUS = 15`, `SAME_ERA_BONUS = 8`) and classification thresholds are module-level constants, making the scoring model auditable and tunable from one place. **Diversity-aware greedy selection** pre-seeds the target's credited artists (parses `ft.`, `&`, `,`, `with` separators with a 2-char guard to avoid splitting `R&B`) and enforces a one-song-per-artist cap. Reason classification uses `classifyReason()` with early-return rules instead of nested ternaries. A `getDiversityMeta()` analyzer scores genre spread (60%) + era spread (40%) across the final picks, producing a 0–100 score with tiered labels. Timezone-safe `safeYear()` with `getUTCFullYear()` prevents era miscalculation from UTC midnight drift. Match scores (0–99%) rendered as circular SVG progress badges with emerald/sky/amber tier colors. |
| **Edge OG Images** | `/api/og/[id]` renders JSX to a 1200×630 PNG via `@vercel/og` (Satori). Sub-100ms, no headless browser. |
| **Fetch Timeout + AbortController** | All outbound API requests enforce a 10s `AbortController` timeout via `safeFetch()` — prevents resource exhaustion from slow upstream responses. Client-side fetches in `useSongData` use a separate `AbortController` that auto-cancels on navigation or unmount, preventing stale-response overwrites. Two layers: server-side protects Node.js connections, client-side protects React state. |
| **Route Middleware** | `withRouteHandler()` wraps all 6 API routes with rate limiting, error handling, and consistent responses — zero boilerplate per route. |

---

## Architecture

```
Client Request ──── useSongData hook (AbortController on nav/unmount)
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
Mock   safeFetch() ── SSRF origin check + 10s timeout
Data       │
           ▼
       Real APIs ── Token Bucket Rate Limiting
       ┌──────────┬────────────┬──────────┐
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
| `GET /api/health` | Runtime health checks, memory, request/error counters, per-subsystem status | — |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Next.js 16** | App Router, Turbopack, Edge Runtime for OG images |
| Runtime | **React 19** | `use()` hook for async params, `useSongData` hook with AbortController cleanup |
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
| **HTTP Headers** | Nonce-based CSP (no `unsafe-inline`, no `unsafe-eval`, `strict-dynamic`), HSTS (2yr + preload), X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP `same-origin`, COEP `credentialless`, X-Permitted-Cross-Domain-Policies `none` |
| **SSRF Protection** | All outbound API requests routed through `safeFetch()` — origin-validated against an explicit allowlist before any request leaves the server. Blocks cloud metadata, internal IPs, `@`-credential tricks, subdomain spoofing, and HTTP downgrades |
| **Input Validation** | Shared `isValidId()` / `sanitizeQuery()` — regex ID check, HTML stripping, dangerous char removal, prototype pollution blocking, 200-char max. Genius ID NaN guard prevents malformed IDs from reaching the API |
| **Rate Limiting** | Per-IP token bucket on all 6 routes (429 + Retry-After + `no-store`), per-upstream-API token buckets, stale bucket eviction, IP format validation to prevent rate limit bypass via spoofed headers |
| **Fetch Timeout** | Two-layer AbortController defense: server-side `safeFetch()` enforces 10s timeouts on all outbound API requests (prevents slow-loris resource exhaustion); client-side `useSongData` hook cancels in-flight fetches on navigation/unmount (prevents stale state overwrites and memory leaks) |
| **Uniform Error Headers** | All API error responses (400, 404, 422, 429, 500) include `nosniff` + `X-Frame-Options: DENY` + `no-store` via `jsonError()` helper — no unprotected JSON responses anywhere in the stack |
| **Href Protocol Validation** | All external URLs from API responses pass through `safeHref()` — only `https:` URLs render as clickable links. Blocks `javascript:`, `data:`, and other dangerous protocols that could enable XSS via compromised API data. Non-HTTPS URLs are suppressed entirely (no inert `#` link rendered) |
| **Input Sanitization** | `sanitizeQuery()` strips null bytes (`\x00`) and unicode control characters (C0/C1 ranges U+0000–U+001F, U+007F–U+009F) before HTML/char filtering — prevents string truncation attacks in downstream parsers and log injection |
| **Permissions Policy** | Locks down 11 browser APIs: camera, microphone, geolocation, payment, USB, Bluetooth, serial, HID, idle detection, screen wake lock, web-share (self only) |
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
├── components/                     # 27 single-responsibility UI components
│   └── PageStates.tsx              # Shared loading/error full-page states
├── hooks/
│   └── useSongData.ts              # Song page data fetching with AbortController
├── lib/
│   ├── timeMachine.ts              # Date-to-chart-#1 matching engine
│   ├── recommendations.ts          # Audio feature similarity engine
│   ├── dataFetcher.ts              # Unified data layer (mock + real + cache)
│   ├── cache.ts                    # TTL cache with max-size eviction
│   ├── rateLimit.ts                # Token bucket rate limiter + input validators
│   ├── apiHandler.ts               # Route middleware (rate limit + error handling)
│   ├── formatNumber.ts              # Shared B/M/K compact number formatter
│   ├── formatDate.ts               # NaN-safe date formatting (replaces 4 inline copies)
│   ├── toSlug.ts                    # URL-safe slug generator (replaces 3 inline copies)
│   ├── timeline.ts                  # Synthetic timeline data generator (deduplicated)
│   ├── safeFetch.ts                 # SSRF-safe fetch with 10s AbortController timeout
│   ├── spotify.ts / youtube.ts / genius.ts
│   └── __tests__/                  # 272 tests across 22 suites
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

**272 tests** across **22 suites** covering:

| Suite | Tests | What's Tested |
|-------|------:|--------------|
| **recommendations** | 59 | Distance ranking, artist/era bonuses, reason labeling, match score validation, artist diversity enforcement, `splitArtists` collaboration parsing, `getDiversityMeta` genre/era scoring, `safeYear` timezone-safe date parsing, `getAutoInsight` strategy resolution |
| **rateLimit** | 30 | Token bucket consumption/refill, per-IP route isolation, stale eviction, input validation (`isValidId`, `sanitizeQuery`) |
| **mockData** | 21 | Catalog integrity, search matching, artist slug resolution, timeline sorting |
| **dataFetcher** | 20 | Search, comparison engine, `lowerWins` inversion, `parseMetric` edge cases, artist lookup, catalog |
| **Time Machine** | 19 | Exact month lookup, zero-padding, closest-month fallback, boundary snapping, data integrity |
| **comparison** | 12 | Winner analysis, tied metrics, head-to-head stat extraction |
| **safeFetch** | 12 | SSRF origin allowlist, 10s timeout enforcement, caller signal precedence, malformed URL rejection |
| **safeHref** | 12 | HTTPS passthrough, `javascript:`/`data:`/`vbscript:`/`http:`/`ftp:`/`file:` blocking, undefined/null/empty/malformed |
| **diversity pipeline** | 10 | End-to-end integration: artist capping, genre spread, era spread, scoring thresholds |
| **formatCompact** | 9 | B/M/K thresholds, numeric string parsing, undefined/null/NaN handling, sub-1000 passthrough |
| **apiHandler** | 8 | Route middleware wrapping, rate limit integration, error response format |
| **TTLCache** | 7 | Expiry, eviction, CRUD operations, `getStats()` observability |
| **QuickStats** | 7 | Empty state, per-platform rendering, number abbreviation, full-data grid, accessibility |
| **useSongData** | 7 | Loading state, parallel fetch, 404/500 handling, network error, catalog-only failure, unmount abort |
| **RecommendationPrefs** | 6 | Genre bonus, era range bonus, mood preset scoring, invalid mood handling, stacked bonuses, empty prefs |
| **timeline** | 6 | Invalid date guard, data point shape, 48-month cap, release anchoring, billboard windowing |
| **toSlug** | 6 | Lowercase/hyphenation, special char stripping, separator collapse, numeric, empty string |
| **formatDate** | 5 | Locale formatting, unparseable date fallback, custom Intl options, empty string, year-only |
| **AudioPlayer** | 5 | Play/pause, unmount cleanup, seek behavior |
| **ComparisonView** | 5 | Side-by-side rendering, winner highlighting, tied metric handling |
| **SearchBar** | 4 | Autocomplete rendering, keyboard navigation |
| **health** | 4 | Cache stats, utilization reporting, zero-maxSize edge case |

External API clients fully mocked — tests run fast and offline.

---

## Contributing

```bash
git checkout -b feature/your-feature
npm test                    # All 272 tests must pass
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
