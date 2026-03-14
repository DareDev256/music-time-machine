import { SongData } from "@/types";
import { songGenres } from "@/lib/mockData";

// ── User preferences ─────────────────────────────────────────────────────

/** Mood preset → target audio feature ranges for preference-aware scoring. */
const MOOD_TARGETS: Record<string, { energy: number; valence: number }> = {
  upbeat:     { energy: 0.8, valence: 0.8 },
  chill:      { energy: 0.35, valence: 0.5 },
  melancholy: { energy: 0.4, valence: 0.2 },
  energetic:  { energy: 0.9, valence: 0.6 },
};

/** Additive bonus when a candidate matches one of the user's preferred genres. */
const PREFERRED_GENRE_BONUS = 12;
/** Additive bonus when a candidate falls within the user's preferred era range. */
const PREFERRED_ERA_BONUS = 10;
/** Additive bonus when a candidate's mood features are close to the user's target. */
const MOOD_MATCH_BONUS = 10;
/** Delta threshold for mood feature proximity. */
const MOOD_PROXIMITY = 0.25;

/** Selection strategy for the recommendation picker. */
export type SelectionStrategy = "auto" | "best-match" | "diverse";

/** Insight into the auto-strategy resolution for UI transparency. */
export interface AutoInsight {
  /** The strategy auto resolved to after inspecting candidates. */
  resolved: "best-match" | "diverse";
  /** Distinct genres detected in the top candidates. */
  genresDetected: string[];
}

// Module-level ref — set during getSimilarSongs, read by getAutoInsight().
// Safe because scoring + rendering are synchronous within a single React render.
let _lastAutoInsight: AutoInsight | null = null;

/** Returns insight from the most recent auto-strategy resolution, or null if strategy wasn't "auto". */
export function getAutoInsight(): AutoInsight | null {
  return _lastAutoInsight;
}

/** User-configurable recommendation preferences. All fields optional. */
export interface RecommendationPrefs {
  /** Preferred genres — candidates matching these get a scoring bonus. */
  genres?: string[];
  /** Preferred release year range — candidates within get a scoring bonus. */
  eraRange?: [number, number];
  /** Mood preset — biases scoring toward matching energy/valence profiles. */
  mood?: "upbeat" | "chill" | "melancholy" | "energetic";
  /** Selection strategy — "best-match" (default) or "diverse" for genre/era spread. */
  strategy?: SelectionStrategy;
}

// ── Algorithm constants ─────────────────────────────────────────────────────
// Named so the scoring model is readable and tunable from one place.

/** Feature weights for the 4D Euclidean distance. Energy and valence dominate "vibe." */
const FEATURE_WEIGHTS = {
  danceability: 1.0,
  energy: 1.5,
  valence: 1.5,
  tempo: 0.8,
} as const;

/** Max BPM used to normalize tempo into 0–1 range alongside other features. */
const TEMPO_CEILING = 200;

/** Multiplier converting raw distance to a 0–100 similarity score. */
const DISTANCE_TO_SCORE = 150;

/** Additive bonus when candidate is released within {@link ERA_PROXIMITY_YEARS} of target. */
const SAME_ERA_BONUS = 8;

/** Max year gap to qualify for the same-era bonus. */
const ERA_PROXIMITY_YEARS = 2;

/** Distance threshold below which two songs are "nearly identical." */
const NEAR_IDENTICAL_THRESHOLD = 0.15;

/** Energy threshold above which both songs qualify as "high energy." */
const HIGH_ENERGY_THRESHOLD = 0.7;

/** Valence delta below which the mood is considered matching. */
const SIMILAR_MOOD_THRESHOLD = 0.1;

/** Year gap for the "Same era" reason label (tighter than the scoring bonus). */
const ERA_REASON_YEARS = 1;

/** Diversity score formula: genre variety is the primary signal. */
const GENRE_WEIGHT = 60;
/** Diversity score formula: era spread adds depth. */
const ERA_WEIGHT = 40;
/**
 * Normalizer for era diversity ratio. Decades are inherently coarser than
 * genres (a catalog spanning 2017–2024 only covers 2 decades), so dividing
 * by pick count produces a ratio that almost never exceeds 0.25. Using a
 * fixed spread of 2 means "picks span 2+ distinct decades" = full era credit.
 */
const ERA_FULL_SPREAD = 2;

