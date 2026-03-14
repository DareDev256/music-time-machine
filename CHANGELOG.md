# Changelog

All notable changes to the Music Time Machine project will be documented in this file.

## [1.24.0] - 2026-03-13

### Added
- **Score breakdown bars** — each recommendation card now renders a stacked bar showing exactly how the match score was computed: base audio similarity (gray), era proximity bonus (sky), genre preference bonus (pink), preferred era bonus (amber), and mood match bonus (violet). Segments are proportionally sized and reveal exact point values on hover via native tooltips. Accessible via `role="img"` with a descriptive `aria-label`
- **`ScoreBreakdown` type** — new exported interface decomposing match scores into 5 additive components (`base`, `era`, `genre`, `prefEra`, `mood`), threaded through the entire scoring→picking→rendering pipeline
- **`PickResult.breakdown` field** — recommendation results now carry their full score breakdown, enabling downstream consumers (UI, analytics, tests) to inspect scoring decisions without re-running the engine

---

## [1.23.2] - 2026-03-13

### Changed
- **Runtime type guards** — `splitArtists()` and `primaryArtist()` now return safe defaults (`[]` and `""`) when called with non-string inputs, preventing `.split()`/`.trim()` crashes from API-sourced data that bypasses TypeScript's compile-time checks
- **String coercion at call boundaries** — All 8 call sites in `scoreCandidates`, `getSimilarSongs`, `getDiversityMeta`, and `pickDiverse` now wrap `.artist` and `.releaseDate` with `String(value ?? "")`, catching both nullish and non-string values before they reach the parsing pipeline

---

## [1.23.1] - 2026-03-13

### Added
- **`useAsyncData` test suite** — 13 tests covering the full state machine lifecycle: idle→loading→success/error transitions, AbortController signal passthrough, unmount abort cleanup, stale request suppression after abort, dependency-driven re-fetch, AbortError swallowing, non-Error rejection handling, empty error message fallback, and console.error logging verification

---

## [1.23.0] - 2026-03-13

### Changed
- **`useAsyncData` generic hook** — New `useReducer`-backed async fetch primitive that replaces the repeated `useState(data) + useState(loading) + useState(error)` pattern. Discriminated union types make impossible states (loading + error simultaneously) unrepresentable. Includes automatic `AbortController` cleanup
- **`useSongData` simplified** — Refactored from 4 separate `useState` calls to a thin wrapper over `useAsyncData`. Same public API, half the code, zero behavior changes
- **Artist page fetch hardened** — Replaced 3 inline `useState` calls + unguarded `fetch` (no `AbortController`) with `useAsyncData`, gaining automatic request cancellation on unmount
- **Error messages pass through** — Network errors now surface the actual message (e.g. "Network error") instead of a generic "Failed to load" string, giving users better diagnostic context

---

## [1.22.1] - 2026-03-10

### Added
- **Testing guide** (`docs/TESTING.md`) — Comprehensive documentation of the test infrastructure: toolchain (Vitest + Testing Library + jsdom), test organization across 25 suites, 6 mock patterns (module-level mocks, fresh re-imports, global fetch stubs, Next.js mocks, fake timers, data factories), test categories (unit/integration/component), security test coverage map, and conventions for adding new tests
- **README nav link** — Added Testing Guide to the docs navigation bar

---

## [1.22.0] - 2026-03-10

### Changed
- **Recommendation engine decomposition** — Extracted `getSimilarSongs` (160-line monolith) into 4 focused functions: `scoreCandidates()` (scoring pipeline), `resolveStrategy()` (auto/best-match/diverse resolution), `pickBestMatch()` (greedy score picker), and `pickDiverse()` (marginal diversity picker). The main function is now a clean 10-line orchestrator. Zero behavior changes — all 322 tests pass unchanged
- **Shared `PickResult` type** — Replaced repeated `{ song: SongData; reason: string; matchScore: number }` inline types with a named interface, reducing type duplication across the pick pipeline
- **`clampScore()` helper** — Extracted the `Math.min(99, Math.max(0, Math.round(...)))` pattern used by both pickers into a single function

---

## [1.21.6] - 2026-03-10

### Fixed
- **SearchBar year display** — `new Date(result.releaseDate).getFullYear()` rendered "NaN" in search dropdown when release date was unparseable. Now shows em-dash fallback
- **BillboardCard chart timeline** — Chart movement start/end labels bypassed the safe `formatDate` utility, calling `new Date().toLocaleDateString()` directly which renders "Invalid Date" on bad input. Now uses `formatDate` consistently
- **SongMilestones Genius date crash** — `new Date(geniusDate).toISOString()` throws `RangeError` (not just bad display) when Genius returns non-ISO strings like "TBD". Now validates before calling `.toISOString()`, falling back to the song's own release date
- **AudioRadarChart tempo NaN** — `audioFeatures.tempo` of `undefined`/`null` propagated NaN through the normalization math, causing the Tempo radar axis to silently vanish. Now guards with `Number.isFinite()` and defaults to 0

---

## [1.21.5] - 2026-03-10

### Fixed
- **yearCache FIFO eviction** — `safeYear()` cache used `yearCache.clear()` when hitting the 256-entry limit, nuking all cached entries including null values for invalid dates. Every subsequent scoring pass re-parsed the same invalid date strings. Replaced with FIFO eviction that removes only the oldest entry, preserving the rest of the cache
- **getDiversityMeta genre ratio denominator** — Songs without genre data in `songGenres` still counted in the `picks.length` denominator, deflating `genreRatio`. A set of 3 picks with 2 known distinct genres scored 2/3 = 0.67 instead of the correct 2/2 = 1.0. Now only genre-mapped picks contribute to the denominator
- **3 new regression tests** covering cache eviction behavior, genre ratio with partial metadata, and zero-genre fallback (322 total, all passing)

---

## [1.21.4] - 2026-03-09

### Added
- **Genius API integration tests** — 21 tests covering all 4 exported functions (`searchGeniusSong`, `searchGeniusSongs`, `getGeniusSong`, `getGeniusSongBySearch`) plus `isGeniusConfigured`. Tests cover response mapping, missing artist fallback to "Unknown", URL encoding of special characters, search limit enforcement, image fallback chain (song_art → header_image), three-tier description extraction (plain → preview → generated), search-to-detail fetch chaining, rate limit enforcement, Bearer token auth header, and missing credentials handling
- **319 total tests** across 25 suites (all passing)

---

## [1.21.3] - 2026-03-09

### Added
- **Spotify integration tests** — 10 tests covering token caching with concurrent `Promise.all` fetches, track/artist response mapping, audio features merge when present and graceful degradation when absent, Spotify ID pattern detection (22-char alphanumeric → direct fetch vs name → search), rate limit enforcement, and credential configuration checks
- **YouTube integration tests** — 6 tests covering video data mapping with `formatCompact`, thumbnail resolution fallback chain (maxres → high → default), search-to-detail fetch chaining in `getYouTubeVideoBySearch`, query construction with music category filter, and API key configuration
- **16 new tests total** (298 total, all passing)

---

## [1.21.2] - 2026-03-09

