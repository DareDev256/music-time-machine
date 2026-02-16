import { SongData } from "@/types";
import { songGenres } from "@/lib/mockData";

interface ScoredSong {
  song: SongData;
  score: number;
  reason: string;
}

/** Diversity analysis of a recommendation set */
export interface DiversityMeta {
  /** Overall diversity score (0–100). Higher = more diverse picks. */
  score: number;
  /** Human-readable label for the diversity level. */
  label: string;
  /** Distinct genres present across the recommendations. */
  genres: string[];
  /** Decade spread — unique decades represented. @example ["2010s", "2020s"] */
  eras: string[];
}

/**
 * Analyze the genre and era diversity of a recommendation set.
 * Score formula:
 *   - Base: (unique genres / total picks) × 60  (genre variety is the primary signal)
 *   - Bonus: (unique eras / total picks) × 40   (era spread adds depth)
 * A set of 4 songs spanning 4 genres and 2 decades scores 100.
 */
export function getDiversityMeta(
  target: SongData,
  picks: { song: SongData }[]
): DiversityMeta {
  if (picks.length === 0) return { score: 0, label: "No data", genres: [], eras: [] };

  const genres = new Set<string>();
  const eras = new Set<string>();

  // Include target song in era calculation for context
  const targetDecade = `${Math.floor(new Date(target.releaseDate).getFullYear() / 10) * 10}s`;
  eras.add(targetDecade);

  for (const { song } of picks) {
    const genre = songGenres[song.id];
    if (genre) genres.add(genre);

    const year = new Date(song.releaseDate).getFullYear();
    eras.add(`${Math.floor(year / 10) * 10}s`);
  }

  const count = picks.length;
  const genreRatio = genres.size / count;
  const eraRatio = (eras.size - 1) / Math.max(1, count); // subtract 1 for target's era (baseline)

  const score = Math.min(100, Math.round(genreRatio * 60 + eraRatio * 40));

  const label =
    score >= 75 ? "Wide mix" :
    score >= 45 ? "Good variety" :
    score >= 20 ? "Similar vibe" :
    "Narrow focus";

  return {
    score,
    label,
    genres: [...genres].sort(),
    eras: [...eras].sort(),
  };
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
  // Pre-seed with target artists so recommendations surface *new* artists, not more of the same.
  scored.sort((a, b) => b.score - a.score);
  const picked: { song: SongData; reason: string; matchScore: number }[] = [];
  const seenArtists = new Set<string>(targetArtists);

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
