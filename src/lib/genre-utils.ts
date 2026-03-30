/**
 * Genre lookup utility.
 *
 * Centralises the songGenres lookup with a consistent "Unknown" fallback.
 * Shared by the pick engine, recommendation engine, and any component
 * that needs to resolve a song ID to its genre string.
 */

import { songGenres } from "@/lib/mockData";

/**
 * Look up a song's genre with a consistent fallback.
 * Returns "Unknown" for unmapped IDs so every call site stays in sync.
 */
export function genreOf(songId: string): string {
  return songGenres[songId] || "Unknown";
}
