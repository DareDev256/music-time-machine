# Music Time Machine

A comprehensive music intelligence dashboard that lets you search any song and see its complete performance timeline across Spotify, YouTube, Billboard, and Genius.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)

**Live Demo:** [music-time-machine.vercel.app](https://music-time-machine.vercel.app)

---

## Features

### Core Features
- **Song Search** - Real-time autocomplete search with debounced API calls, keyboard navigation (arrow keys + enter), and instant results
- **Performance Timeline** - Interactive multi-line chart (Recharts) showing how a song performed over time across Spotify, YouTube, and Billboard
- **Time Machine** - "What was #1 on your birthday?" feature with historical Billboard #1 data from 2019-2024

### Platform Integration Cards
Each song displays detailed metrics from four major platforms:

| Platform | Metrics |
|----------|---------|
| **Spotify** | Total streams, popularity score (0-100), playlist features, audio analysis (danceability, energy, valence, tempo) |
| **YouTube** | Video views, likes, comments, thumbnail, publish date, channel info |
| **Billboard** | Peak position, weeks on chart, entry position, entry date, historical chart movement |
| **Genius** | Lyrics link, page views, annotation count, song description, release context |

### Technical Features
- **Hybrid Data Architecture** - Real APIs seamlessly enrich mock data when configured; graceful fallback ensures the app always works
- **Mobile-First Design** - Fully responsive with touch-friendly interactions, optimized grids, and adaptive typography
- **Type-Safe** - Full TypeScript coverage with strict mode enabled

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Runtime** | React 19 with `use()` hook for async params |
| **Language** | TypeScript 5 (strict mode) |
| **Styling** | Tailwind CSS 4 |
| **Charts** | Recharts (responsive, customizable) |
| **Icons** | Lucide React |
| **Deployment** | Vercel (Edge Functions ready) |

---

## Getting Started

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/music-time-machine.git
cd music-time-machine

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```env
# Spotify API (https://developer.spotify.com/dashboard)
# Create an app -> Copy Client ID and Secret
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# YouTube Data API v3 (https://console.cloud.google.com/apis/credentials)
# Enable YouTube Data API v3 -> Create API Key
YOUTUBE_API_KEY=your_youtube_api_key

# Genius API (https://genius.com/api-clients)
# Create API Client -> Generate Access Token
GENIUS_ACCESS_TOKEN=your_genius_access_token

# Mock Data Mode
# 'true' = always use mock data (default, no API keys needed)
# 'false' = use real APIs when available, fall back to mock
USE_MOCK_DATA=true
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Home page with search + time machine
│   ├── layout.tsx               # Root layout with metadata
│   ├── globals.css              # Tailwind imports + custom styles
│   ├── song/[id]/page.tsx       # Song detail dashboard
│   └── api/
│       ├── search/route.ts      # Search API (GET /api/search?q=query)
│       └── song/[id]/route.ts   # Song data API (GET /api/song/:id)
├── components/
│   ├── SearchBar.tsx            # Autocomplete with keyboard nav
│   ├── DateSearch.tsx           # "What was #1" time machine
│   ├── SongHeader.tsx           # Song info + quick stats + external links
│   ├── TimelineChart.tsx        # Multi-line Recharts performance graph
│   ├── PlatformCard.tsx         # Reusable card wrapper + StatRow
│   ├── SpotifyCard.tsx          # Spotify metrics + audio features bars
│   ├── YouTubeCard.tsx          # YouTube video stats
│   ├── BillboardCard.tsx        # Billboard chart history
│   └── GeniusCard.tsx           # Genius lyrics + annotations
├── lib/
│   ├── mockData.ts              # 18 curated songs with full mock data
│   ├── dataFetcher.ts           # Unified data layer (mock + real APIs)
│   ├── spotify.ts               # Spotify Web API client (OAuth)
│   ├── youtube.ts               # YouTube Data API v3 client
│   └── genius.ts                # Genius API client
└── types/
    └── index.ts                 # TypeScript interfaces for all data
```

---

## Available Songs

The demo includes 18 iconic songs spanning 2014-2024:

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

## API Architecture

The app uses a **hybrid data strategy**:

```
Request -> dataFetcher.ts -> Check USE_MOCK_DATA
                               |
            ┌──────────────────┴──────────────────┐
            │                                      │
      USE_MOCK=true                          USE_MOCK=false
            │                                      │
      Return mock data              Fetch from real APIs
                                           │
                                    ┌──────┼──────┐
                                    │      │      │
                                Spotify YouTube Genius
                                    │      │      │
                                    └──────┴──────┘
                                           │
                                  Merge with mock fallback
```

Each API client:
- **Spotify** (`spotify.ts`) - OAuth 2.0 client credentials flow with automatic token refresh
- **YouTube** (`youtube.ts`) - YouTube Data API v3 with search + video details
- **Genius** (`genius.ts`) - Bearer token authentication with song search + details

---

## Roadmap

### Completed
- [x] Real Spotify API integration
- [x] Real YouTube API integration
- [x] Genius API integration
- [x] Date-based search ("What was #1 on my birthday?")
- [x] Mobile responsive design
- [x] Expanded song catalog (18 songs)

### Planned
- [ ] Billboard chart scraping (historical data)
- [ ] Song comparison feature (side-by-side)
- [ ] Artist timeline view (all songs by artist)
- [ ] Export/share functionality (social cards)
- [ ] User accounts + saved songs
- [ ] Real-time trending from Spotify/YouTube

---

## Changelog

### v0.3.0 (2025-01-25)
**Major Update: API Integration + Time Machine**
- Added real API clients for Spotify, YouTube, and Genius
- Created unified data fetcher with graceful fallback
- Added "Time Machine" birthday search feature
- Expanded song catalog from 10 to 18 songs
- Full mobile responsiveness overhaul
- Updated to Next.js 16, React 19, Tailwind 4

### v0.2.0 (2025-01-21)
**Content Expansion**
- Added 5 more songs: Uptown Funk, drivers license, Dance Monkey, Old Town Road, Levitating
- Improved mock data quality with realistic metrics

### v0.1.0 (2025-01-21)
**Initial Release**
- Core dashboard with search functionality
- Song detail pages with platform cards
- Performance timeline chart
- 5 initial songs with mock data
- Responsive design foundation

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - feel free to use this project for your own purposes.

---

Built with [Claude Code](https://claude.ai/claude-code)
