/**
 * Artist credit parsing utilities.
 *
 * Splits collaboration credit strings ("ft.", "feat.", "&", ",", "with")
 * into individual artist names. Used by the recommendation engine for
 * artist-diversity filtering and available for any component that needs
 * to parse multi-artist credits.
 */

/**
 * Split a credit string into individual artist names.
 * Handles: "ft." / "feat." / "&" / "," / "with" separators.
 * Short tokens around "&" (e.g. "R&B") are kept intact — only splits
 * when both sides have 2+ characters.
 */
export function splitArtists(artist: string): string[] {
  if (typeof artist !== "string") return [];

  const parts = artist.split(
    /\s*(?:,\s*|\s+(?:ft\.?|feat\.?|with)\s+)\s*/i,
  );
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

/** Extract the primary (first-billed) artist name, normalised to lowercase. */
export function primaryArtist(artist: string): string {
  if (typeof artist !== "string") return "";
  return splitArtists(artist)[0] ?? artist.trim().toLowerCase();
}
