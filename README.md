# Music Time Machine

A comprehensive music intelligence dashboard that lets you search any song and see its complete performance timeline across Spotify, YouTube, Billboard, and Genius.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)

**Live Demo:** [music-time-machine.vercel.app](https://music-time-machine.vercel.app)

## Features

- **Song Search** - Real-time autocomplete search across the music catalog
- **Performance Timeline** - Interactive chart showing how a song performed over time across all platforms
- **Platform Cards** - Detailed breakdowns for each data source:
  - **Spotify** - Streams, popularity score, playlist features, audio features (danceability, energy, valence, tempo)
  - **YouTube** - Views, likes, comments, video thumbnail, publish date
  - **Billboard** - Peak position, weeks on chart, entry position, chart movement visualization
  - **Genius** - Lyrics link, page views, annotation count, song description

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

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

Copy `.env.example` to `.env.local` and add your API keys:

```env
# Spotify API (https://developer.spotify.com/dashboard)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# YouTube Data API (https://console.cloud.google.com/apis/credentials)
YOUTUBE_API_KEY=your_youtube_api_key

# Genius API (https://genius.com/api-clients)
GENIUS_ACCESS_TOKEN=your_genius_access_token

# Set to 'false' to use real APIs instead of mock data
USE_MOCK_DATA=true
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Home page with search
│   ├── song/[id]/page.tsx       # Song dashboard
│   └── api/
│       ├── search/route.ts      # Search API
│       └── song/[id]/route.ts   # Song data API
├── components/
│   ├── SearchBar.tsx            # Autocomplete search
│   ├── SongHeader.tsx           # Song info header
│   ├── TimelineChart.tsx        # Multi-line performance chart
│   ├── SpotifyCard.tsx          # Spotify metrics card
│   ├── YouTubeCard.tsx          # YouTube metrics card
│   ├── BillboardCard.tsx        # Billboard chart card
│   └── GeniusCard.tsx           # Genius lyrics card
├── lib/
│   └── mockData.ts              # Mock song database
└── types/
    └── index.ts                 # TypeScript interfaces
```

## Available Songs (Demo)

The demo includes 10 iconic songs with mock data:

| Song | Artist | Peak Billboard |
|------|--------|----------------|
| Blinding Lights | The Weeknd | #1 |
| bad guy | Billie Eilish | #1 |
| Shape of You | Ed Sheeran | #1 |
| As It Was | Harry Styles | #1 |
| Anti-Hero | Taylor Swift | #1 |
| Uptown Funk | Mark Ronson ft. Bruno Mars | #1 |
| drivers license | Olivia Rodrigo | #1 |
| Dance Monkey | Tones and I | #4 |
| Old Town Road | Lil Nas X | #1 |
| Levitating | Dua Lipa | #2 |

## API Integration

To enable real data, implement the API wrappers in `src/lib/`:

- `spotify.ts` - Spotify Web API integration
- `youtube.ts` - YouTube Data API v3 integration
- `billboard.ts` - Billboard chart scraping (using billboard.py or similar)
- `genius.ts` - Genius API integration

## Roadmap

- [ ] Real Spotify API integration
- [ ] Real YouTube API integration
- [ ] Billboard chart scraping
- [ ] Genius API integration
- [ ] Song comparison feature
- [ ] Date-based search (what was #1 on my birthday?)
- [ ] Artist timeline view
- [ ] Export/share functionality

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.

---

Built with Claude Code
