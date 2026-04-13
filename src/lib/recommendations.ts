import { SongData } from "@/types";
import { songGenres } from "@/lib/mockData";
import { splitArtists, primaryArtist } from "@/lib/artist-utils";
import {
  MOOD_TARGETS,
  PREFERRED_GENRE_BONUS,
  PREFERRED_ERA_BONUS,
  MOOD_MATCH_BONUS,
  MOOD_PROXIMITY,
  FEATURE_WEIGHTS,
  TEMPO_CEILING,
  DISTANCE_TO_SCORE,
  SAME_ERA_BONUS,
  ERA_PROXIMITY_YEARS,
  NEAR_IDENTICAL_THRESHOLD,
  HIGH_ENERGY_THRESHOLD,
  SIMILAR_MOOD_THRESHOLD,
  ERA_REASON_YEARS,
  GENRE_WEIGHT,
  ERA_WEIGHT,
  ERA_FULL_SPREAD,
  DIVERSITY_GENRE_BONUS,
  DIVERSITY_ERA_BONUS,
  COLLAB_DIVERSITY_BONUS,
  POPULARITY_WEIGHT,
  AUTO_DIVERSITY_THRESHOLD,
} from "@/lib/scoring-constants";

// Re-export artist utils so existing consumers don't break
export { splitArtists, primaryArtist } from "@/lib/artist-utils";

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

// ── Extracted helpers ─────────────────────────────────────────────────────

/** Pre-parsed metadata for a song — avoids scattered genre/year lookups. */
interface SongMeta {
  genre: string | undefined;
  year: number | null;
  decade: string | null;
}

/**
 * Extract genre, year, and decade for a song in one call.
 * Replaces 6+ inline lookup sites across pickDiverse, getDiversityMeta,
 * and resolveStrategy with a single consistent extraction.
 */
function extractSongMeta(song: SongData): SongMeta {
  const genre = songGenres[song.id];
  const year = safeYear(String(song.releaseDate ?? ""));
  const decade = year !== null ? decadeLabel(year) : null;
  return { genre, year, decade };
}

/**
 * Yield scored entries with at most one entry per artist group.
 * Encapsulates the artist-dedup pattern used by pickBestMatch,
 * pickDiverse's inner loop, and resolveStrategy's inspection.
 */
function* uniqueByArtist(
  scored: Iterable<ScoredSong>,
  limit?: number,
): Generator<ScoredSong> {
  const seen = new Set<string>();
  let count = 0;
  for (const entry of scored) {
    if (limit !== undefined && count >= limit) return;
    if (entry.artists.some((a) => seen.has(a))) continue;
    for (const a of entry.artists) seen.add(a);
    yield entry;
    count++;
  }
}

/** Map a scored entry to the UI-facing PickResult shape. */
function toPickResult(entry: ScoredSong, reasonOverride?: string): PickResult {
  return {
    song: entry.song,
    reason: reasonOverride ?? entry.reason,
    matchScore: clampScore(entry.score),
    breakdown: entry.breakdown,
  };
}

// ── Scoring ─────────────────────────────────────────────────────────────────

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
 */
