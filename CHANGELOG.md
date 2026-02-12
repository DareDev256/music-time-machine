# Changelog

All notable changes to the Music Time Machine project will be documented in this file.

## [1.3.3] - 2026-02-12

### Security
- **Full security audit** — Scanned entire codebase for hardcoded credentials, exposed API keys, and insecure HTTP calls. All API keys correctly use `process.env.*` with missing-key guards. No secrets in source. All external calls use HTTPS. `npm audit` returns 0 vulnerabilities
- **Added `.env.example`** — Safe credential template committed to repo so developers can `cp .env.example .env.local` instead of guessing variable names from README. All values blank, comments link to provider dashboards
- **Cross-Origin-Opener-Policy header** — Added `same-origin` COOP header to prevent cross-origin window access, mitigating Spectre-class side-channel attacks and `window.opener` phishing vectors
- **X-Permitted-Cross-Domain-Policies header** — Added `none` directive to block Flash/Acrobat cross-domain policy file loading (legacy plugin attack vector)

---

## [1.3.2] - 2026-02-12

### Added
- **Mock data module test suite** (`src/lib/__tests__/mockData.test.ts`) — 18 tests covering catalog integrity (song count, required fields, audio features for recommendations), `searchSongs` (exact title, partial match, artist match, empty results, SearchResult shape), `getSongById` (valid/invalid/empty ID), `getTrendingSongs` (count cap, shape), and `getArtistDataBySlug` (slug lookup, top tracks population, career timeline sorting, unknown artist, album deduplication)
- **Data fetcher expanded test suite** — 14 new tests added to `dataFetcher.test.ts`: `parseMetric` edge cases (B/M/K suffixes, plain numbers, non-numeric input, NaN propagation fix), `compareSongs` (insight generation, null on invalid ID, winner correctness, `lowerWins` Billboard inversion, all 6 metrics present), `getArtistData` (mock slug resolution, unknown fallback), `getCatalog` (full catalog return)

---

## [1.3.1] - 2026-02-12

### Added
- **Recommendations engine test suite** (`src/lib/__tests__/recommendations.test.ts`) — 12 tests covering weighted Euclidean distance ranking, same-artist bonus (+15), same-era bonus (+8), reason labeling ("Nearly identical vibe", "High energy match", "Same artist", "Same era"), limit parameter, and edge cases (no audio features, empty catalog, all candidates missing features)
- **Rate limiter test suite** (`src/lib/__tests__/rateLimit.test.ts`) — 21 tests covering token bucket consumption/exhaustion, time-based refill with fake timers, max token cap, pre-configured API limiters (Spotify 30/30s, Genius 50/min), per-IP route isolation, `extractClientIp` header parsing (X-Forwarded-For, X-Real-IP, unknown fallback), 429 response builder, `isValidId` validation (special chars, length), and `sanitizeQuery` XSS prevention (HTML stripping, dangerous chars, length enforcement)

---

## [1.3.0] - 2026-02-12

### Added
- **Similar Songs Recommendation Engine** (`src/lib/recommendations.ts`) — Content-based song recommendation using weighted Euclidean distance across a 4D audio feature space (danceability, energy ×1.5, valence ×1.5, normalized tempo). Additive score bonuses for same-artist (+15) and same-era ±2 years (+8) prevent purely sonic matches. Returns top 4 similar songs with human-readable reason tags ("Nearly identical vibe", "High energy match", "Same artist", etc.)
- **SimilarSongs Component** (`src/components/SimilarSongs.tsx`) — Responsive 2×2 / 4×1 grid of recommended song cards on every song detail page. Each card shows album art, title, artist, and a reason badge. Staggered Framer Motion entrance animations. Cards link directly to the recommended song's detail page for seamless discovery
- **Catalog API Route** (`/api/catalog`) — Returns the full song catalog for client-side recommendation computation. Rate-limited to 10 requests/min per IP. Aggressively cached (24hr `s-maxage`, 1hr `stale-while-revalidate`) since the catalog changes infrequently

---

## [1.2.1] - 2026-02-12

### Added
- **Architecture Guide** (`docs/ARCHITECTURE.md`) — Comprehensive technical documentation covering the full data flow (search → cache → mock/API → render), mock-first design strategy with fallback chain explanation, TTL cache internals with rationale for oldest-first vs true LRU eviction, token bucket algorithm pseudocode for both upstream API and per-IP route rate limiting, input validation guard pattern, component architecture tree mapping UI to source files, and key files reference table. Linked from README navigation bar

---

## [1.2.0] - 2026-02-12

