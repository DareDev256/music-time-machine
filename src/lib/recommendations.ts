import { SongData } from "@/types";

interface ScoredSong {
  song: SongData;
  score: number;
  reason: string;
}

/**
 * Find similar songs based on audio feature proximity, artist match, and era.
 * Uses weighted Euclidean distance in the (danceability, energy, valence, normalizedTempo) space.
 */
export function getSimilarSongs(
  target: SongData,
  catalog: SongData[],
  limit: number = 4
): { song: SongData; reason: string }[] {
  const targetFeatures = target.spotify?.audioFeatures;
  if (!targetFeatures) return [];

  const targetYear = new Date(target.releaseDate).getFullYear();
  const normalizedTargetTempo = targetFeatures.tempo / 200; // BPM → 0-1 range

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

    // Bonus: same artist or featuring artist
    const sameArtist =
      candidate.artist.toLowerCase().includes(target.artist.toLowerCase().split(" ")[0]) ||
      target.artist.toLowerCase().includes(candidate.artist.toLowerCase().split(" ")[0]);
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

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ song, reason }) => ({ song, reason }));
}
