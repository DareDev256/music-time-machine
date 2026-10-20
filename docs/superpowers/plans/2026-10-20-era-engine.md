# Era Engine (v2.0 "Was Playing") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1 mock dashboard with a console → hyperlapse flight → era page product, with a share card and a shared link that replays the flight.

**Architecture:** History is precomputed into static JSON under `public/era/` by Python pipelines in `data/scripts/`. The browser resolves songs (own index via `/api/resolve`, then MusicBrainz and iTunes directly, both CORS-open), flies a pooled three.js tunnel of real #1 covers to the target week, and lands on `/era/YYYY-MM`, a server-rendered page read from the shards. `@vercel/og` renders the share cards.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, three (pinned exact), vitest + jsdom, Python 3 stdlib pipelines, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-20-era-engine-design.md` (read §12 first: it overrides earlier sections).

## Global Constraints
- Ground `#000`, ink `#f4f4f4`, dim `rgba(244,244,244,.52)`, faint `rgba(244,244,244,.16)`, ONE accent `--signal: #ff3b1f`. No other colour in UI chrome; covers carry colour.
- Fonts: Archivo (variable, `wdth` 62–125; display at 62–80%), JetBrains Mono (data/labels), DSEG7 Classic Bold (readouts, `src/fonts/DSEG7Classic-Bold.woff2`, OFL).
- No gradients except the legibility scrim, no glass/blur cards, no icon-in-circle rows, no generated imagery, no float-in-on-scroll.
- Every displayed number has a source line on the page. No view counts from YouTube. No stream counts anywhere.
- Charts start `1958-08-04`; the flight never targets earlier.
- `three` pinned to an exact version in package.json (no caret).
- Copy: the fact is the punchline. No generated "your era" prose.
- Commits: only the files the task names (`git add <paths>`), never `git add -A`.

## Review Focus
1. Song title that is also a year ("1999", "2002", "7 Years", "Summer of '69") → resolves as a song, not a year. Test in Task 3.
2. MusicBrainz returns a karaoke/tribute iTunes match with an earlier date ("Shut Up" karaoke 2015-12-16) → discarded. Test in Task 3.
3. Flight to 1965 on a phone (≈3,100 weeks) → pooled meshes, ≥ 50 fps, first frame < 1.2 s. Measured in Task 4.
4. Shared link opened cold on a phone (`/?to=2012-04-28&song=Cuz%20My%20Gear&artist=Chief%20Keef`) → flight auto-plays and lands; with JS off, `/era/2012-04` still renders the whole era. Checked in Task 5/6.
5. A month with no Wayback capture or a failed lane → the section says "no archived capture for this month" / hides the lane; never an empty box. Test in Task 6.

---

### Task 1: Strip v1, new shell, tokens, fonts, CSP, redirects (lead, native)

**Files:**
- Delete: `src/components/*` except none (all v1 components), `src/lib/{mockData,dataFetcher,spotify,genius,youtube,recommendations,pickNextSong,impactScore,velocity,timeline,comparison,artist-utils,genre-utils,score-colors,scoring-constants}.ts` and their tests, `src/hooks/*`, `src/app/{song,artist,compare}`, `src/app/api/{search,song,artist,compare,catalog}`, `src/app/api/og/[id]`.
- Keep: `src/lib/{hot100,coverArt,cache,safeFetch,safeHref,apiHandler,apiErrorHandler,rateLimit,formatDate,formatNumber,toSlug}.ts`, `src/proxy.ts`, `src/app/api/{health,number-one}`.
- Modify: `src/app/layout.tsx` (fonts via `next/font`, no ThemeProvider/Navigation, dark only), `src/app/globals.css` (tokens above), `next.config.ts` (redirects `/song/:p*`, `/artist/:p*`, `/compare` → `/`, 308), `src/proxy.ts` + `next.config.ts` CSP: add `frame-src https://www.youtube-nocookie.com`, `media-src https://*.itunes.apple.com https://audio-ssl.itunes.apple.com`, `connect-src https://musicbrainz.org https://itunes.apple.com`.
- Tag `v1.40.0` on the current HEAD before deleting.

