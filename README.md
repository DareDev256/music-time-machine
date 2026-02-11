<div align="center">

# Music Time Machine

**Track any song's journey across the entire music ecosystem.**

Search any song. See its complete performance timeline across Spotify, YouTube, Billboard, and Genius.
Compare tracks head-to-head. Explore artist discographies. Preview audio. Share discoveries.

[![Version](https://img.shields.io/badge/version-1.1.1-blue?style=flat-square)](CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![Deploy](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)](https://music-time-machine.vercel.app)

[**Live Demo**](https://music-time-machine.vercel.app) &nbsp;·&nbsp; [API Setup Guide](docs/API_SETUP.md) &nbsp;·&nbsp; [Changelog](CHANGELOG.md)

</div>

---

## Why This Exists

Music data lives in silos. Spotify knows streams but not chart history. YouTube has views but no audio features. Billboard tracks positions but not engagement. Genius adds cultural context but no playback data.

**Music Time Machine bridges all four** into one dashboard — so you can see the full picture of any song's impact, from release day to today.

---

## Quick Start

```bash
git clone https://github.com/DareDev256/music-time-machine.git
cd music-time-machine
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). Works immediately with curated mock data — **no API keys required**.

> Want real-time data? Set `USE_MOCK_DATA=false` in `.env.local` and add your keys. See the [API Setup Guide](docs/API_SETUP.md).

---

## Features

| Feature | Description |
|---------|-------------|
| **Song Search** | Real-time autocomplete with debounced API calls, keyboard navigation, instant results |
| **Performance Timeline** | Interactive multi-line chart tracking Spotify streams, YouTube views, and Billboard position over time |
| **Time Machine** | "What was #1 on your birthday?" — historical Billboard lookup (2019–2024) |
| **Song Comparison** | Side-by-side metrics battle with winner highlighting across streams, views, chart peak, and page views |
| **Artist Pages** | Top tracks, discography grid, career timeline, aggregate stats |
| **Audio Preview** | 30-second Spotify clips with seekable progress bar and album art |
| **Social Sharing** | Share modal (copy link, X, Facebook) with dynamic OG image generation via Edge Runtime |
| **Audio DNA Radar** | Interactive radar chart visualizing danceability, energy, happiness, and tempo with auto-detected "vibe" tag |
| **Theme Toggle** | Light/dark mode with Apple Music–inspired design tokens and FOUC prevention |

### Platform Coverage

| Platform | What You Get |
|----------|-------------|
| **Spotify** | Streams, popularity score, playlist count, audio features (danceability, energy, valence, tempo), 30s preview |
| **YouTube** | Video views, likes, comments, thumbnail, publish date, channel info |
| **Billboard** | Peak position, weeks on chart, entry date, full chart movement history |
| **Genius** | Page views, annotation count, lyrics link, description, release context |

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

**Design decisions:**
- **Zero-config startup** — No API keys? App works perfectly with 18 curated songs across all four platforms
- **Graceful degradation** — Configure only some APIs? Those return real data, the rest fall back to mock
- **TTL caching** — Search: 5 min, song data: 30 min. Prevents redundant external calls

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16** — App Router, Turbopack, Edge Runtime |
| Runtime | **React 19** — `use()` hook for async params |
| Language | **TypeScript 5** — strict mode |
| Styling | **Tailwind CSS 4** — `@theme inline` design tokens, Apple Music color palette |
| Charts | **Recharts 3** — responsive multi-line performance timeline |
| Animation | **Framer Motion 11** — page transitions, staggered card reveals |
| OG Images | **@vercel/og** — dynamic social preview cards at the edge |
| Icons | **Lucide React** |
| Testing | **Vitest 3** + Testing Library + jsdom |
| Deploy | **Vercel** — Edge Functions, automatic preview deploys |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home — search + time machine + trending grid
│   ├── layout.tsx                  # Root layout (ThemeProvider, nav, FOUC script)
│   ├── globals.css                 # Tailwind + Apple Music design tokens (light/dark)
│   ├── error.tsx / global-error.tsx # Error boundaries with retry
│   ├── song/[id]/page.tsx          # Song detail dashboard
│   ├── compare/page.tsx            # Side-by-side song comparison
│   ├── artist/[id]/page.tsx        # Artist profile + discography
│   └── api/
│       ├── search/route.ts         # GET /api/search?q=query
│       ├── song/[id]/route.ts      # GET /api/song/:id
│       ├── compare/route.ts        # GET /api/compare?song1=x&song2=y
│       ├── artist/[id]/route.ts    # GET /api/artist/:id
│       └── og/[id]/route.tsx       # Dynamic OG image (Edge Runtime)
├── components/                     # 17 single-responsibility UI components
├── lib/
│   ├── dataFetcher.ts              # Unified data layer (mock + real + cache)
│   ├── mockData.ts                 # 18 curated songs with full platform metrics
│   ├── cache.ts                    # TTL cache with max-size eviction
│   ├── rateLimit.ts                # Token bucket rate limiter per API
│   ├── spotify.ts / youtube.ts / genius.ts  # API clients
│   └── __tests__/                  # Unit + integration tests
└── types/
    └── index.ts                    # TypeScript interfaces
```

---

## Environment Variables

Create `.env.local` in the project root:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
YOUTUBE_API_KEY=your_youtube_api_key
GENIUS_ACCESS_TOKEN=your_genius_access_token

# 'true' = mock data only (default, no keys needed)
# 'false' = real APIs with mock fallback
USE_MOCK_DATA=true
```

| Variable | Required | Source |
|----------|----------|--------|
| `SPOTIFY_CLIENT_ID` | No | [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) |
| `SPOTIFY_CLIENT_SECRET` | No | Same |
| `YOUTUBE_API_KEY` | No | [Google Cloud Console](https://console.cloud.google.com/) |
| `GENIUS_ACCESS_TOKEN` | No | [Genius API Clients](https://genius.com/api-clients) |
| `USE_MOCK_DATA` | No | `true` (default) / `false` |

See [docs/API_SETUP.md](docs/API_SETUP.md) for step-by-step configuration with troubleshooting.

---

## Security

| Layer | Implementation |
|-------|---------------|
| **HTTP Headers** | CSP, HSTS (2yr + preload), X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy |
| **Input Validation** | Regex ID check (`/^[a-zA-Z0-9\-:]+$/`), 200-char max on all API routes |
| **Query Sanitization** | HTML tag stripping, dangerous character removal (`< > " ' &`), length truncation |
| **API Rate Limiting** | Per-IP token bucket on all API routes — 429 with Retry-After on abuse |
| **External Rate Limiting** | Token bucket per upstream API — prevents quota exhaustion |
| **Response Caching** | TTL-based cache reduces external API surface area |
| **Audio URL Validation** | Preview URLs validated against Spotify CDN origin allowlist |
| **Image Allowlist** | Remote patterns restricted to Spotify, YouTube, Genius CDNs only |
| **Media Sources** | CSP `media-src` locked to Spotify preview CDN (`p.scdn.co`) |

---

## Testing

```bash
npm test              # Run all tests
npx vitest --watch    # Watch mode
```

**Coverage:** TTLCache (expiry, eviction, CRUD), dataFetcher (search, retrieval, unknown ID handling). All external API clients mocked for fast, offline execution.

---

## Demo Songs

18 curated tracks spanning 2014–2024, each with full cross-platform mock data:

> Blinding Lights · bad guy · Shape of You · As It Was · Anti-Hero · Uptown Funk · drivers license · Dance Monkey · Old Town Road · Levitating · Flowers · vampire · Cruel Summer · Espresso · TEXAS HOLD 'EM · Die With A Smile · APT.

---

## Roadmap

- [ ] Billboard chart scraping (historical data beyond mock)
- [ ] User accounts + saved songs
- [ ] Real-time trending from Spotify/YouTube APIs
- [ ] Playlist generation from comparison results
- [x] Audio feature radar chart visualization
- [ ] PWA support (offline mode, install prompt)

---

## Contributing

```bash
git checkout -b feature/your-feature
git commit -m 'feat: add your feature'
git push origin feature/your-feature
# Then open a Pull Request
```

---

## License

MIT

---

<div align="center">

Built with [Claude Code](https://claude.ai/claude-code)

</div>
