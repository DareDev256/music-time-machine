# FOR_DARE.md — Music Time Machine

## 1. What This Thing Actually Does

Music Time Machine is a music analytics dashboard. You search for a song, and it pulls together performance data from Spotify, YouTube, Billboard, and Genius into a single view. Think of it as a "stats page" for any song — streams, views, chart position, lyrics context, all in one place.

The bigger picture: music data is fragmented across platforms. Spotify shows streams but not YouTube views. Billboard shows chart position but not streaming context. This aggregates all of it, adds a performance timeline chart, and lets you compare songs head-to-head or explore an artist's full catalog.

**Who cares:** Music nerds, data visualization enthusiasts, anyone building portfolio projects that demonstrate real API integration patterns. Also useful as a reference implementation for Next.js 16 App Router with multiple external APIs.

**v1.0 ships:** Audio preview (30s Spotify clips), song comparison, artist pages, social sharing with dynamic OG images, Apple Music-inspired redesign with light/dark theming, and a proper security layer.

---

## 2. Architecture in Human Terms

The data flow is straightforward:

**User searches** -> `SearchBar` component fires debounced fetch to `/api/search` -> API route sanitizes input, calls `dataFetcher.searchSongs()` -> dataFetcher checks TTL cache first, then either returns mock data or queries real APIs (Spotify, Genius) -> results merge mock + real, deduplicated by title -> cached and returned.

**User clicks a song** -> `/song/[id]/page.tsx` fetches from `/api/song/:id` -> API route validates the ID format (regex + length cap) -> dataFetcher resolves the song: if the ID is `spotify:xxx` it goes directly to Spotify API, if `genius:xxx` it goes to Genius, if it's a slug like `blinding-lights` it looks up mock data first, then enriches with real APIs -> YouTube and Genius data fetched in parallel via `Promise.all` -> everything merged into a single `SongData` object -> cached 30 minutes -> returned.

**Song comparison** -> `/compare` page has two `SongSelector` components (each with its own search) -> when both songs are selected, fetches `/api/compare?song1=x&song2=y` -> backend loads both songs via `getSongData()` (parallel), computes comparison insights (who has more streams, views, better chart position) -> returns `ComparisonData` with winner for each metric.

**Artist pages** -> `/artist/[id]` fetches from `/api/artist/:id` -> tries mock artist data first (by slug), falls back to Spotify artist search -> returns top tracks, discography, career timeline.

**OG images** -> `/api/og/[id]` runs on Edge Runtime via `@vercel/og` -> loads song data, renders a JSX-to-image with album art, title, artist, and key stats (streams/views/peak).

**Theming** -> `ThemeProvider` (React Context) manages `light`/`dark` state in localStorage. A blocking `<script>` in `<head>` reads localStorage and applies the class _before_ first paint to prevent FOUC. CSS uses custom properties (`:root` for light, `.dark` for dark) mapped to Tailwind via `@theme inline`.

---

## 3. Codebase Map

