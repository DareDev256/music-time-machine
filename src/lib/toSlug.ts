/**
 * URL-safe slug generator.
 *
 * Consolidates the inline `.toLowerCase().replace(/[^a-z0-9]+/g, "-")`
 * pattern previously duplicated in SongHeader, mockData, and spotify.ts.
 *
 * @example
 * toSlug("The Weeknd")      // "the-weeknd"
 * toSlug("Olivia Rodrigo")  // "olivia-rodrigo"
 */
export function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