### Changed
- **Refactored `dataFetcher.ts` comparison engine** — Replaced 5 hand-coded insight-building blocks in `compareSongs()` with a data-driven `COMPARISON_METRICS` array and `buildInsights()` helper. Adding a new comparison metric is now a single array entry instead of a new if-block. Supports `lowerWins` flag for inverted metrics like Billboard peak position
- **Extracted `mergeWithMock()` helper** — Deduplicated identical search-result merge logic that was copy-pasted across Spotify and Genius search branches. Single function handles title-based deduplication, mock-first ordering, and result capping
- **Exported `parseMetric()`** — Promoted from private file-scoped function to exported utility, enabling reuse in tests and other modules without reimplementation
- **README.md restructured for portfolio impact** — Replaced flat features table with narrative "What You Can Do" user journey. Added "Engineering Highlights" section surfacing mock-first architecture, token bucket rate limiting, TTL cache with LRU eviction, and edge-generated OG images. Added API route reference table and "Why" column to tech stack. Consolidated env vars into compact inline-commented format. Tightened hero copy with concrete data examples

---

## [1.1.3] - 2026-02-11

### Fixed
- **AudioPlayer play() unhandled promise rejection** — `audio.play()` returns a Promise that rejects when browser autoplay policies block playback. Previously called without `await`/`catch`, causing unhandled rejections and `isPlaying` state going out of sync (button showed "playing" while audio was silent). Now uses `async/await` with error handling, setting `isPlaying` only on successful playback
- **AudioPlayer audio leak on unmount** — Navigating away from a page with an active AudioPlayer left audio playing in the background because the cleanup function didn't call `audio.pause()`. Added `pause()` to the `useEffect` cleanup
- **parseMetric NaN propagation in song comparison** — Inputs like `"N/AB"` would pass the suffix check (`endsWith("B")`) before NaN detection, producing `NaN * 1_000_000_000` = `NaN` which broke comparison winner logic. Added early `isNaN()` guard before suffix matching
- **AudioPlayer test mock not intercepting jsdom calls** — Test setup replaced `HTMLMediaElement` class entirely instead of mocking methods on jsdom's existing prototype, causing `pause()` to hit jsdom's un-implemented stub during unmount cleanup

---

## [1.1.2] - 2026-02-11

### Security
- **Rate limiter memory leak fix** — Added stale bucket eviction to the per-IP token bucket rate limiter. Buckets idle for >10 minutes are pruned every 5 minutes, preventing unbounded `Map` growth from rotating client IPs in long-running processes
- **CSP hardened** — Removed `'unsafe-eval'` from `script-src` (closes `eval()`/`Function()` XSS vectors), added `object-src 'none'` (blocks Flash/Java plugin exploits), added `base-uri 'self'` (prevents `<base>` tag hijacking for relative URL attacks)
- **X-DNS-Prefetch-Control header** — Added `off` directive to prevent browsers from pre-resolving DNS for page links, reducing DNS-level information leakage
- **Unified input validation** — Extracted shared `isValidId()` and `sanitizeQuery()` into `rateLimit.ts`, replacing 4 duplicated inline implementations across API routes. Fixes artist route missing colon support (was `[a-zA-Z0-9\-]` vs `[a-zA-Z0-9\-:]` everywhere else)

---

## [1.1.1] - 2026-02-11

### Security
- **API route-level rate limiting** — Added per-IP token bucket rate limiting to all 5 API routes (`/api/search`, `/api/song/:id`, `/api/compare`, `/api/artist/:id`, `/api/og/:id`). Returns HTTP 429 with `Retry-After` header when limits are exceeded. Configurable per-route limits (search: 20/min, song/artist: 30/min, compare: 15/min, OG: 10/min)
- **OG image route input validation** — Added missing `isValidId()` regex check and 200-character length limit to `/api/og/[id]` route, matching validation already present on all other API routes
- **Audio preview URL origin validation** — AudioPlayer component now validates that preview URLs originate from Spotify's CDN (`https://p.scdn.co`) before loading, providing application-layer defense alongside existing CSP `media-src` restrictions

---

## [1.1.0] - 2026-02-11

### Added
- **Audio DNA Radar Chart** — Interactive Recharts radar visualization on every song detail page showing danceability, energy, happiness (valence), and tempo as a filled polygon. Tempo normalized from BPM to 0–100 scale for visual consistency. Auto-detects a "vibe" label (Groovy, High Energy, Feel-Good, Fast-Paced, Mellow) based on the dominant audio feature. Includes custom tooltip with feature descriptions and a mini legend below the chart. Dynamically imported for code-split performance

---

## [1.0.3] - 2026-02-11

### Changed
- **README.md elevated to portfolio-grade** — Centered hero with navigation links (Live Demo · API Guide · Changelog), "Why This Exists" narrative section, Quick Start promoted above features for faster onboarding, improved architecture diagram with per-API rate limits inline, environment variable reference table with direct links to provider dashboards, en-dash typography, interpunct-separated demo song list, and tighter contributing section. Designed for two audiences: recruiters (10-second scan) and engineers (deep dive)

