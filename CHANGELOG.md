# Changelog

All notable changes to the Music Time Machine project will be documented in this file.

## [1.39.0] - 2026-04-13

### Changed
- **Extract `extractSongMeta` helper** — consolidated 6+ scattered `songGenres[id]` + `safeYear(...)` + `decadeLabel(year)` inline lookups across `pickDiverse`, `getDiversityMeta`, and `resolveStrategy` into a single `extractSongMeta(song)` function returning `{ genre, year, decade }`. Eliminates inconsistency risk when metadata extraction logic changes
- **Extract `uniqueByArtist` generator** — the artist-deduplication pattern (`seenArtists.has(a)` / `seenArtists.add(a)`) was duplicated in `pickBestMatch`, `pickDiverse`, and `resolveStrategy`. Now encapsulated in a reusable generator with optional limit parameter
- **Extract `toPickResult` mapper** — both `pickBestMatch` and `pickDiverse` inlined the same `ScoredSong → PickResult` conversion with `clampScore`. Now a single function with optional reason override
- **Simplify `pickBestMatch`** — reduced from 16 lines of imperative loop to a single expression: `[...uniqueByArtist(scored, limit)].map(toPickResult)`

---

## [1.38.2] - 2026-04-13

### Added
- **Cache poisoning defense tests** — 11 tests covering `normalizeKey` security surface: NFC/NFD unicode normalization attacks, zero-width character injection, BOM bypass, control character stripping, and RTL override injection. Also tests `getStats()` (including zero-maxSize edge case) and `has()` expiry-triggered eviction behavior
- **Timeline edge-case tests** — 10 tests covering future release dates, `peakMonth` boundary values (0, negative, very large), value-range invariants for all three metrics, ISO date format validation, and monotonic date ordering

### Discovered (not yet fixed)
- **Timeline `peakMonth=0` NaN bug** — `Math.exp(-0/0)` produces NaN on month 0, corrupting the first data point's spotify/youtube values
- **Timeline billboard inversion overflow** — `101 - billboardPos` can produce negative values when `peak + random*10` exceeds 101; billboard values should be clamped to [1, 100]

---

## [1.38.1] - 2026-04-12

### Fixed
- **Auto-strategy genre dilution in mixed catalogs** — `resolveStrategy` counted candidates without genre mappings toward the inspection budget, consuming slots that should have been reserved for genre-bearing candidates. In catalogs where some songs lack `songGenres` entries, this deflated the detected genre count and prematurely triggered "diverse" mode instead of "best-match". The fix skips genreless candidates when counting toward the inspection limit, so the strategy decision is always based on a full sample of genre-mapped data. 2 regression tests added (mixed mapping → best-match, same-genre mapping → diverse)

---

## [1.38.0] - 2026-04-12

### Added
- **Genre Discovery Progress Ring** on "Pick for Me" button — a row of color-coded dots (one per catalog genre) that illuminate as you explore new genres. Each genre gets an intentional color: violet for Alt/Indie, amber for Country, pink for Disco/Dance, gold for Funk, cyan for K-Pop, blue for Pop, red for R&B. Unexplored dots stay dimmed at 15% opacity and adapt to both light/dark themes. A fractional counter (e.g. "3/7") appears after your first exploration. Newly discovered genres animate with a spring-scale pop. Exploration state is derived from recently-viewed songs via memoized `useExploredGenres` hook. ARIA label updated to announce discovery progress for screen readers

---

## [1.37.4] - 2026-04-11

### Security
- **Centralized request parameter validation** — new `src/utils/requestUtils.ts` provides hardened query parameter parsing for API routes. Defends against HTTP parameter pollution (duplicate key detection via `getAll()`), type coercion attacks (strict integer parsing rejects scientific notation, hex, floats, NaN, Infinity, and unsafe integers), unbounded pagination (server-side offset computation with configurable bounds prevents memory exhaustion), prototype pollution (`__proto__`/`constructor`/`prototype` blocked as param values), control character injection (CRLF/null byte rejection), parameter count limits (max 20 params per request), and injection via sort/filter params (enum allowlist via `Set.has()` — no regex). 30 test cases covering all attack vectors

---

## [1.37.3] - 2026-04-09

### Fixed
- **TTLCache spurious eviction on key update** — `set()` evicted the oldest unrelated entry when updating an existing key at max capacity. `Map.set()` on an existing key doesn't increase size, so the eviction was unnecessary — silently dropping a valid cache entry and degrading hit rates over time. The bug triggered whenever frequently-refreshed queries (e.g. repeated searches) were re-cached while the cache was full. Fixed by checking `has(key)` before the eviction gate. Also eliminated a redundant `normalizeKey()` call in `get()`. 3 regression tests added (update-newest, update-oldest, insert-new at capacity)

---

## [1.37.2] - 2026-04-09

### Fixed
- **Flash-of-error-state on song page** — `useAsyncData` hook reported `loading: false` during the pre-effect "idle" frame, causing consumers like the song detail page to briefly render "Song not found" before the fetch started. The idle state now correctly maps to `loading: true`, eliminating the single-frame error flash on every song navigation. Added regression test to prevent reintroduction

