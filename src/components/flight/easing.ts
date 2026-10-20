/**
 * Flight timing. Pure functions, no three.js, no DOM.
 *
 * The curve is the spike's: fast out, long glide in. Most of the distance is
 * covered early and the landing is slow, so the destination week is readable.
 */

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

/** Seconds a flight takes for a distance in years: clamp(1.8 + years * 0.17, 2.6, 7). */
export function flightDuration(years: number): number {
  const y = Number.isFinite(years) ? Math.abs(years) : 0;
  return Math.min(7, Math.max(2.6, 1.8 + y * 0.17));
}

/** 0..1 → 0..1. A quintic in-out (35%) blended with a quartic out (65%). */
export function ease(x: number): number {
  const t = clamp01(x);
  const inOut = t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
  const out = 1 - (1 - t) ** 4;
  return inOut * 0.35 + out * 0.65;
}

/** Analytic derivative of ease (units of "progress per progress"). */
export function easeVelocity(x: number): number {
  const t = clamp01(x);
  const inOut = t < 0.5 ? 80 * t ** 4 : 5 * (-2 * t + 2) ** 4;
  const out = 4 * (1 - t) ** 3;
  return inOut * 0.35 + out * 0.65;
}

/** Speed (world units per second) at which warp saturates. */
export const WARP_SATURATION = 420;

/**
 * Warp amount 0..1 at progress x for a flight of `lengthUnits` world units
 * over `durS` seconds: the curve's own velocity divided by 420 units/s.
 * Same forward difference as the spike, so x = 1 reads as 0 (landed, still).
 */
export function warp(x: number, lengthUnits: number, durS: number): number {
  if (!(durS > 0) || !(lengthUnits !== 0)) return 0;
  const p = clamp01(x);
  const p2 = Math.min(1, p + 0.004);
  if (p2 <= p) return 0;
  const v = ((ease(p2) - ease(p)) / (p2 - p)) * Math.abs(lengthUnits) / durS;
  return Math.min(1, Math.max(0, v / WARP_SATURATION));
}

/** Years between two ISO dates (absolute), 365.25-day years. */
export function yearsBetween(a: string, b: string): number {
  const ms = Math.abs(Date.parse(a) - Date.parse(b));
  return Number.isFinite(ms) ? ms / (365.25 * 86_400_000) : 0;
}