### Fixed
- **Auto-strategy artist deduplication** — The auto-strategy inspection loop used an empty `seenArtists` set when sampling top candidates for genre diversity assessment. Two songs by the same artist both counted toward the inspection limit, potentially filling the sample before other artists were evaluated. This caused the auto resolver to misjudge genre diversity and pick the wrong strategy. The inspection now tracks its own `inspectedArtists` set, matching the deduplication behavior of the actual picker
- **1 new regression test** covering the artist-collision edge case in auto-strategy inspection (282 total, all passing)

---

## [1.21.1] - 2026-03-08

### Added
- **Recommendation engine documentation** — New `docs/RECOMMENDATIONS.md` with complete algorithm reference: scoring model (weighted 4D Euclidean distance), all three selection strategies (best-match, diverse, auto), artist diversity filter, user preference system with mood targets, diversity meta scoring formula, tuning constants table, and export reference. Linked from main README nav bar

---

## [1.21.0] - 2026-03-08

### Added
- **Auto-insight indicator** — When "Auto" strategy is selected, a subtle animated pill appears below the strategy toggle showing what the engine resolved to ("Best match" or "Diverse") and how many genres it detected in top candidates. Uses color-coded labels (emerald for best-match, sky for diverse) and a smooth height-reveal animation. Provides algorithmic transparency without adding cognitive load
- **`getAutoInsight()` API** — New exported function exposing the auto-strategy resolution metadata (`resolved` strategy + `genresDetected` array) for UI consumption. Module-level capture pattern keeps `getSimilarSongs` return type stable (no breaking changes)
- **`AutoInsight` type** — Typed interface for auto-strategy resolution data
- **2 new tests** covering auto-insight population and null-on-manual-strategy (281 total, all passing)

---

## [1.20.1] - 2026-03-06

### Changed
- **Health endpoint data fetching optimized** — Cache stats (`getStats()`) were called 6 times per request (3x per cache); now snapshotted once into locals. Catalog size hoisted to module scope as `CATALOG_SIZE` since `mockSongs` is a static import — eliminates a throwaway `Object.keys()` array allocation per request. Integration count uses arithmetic coercion (`+bool`) instead of `Object.values().filter().length`, avoiding two intermediate array allocations
- **`TTLCache.delete()` now normalizes keys** — `get()` and `set()` both applied NFC normalization + control-char stripping, but `delete()` used the raw key. Unicode-equivalent keys (e.g. precomposed vs decomposed "cafe\u0301") could silently miss the cache entry, leaving stale data unevictable

---

## [1.20.0] - 2026-03-06

### Added
- **Auto selection strategy** — New default "Auto" mode that inspects the top candidates' genre diversity and intelligently switches between best-match and diverse strategies. When the top picks are already genre-diverse (2+ distinct genres), Auto preserves best-match ordering for maximum relevance. When candidates are homogeneous, Auto activates diverse mode to break out of the genre bubble. Eliminates the need for users to manually toggle strategies
- **Popularity quality signal** — The diverse/auto picker now factors in Spotify popularity (0-100) as a lightweight tiebreaker (max +5 points), preventing obscure filler from outranking well-known tracks when diversity bonuses are equal. Popular songs surface naturally without overriding genre/era diversity
- **4 new tests** covering auto-strategy fallback logic, genre homogeneity detection, default strategy behavior, and popularity tiebreaking (279 total, all passing)

---

## [1.19.0] - 2026-03-06

### Added
- **Diverse selection strategy** — New "Diverse" mode toggle in Similar Songs that maximizes genre and era spread across recommendations using a greedy set-cover algorithm. Each pick round applies marginal diversity bonuses (+25 for unseen genre, +15 for unseen decade) to re-rank candidates, producing a wider mix without sacrificing match quality. Strategy persists as `SelectionStrategy` type in `RecommendationPrefs`
- **Strategy toggle UI** — Accessible `radiogroup` with "Best match" (default) and "Diverse" options, styled with the project's accent color system and spring-in transitions. Includes ARIA roles, title descriptions, and focus-visible styles
- **3 new tests** covering diverse strategy genre spreading, artist deduplication under diverse mode, and matchScore range validation (275 total, all passing)

---

## [1.18.3] - 2026-03-06

### Fixed
- **Match score badge unreadable on album art** — The circular match score badge used `-z-10` for its `bg-card` background, but the parent container lacked a stacking context (`isolate`). The background div escaped the badge's paint order and rendered behind the album art image, leaving score text floating on busy artwork with no contrast. Added `isolate` to the badge container to confine the negative z-index
- **Diversity indicator didn't animate on preference changes** — The diversity badge, genre chips, and era tags used `initial`/`animate` props that only fired on mount. When the user changed recommendation preferences, the indicator snapped to new values with no visual feedback. Wrapped the indicator in `AnimatePresence mode="wait"` with a `key` derived from `${label}-${score}`, triggering smooth exit/enter transitions on every diversity change
- **Recommendation cards missing keyboard focus styles** — `Link` elements had hover styles but no `focus-visible` ring, violating WCAG 2.1 SC 2.4.7 (Focus Visible). Keyboard users couldn't tell which card was focused. Added `focus-visible:ring-2 focus-visible:ring-accent` with proper offset
- **Era span text not animated** — The "spans 2010s & 2020s" text rendered as a plain `<span>`, jarring against the animated genre chips beside it. Upgraded to `motion.span` with a staggered fade-in
- **Match score badge missing semantic role** — The circular badge used `title` for tooltip but had no `role` or `aria-label`, making it invisible to screen readers. Added `role="img"` and `aria-label` for the score, plus `aria-hidden` on the decorative percentage text

---

## [1.18.2] - 2026-03-06

### Fixed
- **Same-artist candidates wasted scoring budget** — `SAME_ARTIST_BONUS` (+15) inflated scores of candidates that the diversity filter unconditionally excluded (via `seenArtists` pre-seeding). These dead entries occupied top positions in the sorted array, forcing the diversity loop to skip its highest-scored entries first — a pessimal iteration order. Same-artist candidates are now early-skipped before distance calculation, eliminating wasted `featureDistance()` calls and the removed `SAME_ARTIST_BONUS` constant
- **Recommendation pipeline recomputed on every render** — `getSimilarSongs()` and `getDiversityMeta()` were called directly in the `SimilarSongs` component body with no memoization. Every parent re-render triggered the full O(n) scoring loop, sort, and diversity filter. Both are now wrapped in `useMemo` with proper dependency arrays
- **Dead `classifyReason` parameter** — Removed the `sameArtist` boolean parameter and `"Same artist"` return path from `classifyReason()`, since same-artist candidates are now excluded before scoring and could never reach the classification step

---

## [1.18.1] - 2026-03-05

### Changed
- **`parseMetric` guard** — Replaced global `isNaN()` with `Number.isFinite()` in comparison.ts, catching both NaN and Infinity from `parseFloat()` (Infinity slipped through the old guard)
- **`formatDate` guard** — Switched global `isNaN()` to `Number.isNaN()` in formatDate.ts for type-safe validation without implicit coercion
- **`findClosestChart` immutability** — Converted mutable for-loop with `let closest` to a declarative `Object.entries().reduce()`, making the pure-function contract explicit
- **Health severity engine** — Extracted nested ternary status resolution into a `SEVERITY_WEIGHT` map with `resolveOverallStatus()`, making severity levels data-driven and extensible without touching branching logic