---

## [1.37.1] - 2026-04-09

### Changed
- **README accuracy sync** — corrected 8 stale values across the README to match actual codebase state: test count (589→614 in testing section and contributing gate), suite count (43→44), component count (37→38 in project structure), toSlug test count (6→9). Added 4 missing test suites to the testing table (apiErrorHandler, autoSelect.integration, PlatformShowdown, TasteProfile) with accurate test counts and descriptions. Added 4 missing lib files to the project structure (apiErrorHandler.ts, score-colors.ts, scoring-constants.ts, genre-utils.ts). Marked 4 recently shipped features as completed in the roadmap (Music Timeline, Platform Showdown, Listening DNA, Song Fingerprint). Bumped version badge to 1.37.1

---

## [1.37.0] - 2026-04-08

### Added
- **Music Timeline visualization** — new interactive SVG scatter plot on the home page mapping every song by release date (x-axis) and Billboard peak chart position (y-axis). Circle size encodes total Spotify streams, color encodes genre using the shared palette from GenreConstellation. Hover any dot for a tooltip showing title, artist, genre, peak position, chart weeks, and release year. Click or keyboard-navigate to jump to the song's detail page. Includes genre color legend, `#1` labels for chart-topping hits, glow ring on hover, and graceful dim of non-hovered dots. Horizontally scrollable on mobile with a 620px minimum width. Full ARIA roles and keyboard accessibility

---

## [1.36.4] - 2026-04-07

### Security
- **URL domain extraction hardening** — added `extractDomainFromUrl()` in `src/utils/parsers.ts` with 5 validation layers: type gating, 2 KB length ceiling, ASCII control character rejection (CRLF injection prevention), userinfo stripping (credential-smuggling/phishing defense), and protocol allowlisting (blocks `javascript:`, `data:`, `ftp:`, `file:` schemes). Returns a typed `DomainResult` or `null` — never throws. 25 test cases covering valid URLs, dangerous protocols, credential injection, control characters, overlong input, and non-string edge cases

---

## [1.36.3] - 2026-04-07

### Fixed
- **Slug generation bug** — `toSlug()` produced malformed slugs with leading/trailing hyphens when input started or ended with special characters (e.g. `"  !!!Rock!!!  "` → `"-rock-"` instead of `"rock"`). Also added unicode diacritics normalization so accented artist names produce clean ASCII slugs (`"Beyoncé"` → `"beyonce"` instead of `"beyonc-"`). 8 new test cases covering boundary hyphens, whitespace-only input, all-special-char input, and diacritics

---

## [1.36.2] - 2026-04-07

### Changed
- **README accuracy sync** — corrected 6 stale counts across the README to match actual codebase state: tests (589→581), suites (44→43), components (38→37), project structure annotations (35→37 components, 578→581 tests), contributing test gate (557→581). All numbers now verified against `vitest run` output

---

## [1.36.1] - 2026-04-06

### Added
- **Auto-select integration tests** — 13 tests covering edge cases in the recommendation engine's auto-strategy resolution. Tests missing/undefined/partial strategy parameters, degenerate catalogs (empty, single candidate, all null spotify), unmapped genre IDs forcing diverse fallback, and getAutoInsight state isolation across sequential calls

---

## [1.36.0] - 2026-04-06

### Changed
- **Unified API error handling** — extracted 12 duplicated `error instanceof Error ? error.message : "Unknown"` catch patterns across `genius.ts` (4), `spotify.ts` (4), and `youtube.ts` (3) into a shared `apiErrorHandler.ts` module. New `extractErrorMessage()` safely coerces any thrown value to a string, and `apiCatch()` logs with context prefix and returns a typed fallback in one call. Catch blocks across all three API modules are now one-liners. 11 unit tests cover Error instances, subclasses, string throws, null/undefined/number edge cases, and console.error output verification

---

## [1.35.1] - 2026-04-05

### Added
- **Middleware test suite** — 20 tests covering the edge security middleware that had zero coverage. Tests path traversal blocking (percent-encoded sequences, URL-spec normalization awareness), HTTP method restriction on API routes (405 with Allow header and JSON body), request ID injection (UUID v4 format, uniqueness), X-Robots-Tag on API-only routes, and priority ordering (traversal gate runs before method gate). Documents the interaction between URL-spec normalization and the middleware's defense-in-depth regex

---

## [1.35.0] - 2026-04-05

### Added
- **Platform Showdown** — visual head-to-head between Spotify and YouTube on every song detail page. Compares three dimensions (Reach, Engagement, Discussion) with animated battle bars showing platform split. Includes win counter scoreboard, dominance meter (audio-first vs video-first), and intelligent verdicts (Spotify Stronghold, YouTube Fortress, Balanced Presence, etc.). Uses Framer Motion staggered animations with ease-out curves. Renders only when both platform data sources are available. 7 unit tests covering empty states, verdicts, metric labels, and balanced detection

