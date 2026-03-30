/**
 * Recommendation scoring algorithm constants.
 *
 * Centralizes every tuning knob for the recommendation engine — feature
 * weights, bonus values, thresholds, and diversity parameters. Extracted
 * from recommendations.ts so scoring behaviour is discoverable and
 * adjustable without navigating a 500+ line algorithm file.
 */

// ── User preference bonuses ────────────────────────────────────────────────

/** Mood preset -> target audio feature ranges for preference-aware scoring. */
export const MOOD_TARGETS: Record<string, { energy: number; valence: number }> = {
  upbeat:     { energy: 0.8, valence: 0.8 },
  chill:      { energy: 0.35, valence: 0.5 },
  melancholy: { energy: 0.4, valence: 0.2 },
  energetic:  { energy: 0.9, valence: 0.6 },
};

/** Additive bonus when a candidate matches one of the user's preferred genres. */
export const PREFERRED_GENRE_BONUS = 12;
/** Additive bonus when a candidate falls within the user's preferred era range. */
export const PREFERRED_ERA_BONUS = 10;
/** Additive bonus when a candidate's mood features are close to the user's target. */
export const MOOD_MATCH_BONUS = 10;
/** Delta threshold for mood feature proximity. */
export const MOOD_PROXIMITY = 0.25;

// ── Feature distance ────────────────────────────────────────────────────────

/** Feature weights for the 4D Euclidean distance. Energy and valence dominate "vibe." */
export const FEATURE_WEIGHTS = {
  danceability: 1.0,
  energy: 1.5,
  valence: 1.5,
  tempo: 0.8,
} as const;

/** Max BPM used to normalize tempo into 0-1 range alongside other features. */
export const TEMPO_CEILING = 200;

/** Multiplier converting raw distance to a 0-100 similarity score. */
export const DISTANCE_TO_SCORE = 150;

// ── Era & similarity thresholds ─────────────────────────────────────────────

/** Additive bonus when candidate is released within ERA_PROXIMITY_YEARS of target. */
export const SAME_ERA_BONUS = 8;
/** Max year gap to qualify for the same-era bonus. */
export const ERA_PROXIMITY_YEARS = 2;
/** Distance threshold below which two songs are "nearly identical." */
export const NEAR_IDENTICAL_THRESHOLD = 0.15;
/** Energy threshold above which both songs qualify as "high energy." */
export const HIGH_ENERGY_THRESHOLD = 0.7;
/** Valence delta below which the mood is considered matching. */
export const SIMILAR_MOOD_THRESHOLD = 0.1;
/** Year gap for the "Same era" reason label (tighter than the scoring bonus). */
export const ERA_REASON_YEARS = 1;

// ── Diversity scoring ───────────────────────────────────────────────────────

/** Diversity score formula: genre variety is the primary signal. */
export const GENRE_WEIGHT = 60;
/** Diversity score formula: era spread adds depth. */
export const ERA_WEIGHT = 40;
/**
 * Normalizer for era diversity ratio. Decades are inherently coarser than
 * genres — using a fixed spread of 2 means "picks span 2+ distinct
 * decades" = full era credit.
 */
export const ERA_FULL_SPREAD = 2;

// ── Diversity picker bonuses ────────────────────────────────────────────────

/** Bonus added during the diverse-strategy pick phase for an unseen genre. */
export const DIVERSITY_GENRE_BONUS = 25;
/** Bonus added during the diverse-strategy pick phase for an unseen era. */
export const DIVERSITY_ERA_BONUS = 15;
/**
 * Bonus for collaboration tracks in the diversity picker.
 * Collabs naturally bridge genres and audiences.
 */
export const COLLAB_DIVERSITY_BONUS = 8;
/**
 * Popularity bonus scale for diverse/auto strategies.
 * Max bonus = POPULARITY_WEIGHT (popularity is 0-100, divided by 100).
 */
export const POPULARITY_WEIGHT = 5;
/**
 * Auto-strategy threshold: if the top candidates share fewer than this
 * many distinct genres, auto switches to diverse mode.
 */
export const AUTO_DIVERSITY_THRESHOLD = 2;

// ── Pick-engine scoring (novelty-based "Pick for Me") ──────────────────────

/** Base score every unviewed candidate starts with. */
export const PICK_BASE_SCORE = 50;
/** Bonus for a genre the user hasn't explored yet. */
export const PICK_UNEXPLORED_GENRE_BONUS = 30;
/** Per-occurrence penalty for genres the user has already seen. */
export const PICK_GENRE_REPEAT_PENALTY = 8;
/** Bonus for an artist the user hasn't listened to. */
export const PICK_NEW_ARTIST_BONUS = 15;
/** Divisor applied to Spotify popularity (0-100) for a mild quality signal. */
export const PICK_POPULARITY_DIVISOR = 10;