---

## [1.18.0] - 2026-03-05

### Added
- **Keyboard shortcuts** — Global `useKeyboardShortcuts` hook with 7 key bindings: `/` focus search, `?` toggle cheat sheet, `h` go home, `t` toggle theme, `Esc` close/blur, plus context-aware `s` (share) and `c` (compare) on song pages
- **Shortcuts panel** — Animated modal overlay (`KeyboardShortcuts.tsx`) with scoped sections (Navigation vs Song Page), styled `<kbd>` keys, and proper WCAG focus management (trap, restore, Escape)
- **Nav keyboard trigger** — Keyboard icon button in the desktop navigation bar for discoverability; dispatches a synthetic `?` keydown so the global hook controls all state
- **CustomEvent bridge** — Song page listens for `mtm:share` and `mtm:compare` events, decoupling the global keyboard hook from page-level state without prop drilling or context providers

---

## [1.17.1] - 2026-03-05

### Changed
- **README overhaul** — Corrected all stale metrics (tests: 237→272 across 22 suites, components: 23→27, curated songs: 17→18) and expanded the testing table with per-suite test counts
- **Architecture diagram** — Now shows both resilience layers: client-side `useSongData` AbortController and server-side `safeFetch()` SSRF check + 10s timeout
- **Engineering Highlights** — Added "Fetch Timeout + AbortController" row documenting the two-layer timeout strategy (server-side resource exhaustion prevention + client-side stale-state prevention)
- **Security table** — Updated Fetch Timeout row to describe both AbortController layers instead of just the server-side one
- **Project structure** — Added `hooks/` directory, `safeFetch.ts`, and `PageStates.tsx` to the tree

---

## [1.17.0] - 2026-02-24

### Changed
- **Extract `useSongData` hook** — Moved song detail page data-fetching logic (parallel song + catalog fetch, loading/error states) into `src/hooks/useSongData.ts`. The song page component is now a pure render function with zero `useEffect` calls
- **AbortController on navigation** — The new hook cancels in-flight API requests when the song ID changes or the component unmounts, preventing stale-response overwrites that the inline `useEffect` didn't handle
- **Removed unused imports** — Cleaned `useState`, `useEffect`, and `SongData` type imports from the song page now that the hook owns them

### Added
- **7 hook tests** — Full coverage for `useSongData`: loading state, parallel fetch, 404 handling, 500 handling, network error, catalog-only failure, and unmount abort (272 total tests)

---

## [1.16.7] - 2026-02-24

### Security
- **Uniform error response headers** — All API error responses (400, 404, 422) now include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Cache-Control: no-store` via new `jsonError()` helper. Previously, validation-failure branches in 5 routes returned raw `NextResponse.json()` without security headers — browsers could MIME-sniff those JSON error bodies
- **Fetch timeout enforcement** — `safeFetch()` now enforces a 10-second `AbortController` timeout on all outbound API requests. Prevents resource exhaustion when an allowed upstream origin responds slowly (slow-loris vector). Caller-provided signals take precedence
- **Rate limit CDN cache poisoning fix** — 429 responses now include `Cache-Control: no-store`, preventing CDN/proxy caches from storing and serving rate-limit errors to innocent users
- **Dead import cleanup** — Removed unused `NextResponse` imports from 4 API route files after migrating to `jsonError()`

---

## [1.16.6] - 2026-02-23

### Fixed
- **Insufficient health data resolved** — Replaced hardcoded, stale metrics (wrong song count, manual test count) with dynamic runtime data: catalog size counted from `mockSongs`, request throughput, error rate, and `process.memoryUsage()` snapshot (RSS, heap, external in MB)
- **Per-subsystem health checks** — Added `checks` array with individual `pass/warn/fail` status for catalog, search cache, song cache, and integrations — giving monitoring systems granular data to compute a real health score instead of flagging `insufficient_data`
- **Status derivation from checks** — Overall status is now computed from check results (`unhealthy` if any fail, `degraded` if any warn, `healthy` otherwise) instead of a simplified boolean

### Added
- **`recordError()` export** — Other API routes can increment the global error counter for health reporting
- **Memory metrics** — Health endpoint now reports RSS, heapUsed, heapTotal, and external memory usage

---

## [1.16.5] - 2026-02-22

### Security
- **Reverse tabnabbing** — `window.open` calls in ShareCard now pass `noopener,noreferrer` features, preventing opened pages from accessing `window.opener` to redirect the original tab
- **Deprecated clipboard fallback removed** — Replaced `document.execCommand("copy")` DOM injection with graceful Clipboard API failure handling, eliminating unnecessary XSS surface
- **Cache key normalization** — All cache keys are now NFC-normalized with zero-width/control characters stripped, preventing cache poisoning via Unicode normalization form collisions
- **API response hardening** — All JSON API responses (including 429 and 500 errors) now include `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` headers, closing MIME-sniffing and clickjacking gaps on programmatic responses

---

## [1.16.4] - 2026-02-22

### Fixed
- **Insufficient health data** — Added `/api/health` endpoint exposing structured metrics: app version, uptime, integration readiness (Spotify/YouTube/Genius), cache utilization, and operational status. This resolves the "insufficient_data" health score by giving monitoring systems a concrete surface to probe
- **Cache observability** — Added `getStats()` method to `TTLCache` returning size, maxSize, and utilization ratio for health reporting
- **Build-time version injection** — `NEXT_PUBLIC_APP_VERSION` is now injected from `package.json` via `next.config.ts`, eliminating manual version tracking in health responses

### Added
- **CI test scripts** — `npm run test:ci` (single-run, no watch) and `npm run test:coverage` (with coverage reporting) for pipeline-friendly test execution
- **Health endpoint tests** — 4 tests covering cache stats: empty cache, partial utilization, full utilization, zero-maxSize edge case

---

## [1.16.3] - 2026-02-20

### Added
- **RecommendationPrefs test coverage** — 6 tests covering genre bonus, era range bonus, mood preset scoring, invalid mood graceful handling, stacked multi-bonus ranking, and empty prefs passthrough. These preference bonuses (added in v1.16.0) previously had zero test coverage
- **Timeline generator tests** — 6 tests for `generateTimeline`: invalid date guard, data point shape validation, 48-month cap, release date anchoring, billboard position windowing (months 1–20 only), and custom peakMonth parameter
- **`toSlug` utility tests** — 6 tests covering lowercase/hyphenation, special character stripping, consecutive separator collapse, numeric content, and empty string edge case
- **`formatDate` utility tests** — 5 tests covering locale formatting, unparseable date fallback (returns raw input instead of "Invalid Date"), custom Intl options, empty string handling, and year-only string parsing

---

## [1.16.2] - 2026-02-20

### Fixed
- **Redundant `splitArtists()` regex parsing in recommendation pipeline** — Each candidate song had its artist string parsed twice: once during scoring and again during the diversity filter. The `ScoredSong` interface now carries pre-parsed artist arrays through the pipeline, eliminating N redundant regex operations per recommendation request
- **Redundant `safeYear()` Date construction across scoring and diversity analysis** — Added a bounded memoization cache (256 entries) to `safeYear()` so repeated calls with the same release date string skip `new Date()` construction entirely. The cache self-clears when full to prevent unbounded memory growth

---

## [1.16.1] - 2026-02-19

### Changed
- **Dependency updates** — Bumped 10 packages to latest compatible versions: react 19.2.3→19.2.4, react-dom 19.2.3→19.2.4, eslint-config-next 16.1.4→16.1.6, lucide-react 0.562.0→0.575.0, recharts 3.6.0→3.7.0, tailwindcss 4.1.18→4.2.0, @tailwindcss/postcss 4.1.18→4.2.0, @types/react 19.2.9→19.2.14, @types/node 20.19.30→20.19.33, typescript-eslint packages synced

### Security
- **Audit note** — 15 remaining vulnerabilities (all in eslint 9 dependency tree: ajv ReDoS, minimatch ReDoS) are dev-only and require eslint 10 migration (breaking change, tracked separately). No runtime impact

---

## [1.16.0] - 2026-02-19

### Added
- **User-configurable playlist generation settings** — New `PlaylistConfigurator` component on the song detail page lets users tune recommendation results by preferred genres, release era range (2015–2025), and mood preset (Upbeat / Chill / Melancholy / Energetic). Preferences apply additive scoring bonuses (`PREFERRED_GENRE_BONUS = 12`, `PREFERRED_ERA_BONUS = 10`, `MOOD_MATCH_BONUS = 10`) on top of existing Euclidean distance scoring, so results still make sense when no preferences are set
- **`RecommendationPrefs` type** — Exported from `recommendations.ts` for type-safe preference passing through the engine
- **localStorage persistence** — User preferences saved under `mtm-rec-prefs` key and restored on page load, matching the existing `ThemeProvider` pattern

---

## [1.15.2] - 2026-02-19

### Fixed
- **Era diversity ratio used pick count as denominator, making "Wide mix" unreachable** — `getDiversityMeta()` calculated `eraRatio` as `(eras.size - baseline) / picks.length`, but decades are inherently coarser than genres (a catalog spanning 2017–2024 only covers 2 decades). With 4 picks, the era component maxed out at `1/4 × 40 = 10` points, capping the total diversity score at ~70 and making the "Wide mix" label (≥75) mathematically impossible. Now normalizes against a fixed `ERA_FULL_SPREAD = 2` constant, so spanning 2+ distinct decades gives full era credit (40 points). A set of 4 different genres across 2 decades now correctly scores 80 ("Wide mix") instead of 70 ("Good variety")

### Added
- **1 new test case** — verifies "Similar vibe" label for 2 genres within a single era (238 tests total)

---

## [1.15.1] - 2026-02-19

### Security
- **Applied `safeHref()` to AudioPlayer Spotify link** — `AudioPlayer.tsx` rendered `spotifyUrl` directly in `<a href>` without protocol validation, while all other external links (SongHeader, PlatformCard, GeniusCard) used `safeHref()`. Now validates the URL and suppresses the link entirely if it's non-HTTPS (no inert `#` anchor rendered)
- **Hardened `sanitizeQuery()` against null byte and control char injection** — Added stripping of null bytes (`\x00`) and unicode control characters (C0 range U+0000–U+001F, DEL U+007F, C1 range U+0080–U+009F) before existing HTML/char sanitization. Null bytes can truncate strings in C-backed parsers (e.g. path traversal via `photo\x00.js`); control chars can confuse WAFs, log parsers, and downstream text processing
- **Expanded `Permissions-Policy` from 3 to 11 blocked APIs** — Added `payment=()`, `usb=()`, `bluetooth=()`, `serial=()`, `hid=()`, `idle-detection=()`, `screen-wake-lock=()`, `web-share=(self)` to prevent unauthorized access to sensitive browser APIs via injected iframes or compromised third-party scripts

