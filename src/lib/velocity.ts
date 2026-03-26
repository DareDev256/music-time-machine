/**
 * @module velocity
 * Streaming velocity calculations for songs.
 *
 * Computes daily average streams/views by dividing lifetime totals by days
 * since release, then classifies the velocity into tiers. This surfaces a
 * genuinely useful metric — how fast a song accumulates plays — that no
 * single platform exposes on its own.
 */

import { SongData } from "@/types";
import { parseCount } from "./impactScore";

export type VelocityTier = "viral" | "hot" | "steady" | "catalogue";

export interface VelocityData {
  /** Average Spotify streams per day since release. */
  dailyStreams: number;
  /** Average YouTube views per day since release. */
  dailyViews: number;
  /** Days since the song was released. */
  daysSinceRelease: number;
  /** Billboard weeks on chart (direct passthrough). */
  weeksOnChart: number;
  /** Combined daily velocity (streams + views). */
  combinedDaily: number;
  /** Classified velocity tier. */
  tier: VelocityTier;
}

const TIER_THRESHOLDS = {
  viral: 2_000_000,   // 2M+ combined daily = viral phenomenon
  hot: 500_000,       // 500K+ = actively charting hit
  steady: 100_000,    // 100K+ = solid catalogue performer
} as const;

function classifyTier(combinedDaily: number): VelocityTier {
  if (combinedDaily >= TIER_THRESHOLDS.viral) return "viral";
  if (combinedDaily >= TIER_THRESHOLDS.hot) return "hot";
  if (combinedDaily >= TIER_THRESHOLDS.steady) return "steady";
  return "catalogue";
}

/** Calculate streaming velocity metrics for a song. */
export function calculateVelocity(song: SongData): VelocityData {
  const releaseMs = Date.parse(song.releaseDate);
  const daysSinceRelease = isNaN(releaseMs)
    ? 365 // fallback: assume 1 year if date is bad
    : Math.max(1, Math.floor((Date.now() - releaseMs) / 86_400_000));

  const totalStreams = song.spotify?.totalStreams
    ? parseCount(song.spotify.totalStreams)
    : 0;
  const totalViews = song.youtube?.viewCount
    ? parseCount(song.youtube.viewCount)
    : 0;

  const dailyStreams = Math.round(totalStreams / daysSinceRelease);
  const dailyViews = Math.round(totalViews / daysSinceRelease);
  const combinedDaily = dailyStreams + dailyViews;

  return {
    dailyStreams,
    dailyViews,
    daysSinceRelease,
    weeksOnChart: song.billboard?.weeksOnChart ?? 0,
    combinedDaily,
    tier: classifyTier(combinedDaily),
  };
}

export const TIER_META: Record<VelocityTier, { label: string; color: string; glow: string }> = {
  viral:     { label: "Viral",     color: "#FC3C44", glow: "rgba(252, 60, 68, 0.3)" },
  hot:       { label: "Hot",       color: "#FF9500", glow: "rgba(255, 149, 0, 0.3)" },
  steady:    { label: "Steady",    color: "#30D158", glow: "rgba(48, 209, 88, 0.25)" },
  catalogue: { label: "Catalogue", color: "#86868B", glow: "rgba(134, 134, 139, 0.15)" },
};