/** Bonus added during the diverse-strategy pick phase for an unseen genre. */
const DIVERSITY_GENRE_BONUS = 25;
/** Bonus added during the diverse-strategy pick phase for an unseen era. */
const DIVERSITY_ERA_BONUS = 15;
/**
 * Bonus for collaboration tracks (ft./feat./with) in the diversity picker.
 * Collabs naturally bridge genres and audiences — a featured artist from a
 * different scene is a strong diversity signal the engine should reward.
 */
const COLLAB_DIVERSITY_BONUS = 8;

/**
 * Popularity bonus scale for diverse/auto strategies. Popular songs get a small
 * quality signal so the diversity picker doesn't surface obscure filler over
 * well-known tracks when diversity bonuses are equal.
 * Max bonus = POPULARITY_WEIGHT (popularity is 0–100, divided by 100).
 */
const POPULARITY_WEIGHT = 5;

/**
 * Auto-strategy threshold: if the top `limit` best-match candidates share
 * fewer than this many distinct genres, auto switches to diverse mode.
 * At 2+, the best-match set is already reasonably diverse.
 */
const AUTO_DIVERSITY_THRESHOLD = 2;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Lightweight cache for safeYear — avoids redundant Date construction when the
 * same release date string is parsed in both the scoring loop and getDiversityMeta.
 * Bounded to 256 entries to prevent unbounded growth in edge cases.
 */
const yearCache = new Map<string, number | null>();
const YEAR_CACHE_LIMIT = 256;

/**
 * Safely extract a year from a release date string.
 * Returns null for undefined, empty, or unparseable dates instead of NaN.
 * Results are memoized — repeated calls with the same string skip Date parsing.
 */
export function safeYear(date: string | undefined | null): number | null {
  if (!date || !date.trim()) return null;

  const cached = yearCache.get(date);
  if (cached !== undefined) return cached;

  const parsed = new Date(date);
  const result = Number.isNaN(parsed.getTime()) ? null : parsed.getUTCFullYear();

  // FIFO eviction: remove only the oldest entry instead of nuking the entire
  // cache. clear() destroyed cached null values for invalid dates, forcing
  // redundant Date.parse calls on every subsequent scoring pass.
  if (yearCache.size >= YEAR_CACHE_LIMIT) {
    const oldest = yearCache.keys().next().value;
    if (oldest !== undefined) yearCache.delete(oldest);
  }
  yearCache.set(date, result);

  return result;
}