export function getDiversityMeta(
  target: SongData,
  picks: { song: SongData }[],
): DiversityMeta {
  if (picks.length === 0) return { score: 0, label: "No data", genres: [], eras: [] };

  const genres = new Set<string>();
  const eras = new Set<string>();

  const targetMeta = extractSongMeta(target);
  if (targetMeta.decade) eras.add(targetMeta.decade);

  let genreKnown = 0;
  for (const { song } of picks) {
    const meta = extractSongMeta(song);
    if (meta.genre) {
      genres.add(meta.genre);
      genreKnown++;
    }
    if (meta.decade) eras.add(meta.decade);
  }

  const count = picks.length;
  const genreDenom = genreKnown > 0 ? genreKnown : count;
  const genreRatio = genres.size / genreDenom;
  const eraBaseline = targetMeta.year !== null ? 1 : 0;
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

// ── Pick result type ─────────────────────────────────────────────────────

/** A single recommendation pick with scoring metadata for the UI. */
export interface PickResult {
  song: SongData;
  reason: string;
  matchScore: number;
  /** Score breakdown showing what contributed to the match score. */
  breakdown: ScoreBreakdown;
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

    const candidateArtists = splitArtists(String(candidate.artist ?? ""));
    if (candidateArtists.some((a) => targetArtists.has(a))) continue;

    const distance = featureDistance(targetFeatures, features);
    const base = Math.max(0, 100 - distance * DISTANCE_TO_SCORE);
    let score = base;

    const candidateYear = safeYear(String(candidate.releaseDate ?? ""));
    let eraBonus = 0;
    if (targetYear !== null && candidateYear !== null && Math.abs(candidateYear - targetYear) <= ERA_PROXIMITY_YEARS) {
      eraBonus = SAME_ERA_BONUS;
      score += eraBonus;
    }

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

function resolveStrategy(
  requested: SelectionStrategy,
  scored: ScoredSong[],
  limit: number,
): "best-match" | "diverse" {
  _lastAutoInsight = null;
  if (requested !== "auto") return requested;

  const topGenres = new Set<string>();
  let withGenre = 0;

  // uniqueByArtist handles the artist-dedup loop; we only consume entries
  // whose genre mapping exists (genreless candidates don't count toward the
  // inspection budget — they carry no signal for the best-match / diverse decision).
  for (const entry of uniqueByArtist(scored)) {
    if (withGenre >= limit) break;
    const { genre } = extractSongMeta(entry.song);
    if (genre) {
      topGenres.add(genre);
      withGenre++;
    }
  }

  const resolved = topGenres.size < AUTO_DIVERSITY_THRESHOLD ? "diverse" : "best-match";
  _lastAutoInsight = { resolved, genresDetected: [...topGenres].sort() };
  return resolved;
}

// ── Pick strategies ──────────────────────────────────────────────────────

function pickBestMatch(scored: ScoredSong[], limit: number): PickResult[] {
  return [...uniqueByArtist(scored, limit)].map((e) => toPickResult(e));
}

/**
 * Diverse picker: greedily pick the candidate that maximizes marginal
 * diversity (unseen genre/era) while keeping a quality floor.
 * Collaboration bonus rewards featured-artist tracks that bridge audiences.
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
    let bestGenreBonus = false;
    let bestEraBonus = false;

    for (let i = 0; i < remaining.length; i++) {
      const entry = remaining[i];
      if (entry.artists.some((a) => seenArtists.has(a))) continue;

      let effective = entry.score;
      const meta = extractSongMeta(entry.song);

      const hasGenreBonus = !!(meta.genre && !seenGenres.has(meta.genre));
      if (hasGenreBonus) effective += DIVERSITY_GENRE_BONUS;
      const hasEraBonus = meta.decade !== null && !seenEras.has(meta.decade);
      if (hasEraBonus) effective += DIVERSITY_ERA_BONUS;
      if (entry.artists.length > 1) effective += COLLAB_DIVERSITY_BONUS;
      effective += ((entry.song.spotify?.popularity ?? 0) / 100) * POPULARITY_WEIGHT;

      if (effective > bestEffective) {
        bestEffective = effective;
        bestIdx = i;
        bestGenreBonus = hasGenreBonus;
        bestEraBonus = hasEraBonus;
      }
    }

    if (bestIdx === -1) break;

    const winner = remaining.splice(bestIdx, 1)[0];
    for (const a of winner.artists) seenArtists.add(a);
    const winnerMeta = extractSongMeta(winner.song);
    if (winnerMeta.genre) seenGenres.add(winnerMeta.genre);
    if (winnerMeta.decade) seenEras.add(winnerMeta.decade);

    // When diversity bonuses drove the selection, surface that rationale
    // instead of the generic audio-similarity reason. The first pick never
    // gets overridden — it's always the best pure-similarity candidate.
    const reason = picked.length > 0 && bestGenreBonus
      ? "Unique genre"
      : picked.length > 0 && bestEraBonus
        ? "Different era"
        : winner.reason;

    picked.push(toPickResult(winner, reason));
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