### Added
- **2 new test cases** — null byte stripping (`\x00` truncation attack) and C0/C1 control character removal (`\x09`, `\x0A`, `\x0D`, `\x85`, `\x8D`) in `sanitizeQuery` (237 tests total)

---

## [1.15.0] - 2026-02-18

### Changed
- **Extracted `formatDate()` shared utility** — Consolidated 4 inline `formatDate` implementations (SongHeader, YouTubeCard, BillboardCard, SongMilestones) into `src/lib/formatDate.ts`. The shared version includes NaN-safe fallback that only `SongMilestones` had — the other 3 would render `"Invalid Date"` on bad input. Accepts optional `Intl.DateTimeFormatOptions` for the "short" vs "long" month variants
- **Extracted `toSlug()` shared utility** — Consolidated 3 copies of the `name.toLowerCase().replace(/[^a-z0-9]+/g, "-")` slug pattern (SongHeader, mockData, spotify.ts) into `src/lib/toSlug.ts`. Single source of truth for artist URL generation
- **Extracted `generateTimeline()` to dedicated module** — The 45-line synthetic timeline generator was duplicated verbatim in both `mockData.ts` and `dataFetcher.ts`. A previous bugfix (e0bdbf1) only patched one copy — proving this was an active maintenance hazard. Now lives in `src/lib/timeline.ts` imported by both consumers

---

## [1.14.0] - 2026-02-18

### Changed
- **Extracted named constants from recommendation algorithm** — All tuning knobs (`FEATURE_WEIGHTS`, `SAME_ARTIST_BONUS`, `SAME_ERA_BONUS`, `DISTANCE_TO_SCORE`, thresholds for reason classification, diversity formula weights) are now declared at module scope with JSDoc. Previously embedded as magic numbers across a 75-line function, making the scoring model opaque to tune or audit
- **Extracted `featureDistance()` pure function** — The 4D weighted Euclidean distance calculation (danceability, energy ×1.5, valence ×1.5, normalized tempo ×0.8) is now an independently callable function with tempo normalization co-located with the weight constants
- **Extracted `classifyReason()` pure function** — Replaced a 6-level nested ternary chain with sequential early-return conditionals. Each recommendation reason ("Same artist", "Nearly identical vibe", "High energy match", "Similar mood", "Same era", "Similar sound") is now a single readable line. Adding a new reason requires one `if` insertion instead of editing a fragile ternary tree
- **Extracted `decadeLabel()` helper** — DRYed the `Math.floor(year / 10) * 10}s` pattern used in both branches of `getDiversityMeta()`, eliminating a subtle copy-paste divergence risk
- **Reorganized module into logical sections** — Algorithm constants → helpers → scoring → diversity meta → artist parsing → recommendation engine, with section headers for navigation

---

## [1.13.4] - 2026-02-18

### Changed
- **README portfolio upgrade for diversity-aware recommendations** — Expanded the Similar Songs and Engineering Highlights sections to articulate the full depth of the diversity-picked system: 4D weighted Euclidean distance scoring, collaboration parser (`ft.`, `feat.`, `&`, `,`, `with` with 2-char `R&B` guard), greedy artist-deduplication loop with target artist pre-seeding, `getDiversityMeta()` genre/era scoring formula (60%/40% weighting), timezone-safe `safeYear()` with `getUTCFullYear()`, and tiered match score SVG badges. Expanded test suite table to reflect full recommendation test coverage including `splitArtists`, `getDiversityMeta`, and `safeYear`

