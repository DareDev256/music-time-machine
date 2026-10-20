# Era Engine — design (v2.0)

Written 2026-10-20 while James was at work. Builds on `docs/ERA-PLAN.md` (2026-09-20), which this supersedes where they differ.
Research behind it: three agent reports (metadata/data sources, prior art + domains, a keyless feasibility probe), summarised in §9.

## 1. Intent, in his words

> "Someone says, Hey, I was listening to Chief Keef, Cuz My Gear, in 2012, and it's able to scrape YouTube, not just songs that were released on DSPs… find what was popular or related trending at that time… every genre… as seamless as possible, as popular as possible… it should not look AI slop at all… feel futuristic, have some animation when you search like you're going back in the timeline, hyperlapse/timelapsing through songs."

The product is: **name a song you lived with, travel back to it, and land in its era.** The era is the charts *and* the internet that week: the #1, the lanes, and the mixtape / blog / upload heat no chart recorded.

## 2. Goals, non-goals, anti-goals

**Goals (v2.0, ships today)**
1. One input. A song, an artist + year, a messy sentence ("chief keef my gear 2012"), a year, or a date.
2. The flight: on submit, a hyperlapse back through the real #1 covers, week by week, from today to the target week, then a landing. Skippable. Reduced-motion lands instantly.
3. The era page `/era/YYYY-MM` (with optional `?song=`): the anchor song and where it lived (YouTube upload date / MusicBrainz release / DSP or not), the Hot 100 top 10 for that week, the #1 in each genre lane, and "Off the charts" (internet heat) for the months where archived captures exist.
4. A share card that people post: 9:16 and 1.91:1, one tap, URL baked in.
5. Every number and row carries a source. A pipeline that cannot source a row refuses to write it.
6. Live on the real domain, verified at 390px on the real URL.

**Non-goals (v2.0)**: accounts or login; Spotify login; a chatbot; hosting audio; a mobile app; user submissions (v2.1, needs a DB + moderation); Shazam-style listening (v2.2).

**Anti-goals (a failure even if it works)**
- It looks AI-made: purple gradients, glassmorphism cards, generic "Track Any Song Across the Music Ecosystem" copy, stock icons in circles, generated imagery. The current live site is all of these.
- A number we cannot back (no "popularity × 25M" streams, no invented view counts, no "views then" from views today).
- A flight that stutters on a phone, or a landing that takes longer than the flight.
- An era page that is just the Billboard chart: the off-chart layer is the point.

## 3. The experience

