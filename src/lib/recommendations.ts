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

/** User-configurable recommendation preferences. All fields optional. */
export interface RecommendationPrefs {
  /** Preferred genres — candidates matching these get a scoring bonus. */
  genres?: string[];
  /** Preferred release year range — candidates within get a scoring bonus. */
  eraRange?: [number, number];
  /** Mood preset — biases scoring toward matching energy/valence profiles. */
  mood?: "upbeat" | "chill" | "melancholy" | "energetic";
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

  // Evict oldest entries if cache exceeds limit (simple size guard)
  if (yearCache.size >= YEAR_CACHE_LIMIT) yearCache.clear();
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
  const targetYear = safeYear(target.releaseDate);
  if (targetYear !== null) {
    eras.add(decadeLabel(targetYear));
  }

  for (const { song } of picks) {
    const genre = songGenres[song.id];
    if (genre) genres.add(genre);

    const year = safeYear(song.releaseDate);
    if (year !== null) {
      eras.add(decadeLabel(year));
    }
  }

  const count = picks.length;
  const genreRatio = genres.size / count;
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
  return splitArtists(artist)[0] ?? artist.trim().toLowerCase();
}

// ── Recommendation engine ───────────────────────────────────────────────────

/**
 * Find similar songs based on audio feature proximity, artist match, and era.
 * Uses weighted Euclidean distance in the (danceability, energy, valence, normalizedTempo) space.
 * Enforces artist diversity: at most one song per artist in results.
 */
export function getSimilarSongs(
  target: SongData,
  catalog: SongData[],
  limit: number = 4,
  prefs?: RecommendationPrefs,
): { song: SongData; reason: string; matchScore: number }[] {
  const targetFeatures = target.spotify?.audioFeatures;
  if (!targetFeatures) return [];

  const targetYear = safeYear(target.releaseDate);
  const targetArtists = new Set(splitArtists(target.artist));

  const scored: ScoredSong[] = [];

  for (const candidate of catalog) {
    if (candidate.id === target.id) continue;

    const features = candidate.spotify?.audioFeatures;
    if (!features) continue;

    // Early-skip candidates sharing any artist with the target — the diversity
    // filter would unconditionally exclude them anyway. Skipping here avoids
    // wasted distance calculations and prevents dead entries from occupying
    // top positions in the sorted array.
    const candidateArtists = splitArtists(candidate.artist);
    if (candidateArtists.some((a) => targetArtists.has(a))) continue;

    const distance = featureDistance(targetFeatures, features);

    // Convert distance to a 0-100 similarity score (lower distance = higher score)
    let score = Math.max(0, 100 - distance * DISTANCE_TO_SCORE);

    // Bonus: same era (within ERA_PROXIMITY_YEARS) — skip if either date is invalid
    const candidateYear = safeYear(candidate.releaseDate);
    if (targetYear !== null && candidateYear !== null && Math.abs(candidateYear - targetYear) <= ERA_PROXIMITY_YEARS) {
      score += SAME_ERA_BONUS;
    }

    // ── User preference bonuses ──────────────────────────────────────
    if (prefs) {
      const candidateGenre = songGenres[candidate.id];
      if (prefs.genres?.length && candidateGenre && prefs.genres.includes(candidateGenre)) {
        score += PREFERRED_GENRE_BONUS;
      }
      if (prefs.eraRange && candidateYear !== null) {
        const [lo, hi] = prefs.eraRange;
        if (candidateYear >= lo && candidateYear <= hi) score += PREFERRED_ERA_BONUS;
      }
      if (prefs.mood && MOOD_TARGETS[prefs.mood]) {
        const mt = MOOD_TARGETS[prefs.mood];
        const eDelta = Math.abs(features.energy - mt.energy);
        const vDelta = Math.abs(features.valence - mt.valence);
        if (eDelta < MOOD_PROXIMITY && vDelta < MOOD_PROXIMITY) score += MOOD_MATCH_BONUS;
      }
    }

    const reason = classifyReason(
      distance,
      features.energy,
      targetFeatures.energy,
      features.valence - targetFeatures.valence,
      targetYear,
      candidateYear,
    );

    scored.push({ song: candidate, score, reason, artists: candidateArtists });
  }

  // Diversity-aware selection: skip songs whose *any* credited artist was already picked.
  // This prevents "Lady Gaga & Bruno Mars" and "ROSÉ & Bruno Mars" from both appearing.
  // Same-artist candidates were already excluded in the scoring loop above.
  scored.sort((a, b) => b.score - a.score);
  const picked: { song: SongData; reason: string; matchScore: number }[] = [];
  const seenArtists = new Set<string>();

  for (const entry of scored) {
    if (picked.length >= limit) break;
    // Reuse pre-parsed artists from the scoring pass — no redundant regex work.
    const artists = entry.artists;
    if (artists.some((a) => seenArtists.has(a))) continue;
    for (const a of artists) seenArtists.add(a);
    // Clamp score to 0–99 range (100% would imply identical song)
    const matchScore = Math.min(99, Math.max(0, Math.round(entry.score)));
    picked.push({ song: entry.song, reason: entry.reason, matchScore });
  }

  return picked;
}
