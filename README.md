<div align="center">

# Music Time Machine

**The full picture of any song's impact — from release day to today.**

One search. Four platforms. Every metric that matters.
Spotify streams, YouTube views, Billboard chart position, Genius cultural context — unified in a single dashboard.

[![Version](https://img.shields.io/badge/version-1.5.2-blue?style=flat-square)](CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![Deploy](https://img.shields.io/badge/Live-Vercel-black?style=flat-square&logo=vercel)](https://music-time-machine.vercel.app)

[**Try It Live**](https://music-time-machine.vercel.app) &nbsp;·&nbsp; [Architecture](docs/ARCHITECTURE.md) &nbsp;·&nbsp; [API Setup](docs/API_SETUP.md) &nbsp;·&nbsp; [Changelog](CHANGELOG.md)

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

> Want real-time data from any song on Spotify? Set `USE_MOCK_DATA=false` and add your keys. See the [API Setup Guide](docs/API_SETUP.md).

---

## What You Can Do

**Search & Discover** — Real-time autocomplete with debounced API calls and keyboard navigation. Results appear instantly with album art thumbnails. No query? The home page shows a trending grid of all 18 curated tracks with **genre and era filters** — click any pill (Pop, R&B, Country, K-Pop, Alt/Indie, Disco/Dance, Funk) or era (2010s, 2020s) to slice the catalog instantly, with animated transitions between filter states.

**Song Dashboard** — Every song gets a detail page with four platform cards (Spotify, YouTube, Billboard, Genius), a performance timeline chart tracking metrics over time, an Audio DNA radar chart that auto-detects the song's "vibe" (Groovy, High Energy, Mellow...), a **Similar Songs** section powered by audio feature similarity (weighted Euclidean distance across danceability, energy, valence, and tempo), and a 30-second audio preview with seekable playback.

**Compare Tracks** — Pick any two songs for a head-to-head metrics battle. Winner highlighting across streams, views, chart peak, weeks on chart, and page views. Tied metrics now display with amber highlighting and a summary count. Click-outside dismissal on the song search dropdowns.

**Time Machine** — "What was #1 on your birthday?" Enter a date and see the Billboard chart-topper for that month, with full historical data spanning 2019–2024.

**Artist Profiles** — Explore any artist's top tracks, full discography grid, career timeline, and aggregate stats (monthly listeners, total streams).

**Share** — Dynamic OG image generation via Edge Runtime. Share modal with copy-to-clipboard, X, and Facebook — each shared link renders a rich social preview card with album art and stats.

**Theme Toggle** — Light/dark mode with Apple Music–inspired design tokens. A blocking `<script>` applies the theme before first paint — zero FOUC.

---

## Engineering Highlights

These are the design decisions that make this more than a CRUD app:

**Mock-First Architecture** — The app starts with complete, realistic mock data for all 18 songs across all four platforms. When real APIs are configured, `dataFetcher.ts` enriches mock data with live responses via `Promise.all`. If any API call fails, mock data stays. This means: zero-config works perfectly, partial config works partially, full config works fully. The consumer never sees an empty state.

**Token Bucket Rate Limiting** — Instead of simple request counting with windowed cleanup, each API gets a token bucket with burst capacity and continuous refill. One multiplication, one comparison per request — no arrays, no timers. Per-IP route limits return 429 with `Retry-After`. Stale buckets auto-evict to prevent memory leaks.

**TTL Cache with LRU Eviction** — A generic `TTLCache` class using `Map` insertion-order semantics for oldest-first eviction. Search results cached 5 min (200 entries), song data cached 30 min (100 entries). Eliminates redundant external API calls without external dependencies.

**Content-Based Recommendations** — `recommendations.ts` computes weighted Euclidean distance across a 4D audio feature space (danceability, energy 1.5x, valence 1.5x, normalized tempo). Additive bonuses for same-artist and same-era matches prevent the algorithm from only surfacing sonically identical tracks. Zero external dependencies, runs entirely on the existing mock catalog.

**Edge-Generated OG Images** — `/api/og/[id]` runs on Vercel's Edge Runtime using `@vercel/og` (Satori under the hood). Renders JSX to a 1200x630 PNG with album art, song title, and key stats. Sub-100ms, no headless browser.

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

**6 API routes**, each wrapped in `withRouteHandler()` middleware for automatic rate limiting, error handling, and consistent responses:

| Route | Purpose |
|-------|---------|
| `GET /api/search?q=` | Autocomplete search, returns trending when empty |
| `GET /api/song/:id` | Full song data across all four platforms |
| `GET /api/compare?song1=&song2=` | Head-to-head metrics with winner analysis |
| `GET /api/artist/:id` | Artist profile, top tracks, discography |
| `GET /api/catalog` | Full song catalog for recommendations |
| `GET /api/og/:id` | Dynamic OG image generation (Edge Runtime) |

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
| **HTTP Headers** | CSP (no `unsafe-eval`), HSTS (2yr + preload), X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP `same-origin`, X-Permitted-Cross-Domain-Policies `none` |
| **Input Validation** | Shared `isValidId()` / `sanitizeQuery()` — regex ID check, HTML stripping, dangerous char removal, 200-char max |
| **Rate Limiting** | Per-IP token bucket on all 5 routes (429 + Retry-After), per-upstream-API token buckets, stale bucket eviction |
| **CDN Allowlists** | Remote images restricted to Spotify/YouTube/Genius CDNs; `media-src` locked to `p.scdn.co`; audio URLs validated against origin allowlist |

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
├── components/                     # 19 single-responsibility UI components
├── lib/
│   ├── recommendations.ts          # Audio feature similarity engine
│   ├── dataFetcher.ts              # Unified data layer (mock + real + cache)
│   ├── cache.ts                    # TTL cache with max-size eviction
│   ├── rateLimit.ts                # Token bucket rate limiter + input validators
│   ├── apiHandler.ts               # Route middleware (rate limit + error handling)
│   ├── spotify.ts / youtube.ts / genius.ts
│   └── __tests__/                  # Unit + integration tests
└── types/index.ts                  # TypeScript interfaces for all data shapes
```

---

## Environment Variables

All optional — the app works with zero configuration. Copy `.env.example` to `.env.local` to get started.

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

**93 tests** across 8 suites. Coverage: TTLCache (expiry, eviction, CRUD), dataFetcher (search, comparison engine with `lowerWins` inversion, `parseMetric` edge cases, artist lookup, catalog), mock data module (catalog integrity, search matching, artist slug resolution, timeline sorting), recommendations engine (distance ranking, artist/era bonuses, reason labeling), rate limiter (token bucket consumption/refill, per-IP route isolation, stale eviction), input validation (`isValidId`, `sanitizeQuery`). External API clients fully mocked for fast, offline execution.

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
