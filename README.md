# Music Time Machine

A music intelligence dashboard that lets you search any song and explore its complete performance timeline across Spotify, YouTube, Billboard, and Genius. Compare songs head-to-head, explore artist discographies, preview audio, and share discoveries.

![Version](https://img.shields.io/badge/version-v1.0.1-blue?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)

**Live Demo:** [music-time-machine.vercel.app](https://music-time-machine.vercel.app)

---

## Features

### Core
- **Song Search** — Real-time autocomplete with debounced API calls, keyboard navigation, instant results
- **Performance Timeline** — Interactive multi-line chart (Recharts) tracking Spotify, YouTube, and Billboard performance over time
- **Time Machine** — "What was #1 on your birthday?" with historical Billboard data (2019-2024)

### v1.0 New
- **Audio Preview** — 30-second Spotify preview clips with play/pause, seekable progress bar, and album art
- **Song Comparison** — Side-by-side metrics battle (streams, views, chart position, page views) with winner highlighting
- **Artist Pages** — Top tracks, discography grid, career timeline, and aggregate stats
- **Social Sharing** — Share modal (copy link, X, Facebook) with dynamic OG image generation
- **Theme Toggle** — Light/dark mode with Apple Music-inspired design tokens and FOUC prevention

### Platform Integration

| Platform | Metrics |
|----------|---------|
| **Spotify** | Total streams, popularity (0-100), playlist count, audio features (danceability, energy, valence, tempo), 30s preview |
| **YouTube** | Video views, likes, comments, thumbnail, publish date, channel info |
| **Billboard** | Peak position, weeks on chart, entry position/date, chart movement history |
| **Genius** | Lyrics link, page views, annotation count, description, release context |

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Runtime** | React 19 with `use()` hook for async params |
| **Language** | TypeScript 5 (strict mode) |
| **Styling** | Tailwind CSS 4 (`@theme inline` design tokens) |
| **Charts** | Recharts 3 (responsive, customizable) |
| **Animations** | Framer Motion 11 |
| **OG Images** | @vercel/og (Edge Runtime) |
| **Icons** | Lucide React |
| **Testing** | Vitest 3 + Testing Library + jsdom |
| **Deployment** | Vercel (Edge Functions) |

---

## Getting Started

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm, yarn, or pnpm

### Installation

```bash
git clone https://github.com/DareDev256/music-time-machine.git
cd music-time-machine
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Environment Variables

Create `.env.local` in the project root and configure:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
YOUTUBE_API_KEY=your_youtube_api_key
GENIUS_ACCESS_TOKEN=your_genius_access_token

# 'true' = always use mock data (default, no API keys needed)
# 'false' = use real APIs when available, fall back to mock
USE_MOCK_DATA=true
```

See [docs/API_SETUP.md](docs/API_SETUP.md) for detailed API configuration instructions.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home — search + time machine + trending
│   ├── layout.tsx                  # Root layout (ThemeProvider, Navigation, FOUC script)
│   ├── globals.css                 # Tailwind + Apple Music design tokens (light/dark)
│   ├── error.tsx                   # Route-level error boundary with retry
│   ├── global-error.tsx            # Root layout error boundary
│   ├── song/[id]/page.tsx          # Song detail dashboard
│   ├── compare/page.tsx            # Side-by-side song comparison
│   ├── artist/[id]/page.tsx        # Artist profile (tracks, discography, timeline)
│   └── api/
│       ├── search/route.ts         # GET /api/search?q=query (with input sanitization)
│       ├── song/[id]/route.ts      # GET /api/song/:id (with ID validation)
│       ├── compare/route.ts        # GET /api/compare?song1=x&song2=y
│       ├── artist/[id]/route.ts    # GET /api/artist/:id
│       └── og/[id]/route.tsx       # GET /api/og/:id — dynamic OG image (Edge Runtime)
├── components/
│   ├── ThemeProvider.tsx           # React context for light/dark theming
│   ├── Navigation.tsx              # Fixed nav bar with scroll blur + theme toggle
│   ├── SearchBar.tsx               # Autocomplete with keyboard nav (arrow keys + enter)
│   ├── DateSearch.tsx              # "What was #1" time machine input
│   ├── SongHeader.tsx              # Song info + quick stats + external links
│   ├── AudioPlayer.tsx             # Fixed-bottom HTML5 audio player (30s previews)
│   ├── ComparisonView.tsx          # Side-by-side metric cards with winner badges
│   ├── ShareCard.tsx               # Share modal (copy link, X, Facebook)
│   ├── ArtistHeader.tsx            # Artist image, genres, aggregate stats
│   ├── SafeImage.tsx               # next/image wrapper with fallback on error
│   ├── TimelineChart.tsx           # Multi-line Recharts performance graph
│   ├── PlatformCard.tsx            # Reusable card wrapper + StatRow
│   ├── SpotifyCard.tsx             # Spotify metrics + audio feature bars
│   ├── YouTubeCard.tsx             # YouTube video stats
│   ├── BillboardCard.tsx           # Billboard chart history
│   └── GeniusCard.tsx              # Genius lyrics + annotations
├── lib/
│   ├── dataFetcher.ts              # Unified data layer (mock + real API + cache)
│   ├── mockData.ts                 # 18 curated songs with full mock data
│   ├── cache.ts                    # TTL cache with max-size eviction
│   ├── rateLimit.ts                # Token bucket rate limiter per API
│   ├── spotify.ts                  # Spotify Web API client (OAuth 2.0)
│   ├── youtube.ts                  # YouTube Data API v3 client
│   ├── genius.ts                   # Genius API client
│   └── __tests__/
│       ├── cache.test.ts           # TTLCache unit tests
│       └── dataFetcher.test.ts     # Data fetcher integration tests
└── types/
    └── index.ts                    # TypeScript interfaces (SongData, ArtistData, ComparisonData, etc.)
```

---

## API Architecture

The app uses a **hybrid data strategy** — mock data works out of the box, real APIs enrich when configured:

```
Request → API Route (validate + sanitize)
            ↓
        dataFetcher.ts → Check cache (TTL)
            ↓                    ↓
        Cache HIT          Cache MISS
        (return)               ↓
                    Check USE_MOCK_DATA
                    ↓                ↓
              true: mock      false: real APIs
                                     ↓
                         ┌───────────┼───────────┐
                     Spotify    YouTube      Genius
                     (rate limited per token bucket)
                         └───────────┴───────────┘
                                     ↓
                          Merge with mock fallback
                                     ↓
                            Set cache → Return
```

---

## Security

- **HTTP Security Headers** — CSP, HSTS (2-year max-age + preload), X-Content-Type-Options, X-Frame-Options (DENY), Referrer-Policy, Permissions-Policy. Configured in `next.config.ts`
- **Input Validation** — All API routes validate IDs with regex (`/^[a-zA-Z0-9\-:]+$/`) and enforce 200-char max length
- **Query Sanitization** — Search endpoint strips HTML tags, removes dangerous characters (`< > " ' &`), and truncates
- **Rate Limiting** — Token bucket algorithm per API: Spotify 30 req/30s, YouTube 100 req/hr, Genius 50 req/min
- **Response Caching** — TTL cache prevents redundant API calls (search: 5 min, song data: 30 min)
- **Image Safety** — Remote patterns whitelisted for Spotify, YouTube, and Genius CDNs only
- **Media Sources** — CSP `media-src` restricted to Spotify preview CDN (`p.scdn.co`)

---

## Testing

```bash
# Run all tests
npm test

# Run in watch mode
npx vitest --watch
```

**Stack:** Vitest 3 + @testing-library/react + @testing-library/jest-dom + jsdom

**Coverage:**
- `cache.ts` — TTL expiry, max-size eviction, CRUD operations
- `dataFetcher.ts` — Search by title/artist, mock data retrieval, unknown ID handling

Tests mock all external API clients (Spotify, YouTube, Genius) to run fast and offline.

---

## Available Songs

18 curated songs spanning 2014-2024:

| Song | Artist | Year | Peak |
|------|--------|------|------|
| Blinding Lights | The Weeknd | 2019 | #1 |
| bad guy | Billie Eilish | 2019 | #1 |
| Shape of You | Ed Sheeran | 2017 | #1 |
| As It Was | Harry Styles | 2022 | #1 |
| Anti-Hero | Taylor Swift | 2022 | #1 |
| Uptown Funk | Mark Ronson ft. Bruno Mars | 2014 | #1 |
| drivers license | Olivia Rodrigo | 2021 | #1 |
| Dance Monkey | Tones and I | 2019 | #4 |
| Old Town Road | Lil Nas X ft. Billy Ray Cyrus | 2019 | #1 |
| Levitating | Dua Lipa | 2020 | #2 |
| Flowers | Miley Cyrus | 2023 | #1 |
| vampire | Olivia Rodrigo | 2023 | #1 |
| Cruel Summer | Taylor Swift | 2019 | #1 |
| Espresso | Sabrina Carpenter | 2024 | #1 |
| TEXAS HOLD 'EM | Beyonce | 2024 | #1 |
| Die With A Smile | Lady Gaga & Bruno Mars | 2024 | #1 |
| APT. | ROSE & Bruno Mars | 2024 | #1 |

---

## Roadmap

### Completed
- [x] Real Spotify/YouTube/Genius API integration
- [x] Date-based search ("What was #1 on my birthday?")
- [x] Mobile responsive design
- [x] Expanded song catalog (18 songs)
- [x] Song comparison (side-by-side metrics)
- [x] Artist pages (top tracks, discography, career timeline)
- [x] Social sharing (OG images, share modal)
- [x] Audio preview (Spotify 30s clips)
- [x] Theme toggle (light/dark)
- [x] Security hardening (headers, validation, rate limiting, caching)
- [x] Testing infrastructure (Vitest + Testing Library)

### Planned
- [ ] Billboard chart scraping (historical data beyond mock)
- [ ] User accounts + saved songs
- [ ] Real-time trending from Spotify/YouTube
- [ ] Playlist generation from comparison results
- [ ] Audio feature visualization (radar chart)
- [ ] PWA support (offline mode, install prompt)

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed release history.

---

## License

MIT License - feel free to use this project for your own purposes.

---

Built with [Claude Code](https://claude.ai/claude-code)