---

## [1.34.0] - 2026-04-04

### Added
- **Listening DNA** — personalized taste profile card on the home page that aggregates audio features (energy, danceability, valence, tempo) from recently viewed songs into a diamond radar visualization. Classifies listeners into archetypes (The Dynamo, The Optimist, The Dreamer, The Groover, The Storm Chaser, The Explorer) based on feature thresholds. Shows top genre distribution as colored chips, animated feature bars, and a smooth SVG path-draw animation on mount. Auto-hides when fewer than 2 songs have been explored. Includes 8 unit tests covering empty states, archetype classification, genre chips, feature bars, radar rendering, and non-mock ID handling

---

## [1.33.3] - 2026-04-03

### Changed
- **README accuracy overhaul** — corrected stale counts across the entire README: component count (40→35), test suites (37→38), test count in contributing section (272→522), project structure annotation (272→522). Added suites badge to header
- **Test suite table expanded** — added 14 previously undocumented test suites to the testing section (pickNextSong, score-colors, health-route, velocity, artist-utils, genius, recommendations-merged, spotify, useAsyncData, YouTubeCard, rateLimit.response, apiHandler.jsonError, safeFetch.safeJson), updated recommendations count (59→70)
- **Roadmap updated** — marked 5 completed features (Pick for Me, Genre Constellation, Listening Context, Impact Score, Streaming Velocity) that were shipped but never checked off

---

## [1.33.2] - 2026-04-02

### Fixed
- **API error counter** — `withRouteHandler` now increments a centralized error counter on caught exceptions; the health endpoint previously reported `errors: 0` at all times because the counter lived in an unreachable module and was never wired to the actual error path
- **Response header safety** — `withRouteHandler` no longer mutates `response.headers` directly; instead clones via `new Response()` with copied headers, preventing potential throws on immutable-header responses (e.g. `ImageResponse` from `@vercel/og`)

---

## [1.33.1] - 2026-04-01

### Fixed
- **Pick engine null safety** — `pickNextSong` cold-start and least-recently-viewed fallback paths now validate that the selected song ID actually maps to a catalog entry before returning, preventing undefined-access crashes when `Record<string, SongData>` lookups miss
- **DiscoverPick catalog guard** — the "Pick for Me" button now verifies the picked song exists in `mockSongs` before starting the spin animation, preventing navigation to broken `/song/` routes if the catalog changes between pick and render
- **DiscoverPick undefined coercion** — `mockSongs[pick.id]` lookup now uses nullish coalescing (`?? null`) to normalize `undefined` returns to `null`, aligning runtime behavior with the component's type expectations

---

## [1.33.0] - 2026-04-01

### Added
- **Listening Context** — "When to Listen" card on the song detail page that maps audio features to ideal listening scenarios. Derives four contextual recommendations (time of day, activity, setting, season) from danceability, energy, valence, and tempo. Features a generated vibe sentence, staggered tag entrance animations with spring easing, hover interactions, and full ARIA list accessibility

---

## [1.32.0] - 2026-04-01

### Added
- **Genre Constellation** — interactive star map on the home page visualizing the entire catalog by audio features. Songs are positioned by energy (x-axis) and mood/valence (y-axis), colored by genre, and sized by danceability. Features hover spotlighting with floating tooltips, click-to-navigate, staggered spring entry animations, axis labels with quadrant hints, genre legend, and full keyboard accessibility (focus/blur states, Enter to navigate). Dimming effect fades non-hovered stars to 35% opacity for visual focus

---

## [1.31.2] - 2026-03-31

### Fixed
- **`useRecentlyViewed` snapshot instability** — `getSnapshot()` was calling `JSON.parse` on every invocation, returning a new array reference each time. This violated React's `useSyncExternalStore` contract (requires `Object.is`-stable references), causing unnecessary re-renders. Snapshots are now cached and only updated when `writeToStorage` fires
- **`useRecentlyViewed` stale-read on record** — `record()` now reads authoritative localStorage instead of the cached snapshot, preventing stale data when external writes occur (e.g. cross-tab mutations)
- **DiscoverPick empty-catalog navigation crash** — when `pickNextSong` returned an empty ID (empty catalog), the timer chain still fired, navigating to a broken `/song/` route. The component now validates the pick before starting the animation sequence

### Added
- **`useRecentlyViewed` test suite** — 5 tests covering snapshot referential stability, FIFO ordering with max capacity, deduplication on re-view, and localStorage error resilience

---

## [1.31.1] - 2026-03-31

### Added
- **`apiHandler` comprehensive test suite** — expanded from 14 to 26 tests covering: `jsonError` function (400/404/422 status codes and security headers), security header verification on 500 error responses (nosniff, DENY, no-store), thrown edge cases (null, undefined, plain object, rejected promise), plain `Response` return path (not just `NextResponse`), and `jsonWithCache` Cache-Control override + security header assertions

---

## [1.31.0] - 2026-03-30

