import { SongData, ComparisonInsight } from "@/types";

/** Parse human-readable metric strings like "1.5B", "320M", "45K" into raw numbers. */
export function parseMetric(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  if (value.endsWith("B")) return num * 1_000_000_000;
  if (value.endsWith("M")) return num * 1_000_000;
  if (value.endsWith("K")) return num * 1_000;
  return num;
}

interface MetricDef {
  metric: string;
  platform: keyof SongData;
  getValue: (song: SongData) => string;
  /** Raw numeric value for comparison. Higher wins unless `lowerWins` is set. */
  getNumeric: (song: SongData) => number;
  lowerWins?: boolean;
}

/**
 * Data-driven metric definitions for head-to-head song comparison.
 * Each entry maps a human-readable metric label to the platform data accessor,
 * a display formatter, and a numeric extractor for winner determination.
 * `lowerWins` inverts the comparison for rank-style metrics (Billboard position).
 */
export const COMPARISON_METRICS: MetricDef[] = [
  { metric: "Spotify Streams", platform: "spotify", getValue: (s) => s.spotify!.totalStreams, getNumeric: (s) => parseMetric(s.spotify!.totalStreams) },
  { metric: "Popularity Score", platform: "spotify", getValue: (s) => `${s.spotify!.popularity}/100`, getNumeric: (s) => s.spotify!.popularity },
  { metric: "YouTube Views", platform: "youtube", getValue: (s) => s.youtube!.viewCount, getNumeric: (s) => parseMetric(s.youtube!.viewCount) },
  { metric: "Billboard Peak", platform: "billboard", getValue: (s) => `#${s.billboard!.peakPosition}`, getNumeric: (s) => s.billboard!.peakPosition, lowerWins: true },
  { metric: "Weeks on Chart", platform: "billboard", getValue: (s) => `${s.billboard!.weeksOnChart}`, getNumeric: (s) => s.billboard!.weeksOnChart },
  { metric: "Genius Page Views", platform: "genius", getValue: (s) => s.genius!.pageViews, getNumeric: (s) => parseMetric(s.genius!.pageViews) },
];

/**
 * Build head-to-head comparison insights between two songs.
 * Skips metrics where either song lacks the required platform data,
 * so partial-data songs degrade gracefully instead of crashing.
 */
export function buildInsights(song1: SongData, song2: SongData): ComparisonInsight[] {
  return COMPARISON_METRICS.flatMap(({ metric, platform, getValue, getNumeric, lowerWins }) => {
    if (!song1[platform] || !song2[platform]) return [];
    const n1 = getNumeric(song1);
    const n2 = getNumeric(song2);
    const winner = n1 === n2 ? "tie" as const : lowerWins ? (n1 < n2 ? "song1" : "song2") : (n1 > n2 ? "song1" : "song2");
    return [{ metric, song1Value: getValue(song1), song2Value: getValue(song2), winner } as ComparisonInsight];
  });
}