/** Convert a year to its decade label. @example 2017 → "2010s" */
function decadeLabel(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

interface ScoredSong {
  song: SongData;
  score: number;
  reason: string;
  /** Pre-parsed artist names — avoids redundant regex splits in the diversity filter. */
  artists: string[];
  /** Decomposed score components for UI transparency. */
  breakdown: ScoreBreakdown;
}

/** Weighted Euclidean distance between two audio feature vectors. */
function featureDistance(
  a: { danceability: number; energy: number; valence: number; tempo: number },
  b: { danceability: number; energy: number; valence: number; tempo: number },
): number {
  const normA = a.tempo / TEMPO_CEILING;
  const normB = b.tempo / TEMPO_CEILING;
  return Math.sqrt(
    FEATURE_WEIGHTS.danceability * (a.danceability - b.danceability) ** 2 +
    FEATURE_WEIGHTS.energy * (a.energy - b.energy) ** 2 +
    FEATURE_WEIGHTS.valence * (a.valence - b.valence) ** 2 +
    FEATURE_WEIGHTS.tempo * (normA - normB) ** 2,
  );
}

/**
 * Classify the primary reason a candidate was recommended.
 * Order matters — first matching rule wins, most specific first.
 * Note: same-artist candidates are early-skipped in the scoring loop
 * (they're unconditionally excluded by the diversity filter), so
 * "Same artist" is no longer a possible output.
 */
function classifyReason(
  distance: number,
  candidateEnergy: number,
  targetEnergy: number,
  valenceDelta: number,
  targetYear: number | null,
  candidateYear: number | null,
): string {
  if (distance < NEAR_IDENTICAL_THRESHOLD) return "Nearly identical vibe";
  if (candidateEnergy > HIGH_ENERGY_THRESHOLD && targetEnergy > HIGH_ENERGY_THRESHOLD) return "High energy match";
  if (Math.abs(valenceDelta) < SIMILAR_MOOD_THRESHOLD) return "Similar mood";
  if (targetYear !== null && candidateYear !== null && Math.abs(candidateYear - targetYear) <= ERA_REASON_YEARS) return "Same era";
  return "Similar sound";
}

// ── Diversity meta ──────────────────────────────────────────────────────────

/** Diversity analysis of a recommendation set */
export interface DiversityMeta {
  /** Overall diversity score (0–100). Higher = more diverse picks. */
  score: number;
  /** Human-readable label for the diversity level. */
  label: string;
  /** Distinct genres present across the recommendations. */
  genres: string[];
  /** Decade spread — unique decades represented. @example ["2010s", "2020s"] */
  eras: string[];
}

/**
 * Analyze the genre and era diversity of a recommendation set.
 * Score formula:
 *   - Base: (unique genres / total picks) × 60  (genre variety is the primary signal)
 *   - Bonus: (unique eras / total picks) × 40   (era spread adds depth)
 * A set of 4 songs spanning 4 genres and 3+ decades scores 100.
 */
export function getDiversityMeta(
  target: SongData,
  picks: { song: SongData }[],
): DiversityMeta {
  if (picks.length === 0) return { score: 0, label: "No data", genres: [], eras: [] };

  const genres = new Set<string>();
  const eras = new Set<string>();

  // Include target song in era calculation for context (guard against invalid dates)
  const targetYear = safeYear(String(target.releaseDate ?? ""));
  if (targetYear !== null) {
    eras.add(decadeLabel(targetYear));
  }

  let genreKnown = 0;
  for (const { song } of picks) {
    const genre = songGenres[song.id];
    if (genre) {
      genres.add(genre);
      genreKnown++;
    }

    const year = safeYear(String(song.releaseDate ?? ""));
    if (year !== null) {
      eras.add(decadeLabel(year));
    }
  }

  const count = picks.length;
  // Use only picks with known genres as the denominator — songs missing from
  // songGenres shouldn't deflate the ratio. Falls back to total count when
  // no genre data exists at all (avoids division by zero).
  const genreDenom = genreKnown > 0 ? genreKnown : count;
  const genreRatio = genres.size / genreDenom;
  // Subtract 1 only when the target era was actually added (valid target date).
  // Without this guard, an invalid target date means the set never received the
  // baseline era, making (eras.size - 1) negative and dragging the score below 0.
  const eraBaseline = targetYear !== null ? 1 : 0;
  // Normalize against ERA_FULL_SPREAD instead of count. Decades are far coarser
  // than genres — a typical catalog spans only 2 decades, so dividing by count
  // (4) made eraRatio cap at 0.25, capping era contribution at 10/40 points
  // and making "Wide mix" (≥75) mathematically unreachable.
  const eraRatio = Math.min(1, Math.max(0, (eras.size - eraBaseline) / ERA_FULL_SPREAD));

  const score = Math.min(100, Math.round(genreRatio * GENRE_WEIGHT + eraRatio * ERA_WEIGHT));

  const label =
    score >= 75 ? "Wide mix" :
    score >= 45 ? "Good variety" :
    score >= 20 ? "Similar vibe" :
    "Narrow focus";

  return {
    score,
    label,
    genres: [...genres].sort(),
    eras: [...eras].sort(),
  };
}

// ── Artist parsing ──────────────────────────────────────────────────────────

/**
 * Split a credit string into individual artist names.
 * Handles: "ft." / "feat." / "&" / "," / "with" separators.
 * The "&" split requires at least 2 chars on each side to avoid
 * breaking genre-style names like "R&B".
 * e.g. "Lady Gaga & Bruno Mars" → ["lady gaga", "bruno mars"]
 *      "Mark Ronson ft. Bruno Mars" → ["mark ronson", "bruno mars"]
 *      "Tones and I" → ["tones and i"] (single artist — "and" is NOT a separator)
 */
export function splitArtists(artist: string): string[] {
  // Runtime guard: API responses can smuggle non-string values past TypeScript's
  // compile-time checks. Return empty array instead of crashing on .split().
  if (typeof artist !== "string") return [];

  // First pass: split on unambiguous separators (comma, ft., feat., with)
  const parts = artist.split(
    /\s*(?:,\s*|\s+(?:ft\.?|feat\.?|with)\s+)\s*/i,
  );
  // Second pass: split on "&" only when both sides are ≥2 chars (avoids "R&B")
  const result: string[] = [];
  for (const part of parts) {
    const ampersandParts = part.split(/\s*&\s*/);
    if (ampersandParts.length > 1 && ampersandParts.every((p) => p.trim().length >= 2)) {
      result.push(...ampersandParts);
    } else {
      result.push(part);
    }
  }
  return result.map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Extract the primary (first-billed) artist name, normalised to lowercase */
export function primaryArtist(artist: string): string {
  if (typeof artist !== "string") return "";
  return splitArtists(artist)[0] ?? artist.trim().toLowerCase();
}

// ── Pick result type ─────────────────────────────────────────────────────

<<<<<<< HEAD
/** Why the diversity picker chose this song over alternatives. */
export type DiversityTag = "new-genre" | "new-era" | "collab" | null;
=======
/** Breakdown of how a recommendation score was computed. */
export interface ScoreBreakdown {
  /** Raw similarity score from audio feature distance (0–100). */
  base: number;
  /** Era proximity bonus (0 or SAME_ERA_BONUS). */
  era: number;
  /** Preferred genre bonus (0 or PREFERRED_GENRE_BONUS). */
  genre: number;
  /** Preferred era range bonus (0 or PREFERRED_ERA_BONUS). */
  prefEra: number;
  /** Mood match bonus (0 or MOOD_MATCH_BONUS). */
  mood: number;
}
>>>>>>> passion/feat-diversity-picked-feat-mmpsmce2

/** A single recommendation pick with scoring metadata for the UI. */
export interface PickResult {
  song: SongData;
  reason: string;
  matchScore: number;
<<<<<<< HEAD
  /** Whether this song is a collaboration (has featured artists). */
  isCollab: boolean;
  /** Why the diversity strategy picked this song, if applicable. */
  diversityTag: DiversityTag;
=======
  /** Score breakdown showing what contributed to the match score. */
  breakdown: ScoreBreakdown;
>>>>>>> passion/feat-diversity-picked-feat-mmpsmce2
}

/** Clamp a raw score into the 0–99 integer range used by the UI. */
function clampScore(raw: number): number {
  return Math.min(99, Math.max(0, Math.round(raw)));
}

// ── Scoring pipeline ─────────────────────────────────────────────────────

/** Audio features required from the target song. */
type AudioFeatures = { danceability: number; energy: number; valence: number; tempo: number };

/**
 * Score every eligible candidate against the target.
 * Filters out the target itself, candidates without audio features,
 * and candidates sharing an artist with the target (diversity pre-seed).
 * Returns candidates sorted by score descending.
 */
function scoreCandidates(
  target: SongData,
  catalog: SongData[],
  targetFeatures: AudioFeatures,
  targetYear: number | null,
  targetArtists: Set<string>,
  prefs?: RecommendationPrefs,
): ScoredSong[] {
  const scored: ScoredSong[] = [];

  for (const candidate of catalog) {
    if (candidate.id === target.id) continue;

    const features = candidate.spotify?.audioFeatures;
    if (!features) continue;

    // Early-skip candidates sharing any artist with the target — the diversity
    // filter would unconditionally exclude them anyway.
    const candidateArtists = splitArtists(String(candidate.artist ?? ""));
    if (candidateArtists.some((a) => targetArtists.has(a))) continue;

    const distance = featureDistance(targetFeatures, features);
    const base = Math.max(0, 100 - distance * DISTANCE_TO_SCORE);
    let score = base;

    // Bonus: same era (within ERA_PROXIMITY_YEARS)
    const candidateYear = safeYear(String(candidate.releaseDate ?? ""));
    let eraBonus = 0;
    if (targetYear !== null && candidateYear !== null && Math.abs(candidateYear - targetYear) <= ERA_PROXIMITY_YEARS) {
      eraBonus = SAME_ERA_BONUS;
      score += eraBonus;
    }

    // ── User preference bonuses ──────────────────────────────────────
    let genreBonus = 0;
    let prefEraBonus = 0;
    let moodBonus = 0;
    if (prefs) {
      const candidateGenre = songGenres[candidate.id];
      if (prefs.genres?.length && candidateGenre && prefs.genres.includes(candidateGenre)) {
        genreBonus = PREFERRED_GENRE_BONUS;
        score += genreBonus;
      }
      if (prefs.eraRange && candidateYear !== null) {
        const [lo, hi] = prefs.eraRange;
        if (candidateYear >= lo && candidateYear <= hi) {
          prefEraBonus = PREFERRED_ERA_BONUS;
          score += prefEraBonus;
        }
      }
      if (prefs.mood && MOOD_TARGETS[prefs.mood]) {
        const mt = MOOD_TARGETS[prefs.mood];
        if (Math.abs(features.energy - mt.energy) < MOOD_PROXIMITY && Math.abs(features.valence - mt.valence) < MOOD_PROXIMITY) {
          moodBonus = MOOD_MATCH_BONUS;
          score += moodBonus;
        }
      }
    }

    const breakdown: ScoreBreakdown = { base, era: eraBonus, genre: genreBonus, prefEra: prefEraBonus, mood: moodBonus };

    const reason = classifyReason(
      distance, features.energy, targetFeatures.energy,
      features.valence - targetFeatures.valence, targetYear, candidateYear,
    );

    scored.push({ song: candidate, score, reason, artists: candidateArtists, breakdown });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// ── Strategy resolution ──────────────────────────────────────────────────

/**
 * Inspect the top best-match candidates' genre diversity to decide whether
 * the auto strategy should resolve to "best-match" or "diverse".
 * Deduplicates artists during inspection so the genre sample matches what
 * the picker would actually select.
 */
function resolveStrategy(
  requested: SelectionStrategy,
  scored: ScoredSong[],
  limit: number,
): "best-match" | "diverse" {
  _lastAutoInsight = null;
  if (requested !== "auto") return requested;

  const topGenres = new Set<string>();
  const inspectedArtists = new Set<string>();
  let inspected = 0;

  for (const entry of scored) {
    if (inspected >= limit) break;
    if (entry.artists.some((a) => inspectedArtists.has(a))) continue;
    for (const a of entry.artists) inspectedArtists.add(a);
    const genre = songGenres[entry.song.id];
    if (genre) topGenres.add(genre);
    inspected++;
  }

  const resolved = topGenres.size < AUTO_DIVERSITY_THRESHOLD ? "diverse" : "best-match";
  _lastAutoInsight = { resolved, genresDetected: [...topGenres].sort() };
  return resolved;
}

// ── Pick strategies ──────────────────────────────────────────────────────

/**
 * Best-match picker: greedily pick highest-scored candidates,
 * enforcing at-most-one-song-per-artist diversity.
 */
function pickBestMatch(scored: ScoredSong[], limit: number): PickResult[] {
  const picked: PickResult[] = [];
  const seenArtists = new Set<string>();

  for (const entry of scored) {
    if (picked.length >= limit) break;
    if (entry.artists.some((a) => seenArtists.has(a))) continue;
    for (const a of entry.artists) seenArtists.add(a);
<<<<<<< HEAD
    picked.push({
      song: entry.song,
      reason: entry.reason,
      matchScore: clampScore(entry.score),
      isCollab: entry.artists.length > 1,
      diversityTag: null,
    });
=======
    picked.push({ song: entry.song, reason: entry.reason, matchScore: clampScore(entry.score), breakdown: entry.breakdown });
>>>>>>> passion/feat-diversity-picked-feat-mmpsmce2
  }

  return picked;
}

/**
 * Diverse picker: greedily pick the candidate that maximizes marginal
 * diversity (unseen genre/era) while keeping a quality floor. Each round
 * adds a diversity bonus to unseen genres/eras and picks the highest
 * effective score. Popularity acts as a tiebreaker.
 */
function pickDiverse(scored: ScoredSong[], limit: number): PickResult[] {
  const picked: PickResult[] = [];
  const seenArtists = new Set<string>();
  const seenGenres = new Set<string>();
  const seenEras = new Set<string>();
  const remaining = [...scored];

  while (picked.length < limit && remaining.length > 0) {
    let bestIdx = -1;
    let bestEffective = -Infinity;
<<<<<<< HEAD
    let bestTag: DiversityTag = null;
=======
    /** Track whether the winning candidate got genre/era diversity bonuses. */
    let bestGenreBonus = false;
    let bestEraBonus = false;
>>>>>>> passion/fix-diversity-picked-fix-mmp95ewh

    for (let i = 0; i < remaining.length; i++) {
      const entry = remaining[i];
      if (entry.artists.some((a) => seenArtists.has(a))) continue;

      let effective = entry.score;
      let tag: DiversityTag = null;

      const genre = songGenres[entry.song.id];
<<<<<<< HEAD
<<<<<<< HEAD
      if (genre && !seenGenres.has(genre)) effective += DIVERSITY_GENRE_BONUS;
      const year = safeYear(String(entry.song.releaseDate ?? ""));
      if (year !== null && !seenEras.has(decadeLabel(year))) effective += DIVERSITY_ERA_BONUS;
=======
      if (genre && !seenGenres.has(genre)) {
        effective += DIVERSITY_GENRE_BONUS;
        tag = "new-genre";
      }
      const year = safeYear(entry.song.releaseDate);
      if (year !== null && !seenEras.has(decadeLabel(year))) {
        effective += DIVERSITY_ERA_BONUS;
        // Only override tag if genre wasn't the primary reason
        if (!tag) tag = "new-era";
      }
      // Collaboration bonus — songs with featured artists bridge audiences
      if (entry.artists.length > 1) {
        effective += COLLAB_DIVERSITY_BONUS;
        if (!tag) tag = "collab";
      }
>>>>>>> passion/feat-diversity-picked-feat-mmpo5vfs
=======
      const hasGenreBonus = !!(genre && !seenGenres.has(genre));
      if (hasGenreBonus) effective += DIVERSITY_GENRE_BONUS;
      const year = safeYear(entry.song.releaseDate);
      const hasEraBonus = year !== null && !seenEras.has(decadeLabel(year));
      if (hasEraBonus) effective += DIVERSITY_ERA_BONUS;
>>>>>>> passion/fix-diversity-picked-fix-mmp95ewh
      effective += ((entry.song.spotify?.popularity ?? 0) / 100) * POPULARITY_WEIGHT;

      if (effective > bestEffective) {
        bestEffective = effective;
        bestIdx = i;
<<<<<<< HEAD
        bestTag = tag;
=======
        bestGenreBonus = hasGenreBonus;
        bestEraBonus = hasEraBonus;
>>>>>>> passion/fix-diversity-picked-fix-mmp95ewh
      }
    }

    if (bestIdx === -1) break;

    const winner = remaining.splice(bestIdx, 1)[0];
    for (const a of winner.artists) seenArtists.add(a);
    const genre = songGenres[winner.song.id];
    if (genre) seenGenres.add(genre);
    const year = safeYear(String(winner.song.releaseDate ?? ""));
    if (year !== null) seenEras.add(decadeLabel(year));

<<<<<<< HEAD
<<<<<<< HEAD
    picked.push({
      song: winner.song,
      reason: winner.reason,
      matchScore: clampScore(winner.score),
      isCollab: winner.artists.length > 1,
      diversityTag: bestTag,
    });
=======
    picked.push({ song: winner.song, reason: winner.reason, matchScore: clampScore(winner.score), breakdown: winner.breakdown });
>>>>>>> passion/feat-diversity-picked-feat-mmpsmce2
=======
    // When diversity bonuses drove the selection, surface that rationale
    // instead of the generic audio-similarity reason. The first pick never
    // gets overridden — it's always the best pure-similarity candidate.
    const reason = picked.length > 0 && bestGenreBonus
      ? "Unique genre"
      : picked.length > 0 && bestEraBonus
        ? "Different era"
        : winner.reason;

    picked.push({ song: winner.song, reason, matchScore: clampScore(winner.score) });
>>>>>>> passion/fix-diversity-picked-fix-mmp95ewh
  }

  return picked;
}

// ── Recommendation engine ───────────────────────────────────────────────────

/**
 * Find similar songs based on audio feature proximity, artist match, and era.
 * Uses weighted Euclidean distance in the (danceability, energy, valence, normalizedTempo) space.
 * Enforces artist diversity: at most one song per artist in results.
 *
 * Pipeline: score → resolve strategy → pick
 */
export function getSimilarSongs(
  target: SongData,
  catalog: SongData[],
  limit: number = 4,
  prefs?: RecommendationPrefs,
): PickResult[] {
  const targetFeatures = target.spotify?.audioFeatures;
  if (!targetFeatures) return [];

  const targetYear = safeYear(String(target.releaseDate ?? ""));
  const targetArtists = new Set(splitArtists(String(target.artist ?? "")));

  const scored = scoreCandidates(target, catalog, targetFeatures, targetYear, targetArtists, prefs);
  const strategy = resolveStrategy(prefs?.strategy ?? "auto", scored, limit);

  return strategy === "diverse" ? pickDiverse(scored, limit) : pickBestMatch(scored, limit);
}