### Changed
- **Pick-engine scoring constants extracted** — magic numbers in `noveltyScore` (base score 50, genre bonus 30, repeat penalty 8, artist bonus 15, popularity divisor 10) moved to `scoring-constants.ts` as named `PICK_*` exports, making the pick engine's tuning knobs discoverable alongside the recommendation engine's constants
- **Single-pass scoring + reason classification** — `noveltyScore` refactored into `scoreCandidate` that returns both the numeric score and the human-readable reason in one pass, eliminating the duplicated genre/artist novelty checks that ran separately after scoring
- **`genreOf` extracted to shared `genre-utils.ts`** — the `songGenres[id] || "Unknown"` lookup centralised into its own module, importable by both the pick engine and recommendation engine instead of being defined inside `pickNextSong.ts`
- **`primaryArtist` consolidated** — removed the duplicate `primaryArtist` definition from `pickNextSong.ts`; now imports the canonical version from `artist-utils.ts`. A local `displayArtist` helper preserves original casing for user-facing reason strings

---

## [1.30.2] - 2026-03-30

### Added
- **`pickNextSong` test suite** — 24 tests covering all three selection strategies (random discovery, novelty-scored pick, least-recently-viewed revisit) plus the `primaryArtist` and `genreOf` helper functions. Uses `vi.hoisted()` to mock the catalog layer with a controlled 5-song dataset and pins `Math.random` for deterministic assertions. Tests cover: compound artist credit splitting (feat./ft./&/,/with), genre fallback, empty catalog guard, genre diversity bonus, artist diversity bonus, over-represented genre penalty, top-N randomness boundary, single-candidate edge case, and PickResult shape contract across all code paths

---

## [1.30.1] - 2026-03-29

### Fixed
- **DiscoverPick timer race condition** — moved `setTimeout` calls from the `handlePick` callback into a `useEffect` with proper cleanup. Previously, if a user navigated away during the 1.4s spin→reveal→navigate sequence, both timers would fire after unmount — causing React state-update warnings and ghost navigation to the wrong page. Timers now cancel automatically on unmount via `useEffect` cleanup + `useRef` belt-and-suspenders guard
- **Empty catalog guard in `pickNextSong`** — added a defensive check for `catalogIds.length === 0` that returns a safe fallback instead of crashing with `undefined` access on `catalogIds[idx]`. Prevents runtime errors if the mock data module is ever empty or slow to load

---

## [1.30.0] - 2026-03-29

### Added
- **Chart Journey visualization** — animated SVG component (`ChartJourney`) on the song detail page that traces a song's Billboard Hot 100 trajectory. Uses cardinal-spline interpolation (tension 0.35) for smooth curves between chart positions, gradient area fill, and stroke-dashoffset animation that draws the path on mount. Peak position highlighted with a spring-animated marker. Summary stats row shows entry → peak → latest with date labels and trend arrows. Fully accessible with ARIA description. Renders conditionally when Billboard chart history has ≥2 data points

---

## [1.29.0] - 2026-03-28

### Added
- **Song Fingerprint visualization** — unique generative SVG identity for each song on the detail page (`SongFingerprint` component). Each fingerprint is deterministically derived from the track's audio features: valence maps to colour temperature (indigo → pink → orange), energy controls waveform amplitude, danceability sets segment count, and tempo shapes the inner ring density. Includes animated entrance with staggered pathLength reveals, accent dots, and centre pulse. Fully accessible with ARIA labels describing mood and energy. Responsive layout with feature legend showing mood label, energy class, danceability percentage, and BPM

---

## [1.28.1] - 2026-03-28

### Changed
- **Refactor `pickNextSong` module** — extracted two shared helpers (`primaryArtist`, `genreOf`) to eliminate duplicated logic. The compound-artist splitting regex (`feat.`, `ft.`, `&`, `,`, `with`) previously appeared in 3 separate locations; the genre-with-fallback lookup appeared in 5. Both are now single-source-of-truth functions with JSDoc, exported for reuse and testability. Regex compiled once as a module-level constant (`FEAT_SPLIT`) instead of re-created on every call. Zero behavioral change — all 481 tests pass unchanged

---

## [1.28.0] - 2026-03-27

### Added
- **Pick for Me auto-select** — intelligent song discovery button on the home page (`DiscoverPick` component). Analyzes recently viewed songs via `pickNextSong` engine to maximize genre diversity (+30 for unexplored genres), avoid repeats, and reward new artists (+15). Falls back to random entry when no history exists, or resurfaces least-recently-viewed when entire catalog explored. Three-phase button animation (idle → spinning disc → album art reveal with reason tag) before navigating. Slight top-3 randomness prevents repetitive picks
- New `src/lib/pickNextSong.ts` — pure scoring function with novelty-based candidate ranking, artist/genre profile extraction from viewing history, and three fallback strategies (random, novelty-scored, least-recent revisit)
- Home page action row now features Compare + Pick for Me side-by-side with responsive stacking on mobile

---

## [1.27.2] - 2026-03-27

