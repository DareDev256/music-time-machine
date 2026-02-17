# Changelog

All notable changes to the Music Time Machine project will be documented in this file.

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
