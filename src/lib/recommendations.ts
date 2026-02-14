import { SongData } from "@/types";

interface ScoredSong {
  song: SongData;
  score: number;
  reason: string;
}

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
    /\s*(?:,\s*|\s+(?:ft\.?|feat\.?|with)\s+)\s*/i
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

/**
 * Find similar songs based on audio feature proximity, artist match, and era.
 * Uses weighted Euclidean distance in the (danceability, energy, valence, normalizedTempo) space.
 * Enforces artist diversity: at most one song per artist in results.
 */
export function getSimilarSongs(
  target: SongData,
  catalog: SongData[],
  limit: number = 4
): { song: SongData; reason: string; matchScore: number }[] {
  const targetFeatures = target.spotify?.audioFeatures;
  if (!targetFeatures) return [];

  const targetYear = new Date(target.releaseDate).getFullYear();
  const normalizedTargetTempo = targetFeatures.tempo / 200; // BPM → 0-1 range
  const targetArtists = new Set(splitArtists(target.artist));

  const scored: ScoredSong[] = [];

  for (const candidate of catalog) {
    if (candidate.id === target.id) continue;

    const features = candidate.spotify?.audioFeatures;
    if (!features) continue;

    const normalizedTempo = features.tempo / 200;

    // Weighted Euclidean distance (energy and valence matter most for "vibe")
    const distance = Math.sqrt(
      1.0 * (features.danceability - targetFeatures.danceability) ** 2 +
      1.5 * (features.energy - targetFeatures.energy) ** 2 +
      1.5 * (features.valence - targetFeatures.valence) ** 2 +
      0.8 * (normalizedTempo - normalizedTargetTempo) ** 2
    );

    // Convert distance to a 0-100 similarity score (lower distance = higher score)
    let score = Math.max(0, 100 - distance * 150);

    // Bonus: shared artist credit (any overlap between target and candidate artists)
    const candidateArtists = splitArtists(candidate.artist);
    const sameArtist = candidateArtists.some((a) => targetArtists.has(a));
    if (sameArtist) score += 15;

    // Bonus: same era (within 2 years)
    const candidateYear = new Date(candidate.releaseDate).getFullYear();
    if (Math.abs(candidateYear - targetYear) <= 2) score += 8;

    // Determine the primary reason for the recommendation
    const reason = sameArtist
      ? "Same artist"
      : distance < 0.15
        ? "Nearly identical vibe"
        : features.energy > 0.7 && targetFeatures.energy > 0.7
          ? "High energy match"
          : Math.abs(features.valence - targetFeatures.valence) < 0.1
            ? "Similar mood"
            : Math.abs(candidateYear - targetYear) <= 1
              ? "Same era"
              : "Similar sound";

    scored.push({ song: candidate, score, reason });
  }

  // Diversity-aware selection: skip songs whose *any* credited artist was already picked.
  // This prevents "Lady Gaga & Bruno Mars" and "ROSÉ & Bruno Mars" from both appearing.
  scored.sort((a, b) => b.score - a.score);
  const picked: { song: SongData; reason: string; matchScore: number }[] = [];
  const seenArtists = new Set<string>();

  for (const entry of scored) {
    if (picked.length >= limit) break;
    const artists = splitArtists(entry.song.artist);
    if (artists.some((a) => seenArtists.has(a))) continue;
    for (const a of artists) seenArtists.add(a);
    // Clamp score to 0–99 range (100% would imply identical song)
    const matchScore = Math.min(99, Math.max(0, Math.round(entry.score)));
    picked.push({ song: entry.song, reason: entry.reason, matchScore });
  }

  return picked;
}