- [ ] Tag, delete, rewrite shell. `npx tsc --noEmit` exit 0; `npx vitest run` green (remaining suites); `npm run build` exit 0.
- [ ] Commit `refactor!: remove v1 mock dashboard, new shell and tokens`.

### Task 2: Static data assembly (lead, native)

**Files:**
- Create: `data/scripts/build_flight.py` → `public/era/flight.json`
- Create: `data/seed/non-dsp.json` (hand-verified rows from `scratchpad/probe/RESULTS.md`: at least Cuz My Gear, I Don't Like, L's Anthem, Us, Everyday, Shut Up (Stormzy), Sweet Shop (Doctor P); each `{song, artist, date, dateSource, where, note, source}`)
- Create: `data/scripts/build_index.py` → `public/era/index.json`

**Interfaces (Produces):**
- `public/era/flight.json`: `{ "through": "YYYY-MM-DD", "songs": [{ "s": string, "a": string, "art": string | null }], "weeks": [[date: string, songIdx: number]] }`, weeks oldest → newest; `art` is the iTunes size template with `{w}x{h}`.
- `public/era/index.json`: `{ "built": string, "rows": [{ "s": string, "a": string, "d": "YYYY-MM-DD", "g": "day"|"month"|"year", "src": "hot100"|"lane:<id>"|"heat:<id>"|"seed", "k": string /* normalised "title|artist" */ }] }`, one row per song, earliest date kept, `src` of that date.
- Both refuse to write when an input file is missing or a count is under its floor (flight weeks < 3,500; index rows < 5,000).

- [ ] Run both; print counts; commit.

### Task 3: Date extraction + resolver (subagent, Opus)

**Files:**
- Create: `src/lib/era/types.ts`, `src/lib/era/dates.ts`, `src/lib/era/resolve.ts`, `src/app/api/resolve/route.ts`
- Test: `src/lib/era/__tests__/dates.test.ts`, `src/lib/era/__tests__/resolve.test.ts`, `src/app/api/resolve/__tests__/route.test.ts`

**Interfaces (Produces):**
```ts
// types.ts
export type Granularity = "day" | "month" | "year";
export interface DatedSong { song: string; artist: string; date: string; granularity: Granularity;
  dateSource: string;            // human: "uploaded to YouTube", "first release (MusicBrainz)", "entered the Hot 100"
  where: Array<"chart" | "musicbrainz" | "itunes" | "seed" | "youtube">;
  onDsp: boolean | null; art?: string; previewUrl?: string; youtubeId?: string; mbid?: string; isrc?: string; }
export type ResolveOutcome =
  | { kind: "song"; best: DatedSong; candidates: DatedSong[] }
  | { kind: "date"; date: string; granularity: Granularity; label: string }
  | { kind: "none"; reason: string; yearHint?: number };
// dates.ts
export const CHART_START = "1958-08-04";
export function extractDate(q: string): { date: string; granularity: Granularity; rest: string } | null;
export function flightTarget(date: string, g: Granularity): string;   // year → YYYY-06-15, month → YYYY-MM-15, clamp ≥ CHART_START, ≤ today
// resolve.ts — pure, all I/O injected
export interface ResolverDeps { indexSearch(q: string): Promise<DatedSong[]>; musicbrainz(q: string): Promise<DatedSong[]>; itunes(q: string): Promise<DatedSong[]>; }
export async function resolveQuery(q: string, deps: ResolverDeps): Promise<ResolveOutcome>;
export function browserDeps(): ResolverDeps;  // index → fetch('/api/resolve?q='); MB WS/2 recording search (UA via header not settable in browser: add `fmt=json` and keep ≤ 1 call per resolve); iTunes Search
```
`GET /api/resolve?q=` → `{ rows: DatedSong[] }` from `public/era/index.json` (fuzzy: normalised title contains, artist boosts), `Cache-Control: public, s-maxage=86400`.