---

## [1.0.2] - 2026-02-11

### Changed
- **README.md rewritten** — Feature/platform tables, ASCII architecture diagram, tech stack by layer, security hardening table, condensed song catalog

---

## [1.0.1] - 2026-02-11

### Fixed
- **ThemeProvider cascading render** — Replaced `setState`-in-`useEffect` anti-pattern with lazy `useState` initializer, eliminating an unnecessary re-render on mount and improving theme initialization performance
- **ShareCard unoptimized image** — Replaced raw `<img>` with `SafeImage` (next/image wrapper) for automatic optimization, lazy loading, and graceful error fallback
- **ESLint errors** — Fixed `prefer-const` violations in `dataFetcher.ts` and `mockData.ts` where `let` was used for never-reassigned date variables
- **Unused imports/variables** — Removed dead imports (`MessageSquare`, `Eye` from GeniusCard; `afterEach` from SearchBar test; `isSearching` state from compare SongSelector; unused `error` destructure in GlobalError)

---

## [1.0.0] - 2026-02-07

### Added
- **Apple Music-Inspired Redesign** — Full visual overhaul with ThemeProvider (light/dark mode), Navigation component with scroll-aware blur, and Apple-style design tokens (CSS custom properties via `@theme inline`)
- **Audio Preview** — HTML5 audio player for Spotify 30-second preview clips with play/pause, seekable progress bar, album art, and external Spotify link
- **Song Comparison** — Side-by-side metrics comparison at `/compare` with winner highlighting across Spotify streams, YouTube views, Billboard peak, weeks on chart, and Genius page views
- **Artist Pages** — Dedicated artist view at `/artist/[id]` with top tracks, discography grid, career timeline, and aggregate stats (monthly listeners, total streams)
- **Social Sharing** — Share modal with copy-to-clipboard, X (Twitter), and Facebook sharing. OG image generation via `@vercel/og` edge function at `/api/og/[id]`
- **Security Hardening** — HTTP security headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) via `next.config.ts`. Input validation with regex on all API routes. Query sanitization (HTML stripping, dangerous char removal, 200-char limit)
- **TTL Cache** — In-memory cache with configurable TTL and max size eviction. Search results cached 5 min, song data cached 30 min
- **Token Bucket Rate Limiting** — Per-API rate limits: Spotify 30/30s, YouTube 100/hr, Genius 50/min
- **Testing Infrastructure** — Vitest + Testing Library + jsdom. Unit tests for TTLCache (expiry, eviction, CRUD) and dataFetcher (search, song data retrieval)
- **Error Boundary** — Route-level error page (`error.tsx`) with retry and home navigation, plus root-level `global-error.tsx` for crashes in the root layout itself
- **SafeImage Component** — Image wrapper with graceful fallback to music note icon on load failure
- **FOUC Prevention** — Inline `<script>` in `<head>` applies theme class before first paint

### Changed
- Bumped version from 0.3.0/0.4.0 to 1.0.0
- Replaced raw Tailwind dark mode with class-based theming using CSS custom properties
- Layout now wraps all pages in ThemeProvider with persistent Navigation bar
- All components use semantic color tokens (`bg-background`, `text-foreground`, `border-border`, `bg-card`, etc.) instead of hardcoded Tailwind colors

### Dependencies Added
- `framer-motion` ^11.18.0
- `@vercel/og` ^0.6.0
- `vitest` ^3.0.0 (dev)
- `@testing-library/react` ^16.0.0 (dev)
- `@testing-library/jest-dom` ^6.0.0 (dev)
- `jsdom` ^25.0.0 (dev)

---

## [0.3.0] - 2025-01-25

### Added
- Real API clients for Spotify (OAuth 2.0 Client Credentials), YouTube Data API v3, and Genius API
- Unified data fetcher with hybrid mock/real strategy and graceful fallback
- "Time Machine" birthday search — find the Billboard #1 on any date (2019-2024)
- Expanded song catalog from 10 to 18 curated songs
- Full mobile responsiveness overhaul

### Changed
- Updated to Next.js 16, React 19, Tailwind CSS 4

---

## [0.2.0] - 2025-01-21

### Added
- 5 additional songs: Uptown Funk, drivers license, Dance Monkey, Old Town Road, Levitating
- Improved mock data with more realistic metrics

---

## [0.1.0] - 2025-01-21

### Added
- Core dashboard with real-time search autocomplete
- Song detail pages with platform cards (Spotify, YouTube, Billboard, Genius)
- Performance timeline chart (Recharts multi-line)
- 5 initial songs with full mock data
- Responsive design foundation
