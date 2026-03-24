/**
 * @module impactScore
 * Cross-platform composite impact scoring for songs.
 *
 * Synthesizes Spotify, YouTube, Billboard, and Genius metrics into a single
 * 0–100 score with tier classification. Weights reflect cultural impact:
 * Billboard (30) = chart longevity, Spotify (30) = streaming dominance,
 * YouTube (25) = visual reach, Genius (15) = lyrical engagement.
 */

import { SongData } from "@/types";

/** Parse abbreviated count strings ("4.2B", "18M", "892K") to raw numbers. */
export function parseCount(formatted: string): number {
  if (!formatted) return 0;
  const clean = formatted.replace(/,/g, "").trim();
  const match = clean.match(/^([\d.]+)\s*([BMKT]?)$/i);
  if (!match) return parseInt(clean, 10) || 0;
  const num = parseFloat(match[1]);
  switch (match[2].toUpperCase()) {
    case "B": return num * 1_000_000_000;
    case "M": return num * 1_000_000;
    case "K": return num * 1_000;
    default: return num;
  }
}

export interface ScoreBreakdown {
  total: number;
  spotify: number;
  youtube: number;
  billboard: number;
  genius: number;
  tier: string;
  tierColor: string;
}

const TIERS = [
  { min: 90, label: "Legendary", color: "#FFD700" },
  { min: 75, label: "Iconic", color: "#FC3C44" },
  { min: 60, label: "Hit Maker", color: "#FF6B35" },
  { min: 45, label: "Rising Star", color: "#38BDF8" },
  { min: 30, label: "Cult Classic", color: "#A78BFA" },
  { min: 0, label: "Hidden Gem", color: "#86868B" },
] as const;

export function calculateImpactScore(song: SongData): ScoreBreakdown {
  let spotify = 0;
  if (song.spotify) {
    const streams = parseCount(song.spotify.totalStreams);
    spotify += Math.min(15, (streams / 3_000_000_000) * 15);
    spotify += Math.min(10, (song.spotify.popularity / 100) * 10);
    spotify += Math.min(5, (song.spotify.playlistCount / 80_000) * 5);
  }

  let youtube = 0;
  if (song.youtube) {
    const views = parseCount(song.youtube.viewCount);
    const likes = parseCount(song.youtube.likeCount);
    youtube += Math.min(15, (views / 2_000_000_000) * 15);
    youtube += Math.min(5, (likes / 15_000_000) * 5);
    const engagement = views > 0 ? (likes / views) * 100 : 0;
    youtube += Math.min(5, (engagement / 1.5) * 5);
  }

  let billboard = 0;
  if (song.billboard) {
    billboard += Math.min(15, Math.max(0, 15 - (song.billboard.peakPosition - 1) * 0.5));
    billboard += Math.min(15, (song.billboard.weeksOnChart / 80) * 15);
  }

  let genius = 0;
  if (song.genius) {
    const pageViews = parseCount(song.genius.pageViews);
    genius += Math.min(10, (pageViews / 10_000_000) * 10);
    genius += Math.min(5, (song.genius.annotationCount / 40) * 5);
  }

  const total = Math.round(Math.min(100, spotify + youtube + billboard + genius));
  const tier = TIERS.find((t) => total >= t.min) ?? TIERS[TIERS.length - 1];

  return {
    total,
    spotify: Math.round(spotify),
    youtube: Math.round(youtube),
    billboard: Math.round(billboard),
    genius: Math.round(genius),
    tier: tier.label,
    tierColor: tier.color,
  };
}