---

## [1.13.3] - 2026-02-18

### Fixed
- **Timezone drift in `safeYear()` era calculation** — `getFullYear()` returns local-time year, but `new Date("2022")` parses as UTC midnight. In western-hemisphere timezones (e.g. EST/EDT), this silently shifted years backward (2022 → 2021), corrupting era labels in the diversity indicator. Switched to `getUTCFullYear()` for consistent cross-timezone behavior
- **Whitespace-only date strings bypassed NaN guard** — `safeYear("   ")` passed the `!date` check (truthy), then produced `NaN` from `new Date("   ")`. Now trims before the falsy check
- **Missing NaN guard in `mockData.ts` `generateTimeline()`** — The NaN guard from `e0bdbf1` was only applied to `dataFetcher.ts`, leaving the duplicate `mockData.ts` copy vulnerable to `RangeError` on invalid dates

### Added
- **5 new tests** — timezone-safe year parsing, whitespace date handling, API placeholder strings (`"TBD"`, `"Unknown"`, `"N/A"`), timeline NaN integrity across mock catalog, whitespace release date in pipeline (235 tests total)

---

## [1.13.2] - 2026-02-18

### Fixed
- **Negative diversity score from invalid target dates** — `getDiversityMeta()` era ratio subtracted 1 for the target's baseline era unconditionally, but when `safeYear()` returned `null` for an invalid target date, the target era was never added to the set. This made `(eras.size - 1)` negative, dragging the diversity score below its intended floor. Now conditionally subtracts the baseline only when the target era was actually contributed, with `Math.max(0, ...)` as a safety floor

### Added
- **2 new tests** — negative score regression test with all-invalid dates, and correct scoring when only the target date is invalid (230 tests total)

---

## [1.13.1] - 2026-02-17