```
music-time-machine/
├── src/
│   ├── app/                          # Next.js App Router pages + API routes
│   │   ├── page.tsx                  # Home page: SearchBar + DateSearch + trending grid
│   │   ├── layout.tsx                # Root: Inter font, ThemeProvider, Navigation, FOUC script
│   │   ├── globals.css               # Design tokens (:root light, .dark), @theme inline, scrollbar
│   │   ├── error.tsx                 # Error boundary: retry button + go home
│   │   ├── song/[id]/page.tsx        # Song dashboard: header, audio player, platform cards, timeline, share
│   │   ├── compare/page.tsx          # Comparison: two SongSelectors + ComparisonView
│   │   ├── artist/[id]/page.tsx      # Artist: header, top tracks list, album grid, career timeline
│   │   └── api/
│   │       ├── search/route.ts       # GET — sanitizes query, returns mock or real search results
│   │       ├── song/[id]/route.ts    # GET — validates ID, returns full SongData + _meta
│   │       ├── compare/route.ts      # GET — validates both IDs, returns ComparisonData
│   │       ├── artist/[id]/route.ts  # GET — validates slug, returns ArtistData
│   │       └── og/[id]/route.tsx     # GET — Edge function, returns 1200x630 PNG with song stats
│   │
│   ├── components/                   # All client components ("use client")
│   │   ├── ThemeProvider.tsx         # Context: theme state + toggle, localStorage persistence
│   │   ├── Navigation.tsx            # Fixed navbar: logo, scroll-aware backdrop blur, theme toggle
│   │   ├── SearchBar.tsx             # Autocomplete: debounce, keyboard nav, highlighted results
│   │   ├── DateSearch.tsx            # Birthday input: date picker -> Billboard #1 lookup
│   │   ├── SongHeader.tsx            # Song title, artist link, release date, quick stats, external links
│   │   ├── AudioPlayer.tsx           # Fixed bottom bar: HTML5 <audio>, play/pause, seek, time display
│   │   ├── ComparisonView.tsx        # Two-column metric cards with green winner highlighting + score
│   │   ├── ShareCard.tsx             # Modal: copy link (clipboard API + fallback), share to X/Facebook
│   │   ├── ArtistHeader.tsx          # Round image, genres pills, monthly listeners / total streams
│   │   ├── SafeImage.tsx             # next/image with onError -> music note fallback
│   │   ├── TimelineChart.tsx         # Recharts ResponsiveContainer, multi-line, custom tooltips
│   │   ├── PlatformCard.tsx          # Card shell: icon, title, expandable, StatRow utility
│   │   ├── SpotifyCard.tsx           # Streams, popularity, playlists, audio feature progress bars
│   │   ├── YouTubeCard.tsx           # Views, likes, comments, thumbnail, publish date
│   │   ├── BillboardCard.tsx         # Peak, weeks, entry date, chart history list
│   │   └── GeniusCard.tsx            # Page views, annotations, description, lyrics link
│   │
│   ├── lib/                          # Server-side data logic
│   │   ├── dataFetcher.ts            # Central orchestrator: cache check -> mock/real -> enrich -> return
│   │   ├── mockData.ts              # 18 songs with full Spotify/YouTube/Billboard/Genius mock data
│   │   ├── cache.ts                  # TTLCache class: Map-based, configurable TTL + max size, auto-evict
│   │   ├── rateLimit.ts              # Token bucket: per-API buckets, refill over time, tryConsume()
│   │   ├── spotify.ts                # OAuth client credentials flow, auto token refresh, search/track/artist
│   │   ├── youtube.ts                # API key auth, search + video details endpoints
│   │   ├── genius.ts                 # Bearer token auth, search + song details
│   │   └── __tests__/
│   │       ├── cache.test.ts         # 7 tests: store/retrieve, TTL expiry, eviction, delete, clear
│   │       └── dataFetcher.test.ts   # 5 tests: search by title/artist, full data load, unknown IDs
│   │
│   └── types/
│       └── index.ts                  # All interfaces: SongData, SpotifyData, YouTubeData, BillboardData,
│                                     # GeniusData, SearchResult, ComparisonData, ArtistData, etc.
│
├── next.config.ts                    # Security headers (CSP, HSTS, etc.) + remote image patterns
├── vitest.config.ts                  # jsdom environment, path aliases
├── tsconfig.json                     # Strict mode, path aliases (@/ -> src/)
├── postcss.config.mjs                # Tailwind CSS 4 PostCSS plugin
├── eslint.config.mjs                 # Next.js ESLint config
├── package.json                      # v0.4.0 (should be v1.0.0), all deps
├── CHANGELOG.md                      # Full release history
├── README.md                         # Project overview + setup
└── docs/
    ├── plans/                        # Original design doc
    └── API_SETUP.md                  # Step-by-step API configuration guide
```

---

## 4. Tech Stack & Why

| Choice | Why | What Was Rejected |
|--------|-----|-------------------|
| **Next.js 16** | App Router gives file-based routing + API routes in one framework. Turbopack for fast dev builds. Edge Runtime support for OG images. | Create React App (no SSR), Remix (less Vercel-native) |
| **React 19** | `use()` hook for unwrapping async params is required by Next.js 16's new params-as-Promise pattern. | React 18 (would need `React.use()` polyfill or await pattern) |
| **TypeScript 5 (strict)** | Every data structure crosses API boundaries. Strict mode catches null/undefined issues at compile time, not runtime. | JavaScript (too many API response shapes to track mentally) |
| **Tailwind CSS 4** | `@theme inline` lets you define custom properties that Tailwind utilities can reference. No tailwind.config.js needed. Class-based dark mode with `.dark` selector. | CSS Modules (more boilerplate), styled-components (SSR hydration issues) |
| **Recharts** | React-native charting that composes well with responsive layouts. Customizable tooltips and legends. | Chart.js (imperative API), D3 (overkill for line charts), Victory (fewer features) |
| **Framer Motion** | Declarative animations for page transitions and interactive elements. Tree-shakeable. | CSS animations (less control), react-spring (more verbose) |
| **@vercel/og** | Generates OG images at the edge using JSX. No headless browser, no external service, sub-100ms. | Puppeteer (heavy, slow), Cloudinary (external dependency), static images (no dynamic data) |
| **Vitest** | Same config as Vite (which Next.js/Turbopack aligns with), native ESM, fast, compatible with Testing Library. | Jest (slower, CJS-first), Playwright (for E2E, not unit) |
| **Vercel** | Zero-config Next.js deployment. Edge Functions for OG route. Preview deployments for PRs. | AWS Amplify (more config), Netlify (less Next.js optimization) |
| **Lucide React** | Tree-shakeable icon set, consistent style, good coverage. | Heroicons (fewer icons), React Icons (bundle size) |

---

## 5. The War Stories

### The Hybrid Data Architecture
The core design tension: the app needs to work perfectly with zero API keys (demo mode) but also seamlessly enrich with real data when APIs are configured. The solution is `dataFetcher.ts` acting as an orchestrator that always starts with mock data, then layers real API data on top. When Spotify is configured, mock search results get combined with live Spotify results (deduplicated by title). When fetching a song, mock data provides the baseline, and `enrichMockSong()` replaces individual platform blocks with real API responses. If any API call fails, the mock data is still there. This means the app never shows an empty state — worst case, you get realistic-looking mock data.

