/**
 * URL-safe slug generator.
 *
 * Consolidates the inline `.toLowerCase().replace(/[^a-z0-9]+/g, "-")`
 * pattern previously duplicated in SongHeader, mockData, and spotify.ts.
 *
 * Strips leading/trailing hyphens that would otherwise appear when the
 * input starts or ends with non-alphanumeric characters (e.g. `" Hello "` →
 * `"-hello-"` in the old version). Also normalizes unicode diacritics so
 * accented artist names produce clean ASCII slugs (`"Beyoncé"` → `"beyonce"`).
 *
 * @example
 * toSlug("The Weeknd")      // "the-weeknd"
 * toSlug("Olivia Rodrigo")  // "olivia-rodrigo"
 * toSlug("Beyoncé")         // "beyonce"
 * toSlug("  !!!Rock!!!  ")  // "rock"
 */
export function toSlug(name: string): string {
  return name
    .normalize("NFD")                    // decompose diacritics (é → e + combining accent)
    .replace(/[\u0300-\u036f]/g, "")     // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")        // collapse non-alnum runs to single hyphen
    .replace(/^-+|-+$/g, "");            // trim leading/trailing hyphens
}
