/**
 * The covers a flight will pass, and when. Pure, no three.js, no DOM.
 *
 * Each #1 run on the path gets the moment it comes into view (the camera is `viewAhead` units
 * short of it) and the moment the camera passes it, from the flight's own easing curve. The
 * loader fetches down this list and skips any cover the camera would pass before it can arrive.
 */
import { ease } from "./easing";
import { runsBetween, type FlightData } from "./data";

export interface PlannedCover {
  song: number;
  at: number;
  until: number;
}

export interface FlightShape {
  /** start and end distance along the path (world units), and duration (s) */
  d0: number;
  d1: number;
  dur: number;
  /** world units per chart week */
  sp: number;
  targetIdx: number;
  /** weeks either side of the destination loaded first (the stretch seen slowly) */
  landingBehind: number;
  landingAhead: number;
  viewAhead: number;
}

/** progress p with ease(p) ≈ f (ease is monotonic). */
function inverseEase(f: number): number {
  if (f <= 0) return 0;
  if (f >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < f) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function flightPlan(data: FlightData, f: FlightShape, tLaunch: number): PlannedCover[] {
  const total = data.dates.length;
  const out: PlannedCover[] = [];
  const span = f.d1 - f.d0;
  const end = tLaunch + f.dur * 1000;
  const timeAt = (dist: number) => {
    if (!span) return tLaunch;
    const x = (dist - f.d0) / span;
    if (x <= 0) return tLaunch;
    if (x >= 1) return end;
    return tLaunch + inverseEase(x) * f.dur * 1000;
  };
  // the destination neighbourhood first: it is held on screen at the landing
  const [la, lb] = runsBetween(data, f.targetIdx - f.landingBehind, f.targetIdx + f.landingAhead);
  for (let r = la; r <= lb; r++) out.push({ song: data.song[data.runStart[r]], at: tLaunch, until: end + 6e4 });
  const fromWeek = Math.max(0, Math.floor(f.d0 / f.sp) - 2);
  const toWeek = Math.min(total - 1, f.targetIdx + f.landingAhead);
  const [ra, rb] = runsBetween(data, fromWeek, toWeek);
  for (let r = ra; r <= rb; r++) {
    const dist = ((data.runStart[r] + data.runEnd[r]) / 2) * f.sp;
    out.push({ song: data.song[data.runStart[r]], at: timeAt(dist - f.viewAhead), until: timeAt(dist) });
  }
  return out;
}

/** While a search resolves, the camera heads into the past at about `speed`: the covers just ahead. */
export function prerollPlan(data: FlightData, camD: number, speed: number, sp: number, viewAhead: number, t: number, weeks = 420): PlannedCover[] {
  const total = data.dates.length;
  const out: PlannedCover[] = [];
  const fromWeek = Math.max(0, Math.floor(camD / sp));
  const [ra, rb] = runsBetween(data, fromWeek, Math.min(total - 1, fromWeek + weeks));
  for (let r = ra; r <= rb; r++) {
    const dist = ((data.runStart[r] + data.runEnd[r]) / 2) * sp - camD;
    out.push({ song: data.song[data.runStart[r]], at: t + (Math.max(0, dist - viewAhead) / speed) * 1000, until: t + (Math.max(0, dist) / speed) * 1000 + 400 });
  }
  return out;
}