### FOUC Prevention with Class-Based Dark Mode
Tailwind v4 with `@theme inline` maps CSS custom properties to utility classes. Dark mode uses a `.dark` class on `<html>` that swaps the property values. Problem: React hydrates after the initial paint, so if the theme is stored in localStorage, there's a flash of the wrong theme. Solution: a blocking `<script>` in `<head>` that reads localStorage synchronously and adds the class before the browser paints. The `html:not(.dark):not(.light)` CSS rule defaults to dark background during the gap, and `suppressHydrationWarning` on `<html>` prevents React from complaining about the mismatch.

### Token Bucket Rate Limiting
Rather than simple request counting (which requires windowed cleanup), the rate limiter uses token buckets. Each API gets a bucket with a max token count and a refill rate. Every request consumes one token. Tokens refill continuously based on elapsed time since last refill. This means burst traffic is allowed (up to max tokens) but sustained overuse gets throttled. The math is one multiplication and one comparison — no arrays, no timers, no cleanup.

---

## 6. Patterns Worth Stealing

### TTL Cache with Max-Size Eviction (`cache.ts`)
A generic `TTLCache` class wrapping a `Map`. On `get()`, checks expiry and auto-deletes stale entries. On `set()`, if at capacity, evicts the oldest entry (first key in Map iteration order — Maps maintain insertion order in JS). Two instances: search cache (200 entries, 5 min TTL) and song cache (100 entries, 30 min TTL). Dead simple, zero dependencies, effective.

### Token Bucket Rate Limiter (`rateLimit.ts`)
Stateless per-call: `tryConsume(name, maxTokens, refillPeriodMs)` returns `true`/`false`. Bucket state is a Map entry with tokens, lastRefill, maxTokens, and refillRate. On each call, refill based on elapsed time, then try to consume. Pre-configured wrappers: `checkSpotifyLimit()`, `checkYouTubeLimit()`, `checkGeniusLimit()`. Drop this into any project that calls external APIs.

### Mock-First with Real API Enrichment (`dataFetcher.ts`)
The `enrichMockSong()` pattern: start with complete mock data, then fire `Promise.all` to fetch real data from configured APIs. Each promise independently replaces its section of the mock data (Spotify block, YouTube block, Genius block). Any failure is caught and ignored — the mock data stays. The consumer never knows whether data is mock or real. This pattern eliminates the "API not configured" empty state entirely.

### Theme Provider with FOUC Prevention Script
The combination of a blocking inline script (reads localStorage, applies class), CSS custom properties (`:root` for light, `.dark` for dark), Tailwind's `@theme inline` directive (maps CSS vars to utility classes), and a React context provider (state management + toggle function) creates a complete theming system with zero flash. The key insight is that the script runs before React mounts, so the correct theme is always visible from the first frame.

### SafeImage Component
Wraps `next/image` with an `onError` handler that swaps to a styled fallback (music note icon). Uses `unoptimized` prop to skip Next.js image optimization for external URLs. Simple pattern but prevents broken image icons across the entire app.

---

## 7. Level-Up Takeaways

### Next.js 16 App Router Patterns
- **Async params**: Route params are now `Promise<{ id: string }>` in page components. Use React 19's `use()` hook to unwrap them in client components, or `await` in server components/API routes.
- **API route structure**: `src/app/api/[...]/route.ts` exports named functions (`GET`, `POST`). Each gets `NextRequest` and a context object with `params`.
- **Error boundaries**: `error.tsx` at any level catches errors for that route segment. Gets `error` and `reset` props.
- **Edge Runtime**: Set `export const runtime = "edge"` in a route to run on Vercel's edge network.

### React 19 `use()` Hook
The `use()` hook unwraps promises and context in render. In this project, it's used to unwrap `params` in client components: `const { id } = use(params)`. This replaces the older pattern of receiving params as a plain object.

### Tailwind CSS 4 `@theme inline`
Tailwind v4 dropped `tailwind.config.js`. Design tokens are defined directly in CSS using `@theme inline { }`. Inside that block, you map CSS custom properties to Tailwind's internal token names: `--color-background: var(--background)` makes `bg-background` work as a utility class. Combined with `:root` and `.dark` selectors for the CSS variable values, you get a complete dark mode system without any Tailwind config file.

### @vercel/og Edge Functions
`ImageResponse` from `@vercel/og` takes JSX and returns a PNG. It runs on the edge, uses Satori under the hood (no headless browser). Constraints: limited CSS support (flexbox only, no grid), no external fonts without fetching them, images must be `<img>` with explicit dimensions. The OG route in this project renders album art + song title + stats into a 1200x630 social card.

### Input Validation at the API Boundary
Every API route validates its inputs before touching the data layer. IDs are regex-checked (`/^[a-zA-Z0-9\-:]+$/`) and length-capped (200 chars). Search queries are sanitized (HTML stripped, dangerous chars removed). This prevents injection attacks and keeps the data layer clean — it never sees untrusted input.
