/**
 * @module pickNextSong
 * Intelligent auto-selection engine for the "Pick for Me" feature.
 *
 * Analyzes the user's recently viewed songs and selects the optimal next song
 * from the catalog by maximizing genre diversity and avoiding repeats.
 * When no history exists, picks a random high-quality entry point.
 */

import { mockSongs } from "@/lib/mockData";
import { genreOf } from "@/lib/genre-utils";
import { primaryArtist } from "@/lib/artist-utils";
import type { RecentSong } from "@/hooks/useRecentlyViewed";
import {
  PICK_BASE_SCORE,
  PICK_UNEXPLORED_GENRE_BONUS,
  PICK_GENRE_REPEAT_PENALTY,
  PICK_NEW_ARTIST_BONUS,
  PICK_POPULARITY_DIVISOR,
} from "@/lib/scoring-constants";

// Re-export so existing consumers don't break
export { genreOf } from "@/lib/genre-utils";

export interface PickResult {
  /** The song ID to navigate to. */
  id: string;
  /** Why this song was picked — displayed briefly in the UI. */
  reason: string;
  /** Genre of the picked song. */
  genre: string;
}

/* ------------------------------------------------------------------ */
/*  Internal types                                                     */
/* ------------------------------------------------------------------ */

interface ScoredCandidate {
  id: string;
  score: number;
  reason: string;
  genre: string;
}

/* ------------------------------------------------------------------ */
/*  Display-case artist name (artist-utils lowercases for matching)    */
/* ------------------------------------------------------------------ */

/** Regex that splits compound artist credits (feat., ft., &, commas, "with"). */
const FEAT_SPLIT = /\s*(feat\.|ft\.|&|,|with)\s*/i;

/**
 * Extract the lead artist preserving original casing for display purposes.
 * Uses the same split logic as the canonical `primaryArtist` from artist-utils,
 * but keeps the original case for user-facing reason strings.
 */
function displayArtist(raw: string): string {
  return raw.split(FEAT_SPLIT)[0].trim();
}

/* ------------------------------------------------------------------ */
/*  Scoring                                                            */
/* ------------------------------------------------------------------ */

/**
 * Score and classify a candidate song in a single pass.
 * Returns both the numeric score AND the human-readable reason,
 * eliminating the need to re-derive the reason after scoring.
 */
function scoreCandidate(
  songId: string,
  viewedIds: Set<string>,
  viewedGenres: Map<string, number>,
  viewedArtists: Set<string>,
): ScoredCandidate | null {
  if (viewedIds.has(songId)) return null;

  const song = mockSongs[songId];
  if (!song) return null;

  let score = PICK_BASE_SCORE;
  let reason = "Fresh pick for you";

  // Genre diversity: bonus for genres the user hasn't explored
  const genre = genreOf(songId);
  const genreCount = viewedGenres.get(genre) ?? 0;
  if (genreCount === 0) {
    score += PICK_UNEXPLORED_GENRE_BONUS;
    reason = `New genre: ${genre}`;
  } else {
    score -= genreCount * PICK_GENRE_REPEAT_PENALTY;
  }

  // Artist diversity: bonus for new artists
  const artist = primaryArtist(song.artist);
  if (!viewedArtists.has(artist)) {
    score += PICK_NEW_ARTIST_BONUS;
    // Only upgrade reason if genre wasn't already the headline
    if (genreCount > 0) {
      reason = `New artist: ${displayArtist(song.artist)}`;
    }
  }

  // Popularity signal: slight preference for higher-engagement songs
  const popularity = song.spotify?.popularity ?? 50;
  score += Math.round(popularity / PICK_POPULARITY_DIVISOR);

  return { id: songId, score, genre, reason };
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

  // Guard: empty catalog would cause undefined access downstream
  if (catalogIds.length === 0) {
    return { id: "", reason: "No songs available", genre: "Unknown" };
  }

  // No history: pick a random popular song as entry point
  if (recentSongs.length === 0) {
    const idx = Math.floor(Math.random() * catalogIds.length);
    const id = catalogIds[idx];
    return { id, reason: "Random discovery", genre: genreOf(id) };
  }

  // Build viewing profile
  const viewedIds = new Set(recentSongs.map((s) => s.id));
  const viewedGenres = new Map<string, number>();
  const viewedArtists = new Set<string>();

  for (const s of recentSongs) {
    const genre = genreOf(s.id);
    viewedGenres.set(genre, (viewedGenres.get(genre) ?? 0) + 1);
    viewedArtists.add(primaryArtist(s.artist));
  }

  // Score all candidates — scoring + reason derived in a single pass
  const scored = catalogIds
    .map((id) => scoreCandidate(id, viewedIds, viewedGenres, viewedArtists))
    .filter((c): c is ScoredCandidate => c !== null && c.score > 0)
    .sort((a, b) => b.score - a.score);

  // All songs viewed — pick least-recently-viewed
  if (scored.length === 0) {
    const sorted = [...recentSongs].sort((a, b) => a.viewedAt - b.viewedAt);
    const id = sorted[0].id;
    return { id, reason: "Revisit — it's been a while", genre: genreOf(id) };
  }

  // Top pick — add slight randomness among top 3 to keep it fresh
  const topN = scored.slice(0, Math.min(3, scored.length));
  const pick = topN[Math.floor(Math.random() * topN.length)];

  return { id: pick.id, reason: pick.reason, genre: pick.genre };
}