### Fixed
- **Timeline NaN contamination from unparseable release dates** — `generateTimeline()` now validates the parsed `Date` object before generating data points. Previously, truthy-but-unparseable strings (e.g. `"TBD"`, `"Unknown"`) from the Genius API bypassed the `||` fallback guard and produced `Invalid Date`, causing NaN-contaminated timeline entries (dates like `"NaN-NaN-NaN"`, `NaN` metric values). The function now returns an empty timeline for invalid dates instead of silently generating garbage
- **Genius release date fallback hardened** — `fetchGeniusSongData()` now validates the parsed date _before_ using it, not just checking truthiness. A Genius response with `releaseDate: "TBD"` previously passed the `||` check (it's truthy), producing an invalid `releaseDate` on the `SongData` object and a corrupted timeline. Now falls back to today's date for any unparseable value

### Added
- **1 new test** — Genius song with unparseable release date (`"TBD"`) verifies the fallback produces a valid `releaseDate` and NaN-free timeline data points (228 tests total)

---

## [1.13.0] - 2026-02-17

### Added
- **Song Journey milestone timeline** (`src/components/SongMilestones.tsx`) — Animated vertical timeline on the song detail page showing key moments in a song's life. Extracts milestones from cross-platform data: release date (with album name), YouTube music video publish date, Billboard Hot 100 entry (with entry position and total weeks), Billboard peak position (with #1 celebration copy), and Genius community annotations (when ≥20). Milestones are chronologically sorted and rendered with platform-colored node icons, staggered Framer Motion entrance animations, and WCAG-accessible `role="list"` semantics. Requires at least 2 milestones to render — gracefully returns null for sparse data. 22 components total

---

## [1.12.2] - 2026-02-17

### Security
- **Protocol validation on all external `href` attributes** — Created `safeHref()` utility (`src/lib/safeHref.ts`) that validates URLs use the `https:` protocol before rendering them as `<a href>`. Applied to all components that render API-sourced URLs: `SongHeader.tsx` (Spotify, YouTube, Genius links), `PlatformCard.tsx` (external link icon), and `GeniusCard.tsx` (View Lyrics button). Blocks `javascript:`, `data:`, `vbscript:`, `http:`, `ftp:`, `file:`, and any other non-HTTPS protocol. Links with invalid URLs are suppressed entirely rather than rendering as inert `#` anchors. Defense-in-depth against XSS via compromised API responses — React escapes text content but does NOT sanitize `href` attributes

### Added
- **12 `safeHref` unit tests** — HTTPS passthrough, `javascript:`/`data:`/`vbscript:`/`http:`/`ftp:`/`file:` protocol blocking, undefined/null/empty/malformed URL handling (227 tests total)

---

## [1.12.1] - 2026-02-17

### Security
- **SSRF origin validation on all outbound API requests** — Created `safeFetch()` wrapper (`src/lib/safeFetch.ts`) that validates the final resolved URL origin against an explicit allowlist before any server-side request is made. All three API clients (Spotify, YouTube, Genius) now route through `safeFetch()` instead of bare `fetch()`. Blocks cloud metadata endpoints (169.254.169.254), internal IPs, localhost, `@`-credential URL tricks, subdomain spoofing (api.spotify.com.evil.com), HTTP downgrades of HTTPS origins, and arbitrary external domains. Defense-in-depth against SSRF even when URL construction uses hardcoded base URLs — catches edge cases from encoded characters, future code changes, or template string manipulation
- **Genius ID NaN guard** — `dataFetcher.ts` now validates the parsed Genius ID is a positive integer before passing it to the API client. Previously, `parseInt("not-a-number", 10)` produced `NaN` which would propagate to `getGeniusSong(NaN)` and construct a malformed API URL (`/songs/NaN`)
- **Cross-Origin-Embedder-Policy header** — Added `credentialless` COEP to complete cross-origin isolation alongside the existing COOP `same-origin` header. Mitigates Spectre-class side-channel attacks by ensuring cross-origin resources are loaded without credentials unless explicitly opted in

### Added
- **12 SSRF validation tests** — Coverage for all 4 allowed origins, cloud metadata blocking, localhost blocking, internal IP blocking, arbitrary domain blocking, `@`-credential trick, malformed URL rejection, HTTP downgrade blocking, subdomain spoofing (215 tests total)

---

## [1.12.0] - 2026-02-17

### Added
- **Responsive navigation with route links** — Navigation bar now includes Home and Compare links with active-state indicators (accent highlight + dot badge on mobile). Desktop shows inline pill-style links with a divider before the theme toggle. Mobile gets a hamburger menu with an animated dropdown panel and backdrop overlay
- **Mobile hamburger menu** — Slide-down menu with Framer Motion animations, body scroll lock, Escape-to-close, click-outside dismiss, and `aria-expanded`/`aria-controls` attributes for full WCAG accessibility
- **Active route highlighting** — `usePathname` tracks the current page and highlights the matching nav link with the accent color. Uses `startsWith` for nested routes, exact match for home

---

## [1.11.2] - 2026-02-17

### Added
- **9 integration tests for diversity filter pipeline** — End-to-end coverage for `getSimilarSongs()` → `getDiversityMeta()` composition, specifically targeting the NaN-guard and artist pre-seed fixes that shipped without integration tests. Covers: mixed valid/invalid date propagation, garbage date era-bonus safety, multi-credit collaboration pre-seeding (ft., &, comma separators), UI contract validation (sorted eras, valid labels, integer matchScores), and edge cases (all-same-artist catalog, empty recommendations). 203 tests total

---

## [1.11.1] - 2026-02-17

### Fixed
- **Diversity score NaN contamination** — `getDiversityMeta()` and `getSimilarSongs()` now guard against invalid, missing, or empty `releaseDate` values via a new `safeYear()` helper. Previously, `new Date(undefined).getFullYear()` produced `NaN`, which created phantom `"NaNs"` era entries — corrupting diversity scores and rendering garbage era tags in the UI (e.g. "spans 2020s & NaNs"). Invalid dates are now excluded from era calculations entirely
- **Era bonus crash for missing dates** — The same-era bonus (+8 points) in `getSimilarSongs` now safely skips candidates with unparseable release dates instead of producing NaN comparisons that silently awarded or denied the bonus

### Added
- **`safeYear()` utility** — Extracted reusable date-year parser that returns `null` instead of `NaN` for invalid inputs. Used across both diversity scoring and similarity matching
- **8 new tests** — `safeYear` unit tests (valid dates, undefined, null, empty string, unparseable), `getDiversityMeta` invalid-date edge cases (missing pick dates, invalid target date, all-invalid dates) — 194 tests total

---

## [1.11.0] - 2026-02-16

### Changed
- **Extracted shared `formatCompact()` utility** (`src/lib/formatNumber.ts`) — Unified three duplicate number-formatting functions (`formatNumber` in spotify.ts, `formatViews` in genius.ts, `formatCount` in youtube.ts) into a single polymorphic function that handles `number`, numeric `string`, `undefined`, and `null` inputs. All three API clients now import from one source, eliminating ~30 lines of duplicated B/M/K formatting logic and ensuring consistent thresholds across platforms

### Added
- **`formatCompact` test suite** — 9 tests covering billion/million/thousand thresholds, sub-1000 passthrough, numeric string parsing (YouTube API pattern), undefined/null/empty/NaN handling, and non-numeric string passthrough (186 tests total)

---

## [1.10.1] - 2026-02-16

### Security
- **Rate limit bypass via IP spoofing closed** — `extractClientIp()` now validates extracted IPs against IPv4/IPv6 format patterns before using them as rate limit bucket keys. Previously, an attacker could send `X-Forwarded-For: random-string-{n}` on every request, creating a fresh rate limit bucket each time and completely bypassing per-IP rate limiting. Invalid IPs now fall back to a shared `"unknown-invalid"` bucket, making spoofing counterproductive — all spoofed requests compete for the same token allocation
- **`x-real-ip` header also validated** — Previously `x-real-ip` was trusted without any format check. Now receives the same IPv4/IPv6 validation as `x-forwarded-for`
- **Prototype pollution defense in `sanitizeQuery()`** — Queries that resolve to exactly `__proto__`, `constructor`, or `prototype` after sanitization are now rejected (return empty string). Prevents potential prototype pollution if query values are ever used as object keys in downstream code
- **7 new security tests** — IP spoofing rejection (garbage strings, SQL injection payloads), IPv6 acceptance, shared-bucket funneling assertion, prototype pollution blocking, and safe substring passthrough (177 tests total)

---

## [1.10.0] - 2026-02-16

### Added
- **Diversity indicator on Similar Songs** — A visual bar above recommendations shows how genre-diverse the picks are. Displays color-coded genre chips (Pop, R&B, Country, etc.), era span tags, and a scored diversity label (Wide mix / Good variety / Similar vibe / Narrow focus). Uses the same emerald/sky/amber color language as match scores for consistency
- **`getDiversityMeta()` function** — Analyzes recommendation sets by genre spread (60% weight) and era spread (40% weight) to produce a 0–100 diversity score with human-readable labels. Genres resolved via the existing `songGenres` map; eras derived from release dates
- **7 new tests for `getDiversityMeta`** — Coverage for empty picks, genre detection from mock IDs, era calculation, multi-era detection, comparative scoring, label thresholds, and alphabetical genre sorting (170 tests total)

---

## [1.9.1] - 2026-02-16

### Fixed
- **Diversity filter pre-seeds target artists** — `getSimilarSongs` now excludes the target song's own artists from recommendations. Previously, viewing "Lady Gaga & Bruno Mars" could surface "Bruno Mars - 24K Magic" as a recommendation because the diversity filter only tracked *picked* artists, not the target's. The `seenArtists` set is now initialized with `targetArtists`, ensuring recommendations always surface new artists rather than more songs by the same artist
- **Removed unused `afterEach` import** in `apiHandler.test.ts` — Eliminated the last ESLint warning in the codebase

---

## [1.9.0] - 2026-02-16

### Changed
- **Extracted comparison engine into `src/lib/comparison.ts`** — Moved `parseMetric`, `COMPARISON_METRICS`, and `buildInsights` out of `dataFetcher.ts` into a dedicated module. `dataFetcher.ts` now focuses purely on data orchestration (fetching, caching, resolution), while comparison logic is independently importable and testable. Backwards-compatible re-export of `parseMetric` from `dataFetcher.ts` ensures zero breaking changes for existing consumers

### Added
- **Comparison module test suite** — 12 tests covering `parseMetric` (6 cases), `COMPARISON_METRICS` structure validation (2 cases), and `buildInsights` logic (4 cases including missing platform graceful skip, tie detection, `lowerWins` inversion for Billboard Peak, and song2 winner path)

---

## [1.8.3] - 2026-02-16

### Added
- **API handler middleware test suite** — 8 tests covering `withRouteHandler` and `jsonWithCache` in `apiHandler.ts`, the previously untested middleware wrapping all 6 API routes. Tests verify rate limit enforcement (429 on exceeded limits), error containment (500 responses never leak internal error messages or secrets), non-Error thrown value handling, request context forwarding, and cache header injection

---

## [1.8.2] - 2026-02-16

### Fixed
- **ShareCard modal accessibility** — Added focus trap (Tab cycles within modal), Escape key dismissal, backdrop click-to-close, `role="dialog"` with `aria-modal="true"`, and focus restoration on unmount. Previously keyboard users could tab behind the modal and had no way to dismiss it via keyboard (WCAG 2.1 SC 2.1.2)
- **SearchBar autocomplete ARIA roles** — Added `role="combobox"` with `aria-expanded`, `aria-autocomplete="list"`, `aria-controls`, and `aria-activedescendant` to the input. Dropdown now has `role="listbox"` with `role="option"` and `aria-selected` on each result. Screen readers can now navigate search suggestions
- **AudioPlayer play button missing label** — Added dynamic `aria-label` ("Play preview" / "Pause preview") so screen readers announce the button's purpose
- **AudioPlayer seek bar keyboard access** — Progress bar now has `role="slider"` with full ARIA attributes (`aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`) and Arrow key support for keyboard-only seeking (±2s per press)

---

## [1.8.1] - 2026-02-15

### Security
- **Nonce-based CSP eliminates `'unsafe-inline'` from `script-src`** — Created `src/proxy.ts` (Next.js 16 proxy) that generates a cryptographically random nonce per request. The nonce is injected into the `Content-Security-Policy` header and passed to the layout via `x-nonce` request header. Next.js automatically applies the nonce to framework scripts, bundles, and inline styles. The FOUC-prevention theme script now uses `<Script nonce={nonce}>` instead of `dangerouslySetInnerHTML`. This closes the last major XSS vector — injected inline scripts are now blocked by the browser since they can't guess the per-request nonce
- **`'strict-dynamic'` CSP directive** — Added alongside nonces so dynamically-loaded scripts trusted by nonced scripts also execute, while still blocking attacker-injected scripts. This is the CSP Level 3 best practice for SPAs
- **CSP moved from static headers to dynamic proxy** — `next.config.ts` no longer sets CSP (static headers can't contain per-request nonces). All other security headers (HSTS, X-Frame-Options, etc.) remain in `next.config.ts`
- **Dev-mode CSP safety** — `'unsafe-eval'` only in development (HMR needs it), stripped in production. `'unsafe-inline'` for styles only in dev; production uses nonces for style tags too

---

## [1.8.0] - 2026-02-15

### Added
- **QuickStats summary bar on song detail page** — New at-a-glance stats strip between the song header and timeline chart. Shows abbreviated cross-platform metrics (Spotify streams, YouTube views, Billboard peak/weeks, Genius page views) with color-coded icons. Adapts grid columns to available data — songs with 2 platforms get 2 columns, fully-loaded songs get 5. Smart number abbreviation (2,400,000,000 → 2.4B). Fully accessible with ARIA roles
- **QuickStats test suite** — 7 tests covering empty state, per-platform rendering, abbreviation accuracy, full-data rendering, and accessibility attributes

---

## [1.7.2] - 2026-02-15

### Added
- **Comprehensive JSDoc on all TypeScript interfaces** (`src/types/index.ts`) — Every interface and field now has documentation with `@example` values, value ranges, and architectural notes. Module-level doc explains the nullable platform pattern and why numeric fields use strings
- **Updated component tree in ARCHITECTURE.md** — Fixed stale component count (17 → 20) and added missing components: `PageStates`, `FilterBar`, `SafeImage`, `PlatformCard`, `SimilarSongs`. Component tree now shows shared utility components and `PageStates` reuse across song/artist pages

---

## [1.7.1] - 2026-02-15

### Security
- **CSP `form-action 'self'` directive** — Blocks XSS payloads from submitting forms to attacker-controlled servers. `form-action` is not covered by `default-src`, so without this directive a script injection could exfiltrate data via form submission even with strict CSP
- **CSP `upgrade-insecure-requests` directive** — Forces browsers to rewrite any `http://` subresource URLs to `https://`, catching mixed-content issues that slip past code review
- **`Cross-Origin-Resource-Policy: same-origin` header** — Prevents other origins from embedding API responses as subresources, mitigating Spectre-class cross-origin data leakage
- **Safe error logging in `apiHandler.ts`** — Error handler now logs only `error.message` instead of the full error object, preventing upstream API internals, response bodies, and file-path-containing stack traces from appearing in production logs
- **`npm run audit` script** — Added `npm audit --audit-level=moderate` as a package script for CI/CD integration. `npm audit` returns 0 vulnerabilities as of this audit

---

## [1.7.0] - 2026-02-14

### Changed
- **Extracted `PageLoadingState` / `PageErrorState` shared components** (`src/components/PageStates.tsx`) — Song detail and artist pages both duplicated identical full-screen loading spinners and error-with-back-link states (~15 lines each). Now import from a single shared module, eliminating 4 copy-pasted blocks
- **Consolidated `getSongData` cache logic** — Extracted `resolveSongData()` helper that handles the mock → API-prefix → enrichment → fallback resolution chain. The 5 separate `songCache.set()` calls collapsed to one, making the caching boundary explicit and the resolution logic easier to follow
- **Removed dead `getConfiguredApis()`** — Function computed configured API names on every search/song request, but no client component ever consumed the `apis` field. Removed the function and the `apis`/`_meta` properties from search and song API responses
- **Artist route now uses `jsonWithCache`** — `/api/artist/[id]` was the only data route returning bare `NextResponse.json()` without `Cache-Control` headers, causing redundant API calls for repeated artist lookups. Now matches song/compare/catalog pattern with 1-hour `s-maxage`

### Removed
- `getConfiguredApis()` from `dataFetcher.ts` — dead code, never consumed by frontend
- `apis` field from `/api/search` response — unused metadata
- `_meta` wrapper from `/api/song/:id` response — unused metadata

> *"Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away."* — Antoine de Saint-Exupery

---

## [1.6.3] - 2026-02-14

### Fixed
- **`splitArtists()` `&` separator required surrounding whitespace** — The regex used `\s+&\s+` which only matched `" & "` with spaces on both sides. Real-world Spotify data can have `"A&B"`, `"A& B"`, or `"A &B"` — all of which silently bypassed the diversity filter, allowing duplicate-artist recommendations. Now uses `\s*&\s*` (optional whitespace)
- **`splitArtists()` broke genre-like names with `&`** — The lenient `&` split would incorrectly split `"R&B"` into `["R", "B"]`. Added a 2-character minimum guard: `&` only splits when both sides are ≥2 characters
- **Removed undocumented `x` separator** — JSDoc claimed support for `"Future x Metro Boomin"` but the regex never implemented it. Rather than add a fragile `x` split (which breaks artist names like `"Lil Nas X"`), removed the false documentation

### Added
- 2 new tests for `splitArtists` edge cases (spaceless `&` splits, `R&B` preservation), bringing total to 134

---

## [1.6.2] - 2026-02-14

### Fixed
- **Diversity filter bypass for `&` / `,` / `with` collaborations** — `primaryArtist()` only stripped `ft.`/`feat.` credits, so "Lady Gaga & Bruno Mars" and "ROSÉ & Bruno Mars" were treated as unrelated artists and could both appear in recommendations. New `splitArtists()` function parses all common collaboration separators, and the diversity filter now checks *every* credited artist against the seen-set — not just the primary
- **Same-artist bonus missed for `&` collaborations** — Scoring now detects shared credits across any separator, so "Bruno Mars" correctly gets the +15 same-artist bonus when compared to "Lady Gaga & Bruno Mars"

### Added
- 11 new tests covering `splitArtists()` parsing (8 tests) and `&`-collaboration diversity enforcement (2 + 1 primaryArtist test), bringing total to 132

---

## [1.6.1] - 2026-02-14

### Changed
- **README.md portfolio-grade overhaul** — Added at-a-glance stats bar (19 components, 121 tests, 6 API routes, 4 platforms, 0 config required), test coverage badge, restructured features into scannable emoji-anchored sections with bullet breakdowns instead of dense paragraphs, converted Engineering Highlights from prose to comparison table format, added per-route rate limit column to API routes table, broke test coverage from a single paragraph into a suite-by-suite table, and added Contributing section with codebase conventions (middleware pattern, data layer rules, styling tokens, type boundaries). Tighter hero copy, cleaner visual hierarchy for both recruiter quick-scan and engineer deep-dive audiences

---

## [1.6.0] - 2026-02-14

### Added
- **Match Score Badges** — Each similar song recommendation now displays a circular progress badge showing the percentage match (0–99%) with color-coded tiers: emerald (≥80%), sky blue (≥60%), amber (≥40%), muted (below). The recommendations engine now exposes the numeric similarity score alongside the reason tag, giving users tangible confidence in each recommendation
- **Color-coded card borders** — Similar song cards render with a subtle ring tint matching their match score tier, reinforcing the visual hierarchy at a glance
- **2 new recommendation tests** — `matchScore` range validation (0–99, integer) and ordering assertion (closer songs get higher scores)

---

## [1.5.4] - 2026-02-13

### Fixed
- **Recommendations same-artist flooding** — `getSimilarSongs()` used pure top-K scoring, allowing multiple songs by the same artist to dominate the 4-slot recommendation grid. Added diversity-aware greedy selection that enforces at most one song per primary artist, scanning past duplicate artists to fill slots with varied picks
- **False-positive same-artist matching** — Artist comparison used `split(" ")[0]` + `includes()`, a fragile heuristic that could match unrelated artists sharing a common word. Replaced with `primaryArtist()` extraction that strips "ft." / "feat." guest credits and compares normalized primary names via strict equality

### Added
- **7 new recommendation tests** — Artist diversity enforcement (at most 1 per artist, diverse fill across limit), "ft." featured artist detection, `primaryArtist()` unit tests (ft./feat. extraction, case insensitivity, passthrough for solo artists)

---

## [1.5.3] - 2026-02-13

### Added
- **Time Machine test suite** (`src/lib/__tests__/timeMachine.test.ts`) — 19 tests covering the core date-to-song matching engine. `getChartForDate`: exact month lookup, zero-padding of single-digit months, leap day handling, out-of-range dates (pre-2019 / post-2024), last-day-of-month edge case, full ChartEntry shape validation. `findClosestChart`: exact month passthrough, closest-month fallback for gaps in data, boundary snapping for dates far outside the range, empty dataset returns null, custom single-entry dataset injection, equidistant month tiebreaking. `historicalNumber1s` data integrity: year span validation, YYYY-MM key format enforcement, required field checks, unique song ID constraint
- **Extracted `timeMachine.ts`** (`src/lib/timeMachine.ts`) — Moved `getChartForDate()`, `findClosestChart()`, `ChartEntry` interface, and `historicalNumber1s` data from `DateSearch.tsx` into a dedicated testable module. `findClosestChart` now accepts an optional `data` parameter for dependency injection in tests. `DateSearch.tsx` updated to import from the new module with zero behavior change

---

## [1.5.2] - 2026-02-12

### Fixed
- **Comparison tie misattribution** — `buildInsights()` in `dataFetcher.ts` used `>=`/`<=` comparisons that silently awarded ties to Song 1 instead of detecting equality. When two songs had identical values (e.g., both peaking at #1 on Billboard), Song 1 was incorrectly declared the "winner." Now uses strict `<`/`>` with an explicit `n1 === n2` tie check, matching the `"tie"` value already defined in the `ComparisonInsight` type
- **Comparison UI missing tie rendering** — `ComparisonView.tsx` only styled `"song1"` and `"song2"` winner states. Tied metrics now display with amber highlight on both sides, a "Tie" label, and a summary count ("2 tied metrics") below the overall score
- **Compare page dropdown stuck open** — `SongSelector` dropdown in `/compare` never closed when clicking outside because `isOpen` was only set to `false` on item selection. Added `useRef` + `mousedown` click-outside handler to dismiss the dropdown when focus leaves the component

---

## [1.5.1] - 2026-02-12

### Fixed
- **Era filter crash on missing `release_date`** — Spotify API can return `null`/`undefined` for `track.album.release_date` on some tracks (singles, EPs, older catalog). `getSpotifyTrack()` and `searchSpotifyTracks()` in `spotify.ts` now fall back to `"Unknown"` instead of propagating `undefined`. `getEra()` in `page.tsx` now guards against missing/malformed release dates with `isNaN()` check, returning `"Unknown"` instead of crashing with `TypeError: Cannot read properties of undefined (reading 'split')`
- **Compare route missing cache headers** — `/api/compare` was the only data route returning bare `NextResponse.json()` without `Cache-Control` headers after the v1.4.0 middleware refactor. Now uses `jsonWithCache()` with 1-hour `s-maxage` and 5-minute `stale-while-revalidate`, matching the song detail route pattern. Eliminates redundant API calls for repeated comparisons

---

## [1.5.0] - 2026-02-12

### Added
- **Genre & Era Discovery Filters** (`src/components/FilterBar.tsx`) — Interactive filter pill bar on the trending songs grid. Users can filter by genre (Pop, R&B, Country, K-Pop, Alt/Indie, Disco/Dance, Funk) and era (2010s, 2020s) with toggle-on/toggle-off selection. Active filters show a result count badge ("5 of 18"). `AnimatePresence` with `mode="wait"` provides smooth cross-fade transitions between filter states; `layout` prop on cards animates grid reflow. Clear button resets all filters. Empty state handles zero-match combinations gracefully
- **Genre classification system** — Added `songGenres` map and `catalogGenres` export to `mockData.ts`, assigning accurate genre tags to all 18 songs. Genre propagates through `SearchResult` type via new optional `genre` field, included in both `searchSongs()` and `getTrendingSongs()` results
- **Full catalog in trending** — `getTrendingSongs()` now returns all 18 songs instead of the previous 10-song cap, making genre filtering meaningful across the complete catalog
- **Genre badge on song cards** — Each trending card now displays a small genre pill below the artist name for at-a-glance categorization

### Fixed
- **`withRouteHandler` RouteContext type** — Changed `RouteContext.params` from `Promise<{ id: string }>` to `Promise<Record<string, string>>` to accommodate routes with no dynamic params (e.g. `/api/catalog`), fixing a TypeScript build error

---

## [1.4.0] - 2026-02-12

### Changed
- **Extracted `withRouteHandler` middleware** (`src/lib/apiHandler.ts`) — New higher-order function that wraps all API route handlers with rate limiting (IP extraction + route-level token bucket check + 429 response) and centralized error handling (try/catch + structured 500 response). Eliminates ~60 lines of duplicated boilerplate across 6 API routes. Adding a new route now requires zero lifecycle code — just business logic
- **Refactored all 6 API routes** — `search`, `song/[id]`, `compare`, `artist/[id]`, `catalog`, and `og/[id]` all use `withRouteHandler()` instead of hand-rolled rate limiting and try/catch blocks. Routes now export `const GET = withRouteHandler(...)` instead of `async function GET(...)`, making the handler a pure expression of its business logic
- **Added `jsonWithCache` helper** — Utility function in `apiHandler.ts` for building `NextResponse.json` with `Cache-Control` headers, replacing 3 inline header objects across search, song, and catalog routes

---

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