- [ ] Tests first, each from spec §12.10, with exact cases:
  - `extractDate("chief keef cuz my gear 2012")` → `{date:"2012-06-15", granularity:"year", rest:"chief keef cuz my gear"}`; `"March 2012"` → month `2012-03-15`; `"2012-04-28"` → day; `"'12"` → year 2012; `"summer 2012"` → `2012-07-15` month.
  - `resolveQuery("1999")` with an index that holds "1999 — Prince" → `kind:"song"`, not a date. `resolveQuery("1999")` with an empty index and no MB hit → `kind:"date"` 1999.
  - iTunes row artist "Karaoke Hits Band" for "Shut Up" is discarded; MB date 2016-02-16 vs seed YouTube 2015-05-17 → best date `2015-05-17`, `dateSource` "uploaded to YouTube".
  - MB partial date "2012" → granularity "year".
  - Index row `src:"hot100"` → `dateSource:"entered the Hot 100"`; an earlier MB date for the same song overrides it.
  - `"Hold On"` with no artist/year and 3 MB matches → `candidates.length === 3` and `best` not auto-accepted (outcome carries all three; caller shows picker): assert `best.where` does not include only `"musicbrainz"` without artist match, or return `kind:"song"` with `candidates` length ≥ 2 and a flag `needsPick: true` (add `needsPick?: boolean` to the song outcome).
  - `"cuz my gear"` resolves from the seed alone with zero MB/iTunes calls (spy deps).
  - Any dep throwing → still returns `kind:"date"` when a year was in the text, else `kind:"none"`.
- [ ] Implement; `npx vitest run src/lib/era src/app/api/resolve` green; commit.

### Task 4: Flight component (subagent, Opus)

**Files:**
- Create: `src/components/flight/Flight.tsx` (client), `src/components/flight/tunnel.ts` (pure three.js scene builder, no React), `src/components/flight/easing.ts`
- Test: `src/components/flight/__tests__/easing.test.ts`, `src/components/flight/__tests__/pool.test.ts`
- Add dependency: `three` exact `0.170.0`, `@types/three` exact `0.170.0` (dev).

**Interfaces:**
- Consumes: `public/era/flight.json` (Task 2 shape).
- Produces:
```ts
export interface FlightProps { target: string | null;          // ISO week date; null = idle drift at the newest week
  onPassing?(w: { date: string; song: string; artist: string; runWeek: number; runLength: number }): void;
  onArrive?(): void; freeze?: number;                              // 0..1 for deterministic screenshots (?freeze=)
  skipSignal?: number; }                                           // increment to skip to landing
export default function Flight(props: FlightProps): JSX.Element;   // full-viewport fixed <canvas>; dynamic-imported with ssr:false by pages
// easing.ts
export function flightDuration(years: number): number;             // clamp(1.8 + years*0.17, 2.6, 7) seconds
export function ease(x: number): number;                           // the spike's curve
export function warp(x: number, lengthUnits: number, durS: number): number; // 0..1 from ease velocity / 420
```
- Behaviour: port `scratchpad/spike/index.html` (`build`, `gate`, streaks, readout timing) with spec §12.9: a pool of 120 card meshes recycled as the camera passes, textures loaded by proximity (first 40 before launch), year gates pooled too, `setPixelRatio(min(dpr, innerWidth < 640 ? 1.5 : 2))`, typeset sleeve fallback for `art: null`, `prefers-reduced-motion` → land immediately, dispose everything on unmount. Idle mode: slow drift (0.6 units/s) through the newest ~60 weeks.

- [ ] Tests: `flightDuration(14)` ≈ 4.18; `flightDuration(0)` = 2.6; `flightDuration(68)` = 7; `ease(0)=0`, `ease(1)=1`, monotonic over 101 samples; the pool never exceeds 120 meshes for a 3,100-week path (pure function `assignSlots(cameraWeek, totalWeeks, poolSize)` returns ≤ poolSize indices).
- [ ] Build a throwaway harness page `src/app/flight-test/page.tsx` that mounts Flight with `?to=&freeze=`; measure with headless Chromium on the Mac GPU at 390×844 for `to=1965-03-06` and `to=2012-04-28`: report median fps over the flight (rAF timestamps) and time to first frame. Bar: ≥ 50 fps, < 1.2 s. Delete the harness page before the final commit (the lead keeps `/?freeze=`).
- [ ] Commit.

