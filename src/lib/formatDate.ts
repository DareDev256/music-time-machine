/**
 * Shared date formatting utility.
 *
 * Consolidates the inline `formatDate` helpers previously duplicated in
 * SongHeader, YouTubeCard, BillboardCard, and SongMilestones — each with
 * subtly different NaN handling. This version always guards against
 * unparseable strings and returns the raw input as a fallback.
 *
 * @example
 * formatDate("2024-01-15")                          // "January 15, 2024"
 * formatDate("2024-01-15", { month: "short" })      // "Jan 15, 2024"
 * formatDate("not-a-date")                          // "not-a-date"
 */

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

/**
 * Format an ISO date string into a human-readable locale string.
 *
 * Returns the raw `iso` value unchanged when the input is unparseable,
 * preventing `"Invalid Date"` from leaking into the UI.
 */
export function formatDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_OPTIONS
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", options);
}
