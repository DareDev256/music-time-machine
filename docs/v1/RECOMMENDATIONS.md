# Recommendation Engine

How Music Time Machine suggests "similar songs" — the scoring model, diversity strategies, and preference system inside `src/lib/recommendations.ts`.

---

## Algorithm Overview

```
Target song audio features
        │
        ▼
  ┌─────────────┐     ┌──────────────────┐
  │  Score each  │────►│  Weighted 4D     │
  │  candidate   │     │  Euclidean dist   │
  └──────┬──────┘     │  (dance, energy,  │
         │            │   valence, tempo)  │
         │            └──────────────────┘
         ▼
  ┌─────────────┐
  │  + Era bonus │  +8 pts if within 2 years
  │  + Pref bonus│  +10–12 pts per matched pref
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────┐
  │  Strategy picker             │
  │  ┌─────────┐  ┌───────────┐ │
  │  │best-match│  │  diverse   │ │
  │  │ greedy   │  │ set-cover │ │
  │  │ by score │  │ + bonuses │ │
  │  └─────────┘  └───────────┘ │
  │        ▲   auto   ▲         │
  │        └────┬─────┘         │
  │     genre diversity < 2?    │
  │     → diverse, else match   │
  └──────────────┬──────────────┘
                 │
                 ▼
         Artist-diverse top N
```

---

## Scoring Model

Each candidate receives a **similarity score** (0–100) based on four audio features from Spotify:

| Feature       | Weight | Why                                          |
|---------------|--------|----------------------------------------------|
| Danceability  | 1.0    | Baseline rhythm similarity                   |
| Energy        | 1.5    | Dominant "vibe" signal — louder = more similar|
| Valence       | 1.5    | Emotional tone — happy/sad alignment         |
| Tempo         | 0.8    | Normalized to 0–1 (÷ 200 BPM ceiling)       |

**Score formula:** `100 - euclideanDistance × 150`

Bonuses stack additively:
- **Same era:** +8 if released within 2 years of target
- **Genre pref:** +12 if candidate matches a user-preferred genre
- **Era pref:** +10 if candidate falls within user's preferred year range
- **Mood pref:** +10 if energy + valence are within 0.25 of the mood target

---

## Selection Strategies

### `best-match` (greedy by score)
Sorts all scored candidates descending, picks top N while enforcing one-per-artist. Fastest path — no re-scoring.

### `diverse` (set-cover with marginal bonuses)
Each pick round scans remaining candidates and adds:
- **+25** for an unseen genre
- **+15** for an unseen decade
- **+0–5** popularity tiebreaker (Spotify popularity ÷ 100 × 5)

This greedy set-cover approach maximizes genre/era coverage while keeping a quality floor (the base similarity score still dominates for bad matches).

### `auto` (default — inspects then delegates)
1. Simulates a best-match pass over the top N candidates
2. Counts distinct genres in that preview set
3. If < 2 genres → switches to `diverse` (breaks the genre bubble)
4. If ≥ 2 genres → keeps `best-match` (already diverse enough)

The resolution is captured in `AutoInsight` and exposed via `getAutoInsight()` for UI transparency.

---

## Artist Diversity Filter

Applied in **all** strategies. Two layers prevent artist repetition:

1. **Early skip:** Candidates sharing any credited artist with the target are filtered out during scoring (saves distance calculations)
2. **Pick filter:** Each picked song's artists are added to a `seenArtists` set. Subsequent candidates with any overlapping artist are skipped

Artist parsing handles: `ft.`, `feat.`, `&` (but not in "R&B"), `,`, `with`.

---

## Diversity Meta

`getDiversityMeta()` scores a recommendation set's variety (0–100):

```
score = min(100, genreRatio × 60 + eraRatio × 40)
```

- **genreRatio** = unique genres ÷ pick count
- **eraRatio** = min(1, unique eras ÷ 2) — decades are coarse, so 2+ = full credit
- Labels: "Wide mix" (≥75), "Good variety" (≥45), "Similar vibe" (≥20), "Narrow focus" (<20)

---

## User Preferences (`RecommendationPrefs`)

```typescript
interface RecommendationPrefs {
  genres?: string[];              // Preferred genres — +12 bonus each
  eraRange?: [number, number];    // Year range — +10 if candidate is within
  mood?: "upbeat" | "chill" | "melancholy" | "energetic";  // +10 mood match
  strategy?: "auto" | "best-match" | "diverse";
}
```

All fields are optional. Without prefs, the engine uses `auto` strategy with no genre/era/mood bonuses.

### Mood Targets

| Mood        | Energy | Valence |
|-------------|--------|---------|
| Upbeat      | 0.80   | 0.80    |
| Chill       | 0.35   | 0.50    |
| Melancholy  | 0.40   | 0.20    |
| Energetic   | 0.90   | 0.60    |

---

## Key Exports

| Export                | Type       | Purpose                                          |
|-----------------------|------------|--------------------------------------------------|
| `getSimilarSongs()`   | Function   | Main entry — scores catalog, picks top N         |
| `getDiversityMeta()`  | Function   | Analyzes genre/era diversity of a result set     |
| `getAutoInsight()`    | Function   | Returns last auto-strategy resolution metadata   |
| `splitArtists()`      | Function   | Parses credit strings into individual names      |
| `primaryArtist()`     | Function   | Extracts first-billed artist (lowercase)         |
| `safeYear()`          | Function   | Parses release dates with memoization + null safety |
| `SelectionStrategy`   | Type       | `"auto" \| "best-match" \| "diverse"`            |
| `RecommendationPrefs` | Interface  | User preference configuration                    |
| `AutoInsight`         | Interface  | Auto-strategy resolution metadata                |
| `DiversityMeta`       | Interface  | Diversity analysis result                        |

---

## Tuning Constants

All scoring constants are defined at module scope for single-point tuning:

| Constant                  | Value | Effect                                    |
|---------------------------|-------|-------------------------------------------|
| `DISTANCE_TO_SCORE`       | 150   | Steeper = more score separation           |
| `TEMPO_CEILING`           | 200   | Max BPM for normalization                 |
| `SAME_ERA_BONUS`          | 8     | Era proximity reward                      |
| `ERA_PROXIMITY_YEARS`     | 2     | Year gap for era bonus                    |
| `PREFERRED_GENRE_BONUS`   | 12    | User genre pref reward                    |
| `PREFERRED_ERA_BONUS`     | 10    | User era pref reward                      |
| `MOOD_MATCH_BONUS`        | 10    | Mood proximity reward                     |
| `DIVERSITY_GENRE_BONUS`   | 25    | Diverse strategy: unseen genre bonus      |
| `DIVERSITY_ERA_BONUS`     | 15    | Diverse strategy: unseen decade bonus     |
| `POPULARITY_WEIGHT`       | 5     | Max popularity tiebreaker in diverse mode |
| `AUTO_DIVERSITY_THRESHOLD`| 2     | Genre count that triggers diverse mode    |

---

## Tests

```bash
npm test -- recommendations       # Core scoring + diversity
npm test -- recommendations-prefs # Preference bonuses + mood matching
npm test -- diversity-pipeline    # Integration: full pipeline with strategies
```

---

## Where It's Used

- **`SimilarSongs` component** — Renders recommendation cards on song pages
- **`PlaylistConfigurator`** — Exposes strategy toggle + preference controls
- **`/api/song/[id]`** — Server-side could use it for pre-computed recommendations

---

*Last updated: 2026-03-08 · Engine version: 1.21.1*
