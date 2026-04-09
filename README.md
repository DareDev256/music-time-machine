<div align="center">

# 🎵 Music Time Machine

**The full picture of any song's impact — from release day to today.**

One search. Four platforms. Every metric that matters.

[![Version](https://img.shields.io/badge/version-1.37.2-blue?style=flat-square)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/tests-615_passing-brightgreen?style=flat-square)](src/lib/__tests__)
[![Suites](https://img.shields.io/badge/suites-44-blue?style=flat-square)](src/lib/__tests__)
[![Health](https://img.shields.io/badge/health-/api/health-brightgreen?style=flat-square)](src/app/api/health/route.ts)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![Deploy](https://img.shields.io/badge/Live-Vercel-black?style=flat-square&logo=vercel)](https://music-time-machine.vercel.app)

[**Try It Live →**](https://music-time-machine.vercel.app) &nbsp;·&nbsp; [Architecture](docs/ARCHITECTURE.md) &nbsp;·&nbsp; [Recommendation Engine](docs/RECOMMENDATIONS.md) &nbsp;·&nbsp; [API Setup](docs/API_SETUP.md) &nbsp;·&nbsp; [Testing Guide](docs/TESTING.md) &nbsp;·&nbsp; [Changelog](CHANGELOG.md)

<br>

<table>
<tr>
<td align="center"><strong>38</strong><br><sub>Components</sub></td>
<td align="center"><strong>615</strong><br><sub>Tests</sub></td>
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

### 🕰️ Music Timeline
Interactive SVG scatter plot mapping every song by release date and Billboard peak chart position. Circle size encodes total Spotify streams; color encodes genre using the shared palette. Hover for rich tooltips, click to navigate. `#1` labels float above chart-toppers, non-hovered dots dim for focus, and the chart scrolls horizontally on mobile. Full keyboard accessibility with ARIA roles.

### 🎲 Pick for Me (Auto-Select)
An intelligent auto-discovery button on the home page that analyzes your recently viewed songs and picks the optimal next track to explore. The selection engine maximizes **genre diversity** (unexplored genres get a bonus), avoids repeats, and rewards **new artists** — so if you've been deep in Pop, it'll surface a Country or K-Pop pick. All scoring constants (`PICK_BASE_SCORE`, `PICK_UNEXPLORED_GENRE_BONUS`, etc.) are centralized in `scoring-constants.ts` alongside the recommendation engine's tuning knobs for easy adjustment. The scorer returns both score and reason in a single pass via `scoreCandidate`, and genre lookups use the shared `genreOf` utility from `genre-utils.ts`. When your history is empty, it picks a random high-quality entry point. When you've explored the entire catalog, it resurfaces your least-recently-viewed track. The button features a three-phase animation: idle → spinning disc → album art reveal with reason tag ("New genre: K-Pop", "New artist: Dua Lipa") before navigating. Slight randomness among top-3 candidates keeps repeated picks feeling fresh.

### 📊 Song Dashboard
Every song gets a detail page with:
- **Quick Stats bar** — at-a-glance cross-platform metrics (streams, views, chart peak, weeks, page views) with smart abbreviation (2.4B, 770M) and color-coded icons
- **4 platform cards** — Spotify, YouTube, Billboard, Genius
- **Performance timeline** — multi-line chart tracking metrics over time
- **Mood Ring** — classifies audio features into a named mood personality (Euphoric, Aggressive, Melancholic, Dreamy, Groovy, Electric, Warm, Nocturnal) with a rotating conic-gradient ring, tempo-synced pulsing emoji, ambient blur glow, a one-liner personality description, and mini trait bars for energy/valence/danceability — giving an instant visceral read on the track's character
- **Audio DNA radar** — auto-detects the song's "vibe" (Groovy, High Energy, Mellow...)
- **Song Fingerprint** — a unique generative SVG visualization for every song, deterministically derived from audio features. Valence maps to colour temperature (indigo for melancholic → pink for reflective → orange for euphoric), energy drives waveform amplitude, danceability controls segment density, and tempo shapes the inner ring. Animated entrance with staggered path reveals, accent dots, and centre pulse. Includes a feature legend with mood label, energy class, danceability %, and BPM
- **Impact Score** — a composite 0–100 score synthesizing all platform metrics into a single animated ring visualization. Weighted scoring: Billboard (30 pts — chart peak + longevity), Spotify (30 pts — streams + popularity + playlists), YouTube (25 pts — views + likes + engagement ratio), Genius (15 pts — page views + annotations). Tiered labels — Legendary, Iconic, Hit Maker, Rising Star, Cult Classic, Hidden Gem — with per-platform breakdown bars showing exactly where the points come from
- **Platform Showdown** — visual head-to-head comparing Spotify vs YouTube across three dimensions: Reach (streams vs views), Engagement (playlists vs likes), and Discussion (popularity vs comments). Animated battle bars show platform split per metric, a scoreboard tallies category wins, and a dominance meter reveals whether the song is audio-first or video-first. Intelligent verdicts (Spotify Stronghold, YouTube Fortress, Balanced Presence) summarize the competitive landscape at a glance
- **Streaming Velocity** — computes daily average Spotify streams and YouTube views from lifetime totals and release date, classifying each song into velocity tiers (Viral 2M+/day, Hot 500K+, Steady 100K+, Catalogue). Features animated counters, a color-coded tier badge with glow effect, and a proportional Spotify-vs-YouTube bar showing platform dominance. Renders only when meaningful data exists
- **Listening Context** — "When to Listen" card that algorithmically maps audio features to ideal listening scenarios. Derives four contextual recommendations — time of day (Late Night, Golden Hour, Midday Peak, Early Morning), activity (Workout, Dance Floor, Road Trip, Deep Focus, Reflection, Chill Session), setting (Festival Crowd, House Party, Solo Headphones, Coffee Shop, Sunset Balcony), and season (Summer Heat, Spring Bloom, Autumn Storm, Winter Night, Rainy Day) — from danceability, energy, valence, and tempo analysis. Features a generated vibe sentence, staggered tag entrance animations, hover interactions, and full ARIA list accessibility
- **Chart Journey** — an animated SVG visualization tracing the song's Billboard Hot 100 trajectory. A smooth cardinal-spline curve maps chart position over time (inverted: #1 at the peak), with a gradient fill beneath and a stroke-dashoffset animation that "draws" the path on mount. Key landmarks (entry position, peak, latest position) are annotated with date labels and directional arrows. The peak moment gets a spring-animated marker. Summary stats row below shows entry → peak → latest with trend indicators. Only renders for songs with ≥2 chart history points
- **Song Journey** — animated vertical milestone timeline showing key moments: release date, music video drop, Billboard chart entry, peak position, and Genius community engagement. Each milestone is chronologically sorted with platform-colored icons and staggered entrance animations
- **Similar Songs** — content-based recommendations powered by weighted Euclidean distance across 4D audio features (danceability, energy ×1.5, valence ×1.5, normalized tempo), with same-era bonus (+8). Color-coded **match score badges** (emerald ≥80%, sky ≥60%, amber ≥40%) render as circular SVG progress rings on each card. Each card includes a **score breakdown bar** — a stacked segment bar showing exactly how the match score was computed (base similarity, era bonus, genre/era/mood preference bonuses), with hover tooltips revealing exact point values. **User-configurable preferences** let you tune results by preferred genres, era range (2015–2025), and mood (Upbeat / Chill / Melancholy / Energetic) — persisted to localStorage
- **Diversity-Aware Picks** — same-artist candidates are early-skipped before scoring (parsing `ft.`, `feat.`, `&`, `,`, `with` collaborations), avoiding wasted distance calculations. A greedy selection loop then caps results at one song per artist, ensuring recommendations always surface *new* artists. **Three selection strategies** are available via a toggle: **Auto** (default — inspects top candidates' genre diversity and intelligently switches between best-match and diverse), **Best match** (greedy by score), and **Diverse** (greedy set-cover with marginal diversity bonuses — +25 unseen genre, +15 unseen decade, +8 collaboration track — plus a popularity quality signal that prevents obscure filler from outranking well-known tracks). **Collaboration-aware picking** rewards songs with featured artists (`ft.`/`feat.`/`with`) because collabs naturally bridge genres and audiences. **Diversity reason tags** appear on each card in diverse/auto mode — "New genre" (violet), "New era" (teal), or "Collab pick" (rose) — giving users transparency into why the engine chose each recommendation. A **collab indicator** (Users icon) marks featured artist tracks on recommendation cards. An **auto-insight indicator** reveals the engine's decision when Auto is active — showing the resolved strategy and genre count detected, with color-coded labels and smooth height-reveal animation. Both the scoring pipeline and diversity metadata are memoized to prevent redundant recomputation on re-renders. A **diversity indicator** bar analyzes the final picks by genre spread (60% weight) and era spread (40% weight, normalized against a fixed 2-decade spread instead of pick count), displaying genre chips with per-genre colors, era span tags, and a scored label (Wide mix / Good variety / Similar vibe / Narrow focus)
- **30-second preview** — seekable audio playback from Spotify

### 🌌 Genre Constellation
An interactive star map on the home page that visualizes the entire catalog by audio DNA. Each song is a star positioned by **energy** (horizontal) and **mood/valence** (vertical), colored by genre, and sized by danceability. Four quadrants emerge naturally — Euphoric+Energetic, Chill+Happy, Intense+Dark, Calm+Reflective — letting you see how songs cluster across the musical landscape. Hovering spotlights a star (dimming the rest) with a floating tooltip showing song name, artist, and genre tag. Clicking any star navigates to its detail page. Stars animate in with staggered spring physics. Full keyboard accessibility with focus states and Enter-to-navigate.

### 🧬 Your Listening DNA
A personalized taste profile card that appears on the home page after you've explored 2+ songs. Aggregates audio features (energy, danceability, valence, tempo) from your recently viewed tracks to build a **diamond radar visualization** and classify you into a listener archetype — The Dynamo, The Optimist, The Dreamer, The Groover, The Storm Chaser, or The Explorer. Shows your top genre distribution as colored chips and animated feature bars. The diamond shape "draws" itself on mount with a smooth path animation, and vertex dots spring in sequentially. Auto-hides when insufficient data exists. The more you explore, the more your DNA evolves.

### 🕐 Recently Viewed
A horizontal scroll strip on the home page shows the last 8 songs you've explored, persisted in localStorage via `useSyncExternalStore`. Each entry displays album art, title, and artist in a compact pill layout. Songs are deduplicated (re-viewing moves to front) and capped with FIFO eviction. The section auto-hides when empty — zero visual noise for first-time visitors.

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
| **Content-Based Recommendations** | 4D audio feature similarity via extracted `featureDistance()` function with named weight constants (`FEATURE_WEIGHTS`: danceability ×1.0, energy ×1.5, valence ×1.5, tempo ×0.8). Additive bonuses (`SAME_ERA_BONUS = 8`) and classification thresholds are module-level constants, making the scoring model auditable and tunable from one place. **Score breakdown** decomposes each match score into 5 components (base, era, genre, prefEra, mood) that flow through the full pipeline and render as stacked segment bars on each card. **Diversity-aware greedy selection** pre-seeds the target's credited artists (parses `ft.`, `&`, `,`, `with` separators with a 2-char guard to avoid splitting `R&B`) and enforces a one-song-per-artist cap. Reason classification uses `classifyReason()` with early-return rules instead of nested ternaries. A `getDiversityMeta()` analyzer scores genre spread (60%) + era spread (40%) across the final picks, producing a 0–100 score with tiered labels. Timezone-safe `safeYear()` with `getUTCFullYear()` prevents era miscalculation from UTC midnight drift. Match scores (0–99%) rendered as circular SVG progress badges with emerald/sky/amber tier colors. |
| **Edge OG Images** | `/api/og/[id]` renders JSX to a 1200×630 PNG via `@vercel/og` (Satori). Sub-100ms, no headless browser. |
| **Fetch Timeout + AbortController** | All outbound API requests enforce a 10s `AbortController` timeout via `safeFetch()` — prevents resource exhaustion from slow upstream responses. Client-side fetches in `useSongData` use a separate `AbortController` that auto-cancels on navigation or unmount, preventing stale-response overwrites. Two layers: server-side protects Node.js connections, client-side protects React state. |
| **Route Middleware** | `withRouteHandler()` wraps all 6 API routes with rate limiting, error handling, and consistent responses — zero boilerplate per route. |

---

## Custom Hooks API

Four purpose-built hooks power the client-side data flow. Each is independently importable from `src/hooks/`.

### `useAsyncData<T>(fetcher, deps)` — Generic Async State Machine

Replaces the `useState(data) + useState(loading) + useState(error)` triple with a single `useReducer`-backed [discriminated union](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions) — impossible states like "loading AND error" are structurally unrepresentable.

```tsx
import { useAsyncData } from "@/hooks/useAsyncData";

const { data, loading, error } = useAsyncData<Album[]>(
  (signal) => fetch("/api/albums", { signal }).then(r => r.json()),
  [artistId]  // re-fetches when deps change
);
```

**Key behaviors:**
- `AbortController` per fetch cycle — stale responses from previous renders are cancelled before new ones fire
- Automatic cleanup on unmount — no "set state on unmounted component" warnings
- Type-narrows via `status: "idle" | "loading" | "success" | "error"` internally

### `useSongData(id)` — Song Page Data Fetcher

Wraps `useAsyncData` to parallel-fetch song detail + catalog data in a single `Promise.all`. Returns `{ song, catalog, loading, error }`.

```tsx
const { song, catalog, loading, error } = useSongData("blinding-lights");
// song: SongData | null, catalog: SongData[] (empty on failure, never undefined)
```

**Resilience:** If the catalog endpoint fails but the song succeeds, you still get `song` with an empty `catalog[]` — partial success over total failure.

### `useKeyboardShortcuts({ onToggleTheme })` — Global Keyboard Navigation

Powers the `?` shortcut cheat sheet and all power-user keyboard navigation. Returns `{ showPanel, setShowPanel, isSongPage }`.

```tsx
const { showPanel, setShowPanel, isSongPage } = useKeyboardShortcuts({
  onToggleTheme: () => setTheme(prev => prev === "dark" ? "light" : "dark"),
});
```

**Shortcut registry** (`SHORTCUTS` export — array of `{ key, label, scope }` objects):

| Key | Action | Scope |
|-----|--------|-------|
| `/` | Focus search input | Global |
| `?` | Toggle shortcuts panel | Global |
| `h` | Navigate home | Global |
| `t` | Toggle theme | Global |
| `s` | Share current song | Song page only |
| `c` | Compare current song | Song page only |
| `Esc` | Close panel / blur input | Global |

**Adding a shortcut:** Add an entry to `SHORTCUTS`, add a `case` in the `handleKey` switch, and song-page actions dispatch [CustomEvents](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) (`mtm:share`, `mtm:compare`) that page components listen for.

**Form-field awareness:** All shortcuts are suppressed when focus is on `input`, `textarea`, `select`, or `contentEditable` elements — except `Escape`, which blurs the field.

### `useRecentlyViewed()` — Recently Viewed FIFO Queue

Tracks the last 8 viewed songs in `localStorage` via React 19's `useSyncExternalStore` — no `useEffect`-on-mount hydration hack. Returns `{ songs, record }`.

```tsx
const { songs, record } = useRecentlyViewed();

// Record a view (deduplicates, moves to front, FIFO-evicts past 8)
record({ id: "blinding-lights", title: "Blinding Lights", artist: "The Weeknd", albumArt: "/art.jpg" });

// songs: RecentSong[] — reactive, updates across tabs via storage events
```

**Storage shape:** Lightweight stubs (`id`, `title`, `artist`, `albumArt`, `viewedAt`) — never full `SongData` payloads. Key: `mtm:recently-viewed`. Degrades silently on storage-full or private browsing.

---

## Architecture

```
Client Request ──── useAsyncData hook (AbortController on nav/unmount)
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
| Runtime | **React 19** | `use()` hook for async params, `useAsyncData` generic fetch hook with `useReducer` state machine + AbortController cleanup |
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
| **Input Validation** | Shared `isValidId()` / `sanitizeQuery()` — regex ID check, HTML stripping, dangerous char removal, prototype pollution blocking, 200-char max. Query string size guard (2 KB) in `withRouteHandler()` rejects oversized payloads with 414 before any per-param parsing — prevents ReDoS amplification and log injection. Genius ID NaN guard prevents malformed IDs from reaching the API |
| **Trusted Types** | `require-trusted-types-for 'script'` in both nonce-based proxy CSP (production) and static fallback CSP — blocks DOM XSS sinks (`innerHTML`, `document.write`, `eval`) unless values pass through a TrustedTypes policy. Progressive enhancement: unsupported browsers ignore the directive |
| **Rate Limiting** | Per-IP token bucket on all 6 routes (429 + Retry-After + `no-store`), per-upstream-API token buckets, stale bucket eviction, IP format validation to prevent rate limit bypass via spoofed headers |
| **Fetch Timeout** | Two-layer AbortController defense: server-side `safeFetch()` enforces 10s timeouts on all outbound API requests (prevents slow-loris resource exhaustion); client-side `useAsyncData` hook cancels in-flight fetches on navigation/unmount across all data-fetching pages (prevents stale state overwrites and memory leaks) |
| **Request Traceability** | Every API response includes a unique `X-Request-ID` header (crypto.randomUUID) for cross-system incident correlation. Error logs embed the request ID. Rate limit 429 responses carry the ID so CDN/WAF logs can trace blocked requests |
| **Health Info Redaction** | `/api/health` redacts `process.memoryUsage()`, error counts, request counts, and cache internals in production — prevents attackers from using memory stats to time resource exhaustion attacks or error counts to confirm fuzzing attempts |
| **Edge Middleware** | Request-level security at the edge: `X-Request-Id` correlation headers on every request, path traversal blocking (`/../`, `%2e%2e`, `%252e` double-encoded, backslash variants), HTTP method restriction (GET/HEAD/OPTIONS only on API routes), `Content-Length` + `Cache-Control: no-store` on 405 responses |
| **Uniform Error Headers** | All API error responses (400, 404, 422, 429, 500) and the health endpoint include `nosniff` + `X-Frame-Options: DENY` + `no-store` + `Cross-Origin-Resource-Policy: same-origin` via `jsonError()` helper — no unprotected JSON responses anywhere in the stack |
| **API Response Sanitization** | All external API responses (Spotify, YouTube, Genius) pass through `safeJson()` — a recursive sanitizer that strips `__proto__`, `constructor`, and `prototype` keys from parsed JSON before it enters application logic. Prevents prototype pollution from compromised CDNs, middleboxes, or API responses. Depth-capped at 20 levels to prevent stack overflow from adversarial payloads |
| **Href Protocol Validation** | All external URLs from API responses pass through `safeHref()` — only `https:` URLs render as clickable links. Blocks `javascript:`, `data:`, and other dangerous protocols that could enable XSS via compromised API data. Non-HTTPS URLs are suppressed entirely (no inert `#` link rendered) |
| **URL Domain Extraction** | `extractDomainFromUrl()` provides hardened URL parsing with 5 validation layers: type gating, 2 KB length ceiling, ASCII control character rejection (CRLF injection), userinfo stripping (credential-smuggling defense), and protocol allowlisting. Returns typed `DomainResult` or `null` — never throws |
| **Input Sanitization** | `sanitizeQuery()` strips null bytes (`\x00`) and unicode control characters (C0/C1 ranges U+0000–U+001F, U+007F–U+009F) before HTML/char filtering — prevents string truncation attacks in downstream parsers and log injection |
| **Permissions Policy** | Locks down 11 browser APIs: camera, microphone, geolocation, payment, USB, Bluetooth, serial, HID, idle detection, screen wake lock, web-share (self only) |
| **CDN Allowlists** | Remote images restricted to Spotify/YouTube/Genius CDNs; `media-src` locked to `p.scdn.co`; audio URLs validated against origin allowlist |
| **Health Endpoint Auth** | `/api/health` returns only `status` + `version` to unauthenticated callers. Detailed diagnostics (memory, uptime, cache stats, integration config, error counts) require a `HEALTH_AUTH_TOKEN` Bearer header — prevents server reconnaissance (OWASP A01) |
| **Structured Error Logging** | All API error `catch` blocks log `error.message` only — never the full error object. Prevents stack traces, file paths, and upstream API response bodies from leaking into log aggregators |
| **Cache Key Normalization** | All cache operations (get/set/has/delete) normalize keys via NFC unicode normalization + control char stripping — prevents cache poisoning via equivalent-but-different byte sequences |
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
├── components/                     # 38 single-responsibility UI components
│   └── PageStates.tsx              # Shared loading/error full-page states
├── hooks/
│   ├── useAsyncData.ts              # Generic useReducer-backed async fetch hook
│   ├── useSongData.ts              # Song page data fetching (wraps useAsyncData)
│   ├── useKeyboardShortcuts.ts     # Global keyboard navigation + shortcut registry
│   └── useRecentlyViewed.ts        # localStorage FIFO queue via useSyncExternalStore
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
│   ├── apiErrorHandler.ts           # Unified error extraction + context-prefixed logging
│   ├── score-colors.ts              # Match badge color tiers + SVG ring rendering
│   ├── scoring-constants.ts         # Centralized scoring weights, bonuses, and thresholds
│   ├── genre-utils.ts               # Genre lookup resolution from catalog genre IDs
│   ├── spotify.ts / youtube.ts / genius.ts
│   └── __tests__/                  # 615 tests across 44 suites
├── utils/
│   ├── parsers.ts                   # Hardened URL domain extraction with 5-layer validation
│   └── __tests__/                   # 25 parser tests
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

**615 tests** across **44 suites** covering:

| Suite | Tests | What's Tested |
|-------|------:|--------------|
| **recommendations** | 70 | Distance ranking, artist/era bonuses, reason labeling, match score validation, artist diversity enforcement, `splitArtists` collaboration parsing, `getDiversityMeta` genre/era scoring, `safeYear` timezone-safe date parsing, `getAutoInsight` strategy resolution |
| **rateLimit** | 30 | Token bucket consumption/refill, per-IP route isolation, stale eviction, input validation (`isValidId`, `sanitizeQuery`) |
| **mockData** | 21 | Catalog integrity, search matching, artist slug resolution, timeline sorting |
| **dataFetcher** | 20 | Search, comparison engine, `lowerWins` inversion, `parseMetric` edge cases, artist lookup, catalog |
| **Time Machine** | 19 | Exact month lookup, zero-padding, closest-month fallback, boundary snapping, data integrity |
| **comparison** | 12 | Winner analysis, tied metrics, head-to-head stat extraction |
| **safeFetch** | 19 | SSRF origin allowlist, 10s timeout enforcement, caller signal precedence, malformed URL rejection, prototype pollution sanitization (`sanitizeJson`), recursive key stripping, depth cap enforcement |
| **safeHref** | 12 | HTTPS passthrough, `javascript:`/`data:`/`vbscript:`/`http:`/`ftp:`/`file:` blocking, undefined/null/empty/malformed |
| **parsers** | 25 | Domain extraction, protocol allowlisting, credential-smuggling stripping, control char rejection, overlong URL rejection, non-string/null/undefined gating |
| **diversity pipeline** | 10 | End-to-end integration: artist capping, genre spread, era spread, scoring thresholds |
| **formatCompact** | 9 | B/M/K thresholds, numeric string parsing, undefined/null/NaN handling, sub-1000 passthrough |
| **apiHandler** | 26 | Route middleware, rate limit gating, security headers (nosniff/DENY/no-store), thrown value edge cases (null/undefined/object/rejected promise), plain Response support, jsonError status codes, X-Request-ID tracing |
| **TTLCache** | 7 | Expiry, eviction, CRUD operations, `getStats()` observability |
| **QuickStats** | 7 | Empty state, per-platform rendering, number abbreviation, full-data grid, accessibility |
| **useSongData** | 7 | Loading state, parallel fetch, 404/500 handling, network error, catalog-only failure, unmount abort |
| **RecommendationPrefs** | 6 | Genre bonus, era range bonus, mood preset scoring, invalid mood handling, stacked bonuses, empty prefs |
| **timeline** | 6 | Invalid date guard, data point shape, 48-month cap, release anchoring, billboard windowing |
| **toSlug** | 9 | Lowercase/hyphenation, special char stripping, separator collapse, numeric, empty string, boundary hyphen stripping, whitespace-only, unicode diacritics normalization |
| **formatDate** | 5 | Locale formatting, unparseable date fallback, custom Intl options, empty string, year-only |
| **AudioPlayer** | 5 | Play/pause, unmount cleanup, seek behavior |
| **ComparisonView** | 5 | Side-by-side rendering, winner highlighting, tied metric handling |
| **SearchBar** | 4 | Autocomplete rendering, keyboard navigation |
| **health** | 4 | Cache stats, utilization reporting, zero-maxSize edge case |
| **impactScore** | 12 | parseCount (B/M/K/comma/plain/empty), tier assignment, platform capping, total ceiling, billboard ranking |
| **pickNextSong** | 24 | Scoring engine candidates, genre diversity bonus, repeat penalty, least-recently-viewed fallback, empty history random pick, null safety guards |
| **score-colors** | 20 | Match badge color thresholds, tier classification, SVG ring rendering, edge case score values |
| **health-route** | 19 | Authenticated vs public responses, memory redaction in production, cache stats, subsystem status |
| **velocity** | 18 | Daily stream/view computation, velocity tier classification, platform dominance ratio, missing data guards |
| **artist-utils** | 15 | Artist slug parsing, collaboration splitting (`ft.`/`feat.`/`&`/`with`), name normalization |
| **genius** | 21 | Search integration, song page scraping, annotation parsing, missing field fallbacks |
| **recommendations-merged** | 13 | Full pipeline integration: scoring → diversity → selection → reason tagging |
| **spotify** | 10 | Auth token flow, search endpoint, track features, playlist count, error recovery |
| **useAsyncData** | 13 | Discriminated union state transitions, abort on deps change, abort on unmount, error narrowing |
| **YouTubeCard** | 8 | Metric rendering, external link safety, missing data states, compact number formatting |
| **rateLimit.response** | 9 | 429 response shape, Retry-After header, X-Request-ID propagation, security headers on limit |
| **apiHandler.jsonError** | 9 | Status code mapping (400/404/422), security header presence, error body shape |
| **safeFetch.safeJson** | 8 | Recursive `__proto__`/`constructor` stripping, depth cap enforcement, nested object sanitization |
| **scoring-constants** | 19 | Structural invariants: mood target ranges, feature weight hierarchy, bonus/penalty sign correctness, diversity weight sum, threshold sanity, pick-engine balance |
| **middleware** | 20 | Path traversal blocking (percent-encoded sequences, URL-spec normalization), method restriction (405 + Allow header + JSON body), request ID injection (UUID v4, uniqueness), X-Robots-Tag API-only, gate priority ordering |
| **genre-utils** | 6 | Genre lookup resolution, unknown fallback, case sensitivity, special character genres, type safety |
| **apiErrorHandler** | 11 | `extractErrorMessage()` on Error instances, subclasses, string/null/undefined/number throws, `apiCatch()` logging with context prefix, typed fallback returns, console.error output verification |
| **autoSelect.integration** | 13 | Strategy resolution edge cases: missing/undefined/partial strategy params, degenerate catalogs (empty, single candidate, all null Spotify), unmapped genre IDs forcing diverse fallback, `getAutoInsight` state isolation across sequential calls |
| **PlatformShowdown** | 7 | Empty states, verdict classification, metric label rendering, balanced detection, battle bar proportions |
| **TasteProfile** | 8 | Empty states (< 2 songs), archetype classification thresholds, genre chip rendering, feature bar accuracy, radar SVG path rendering, non-mock ID handling |

External API clients fully mocked — tests run fast and offline.

---

## Contributing

```bash
git checkout -b feature/your-feature
npm test                    # All 615 tests must pass
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

- [x] Audio feature radar chart visualization
- [x] Intelligent auto-discovery (Pick for Me engine)
- [x] Genre Constellation star map
- [x] Listening Context recommendations
- [x] Impact Score composite scoring
- [x] Streaming Velocity analysis
- [x] Music Timeline scatter plot visualization
- [x] Platform Showdown head-to-head comparison
- [x] Listening DNA taste profiling
- [x] Song Fingerprint generative visualization
- [ ] Billboard chart scraping (historical data beyond mock)
- [ ] User accounts + saved songs
- [ ] Real-time trending from Spotify/YouTube APIs
- [ ] Playlist generation from comparison results
- [ ] PWA support (offline mode, install prompt)

---

## License

MIT

---

<div align="center">

Built with [Claude Code](https://claude.ai/claude-code)

</div>