### Fixed
- **Unsafe type casts in `useAsyncData`** — replaced `IDLE as AsyncState<T>` with a generic factory function `createIdle<T>()` that produces properly typed initial state without assertion. Replaced `(err as Error).name` and `(err as Error).message` casts in the catch block with `instanceof`-based type guards (`isAbortError`, `toErrorMessage`) that correctly handle non-Error rejection values (strings, numbers, objects) instead of silently swallowing them
- **Unnecessary `as string` cast in `getAccessToken`** — the Spotify token function used `return accessToken as string` on a module-level `string | null` variable. Refactored to capture the token in a local `const` before assignment, giving TypeScript a narrow `string` type without any assertion
- Updated test expectation for string rejection values to match the improved behavior (string errors now surface their actual message instead of falling through to the generic fallback)

---

## [1.27.1] - 2026-03-27

### Added
- **Velocity module test suite** — 18 tests covering `calculateVelocity()` and `TIER_META` from `velocity.ts`. Tests daily rate arithmetic (total ÷ days), all four tier boundary classifications (viral ≥ 2M, hot ≥ 500K, steady ≥ 100K, catalogue), null platform graceful degradation, invalid/empty release date fallback to 365 days, same-day release floor to 1 day, billboard `weeksOnChart` passthrough, and `combinedDaily` sum correctness. Deterministic via pinned `Date.now()` mocks. Total test count: 463 → 481

---

## [1.27.0] - 2026-03-26

### Added
- **Streaming Velocity** — new song detail section showing daily average Spotify streams, YouTube views, Billboard weeks on chart, and days since release. Metrics animate on mount with ease-out cubic timing. Songs are classified into velocity tiers (Viral / Hot / Steady / Catalogue) with color-coded badges and glow effects. A proportional Spotify-vs-YouTube bar shows platform dominance at a glance. Utility module (`velocity.ts`) reuses existing `parseCount` from `impactScore.ts` for consistent number parsing

---

## [1.26.2] - 2026-03-25

### Changed
- **Refactored `SongHeader` component** — extracted `HeaderStat` and `PlatformLink` sub-components to eliminate three copy-pasted stat blocks and three copy-pasted external link blocks. The header now uses data-driven rendering, reducing ~70 lines of duplicated JSX to composable, typed components that are easier to maintain and extend with new platforms

---

## [1.26.1] - 2026-03-25

### Security
- **Next.js 16.1.6 → 16.2.1** — patches 5 CVEs: HTTP request smuggling in rewrites (GHSA-ggv3-7p47-pfv8), unbounded next/image disk cache exhaustion (GHSA-3x4c-7xq6-9pq8), postponed resume buffering DoS (GHSA-h27x-g6w4-24gq), null origin CSRF bypass on Server Actions (GHSA-mq59-m269-xvcx), null origin HMR websocket CSRF bypass (GHSA-jcc7-9wpm-mj36)
- **`crypto.timingSafeEqual` in health auth** — replaced manual byte-loop comparison with Node.js native constant-time comparison to eliminate timing side-channel on `HEALTH_AUTH_TOKEN` verification
- **Resolved .env.example merge conflict** — removed git conflict markers; consolidated on `HEALTH_AUTH_TOKEN` (Bearer header pattern) as the canonical env var name
- **Dependency audit: 0 vulnerabilities** — fixed 4 transitive CVEs (rollup path traversal, flatted prototype pollution + DoS, minimatch ReDoS, ajv ReDoS) via `npm audit fix`
- **API response indexing prevention** — added `X-Robots-Tag: noindex, nofollow` header to all `/api/*` responses via edge middleware to prevent search engine crawling of JSON endpoints

---

## [1.26.0] - 2026-03-24

### Added
- **Cross-Platform Impact Score** — a composite 0–100 score synthesizing Spotify, YouTube, Billboard, and Genius metrics into a single animated ring visualization with tier labels (Legendary, Iconic, Hit Maker, Rising Star, Cult Classic, Hidden Gem). SVG ring animates with spring-physics easing, number counts up with cubic ease-out, and per-platform breakdown bars show exactly where points come from
- **`impactScore.ts` scoring engine** — weighted algorithm: Billboard (30 pts — chart peak + longevity), Spotify (30 pts — streams + popularity + playlists), YouTube (25 pts — views + likes + engagement ratio), Genius (15 pts — page views + annotations). Includes `parseCount()` utility for abbreviated number strings (4.2B, 18M, 892K)
- **12 tests for impact scoring** — covers `parseCount` (6 tests for B/M/K/comma/plain/empty formats), tier assignment, platform score capping, total ceiling at 100, and billboard ranking comparisons

---

## [1.25.3] - 2026-03-24

### Added
- **Custom Hooks API section in README** — full developer-facing documentation for all 4 client hooks (`useAsyncData`, `useSongData`, `useKeyboardShortcuts`, `useRecentlyViewed`) with type signatures, usage examples, key behaviors, and extension guides
- **Keyboard shortcut registry table** — documents all 7 shortcuts, their scopes, the `CustomEvent` dispatch pattern (`mtm:share`, `mtm:compare`), form-field suppression logic, and how to add new shortcuts
- **Project structure update** — added `useKeyboardShortcuts.ts` and `useRecentlyViewed.ts` to the directory tree (previously missing from README)

