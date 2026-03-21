/**
 * Threshold-based color utilities for recommendation scores.
 *
 * Consolidates duplicated color-mapping logic from SimilarSongs into
 * a single parameterized system. Each "color tier" maps a numeric score
 * to a set of Tailwind classes for text, ring, background, and border.
 */

interface ColorTier {
  /** Minimum score (inclusive) to qualify for this tier. */
  min: number;
  text: string;
  ring: string;
  bg: string;
}

/**
 * Match-strength color tiers — used for individual recommendation scores.
 * Ordered high-to-low so the first matching tier wins.
 */
const MATCH_TIERS: ColorTier[] = [
  { min: 80, text: "text-emerald-400", ring: "ring-emerald-400/30", bg: "bg-emerald-400/10 border-emerald-400/20" },
  { min: 60, text: "text-sky-400",     ring: "ring-sky-400/30",     bg: "bg-sky-400/10 border-sky-400/20" },
  { min: 40, text: "text-amber-400",   ring: "ring-amber-400/30",   bg: "bg-amber-400/10 border-amber-400/20" },
  { min: 0,  text: "text-foreground-secondary", ring: "ring-border", bg: "bg-foreground/5 border-foreground/10" },
];

/**
 * Diversity score tiers — same thresholds but offset down since
 * diversity scores are inherently lower than match scores.
 */
const DIVERSITY_TIERS: ColorTier[] = [
  { min: 75, text: "text-emerald-400", ring: "ring-emerald-400/30", bg: "bg-emerald-400/10 border-emerald-400/20" },
  { min: 45, text: "text-sky-400",     ring: "ring-sky-400/30",     bg: "bg-sky-400/10 border-sky-400/20" },
  { min: 20, text: "text-amber-400",   ring: "ring-amber-400/30",   bg: "bg-amber-400/10 border-amber-400/20" },
  { min: 0,  text: "text-foreground-secondary", ring: "ring-border", bg: "bg-foreground/5 border-foreground/10" },
];

function resolve(tiers: ColorTier[], score: number): ColorTier {
  return tiers.find((t) => score >= t.min) ?? tiers[tiers.length - 1];
}

/** Tailwind text color class for a match score (0–100). */
export const matchTextColor = (s: number) => resolve(MATCH_TIERS, s).text;

/** Tailwind ring class for a match score. */
export const matchRingColor = (s: number) => resolve(MATCH_TIERS, s).ring;

/** Tailwind text color class for a diversity score. */
export const diversityTextColor = (s: number) => resolve(DIVERSITY_TIERS, s).text;

/** Tailwind bg + border classes for a diversity score badge. */
export const diversityBgColor = (s: number) => resolve(DIVERSITY_TIERS, s).bg;

/** SVG strokeDashoffset for a circular progress indicator (r=16). */
export function circleArcOffset(score: number): string {
  const circumference = 2 * Math.PI * 16;
  return `${circumference - (score / 100) * circumference}`;
}

/** Tailwind classes for a genre chip — each genre gets a unique muted palette. */
export function genreChipColor(genre: string): string {
  const map: Record<string, string> = {
    "Pop":         "bg-pink-500/15 text-pink-300 border-pink-500/20",
    "R&B":         "bg-purple-500/15 text-purple-300 border-purple-500/20",
    "Country":     "bg-amber-500/15 text-amber-300 border-amber-500/20",
    "K-Pop":       "bg-rose-500/15 text-rose-300 border-rose-500/20",
    "Alt/Indie":   "bg-teal-500/15 text-teal-300 border-teal-500/20",
    "Disco/Dance": "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
    "Funk":        "bg-orange-500/15 text-orange-300 border-orange-500/20",
  };
  return map[genre] ?? "bg-foreground/10 text-foreground-secondary border-foreground/10";
}

/** Tailwind classes for the reason tag overlay on recommendation cards. */
export function reasonTagColor(reason: string): string {
  if (reason === "Unique genre") return "bg-purple-600/80 text-purple-100";
  if (reason === "Different era") return "bg-teal-600/80 text-teal-100";
  return "bg-black/70 text-white";
}