### 3.1 Console (home)
True black screen. The tunnel idles behind it (slow drift through this week's neighbourhood of #1 covers). Top right: two seven-segment readouts, `DESTINATION` (signal red, blank until set) and `PRESENT` (white, today). One input, placeholder `WHAT WERE YOU PLAYING?`, a GO button. Under it, 4 example chips that are real (Cuz My Gear · 2012, Rolling in the Deep · 2011, a birthday, a decade). The birthday hook from 1.40 stays as one chip ("the #1 the day you were born").

### 3.2 Resolve
`GET /api/resolve?q=` returns `{ song, artist, date, dateSource, where: ["youtube"|"musicbrainz"|"itunes"|"chart"], youtubeId?, art?, onDsp, candidates[] }`. The DESTINATION readout fills the moment resolve returns; if it returns several plausible matches, show up to 3 as a picker strip before launch (one tap). Ambiguous input with a year falls back to that year. Unknown input with no year: say so plainly and offer the year picker; never guess silently.

### 3.3 Flight (the signature)
Built from the spike in `scratchpad/spike/index.html` (proven: real covers via iTunes CDN, `access-control-allow-origin: *`).
- Corridor of #1 covers in issue-week order, newest first, alternating four walls; a #1 run reads as a streak of the same cover.
- A gate (thin signal-red frame + the year) at every January.
- Speed-driven warp: FOV 62→98 and streak length scale with the easing curve's own velocity; slight roll.
- HUD during flight: `NOW PASSING` date ticking, the passing #1 title huge (condensed), artist, "week 3 of 13 at #1".
- Duration scales with distance: `clamp(1.8 + years × 0.17, 2.6 s, 7 s)`. Skip button. `prefers-reduced-motion` lands instantly.
- Landing: the destination week's cover settles centre in a red frame, readouts match, then the era page slides up under it (the flight canvas stays as the page header, frozen on the landing frame).
- Budget: ≥ 50 fps on an iPhone 13-class GPU at 390×844; first frame < 1.2 s on 4G; textures 200×200, mipmaps off; no more than ~800 meshes per flight; covers missing art render as a typeset sleeve, never a grey box.

### 3.4 Era page `/era/YYYY-MM`
Server-rendered from static shards, cached immutable. Sections, in order:
1. **Anchor** (when `?song=`): cover / YouTube thumbnail, title, artist, the date and where that date came from ("uploaded to YouTube 28 Apr 2012 · first release 17 May 2012, MusicBrainz"), DSP status ("not on Apple Music" is a feature, say it). Play in place: YouTube embed (nocookie) when we hold an ID, else iTunes 30 s preview, else link out.
2. **The charts that week**: Hot 100 top 10 for the issue week nearest the anchor date (rank, movement, weeks on chart). Lane strip: #1 that week in R&B/Hip-Hop, Rap, Country, Rock/Alt, Dance, Latin, UK, Canada (each only where that chart existed).
3. **Off the charts**: what the internet was playing that month: HotNewHipHop front page / top 100, DatPiff popular mixtapes, Hype Machine popular, Billboard genre top 10s captured by the Wayback Machine. Each row links the capture it came from ("seen on hotnewhiphop.com, 2 May 2012, archived"). Months with no capture say so.
4. **Around it**: the weeks either side as a scrubbable strip (tap a week, the page re-anchors without a full reload).
5. **Share** (§3.5) and the birthday/conceived card.

Copy rule: the fact is the punchline. No generated "your era was a time of…" paragraph anywhere.

### 3.5 Share card
Object: a cassette J-card crossed with the time-circuit readout. 9:16 (1080×1920) and 1.91:1 (1200×630) via `@vercel/og` at `/api/card?song=&date=`.
Content: the date in seven-segment red, "I WAS PLAYING" + the anchor song, "THE #1 WAS" + the Hot 100 #1 that week, two off-chart rows, the URL. One tap: Web Share API with the image file on mobile, download + copy link on desktop. Identity line, e.g. `SPRING 2012 · I WAS ON CHIEF KEEF`.

## 4. Look (anti-AI-slop is a hard gate)
- Ground: true black `#000`. Ink `#f4f4f4`. ONE loud accent: signal red `#ff3b1f` (the destination readout, gates, the GO button). Nothing else is coloured; the album covers carry all other colour.
- Type: Archivo (variable width; condensed 62–80% for display), JetBrains Mono for data and labels, DSEG7 Classic (OFL) for the seven-segment readouts, self-hosted.
- Imagery: only real covers and real thumbnails. No generated images, no illustrations, no icon-in-a-circle feature rows, no gradients, no glass.
- Motion: purposeful only (the flight, the landing, the week scrub). No float-in-on-scroll for every block.
- Named bar for critics: **nts.live** (restraint, a music brand that owns black and type), **kworb.net** (data density, a number per row), **teenage.engineering** (futuristic without chrome), the **macOS Time Machine** window stack and the **Back to the Future time-circuit display** for the flight and readouts.

## 5. Data architecture

Principle: **history is immutable, so it is precomputed and served static.** The only live work at request time is resolving a song the index does not know.

### 5.1 Offline pipelines (`data/scripts/`, Python, run on the Mac; each refuses to write on a parse that yields zero or a broken cadence)
| Pipeline | Source | Output | Notes |
|---|---|---|---|
| `hot100_number_ones.py` (exists) | Wikipedia per-year lists, CC BY-SA | `data/hot100-number-ones.json` | shipped 1.40 |
| `hot100_covers.py` (new, running) | iTunes Search, keyless | `data/hot100-covers.json` | 1,199 songs, newest first, refuses < 80% |
| `hot100_weekly.py` | `mhollingshead/billboard-hot-100` (no licence; Billboard's data) | `public/era/hot100/YYYY.json`, top 10 per week only | used as a build-time reference; we publish a derived top 10, as chart sites do; attribution line on the page |
| `lanes.py` | Wikipedia "List of number-one … of YYYY" for R&B/Hip-Hop, Rap, Country, Rock/Alt, Dance, Latin, UK, Canada | `public/era/lanes/YYYY.json` | same parser pattern as the Hot 100 script; each lane only from its first year |
| `wayback_heat.py` | Wayback CDX + `id_` raw captures: hotnewhiphop.com (+ /top100), datpiff.com popular, hypem.com/popular, billboard.com genre charts pre-2013 | `public/era/heat/YYYY-MM.json` | 2006-01 → 2016-12 first; ≤ 1 request / 2 s with a User-Agent (Wayback has 429ed automated traffic since Sept 2026); per-site parsers with a parse-count canary per month; every row keeps the capture URL |
| `youtube_ids.py` | yt-dlp, offline only, ≤ 1 req/s | adds `youtubeId` + upload date to heat rows and anchors | research use only; stores the ID and upload date (facts), never view counts |

Shards are small (a year of top-10 weeks ≈ 40 KB) and served from `public/` with `Cache-Control: immutable`.

### 5.2 Search index
Build-time `public/era/index.json`: every song that appears in any shard (title, artist, first-seen date, sources), normalised for fuzzy matching. Searched in the `/api/resolve` function (and prefetched client-side for instant typeahead if it stays under ~1.5 MB gzipped; otherwise server only).

### 5.3 Resolver order (`/api/resolve`)
1. Year/date extraction from the text (deterministic regex: `2012`, `'12`, `summer 2012`, `March 2012`, ISO dates).
2. Own index (fuzzy title + artist, year-weighted).
3. MusicBrainz WS/2 recording search (keyless, User-Agent set, 1 req/s global: a token bucket in front; first-release date + ISRC).
4. iTunes Search (art, DSP presence, preview).
5. YouTube Data API v3 when `YOUTUBE_API_KEY` is set: `search.list` (100 units) then `videos.list` (1 unit) for the upload date; hard daily budget of 90 searches; results cached ≤ 30 days per YouTube policy.
6. Nothing found: say so, offer the year.
Date rule: the earliest credible date wins (a YouTube upload often precedes the MusicBrainz release: Stormzy "Shut Up" 2015 upload vs 2016 release). Responses cached at the CDN by normalised query (`s-maxage=86400`).

### 5.4 No database in v2.0
Charts are static files; resolves are CDN-cached GETs. A DB arrives with submissions (v2.1).

## 6. Efficiency and budgets
- Era pages: static params for 1958-08 → this month (~820 pages) via ISR, not a full SSG build.
- The flight loads `three` as a dynamic client chunk only on the home and era routes; the era page's text renders without it (SEO + no-JS readers get the full era).
- Covers come straight from Apple's CDN at 200×200 for the tunnel, 600×600 for the anchor; no proxy, no storage.
- Remove the dead weight: the 17-song mock catalog, the Spotify / Genius / audio-feature cards on the default path, the "Trending" mock grid, `framer-motion` and `recharts` if nothing on the new path uses them.
- CSP additions: `frame-src https://www.youtube-nocookie.com`, `media-src https://*.itunes.apple.com https://audio-ssl.itunes.apple.com`, `connect-src` for MusicBrainz + iTunes if any client-side fetch remains.

## 7. Release
- Domain: James's call (money). Recommendation **wasplaying.com**, US$10.46/yr flat, checked live on Cloudflare 2026-10-20. Until he says yes, ship on `music-time-machine.vercel.app`.
- Brand: "Was Playing", with "the music time machine" kept as a descriptor. "Music Time Machine" as a brand collides with a live Chrome extension of that exact name and with Radiooooo's tagline "The Musical Time Machine".
- Repo stays `DareDev256/music-time-machine` (stars and links survive); README rewritten around the flight with a GIF; CHANGELOG; version 2.0.0; GitHub release.
- Drafts (gated, James posts or approves): Show HN, X thread with the flight GIF, Product Hunt.

## 8. Gauntlet (the builder never grades itself)
| Piece | Bar | Instrument |
|---|---|---|
| Flight | macOS Time Machine stack + "a hyperlapse through songs" | fresh-context critic on frozen frames + a recorded 6 s clip; telemetry: fps at 390×844 on the Mac GPU, time to first frame |
| Era page | nts.live, kworb.net, The Pudding | blind A/B screenshots against the references at 1440 and 390; anti-slop checklist |
| Share card | Receiptify, Instafest, Wrapped story cards | critic answers "would you post this?" blind, and names the one gap |
| Resolver | a 40-query set across genres and eras, ≥ 12 non-DSP songs | script scores year-correct %; a second agent re-derives the expected answers independently before the score counts; bar ≥ 85% |
| Whole site | the anti-goals in §2 | design-audit desktop + 390 on the LIVE URL |

## 9. What the research changed (summary; full reports in the session scratchpad)
1. "Cuz My Gear" is Chief Keef ft. Riff Raff; YouTube upload 2012-04-28 (10.96 M views), DatPiff "Young & Flexin" 2012-05-17, MusicBrainz has it with ISRC FR5R00903251, iTunes has nothing. The product's core case is real and non-DSP.
2. No free source gives "top songs in month X, any genre" (ListenBrainz ranges are relative only; Last.fm has no historical sitewide charts). The era layer must be built offline.
3. Wayback captures reconstruct the scene: Billboard genre top 10s, Hype Machine popular, HotNewHipHop and DatPiff fronts parse for 2012; WorldStar and SoundCloud charts were not archived.
4. Spotify cannot be a foundation (2024-11-27 and 2026-02-11 restrictions). Link out only.
5. YouTube: 100 searches/day by default, 30-day cache limit, scraping banned for the service; yt-dlp stays offline research.
6. Industry metadata (DDEX, ISRC, ISWC, IPI, UPC, ISNI) is matching and royalty plumbing, not popularity; ISRC is useful as a join key. Paid trend data: Luminate (~US$395/mo), Chartmetric, Soundcharts.
7. DatPiff's Internet Archive collection is gone; Wayback is the only DatPiff history.
8. No product found that places YouTube/SoundCloud/mixtape-only songs by era (shallow search; treat as likely).

## 10. Decided by Claude (James can overturn any by letter)
- A. Brand "Was Playing", domain wasplaying.com (purchase waits on his yes).
- B. Accent signal red `#ff3b1f` on true black; Archivo + JetBrains Mono + DSEG7.
- C. Flight = cover tunnel driven by time, not scroll.
- D. No DB, no login in v2.0; submissions in v2.1.
- E. YouTube Data API key: create one restricted to YouTube Data API v3 in his existing "Hobby Projects" GCP project (credentials gate: waits on his yes); until then the resolver runs index → MusicBrainz → iTunes, which already finds "Cuz My Gear".
- F. Wayback crawl covers 2006-01 → 2016-12 first (the blog/mixtape era where the off-chart layer matters most), then extends.

## 11. Left to the builder
Component boundaries, file layout under `src/`, parser internals, test structure, exact easing constants (start from the spike), how the landing frame hands off to the page.

## 12. Revisions after the builder check and the Fable red-team (2026-10-20, 09:05)
These override the sections above where they differ.

1. **Resolver runs in the browser.** MusicBrainz and iTunes both send `access-control-allow-origin: *`; resolving client-side makes their rate limits per visitor instead of one shared Vercel IP that 503s on launch day. `/api/resolve` stays only as the own-index lookup. No token bucket, no DB.
2. **A failed resolve never blocks the flight.** No match → "pick the year" → fly anyway. The flight and the era page are date-driven.
3. **The shared link replays the flight**: `/?to=YYYY-MM-DD&song=…&artist=…` auto-launches (skippable) and lands on the era page. `/era/YYYY-MM` stays the static, crawlable page.
4. **The card line is a contrast, not a label**: `SPRING 2012 · I WAS ON CHIEF KEEF · THE WORLD WAS ON GOTYE`.
5. **Cut from v2.0**: the week-scrub strip (§3.4 item 4), the YouTube Data API path (§5.3 step 5, decision E), DatPiff (front page gave no rank or artist).
6. **Off-chart scope**: Wayback 2010-01 → 2014-12, hotnewhiphop.com + hypem.com/popular + billboard.com genre pages; publish only months whose parse-count canary passes; log every 429 and refuse a month that errored. Every other month shows "no archived capture for this month".
7. **Lanes**: each lane ships only when its cadence canary passes; failed lanes are hidden, never hand-fixed.
8. **Weekly chart source**: utdata/rwd-billboard-data (MIT repo) primary, mhollingshead/billboard-hot-100 cross-check on every top-10 rank (3 of 35,580 pairs disagree), Wikipedia cross-check on #1 (13 of 3,555, all medley/punctuation).
9. **Tunnel performance**: pool ~120 meshes and recycle them behind the camera; load textures by proximity (first 40 before launch); `setPixelRatio` ≤ 1.5 below 640 px; fps measured on a flight to 1965, not 2012.
10. **Resolver date rules** (each one is a test):
    - iTunes hits count only when the normalised primary artist matches; discard artists containing karaoke / tribute / "made famous by" / "in the style of".
    - Match the whole query against the index and MusicBrainz first; a 4-digit token is a year only if the rest still resolves ("1999", "7 Years", "Summer of '69" are titles).
    - Partial MusicBrainz dates keep their granularity ("2012, year only") and fly to mid-period, never Jan 1.
    - The index's first-seen date is labelled "entered the Hot 100", never "released"; an earlier MusicBrainz date overrides it for the anchor.
    - Common titles with no artist and no year never auto-accept a MusicBrainz-only match: show up to 3 candidates.
    - Seed the index with a hand-verified non-DSP set (Cuz My Gear and the probe's drill list) so the core case needs zero external calls.
11. **Builder-check answers**: v2.0 ships with whatever off-chart months pass (not blocked on the crawl). The resolver bar is scored keyless. Weekly refresh: a launchd job re-runs the pipelines, rebuilds and deploys (`add-life-ops-cron`), and the page shows "charts through <date>". A bare year flies to mid-year (`YYYY-06-15`) and labels it "year only"; a decade flies to its middle year; dates before 1958-08-04 land on the first chart week and say "the Hot 100 starts 4 Aug 1958". The v1 mock dashboard (`/song`, `/artist`, `/compare`, mock catalog, Spotify/Genius cards, "Trending") is removed and its routes redirect to `/`; `v1.40.0` is tagged first so it stays recoverable.