---

## [1.25.2] - 2026-03-24

### Added
- **35 tests for 3 recently-extracted modules** — covers `score-colors.ts` (20 tests), `artist-utils.ts` (15 tests), and validates all tier boundary values, SVG arc math, genre chip mapping, and artist credit parsing edge cases
- **Boundary regression guards** — explicit off-by-one checks on color tier thresholds (≥80 vs >80) that would silently miscolor recommendation badges
- **Runtime safety coverage** — tests for non-string inputs to `splitArtists`/`primaryArtist` that TypeScript can't catch from untyped API responses
- **R&B ampersand preservation test** — ensures the `&` split heuristic doesn't break genre names like "R&B" while still splitting "Simon & Garfunkel"

---

## [1.25.1] - 2026-03-23

### Changed
- **Extracted `MetricCell` component from `ComparisonView`** — deduplicated the winner/tie/neutral cell rendering that was copy-pasted for song1 and song2 in every metric row
- **Added `resolveState` + `cellStyles` lookup table** — conditional winner styling is now a single data-driven map instead of repeated ternary chains across 40+ lines
- **Pre-computed score summary counts** — replaced three separate `insights.filter()` calls with a single `useMemo` loop that counts song1 wins, song2 wins, and ties in one pass
- **Eliminated IIFE in JSX** — the score summary section no longer wraps in an anonymous function call; uses the pre-computed `scores` object directly

---

## [1.25.0] - 2026-03-23

### Changed
- **Decomposed `recommendations.ts`** (566 -> 474 lines) — extracted two focused modules from the monolithic recommendation engine:
  - **`artist-utils.ts`** — `splitArtists` and `primaryArtist` are now general-purpose utilities importable by any component, not trapped inside the scoring algorithm
  - **`scoring-constants.ts`** — all 22 algorithm tuning knobs (feature weights, bonus values, thresholds, diversity parameters) extracted into a single discoverable file for easier adjustment
- **Zero-breakage re-exports** — `recommendations.ts` re-exports artist utilities so all existing imports (3 components, 2 test files) continue working without changes
- **All 416 tests pass** — no regressions from the decomposition

---

## [1.24.0] - 2026-03-21

### Changed
- **Extracted `score-colors.ts`** — consolidated 6 duplicated threshold-based color functions (`matchColor`, `matchRingColor`, `diversityColor`, `diversityBgColor`, `genreChipColor`, `reasonTagColor`) into a single parameterized module with tier-based lookups
- **Extracted `MatchScoreBadge` component** — the 20-line inline SVG circular progress indicator is now a reusable component with typed props, ready for use in song cards, search results, and playlist previews
- **Cleaned dead merge-conflict code** — removed unreachable `diversityTag`/`isCollab` references and the undefined `DiversityTag` type from `SimilarSongs.tsx` (artifacts from a 3-way merge that silently failed at runtime)
- **Reduced `SimilarSongs.tsx` by ~40%** — from 367 lines with 7 inline utility functions to 213 lines focused purely on layout and interaction logic

---

## [1.23.7] - 2026-03-20

### Fixed
- **Resolved merge conflicts** in `recommendations.ts` (3-way conflict from diversity/breakdown/reason branches) and `health/route.ts` (3-way conflict from auth/token/production-redact branches)
  - Unified `PickResult` interface with `ScoreBreakdown` + diversity reason overrides + collab bonus
  - Health route consolidated to Bearer token auth with public/private response split and security headers

### Added
- **32 new tests across 2 test files** covering critical paths after merge resolution (416 total tests across 32 suites):
  - `health-route.test.ts` — `resolveOverallStatus` severity resolution (6 cases: all-pass, warn escalation, fail dominance, empty array, unknown status fallback), `isAuthorizedForDetails` Bearer token auth (7 cases: no env var, no header, wrong scheme, correct token, wrong token, length mismatch, prefix-match attack), `formatUptime` display formatting (6 cases: seconds, minutes, hours, days, zero, exact boundaries)
  - `recommendations-merged.test.ts` — Runtime type guards for `splitArtists`/`primaryArtist` with non-string inputs (7 cases: null, undefined, number, object), `ScoreBreakdown` presence and decomposition on every `PickResult` (4 cases: base score, sum verification, era bonus detection, distant-era zero), diversity reason labels (2 cases: first-pick immunity from override, collab bonus in diverse mode)

---

## [1.23.6] - 2026-03-16

### Added
- **8 new YouTubeCard unit tests** covering interactive video preview rendering (306 total tests across 30 suites):
  - Platform header, stat rows (views/likes/comments/channel), thumbnail image with alt text
  - Play button overlay verification (red circle + triangular play icon)
  - Short date formatting via `formatDate` with `SHORT_DATE` options
  - External URL passthrough to PlatformCard (href, target, rel attributes)
  - Graceful fallback when `publishedAt` is unparseable (no "Invalid Date" leak)
  - Data isolation test ensuring no cross-fixture bleed-through

