/**
 * Synthetic timeline data generator.
 *
 * Previously duplicated in both mockData.ts and dataFetcher.ts — a bugfix
 * (e0bdbf1) only patched one copy, proving the duplication was a maintenance
 * hazard. Now lives in a single module imported by both consumers.
 */

import { TimelineDataPoint } from "@/types";

/**
 * Generate simulated monthly performance data for a song.
 *
 * Produces up to 48 months of synthetic Spotify/YouTube growth curves
 * and Billboard chart positions from `releaseDate` to the present.
 *
 * @param releaseDate  ISO date string for the song's release
 * @param peakMonth    Month index at which the song hits peak popularity (default 3)
 * @returns            Array of monthly data points (empty if date is unparseable)
 */
export function generateTimeline(
  releaseDate: string,
  peakMonth: number = 3
): TimelineDataPoint[] {
  const timeline: TimelineDataPoint[] = [];
  const start = new Date(releaseDate);

  // Guard: reject Invalid Date from unparseable strings.
  if (Number.isNaN(start.getTime())) return timeline;

  const now = new Date();
  const currentDate = new Date(start);
  let month = 0;

  while (currentDate <= now && month < 48) {
    const spotifyGrowth = Math.min(
      100,
      Math.floor(20 + 80 * (1 - Math.exp(-month / peakMonth)) + Math.random() * 10 - month * 0.5)
    );
    const youtubeGrowth = Math.min(
      100,
      Math.floor(15 + 85 * (1 - Math.exp(-month / (peakMonth + 1))) + Math.random() * 8 - month * 0.3)
    );

    let billboardPos = null;
    if (month >= 1 && month <= 20) {
      const peak = 100 - 90 * Math.exp(-Math.pow(month - peakMonth, 2) / 10);
      billboardPos = Math.max(1, Math.floor(peak + Math.random() * 10));
    }

    timeline.push({
      date: currentDate.toISOString().split("T")[0],
      spotify: Math.max(0, spotifyGrowth),
      youtube: Math.max(0, youtubeGrowth),
      billboard: billboardPos ? 101 - billboardPos : undefined,
    });

    currentDate.setMonth(currentDate.getMonth() + 1);
    month++;
  }

  return timeline;
}
