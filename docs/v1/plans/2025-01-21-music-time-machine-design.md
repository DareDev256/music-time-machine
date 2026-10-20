# Music Time Machine Dashboard - Design Document

## Overview

A comprehensive music intelligence dashboard that lets you search any song and see its complete performance timeline across multiple platforms. Way beyond the basic "Musical Time Machine" - this is a full cross-platform analytics dashboard.

## Core Concept

**Search a song → See its entire life story across the music ecosystem**

- When did it chart on Billboard?
- How did Spotify streams grow over time?
- When did the YouTube video drop and how did views accumulate?
- What's the cultural context from Genius?

## Data Sources

| Platform | API/Method | Data Points |
|----------|------------|-------------|
| Spotify | Official API | Streams, popularity score, playlist features, audio features |
| YouTube | Data API v3 | View counts, publish date, trending history, comments |
| Billboard | `billboard.py` | Chart positions over time (Hot 100, genre charts) |
| Genius | Official API | Lyrics, annotations, song/album info, artist details |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **API Layer**: Next.js API routes (hides keys, handles caching)
- **Deployment**: Vercel

## UI Architecture

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  🎵 Music Time Machine                    [Search Bar]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SONG HEADER                                            │
│  ┌─────────┐  Title - Artist                           │
│  │ Album   │  Album • Release Date                     │
│  │ Art     │  Quick stats: Peak Billboard, Total Views │
│  └─────────┘                                            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  TIMELINE GRAPH (Horizontal, multi-line)               │
│  ┌─────────────────────────────────────────────────┐   │
│  │     📈                                           │   │
│  │   /    \___      ← Spotify Streams (green)      │   │
│  │  /         \__   ← YouTube Views (red)          │   │
│  │ /             \  ← Billboard Position (blue)    │   │
│  └─────────────────────────────────────────────────┘   │
│  [2020]─────[2021]─────[2022]─────[2023]─────[2024]    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  PLATFORM CARDS (Grid)                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │   SPOTIFY    │ │   YOUTUBE    │ │  BILLBOARD   │   │
│  │ 1.2B streams │ │ 890M views   │ │ Peak: #1     │   │
│  │ Pop: 85/100  │ │ Published:   │ │ Weeks: 42    │   │
│  │ In 450 lists │ │ 2020-03-15   │ │ Entry: #67   │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
│  ┌──────────────┐                                      │
│  │   GENIUS     │                                      │
│  │ 1.2M views   │                                      │
│  │ 45 annotat.  │                                      │
│  │ [View Lyrics]│                                      │
│  └──────────────┘                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Pages

1. **Home (`/`)** - Hero with search bar, trending songs, recent searches
2. **Song Detail (`/song/[id]`)** - Full dashboard for a specific song
3. **Compare (`/compare`)** - Side-by-side comparison of 2-3 songs (stretch goal)

## API Routes

```
/api/search?q={query}     → Search across platforms, return unified results
/api/song/[id]            → Get full song data from all platforms
/api/spotify/track/[id]   → Spotify-specific data
/api/youtube/video/[id]   → YouTube-specific data
/api/billboard/chart      → Billboard chart data
/api/genius/song/[id]     → Genius lyrics and annotations
```

## Data Flow

```
User searches "Blinding Lights"
        ↓
Frontend calls /api/search?q=Blinding+Lights
        ↓
API route queries Spotify Search API
        ↓
Returns list of matching tracks with Spotify IDs
        ↓
User clicks a result
        ↓
Navigate to /song/[spotify-id]
        ↓
Page calls /api/song/[id] which:
  - Fetches Spotify track data
  - Searches YouTube for official video
  - Queries billboard.py for chart history
  - Fetches Genius song info
        ↓
All data combined and returned
        ↓
Frontend renders timeline + platform cards
```

## Component Structure

```
src/
├── app/
│   ├── page.tsx                 # Home with search
│   ├── song/[id]/page.tsx       # Song dashboard
│   └── api/
│       ├── search/route.ts
│       ├── song/[id]/route.ts
│       ├── spotify/[...]/route.ts
│       ├── youtube/[...]/route.ts
│       ├── billboard/route.ts
│       └── genius/[...]/route.ts
├── components/
│   ├── SearchBar.tsx
│   ├── SongHeader.tsx
│   ├── TimelineChart.tsx        # Multi-line Recharts graph
│   ├── PlatformCard.tsx         # Reusable card component
│   ├── SpotifyCard.tsx
│   ├── YouTubeCard.tsx
│   ├── BillboardCard.tsx
│   └── GeniusCard.tsx
├── lib/
│   ├── spotify.ts               # Spotify API wrapper
│   ├── youtube.ts               # YouTube API wrapper
│   ├── billboard.ts             # Billboard scraping logic
│   ├── genius.ts                # Genius API wrapper
│   └── unified.ts               # Combines all sources
└── types/
    └── index.ts                 # TypeScript interfaces
```

## Environment Variables

```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
YOUTUBE_API_KEY=
GENIUS_ACCESS_TOKEN=
```

## Implementation Phases

### Phase 1: Foundation
- [ ] Initialize Next.js project with Tailwind
- [ ] Set up project structure
- [ ] Create basic layout and navigation
- [ ] Implement search bar UI

### Phase 2: Spotify Integration
- [ ] Set up Spotify API authentication (Client Credentials flow)
- [ ] Implement track search
- [ ] Implement track details fetch
- [ ] Create SpotifyCard component

### Phase 3: YouTube Integration
- [ ] Set up YouTube Data API
- [ ] Search for music videos by track name + artist
- [ ] Fetch video statistics
- [ ] Create YouTubeCard component

### Phase 4: Billboard Integration
- [ ] Implement billboard chart fetching (billboard.py or custom scraper)
- [ ] Parse chart history for a song
- [ ] Create BillboardCard component

### Phase 5: Genius Integration
- [ ] Set up Genius API
- [ ] Fetch song info and lyrics
- [ ] Create GeniusCard component

### Phase 6: Timeline Visualization
- [ ] Install and configure Recharts
- [ ] Create TimelineChart component
- [ ] Normalize data across platforms for consistent timeline
- [ ] Add interactivity (hover, zoom)

### Phase 7: Polish & Deploy
- [ ] Loading states and skeletons
- [ ] Error handling
- [ ] Mobile responsiveness
- [ ] Deploy to Vercel

## API Keys Needed

1. **Spotify**: https://developer.spotify.com/dashboard
2. **YouTube**: https://console.cloud.google.com/apis/credentials
3. **Genius**: https://genius.com/api-clients

## Success Criteria

- Search any popular song and see unified data within 3 seconds
- Timeline graph shows all available platform data overlaid
- Each platform card shows relevant metrics
- Works on mobile and desktop
- Deployed and shareable

---

*Design created: 2025-01-21*
*Status: Ready for implementation*
