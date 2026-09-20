# Era plan — song-first, not date-first

Decided 2026-09-20. The product is: **search a song → land on its era.**
"Cuz My Gear" → March 2012 → what was #1 across the lanes, the biggest videos of that
window by genre, and the scene layer no chart recorded (WorldStar, blogs, mixtapes).
Later: hold the phone up (ShazamKit) → the same page.

The birthday / conceived card (shipped in 1.40.0) is the free hook and the SEO floor,
not the product.

## Layers and where each comes from

| Layer | Source | Status |
|---|---|---|
| Hot 100 #1 by week, 1958→ | Wikipedia per-year lists, `data/scripts/hot100_number_ones.py` | **shipped 1.40.0** |
| Cover art + 30s preview | iTunes Search API, keyless (`src/lib/coverArt.ts`) | **shipped 1.40.0** |
| Genre lanes (R&B/Hip-Hop 1958→, Country 1958→, Dance 1976→, Rock/Alt 1988→, Latin 1986→) | Wikipedia per-year lists, same scraper pattern | next |
| Weekly top 10, not just #1 | Wikipedia / public chart archives | next |
| Canada (Canadian Hot 100 2007→, RPM 1964–2000 at Library and Archives Canada) + UK (Official Charts 1952→) | public archives | after lanes |
| Song → release date, genre tags | MusicBrainz + Last.fm tags, both free | with the era page |
| "Hot on YouTube then" | YouTube Data API: music videos published in the window, ordered by views today, genre via tags. Views today ≠ heat then; fine for nostalgia | with the era page |
| Scene layer (drill 2012, Toronto 2010–16, WorldStar cycle) | hand-seeded from James's own archive first, then user submissions | schema in v1, content seeded by hand |
| Shazam entry | ShazamKit (free, iOS/macOS); web needs AudD/ACRCloud (paid) | the app, later |

## Rules
- The fact is the punchline. A card carries a date, a song, a cover, and nothing that
  sounds written. No generated "your era" paragraph on the default card.
- AI is plumbing (messy input → date range; chart names → platform IDs) plus one optional
  feature (compare two people). Never a chatbot.
- Every number on a page has a source row. A generator that cannot source a figure refuses.
- Spotify stream counts are not public. Never fabricate one (the old `popularity × 25M` is gone from the era path).

## Next build: the era page
`/era/YYYY-MM-DD` (server-rendered, cached):
1. Header: the window (±6 months of the anchor date) and how it was reached (song search or date).
2. Lanes strip: #1 per lane for the anchor week, tap to set the page's lane.
3. Weekly top 10 for the anchor week.
4. Biggest videos of the window in the chosen lane (YouTube, 12 tiles, play in place).
5. Scene layer block: seeded entries; "add what you were playing" submission.
6. Share card (`@vercel/og`) and playlist export (Spotify: allowed use is playlist creation).

DONE WHEN: searching "Cuz My Gear" returns an era page James would screenshot;
`/era/2012-03-17` renders the lanes strip and top 10 from sourced data; the scene block
holds at least ten hand-seeded 2012 entries with a source each.