### Task 5: Console + home + shared-link replay (lead, native)

**Files:** Create `src/components/console/{Console,Readout,CandidatePicker}.tsx`; Modify `src/app/page.tsx`.
- Consumes Task 3 `resolveQuery`, `browserDeps`, `flightTarget`; Task 4 `Flight`.
- `/?to=YYYY-MM-DD&song=&artist=` autoplays; on arrive → `router.push('/era/YYYY-MM?song=…&artist=…&date=…&src=…')`.
- [ ] Readouts: DESTINATION (signal), PRESENT/NOW PASSING (ink). Chips: Cuz My Gear · 2012, Rolling in the Deep · 2011, "the day you were born" (date input), "1999" (as a year chip labelled "Summer 1999").
- [ ] Verify in a real browser (Playwright) desktop + 390: type "cuz my gear", see DESTINATION fill with 04.28.2012, flight runs, lands on the era page.

### Task 6: Era page (lead, native)

**Files:** Create `src/lib/era/data.ts`, `src/app/era/[month]/page.tsx`, `src/components/era/{Anchor,ChartWeek,Lanes,OffCharts,ShareBar}.tsx`; Test `src/lib/era/__tests__/data.test.ts`.
- `data.ts`: `weekNearest(date): { date: string; top: ChartRow[] } | null`, `lanesOn(date): LaneHit[]` (only lanes listed in `public/era/lanes/index.json`), `heatFor(month): HeatMonth | null` (only passing sources), `chartsThrough(): string`. Reads files with `fs` from `public/era` at request time (server component), cached in module scope.
- Route: `generateStaticParams` returns none; `revalidate = false`; invalid month → `notFound()`; months before 1958-08 or after `chartsThrough()` → `notFound()`.
- Tests: `weekNearest("2012-04-28").top[0]` is the chart week ≤ 7 days from it; `heatFor("2009-01")` (out of crawl scope) → null; `lanesOn` omits failed lanes.
- [ ] Render check desktop + 390 for `/era/2012-04?song=Cuz%20My%20Gear&artist=Chief%20Keef&date=2012-04-28&src=youtube`, `/era/1985-03`, `/era/2026-10`.

### Task 7: Share card (subagent, Sonnet, after Task 1)

**Files:** Create `src/app/api/card/route.tsx`, `src/lib/era/cardLine.ts`; Test `src/lib/era/__tests__/cardLine.test.ts`.
- `GET /api/card?song=&artist=&date=YYYY-MM-DD&format=story|wide` → PNG 1080×1920 or 1200×630; edge runtime; fonts loaded from `/fonts/*` (copy the woff/ttf the edge renderer needs into `public/fonts/`).
- `cardLine({ song, artist, date, numberOne }) → { season: "SPRING 2012", me: "I WAS ON CHIEF KEEF", world: "THE WORLD WAS ON GOTYE" }`; seasons by month (Dec–Feb WINTER, Mar–May SPRING, Jun–Aug SUMMER, Sep–Nov FALL); when the anchor artist IS the #1 artist → world line `"SO WAS EVERYONE"`.
- [ ] Tests for cardLine; render both formats to PNG and Read them; commit.

### Task 8: Docs, version, release prep (lead)
- README rewritten around the flight (GIF from frozen frames), CHANGELOG `[2.0.0]`, `package.json` 2.0.0, `docs/OVERVIEW.md` architecture section updated, attribution lines (Wikipedia CC BY-SA, utdata MIT, Internet Archive, iTunes, MusicBrainz CC0).

### Task 9: Gauntlet, deploy, verify live (lead + fresh critics)
- Critics per spec §8 on the LIVE preview URL; fix the one named gap per round; `vercel deploy --prod`; Playwright desktop + 390 on the production URL; screenshots to `docs/screenshots/2026-10-20_*`; push; GitHub release v2.0.0.
