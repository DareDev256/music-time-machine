# Music Time Machine

**Search any song. See its journey across the entire music ecosystem.**

A full-stack music intelligence dashboard that unifies real-time data from Spotify, YouTube, Billboard, and Genius into a single interactive timeline. Compare tracks head-to-head, explore artist discographies, preview audio, and share discoveries — all with production-grade security and zero-config setup.

[![Version](https://img.shields.io/badge/version-1.0.2-blue?style=flat-square)](CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)](https://music-time-machine.vercel.app)

**[Live Demo](https://music-time-machine.vercel.app)**

---

## What It Does

| Feature | Description |
|---------|-------------|
| **Song Search** | Real-time autocomplete with debounced API calls, keyboard navigation (arrow keys + enter), instant results |
| **Performance Timeline** | Interactive multi-line chart tracking Spotify streams, YouTube views, and Billboard position over time |
| **Time Machine** | "What was #1 on your birthday?" — historical Billboard lookup (2019-2024) |
| **Audio Preview** | 30-second Spotify clips with seekable progress bar, album art, play/pause controls |
| **Song Comparison** | Side-by-side metrics battle with winner highlighting across streams, views, chart position, and page views |
| **Artist Pages** | Top tracks, discography grid, career timeline, and aggregate stats |
| **Social Sharing** | Share modal (copy link, X, Facebook) with dynamic OG image generation via Edge Runtime |
| **Theme Toggle** | Light/dark mode with Apple Music-inspired design tokens and FOUC prevention |

### Platform Coverage

| Platform | What You Get |
|----------|-------------|
| **Spotify** | Total streams, popularity score, playlist count, audio features (danceability, energy, valence, tempo), 30s preview |
| **YouTube** | Video views, likes, comments, thumbnail, publish date, channel info |
| **Billboard** | Peak position, weeks on chart, entry date, chart movement history |
| **Genius** | Lyrics link, page views, annotation count, description, release context |

---

## Architecture

The app uses a **hybrid data strategy** — works out of the box with curated mock data, enriches with real APIs when configured:

```
Client Request
     │
     ▼
API Route ──── Validate input (regex ID check, 200-char limit)
     │          Sanitize query (strip HTML, remove < > " ' &)
     │
     ▼
dataFetcher ──── TTL Cache hit? ──── YES ──► Return cached
     │
     │ MISS
     ▼
USE_MOCK_DATA?
     │
  ┌──┴──┐
  YES   NO
  │     │
  ▼     ▼
Mock   Real APIs (rate-limited per token bucket)
Data   ┌──────┬──────────┬────────┐
       │ Spotify  YouTube   Genius │
       └──────┴──────────┴────────┘
              │
              ▼
        Merge with mock fallback
              │
              ▼
        Cache result ──► Return
```

**Key engineering decisions:**
- **Graceful degradation** — No API keys? App still works perfectly with 18 curated songs
- **Token bucket rate limiting** — Spotify 30 req/30s, YouTube 100 req/hr, Genius 50 req/min
- **TTL caching** — Search results: 5 min, song data: 30 min (prevents redundant API calls)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16** — App Router, Turbopack, Edge Runtime |
| Runtime | **React 19** — `use()` hook for async params |
| Language | **TypeScript 5** — Strict mode |
| Styling | **Tailwind CSS 4** — `@theme inline` design tokens (light/dark) |
| Charts | **Recharts 3** — Multi-line normalized timeline |
| Animation | **Framer Motion 11** — Page transitions, card animations |
| OG Images | **@vercel/og** — Dynamic social preview images at the edge |
| Icons | **Lucide React** |
| Testing | **Vitest 3** + Testing Library + jsdom |
| Deploy | **Vercel** — Edge Functions, serverless |

---

## Quick Start

```bash
git clone https://github.com/DareDev256/music-time-machine.git
cd music-time-machine
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app works immediately with mock data — no API keys required.

### Environment Variables (optional)

To enable real API data, create `.env.local`:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
YOUTUBE_API_KEY=your_youtube_api_key
GENIUS_ACCESS_TOKEN=your_genius_access_token

# 'true' = mock data only (default, no keys needed)
# 'false' = real APIs with mock fallback
USE_MOCK_DATA=true
```

See [docs/API_SETUP.md](docs/API_SETUP.md) for step-by-step API configuration.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home — search + time machine + trending
│   ├── layout.tsx                  # Root layout (ThemeProvider, nav, FOUC script)
│   ├── globals.css                 # Tailwind + Apple Music design tokens
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
├── components/                     # 16 single-responsibility UI components
├── lib/
│   ├── dataFetcher.ts              # Unified data layer (mock + real + cache)
│   ├── mockData.ts                 # 18 curated songs with full metrics
│   ├── cache.ts                    # TTL cache with max-size eviction
│   ├── rateLimit.ts                # Token bucket rate limiter per API
│   ├── spotify.ts / youtube.ts / genius.ts  # API clients
│   └── __tests__/                  # Unit + integration tests
└── types/
    └── index.ts                    # TypeScript interfaces
```

---

## Security

This project implements production-grade security hardening:

| Layer | Implementation |
|-------|---------------|
| **HTTP Headers** | CSP, HSTS (2yr + preload), X-Content-Type-Options, X-Frame-Options (DENY), Referrer-Policy, Permissions-Policy |
| **Input Validation** | Regex ID validation (`/^[a-zA-Z0-9\-:]+$/`), 200-char max on all API routes |
| **Query Sanitization** | HTML tag stripping, dangerous character removal (`< > " ' &`), length truncation |
| **Rate Limiting** | Token bucket per API — prevents abuse and quota exhaustion |
| **Caching** | TTL-based response cache — reduces external API surface |
| **Image Allowlist** | Remote patterns restricted to Spotify, YouTube, and Genius CDNs only |
| **Media Sources** | CSP `media-src` locked to Spotify preview CDN (`p.scdn.co`) |

---

## Testing

```bash
npm test              # Run all tests
npx vitest --watch    # Watch mode
```

**Coverage:** TTLCache (expiry, eviction, CRUD) and dataFetcher (search, retrieval, fallback). All external APIs mocked for fast, offline execution.

---

## Available Songs

18 curated tracks spanning 2014-2024, each with full cross-platform mock data:

> Blinding Lights, bad guy, Shape of You, As It Was, Anti-Hero, Uptown Funk, drivers license, Dance Monkey, Old Town Road, Levitating, Flowers, vampire, Cruel Summer, Espresso, TEXAS HOLD 'EM, Die With A Smile, APT.

---

## Roadmap

- [ ] Billboard chart scraping (historical data beyond mock)
- [ ] User accounts + saved songs
- [ ] Real-time trending from Spotify/YouTube
- [ ] Playlist generation from comparison results
- [ ] Audio feature radar chart visualization
- [ ] PWA support (offline mode, install prompt)

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT

---

Built with [Claude Code](https://claude.ai/claude-code)