---

## [1.23.5] - 2026-03-15

### Added
- **26 new tests across 3 test files** covering previously untested critical paths (316 total tests across 29 suites):
  - `apiHandler.jsonError.test.ts` — Verifies `jsonError()` returns correct status codes (400/404/422), includes security headers (nosniff, DENY, no-store), and confirms header parity between `jsonError` and `jsonWithCache`
  - `safeFetch.safeJson.test.ts` — Tests `safeJson()` async pipeline: clean JSON parsing, `__proto__`/`constructor` stripping from API responses, array sanitization, null/primitive handling, and malformed body error propagation
  - `rateLimit.response.test.ts` — Tests `rateLimitResponse()` X-Request-ID attachment (present when provided, absent when omitted), security headers on 429 responses, and JSON body structure

---

## [1.23.4] - 2026-03-14

### Security
- **Prototype pollution sanitizer for external API responses** — All outbound API calls (Spotify, YouTube, Genius) now pass through `safeJson()` instead of raw `response.json()`. The sanitizer recursively strips `__proto__`, `constructor`, and `prototype` keys from parsed JSON before it enters application logic. A compromised CDN, middlebox, or API response containing `{"__proto__": {"isAdmin": true}}` would previously propagate prototype pollution through the entire server→client pipeline. Depth-capped at 20 levels to prevent stack overflow from adversarial payloads
- **Health endpoint security headers** — `/api/health` now returns `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Cache-Control: no-store`. Previously bypassed `withRouteHandler`, so browsers could MIME-sniff the unprotected JSON body into executable HTML

### Added
- **7 new sanitizer tests** — Prototype pollution key stripping, nested object sanitization, array traversal, primitive pass-through, recursion depth cap, and `constructor`/`prototype` key removal (348 tests across 26 suites)

---

## [1.23.3] - 2026-03-14

### Security
- **X-Request-ID traceability** — Every API response (200, 429, 500) now includes a unique `X-Request-ID` header (crypto.randomUUID). Error logs include the request ID for cross-system incident correlation. Rate limit responses also carry the ID so CDN/WAF logs can trace blocked requests back to the application layer
- **Health endpoint info redaction** — `/api/health` no longer exposes `process.memoryUsage()`, error counts, request counts, or cache internals in production (`NODE_ENV=production`). Attackers previously could use memory pressure data to time resource exhaustion attacks and error counts to confirm fuzzing attempts. Development mode retains full diagnostics for debugging convenience

### Added
- **6 new traceability tests** — UUID format validation, uniqueness verification, X-Request-ID presence on 200/429/500 responses, and request ID inclusion in error log messages (341 tests across 26 suites)
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
## [1.24.0] - 2026-03-13

### Added
- **Collaboration-aware diversity picking** — The diverse/auto strategy now detects featured artist tracks (ft./feat./with) and applies a `COLLAB_DIVERSITY_BONUS` (+8) to reward cross-genre collaborations. Songs with featured artists naturally bridge audiences and genres, making them high-value diversity picks
- **Diversity reason tags** — Each recommendation card in diverse/auto mode now shows *why* it was diversity-picked: "New genre" (violet), "New era" (teal), or "Collab pick" (rose). Positioned as a top-left badge on the album art for at-a-glance transparency into the engine's decision-making
- **Collaboration indicator** — A `Users` icon appears next to song titles on recommendation cards when the track has featured artists, giving visual context for multi-artist credits
- **Exported `PickResult` and `DiversityTag` types** — Recommendation pick metadata is now part of the public API for downstream consumers

---

## [1.23.1] - 2026-03-13

### Added
- **`useAsyncData` test suite** — 13 tests covering the full state machine lifecycle: idle→loading→success/error transitions, AbortController signal passthrough, unmount abort cleanup, stale request suppression after abort, dependency-driven re-fetch, AbortError swallowing, non-Error rejection handling, empty error message fallback, and console.error logging verification
## [1.23.1] - 2026-03-13

### Fixed
- **Diversity reason tags** — Songs picked by the diverse strategy for genre/era variety now show "Unique genre" or "Different era" instead of the misleading audio-similarity reason (e.g. "Similar sound"). The first pick still shows the original reason since it's always the best pure-similarity match
- **Diversity reason styling** — Diversity-driven reason tags render with distinct colors (purple for genre, teal for era) so users can visually distinguish diversity picks from similarity picks at a glance

---

## [1.23.0] - 2026-03-13

