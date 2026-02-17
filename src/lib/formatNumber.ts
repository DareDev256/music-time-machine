/**
 * Compact number formatting utility.
 *
 * Shared across all API clients (Spotify, YouTube, Genius) to ensure
 * consistent B/M/K abbreviation thresholds and precision throughout the UI.
 *
 * @example
 * formatCompact(2_400_000_000) // "2.4B"
 * formatCompact(770_000)       // "770.0K"
 * formatCompact("1234567")     // "1.2M"
 * formatCompact(undefined)     // "N/A"
 */

const FALLBACK = "N/A";

/**
 * Format a numeric value into a compact human-readable string.
 *
 * Accepts `number`, numeric `string`, `undefined`, or `null`.
 * Non-numeric / falsy inputs return `"N/A"`.
 *
 * Thresholds: ≥1B → "X.XB", ≥1M → "X.XM", ≥1K → "X.XK", else raw string.
 */
export function formatCompact(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "") return FALLBACK;

  const num = typeof value === "string" ? parseInt(value, 10) : value;
  if (isNaN(num)) return typeof value === "string" ? value : FALLBACK;

  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
}
