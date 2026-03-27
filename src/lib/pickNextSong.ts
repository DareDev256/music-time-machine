/**
 * @module pickNextSong
 * Intelligent auto-selection engine for the "Pick for Me" feature.
 *
 * Analyzes the user's recently viewed songs and selects the optimal next song
 * from the catalog by maximizing genre diversity and avoiding repeats.
 * When no history exists, picks a random high-quality entry point.
 */

import { mockSongs, songGenres } from "@/lib/mockData";
import type { RecentSong } from "@/hooks/useRecentlyViewed";

export interface PickResult {
  /** The song ID to navigate to. */
  id: string;
  /** Why this song was picked — displayed briefly in the UI. */
  reason: string;
  /** Genre of the picked song. */
  genre: string;
}

/**
 * Score each candidate song based on how different it is from viewing history.
 * Higher = more novel = better pick.
 */
function noveltyScore(
  songId: string,
  viewedIds: Set<string>,
  viewedGenres: Map<string, number>,
  viewedArtists: Set<string>,
): number {
  if (viewedIds.has(songId)) return -1; // Hard exclude

  const song = mockSongs[songId];
  if (!song) return -1;

  let score = 50; // Base score

  // Genre diversity: bonus for genres the user hasn't explored
  const genre = songGenres[songId] || "Unknown";
  const genreCount = viewedGenres.get(genre) ?? 0;
  if (genreCount === 0) {
    score += 30; // Unexplored genre — strong bonus
  } else {
    score -= genreCount * 8; // Penalize over-represented genres
  }

  // Artist diversity: bonus for new artists
  const artist = song.artist.split(/\s*(feat\.|ft\.|&|,|with)\s*/i)[0].trim();
  if (!viewedArtists.has(artist.toLowerCase())) {
    score += 15;
  }

  // Popularity signal: slight preference for higher-engagement songs
  const popularity = song.spotify?.popularity ?? 50;
  score += Math.round(popularity / 10);

  return score;
}

/**
 * Pick the next song to explore. Pure function — no side effects.
 *
 * Strategy:
 * 1. If no history → random pick from catalog (weighted by popularity)
 * 2. If history exists → maximize novelty (new genre > new artist > popular)
 * 3. If entire catalog viewed → pick the least-recently-viewed song
 */
export function pickNextSong(recentSongs: RecentSong[]): PickResult {
  const catalogIds = Object.keys(mockSongs);

  // No history: pick a random popular song as entry point
  if (recentSongs.length === 0) {
    const idx = Math.floor(Math.random() * catalogIds.length);
    const id = catalogIds[idx];
    return {
      id,
      reason: "Random discovery",
      genre: songGenres[id] || "Unknown",
    };
  }

  // Build viewing profile
  const viewedIds = new Set(recentSongs.map((s) => s.id));
  const viewedGenres = new Map<string, number>();
  const viewedArtists = new Set<string>();

  for (const s of recentSongs) {
    const genre = songGenres[s.id] || "Unknown";
    viewedGenres.set(genre, (viewedGenres.get(genre) ?? 0) + 1);
    viewedArtists.add(s.artist.split(/\s*(feat\.|ft\.|&|,|with)\s*/i)[0].trim().toLowerCase());
  }

  // Score all candidates
  const scored = catalogIds
    .map((id) => ({
      id,
      score: noveltyScore(id, viewedIds, viewedGenres, viewedArtists),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  // All songs viewed — pick least-recently-viewed
  if (scored.length === 0) {
    const sorted = [...recentSongs].sort((a, b) => a.viewedAt - b.viewedAt);
    const id = sorted[0].id;
    return {
      id,
      reason: "Revisit — it's been a while",
      genre: songGenres[id] || "Unknown",
    };
  }

  // Top pick — add slight randomness among top 3 to keep it fresh
  const topN = scored.slice(0, Math.min(3, scored.length));
  const pick = topN[Math.floor(Math.random() * topN.length)];
  const genre = songGenres[pick.id] || "Unknown";

  // Classify the reason
  const genreCount = viewedGenres.get(genre) ?? 0;
  let reason: string;
  if (genreCount === 0) {
    reason = `New genre: ${genre}`;
  } else {
    const song = mockSongs[pick.id];
    const artist = song?.artist.split(/\s*(feat\.|ft\.|&|,|with)\s*/i)[0].trim() ?? "";
    if (!viewedArtists.has(artist.toLowerCase())) {
      reason = `New artist: ${artist}`;
    } else {
      reason = "Fresh pick for you";
    }
  }

  return { id: pick.id, reason, genre };
}