### Changed
- **`useAsyncData` generic hook** — New `useReducer`-backed async fetch primitive that replaces the repeated `useState(data) + useState(loading) + useState(error)` pattern. Discriminated union types make impossible states (loading + error simultaneously) unrepresentable. Includes automatic `AbortController` cleanup
- **`useSongData` simplified** — Refactored from 4 separate `useState` calls to a thin wrapper over `useAsyncData`. Same public API, half the code, zero behavior changes
- **Artist page fetch hardened** — Replaced 3 inline `useState` calls + unguarded `fetch` (no `AbortController`) with `useAsyncData`, gaining automatic request cancellation on unmount
- **Error messages pass through** — Network errors now surface the actual message (e.g. "Network error") instead of a generic "Failed to load" string, giving users better diagnostic context
## [1.23.0] - 2026-03-11

### Added
- **Recently Viewed songs** — Horizontal scroll strip on the home page showing the last 8 songs the user explored. Persisted in localStorage via `useSyncExternalStore` for SSR-safe, lint-clean hydration. Songs are deduplicated on re-view (moved to front) and capped at 8 entries with FIFO eviction. Section auto-hides when empty
- **`useRecentlyViewed` hook** (`src/hooks/useRecentlyViewed.ts`) — Manages localStorage-backed recently viewed queue with `subscribe`/`getSnapshot`/`getServerSnapshot` pattern for concurrent-mode safety
- **`RecentlyViewed` component** (`src/components/RecentlyViewed.tsx`) — Compact pill-style cards with album art, staggered entrance animations, and hover-to-accent transitions. Uses `scrollbar-hide` utility for clean horizontal overflow
- **`scrollbar-hide` CSS utility** — Cross-browser scrollbar hiding for horizontal scroll strips (WebKit + Firefox + IE)
- **Song detail page integration** — Automatically records viewed songs when song data loads, feeding the home page strip
## [1.22.2] - 2026-03-13

### Fixed
- **Stale recommendation prefs from React 19 batching** — `PlaylistConfigurator` and `SimilarSongs` maintained independent `useState` copies of recommendation preferences. When both updated in the same event handler, React 19 automatic batching caused stale closures. Consolidated into a single `PrefsProvider` context backed by `useReducer` that always re-reads from localStorage after writes
- **Cross-tab preference sync** — Recommendation preferences now sync across browser tabs via `storage` event listener. Changing genre/mood/era filters in one tab immediately reflects in others
- **Strategy state duplication** — `SelectionStrategy` ("auto"/"best-match"/"diverse") was managed independently in `SimilarSongs` via local `useState`. Now lives in the centralized `PrefsProvider` alongside prefs, persisted to localStorage
## [1.22.2] - 2026-03-11

### Security
- **Fallback CSP in next.config.ts** — Added static Content-Security-Policy header as defense-in-depth baseline for requests the proxy doesn't intercept (static assets, error pages). Uses `'strict-dynamic'` + `'unsafe-inline'` fallback pair per CSP3 spec §8.1
- **Health endpoint hardened** — Wrapped `/api/health` with `withRouteHandler` for rate limiting (6 req/min per IP) and security headers. Memory details (heap, RSS) now gated behind `HEALTH_TOKEN` env var to prevent unauthenticated runtime recon
- **`health` rate limit bucket** — Added to `ROUTE_LIMITS` in rateLimit.ts (was the only unprotected API route)
## [1.22.2] - 2026-03-13

### Security
- **Edge middleware** (`src/middleware.ts`) — New request-level security layer running on Vercel's edge network before any route handler. Adds `X-Request-Id` header (crypto.randomUUID) to every request/response for security incident correlation, blocks path traversal attempts (`/../`, `/./`, `%2e%2e` encoded variants) at the edge before they reach route handlers, and enforces method restriction (GET/HEAD/OPTIONS only) on all API routes with proper 405 responses
- **Health endpoint hardening** — `/api/health` now has rate limiting (30 req/min per IP via token bucket) and security headers (`nosniff`, `X-Frame-Options: DENY`, `no-store`) matching all other API routes. Previously the only route bypassing both `withRouteHandler()` and security headers, making it a reconnaissance and DDoS vector

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
## [1.21.0] - 2026-03-06

### Security
- **Health endpoint information disclosure** — `/api/health` previously exposed heap memory sizes, RSS, uptime, error counts, cache utilization, and integration config to unauthenticated users — a reconnaissance goldmine for attackers (OWASP A01). Now returns only `status` + `version` + `timestamp` without auth. Detailed diagnostics require a `HEALTH_AUTH_TOKEN` Bearer header. Added `HEALTH_AUTH_TOKEN` to `.env.example`
- **Error object logging leaks server internals** — All `catch` blocks in `spotify.ts`, `youtube.ts`, and `genius.ts` logged the full error object (`console.error("...", error)`), which serializes stack traces containing file paths, and upstream API response bodies that may echo back auth headers. Replaced with `error.message` extraction across all 9 catch blocks
- **Cache.delete() normalization bypass** — `TTLCache.delete()` used the raw key instead of `normalizeKey()`, meaning entries set via NFC-normalized keys couldn't be deleted with unicode-equivalent variants. Fixed to normalize consistently across all cache operations (get/set/has/delete)

### Added
- 2 new tests for cache delete normalization (unicode NFC equivalence, zero-width char stripping)

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
