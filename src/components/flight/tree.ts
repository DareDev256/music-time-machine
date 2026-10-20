/**
 * The shape of the timeline tree. Pure math, no three.js, no DOM; the GLSL
 * the thread shader runs is generated from the same constants so the GPU and
 * the JS (camera, covers, rings, canopy) agree on where every strand is.
 *
 * Axes: time runs along world Y. Path week i (0 = newest chart week) sits at
 * y = -i * SP, so the present is at the top and the past goes down.
 *
 * TRUNK: the Hot 100 #1 line, a braid of BRAID_STRANDS thin red strands
 * twisted round one gently meandering spine, about one twist per year.
 * LANES: each genre chart is a looser group of strands running beside the
 * trunk on a slow helix; flying back in time a lane folds into the trunk at
 * the week its chart began. OFFSHOOTS: faint filaments, 2010–2014 only.
 */
import { targetIndex, type FlightData } from "./data";

/** World units per chart week. */
export const SP = 1.15;
export const BRAID_R = 0.5;
export const BRAID_STRANDS = 48;
const TWIST_PERIOD = 16 * SP; // a twist every ~4 months, so the braid reads as a braid in the ~17 weeks on screen
const LANE_STRANDS = 4;

// spine meander in x/z: a0 sin(y a1 + a2) + a3 sin(y a4 + a5)
const SX = [0.32, 0.019, 0.4, 0.16, 0.0071, 1.7] as const;
const SZ = [0.28, 0.015, 2.1, 0.14, 0.0053, 0.3] as const;

export function spineX(y: number): number {
  return SX[0] * Math.sin(y * SX[1] + SX[2]) + SX[3] * Math.sin(y * SX[4] + SX[5]);
}
export function spineZ(y: number): number {
  return SZ[0] * Math.sin(y * SZ[1] + SZ[2]) + SZ[3] * Math.sin(y * SZ[4] + SZ[5]);
}

export interface LaneSpec {
  lane: string;
  /** Short display name, used whenever the page's label is too long to sit beside a branch. */
  name: string;
  /** First chart week of the lane (public/era/lanes/index.json `from`). */
  from: string;
  radius: number;
  phase: number;
  /** World units per full turn round the trunk; the sign is the handedness. */
  period: number;
}

/** Lane start dates from public/era/lanes/index.json (built 2026-10-20). */
export const LANES: readonly LaneSpec[] = [
  { lane: "rnb_hiphop", name: "R&B / Hip-Hop", from: "1958-01-06", radius: 1.35, phase: 0.3, period: 420 },
  { lane: "country", name: "Country", from: "1958-01-06", radius: 2.2, phase: 2.5, period: -520 },
  { lane: "uk", name: "UK", from: "1952-11-14", radius: 1.75, phase: 4.2, period: 470 },
  { lane: "dance", name: "Dance", from: "1976-01-03", radius: 2.5, phase: 1.3, period: -380 },
  { lane: "latin", name: "Latin", from: "1986-09-06", radius: 1.95, phase: 5.4, period: 440 },
  { lane: "rock_alt", name: "Rock / Alt", from: "1988-09-10", radius: 1.2, phase: 3.4, period: -360 },
  { lane: "rap", name: "Rap", from: "1989-03-11", radius: 1.6, phase: 0.95, period: 400 },
  { lane: "canada", name: "Canada", from: "2007-03-31", radius: 2.35, phase: 3.95, period: -460 },
];

const OFFSHOOTS = [
  { radius: 3.0, phase: 1.9, period: 160, from: "2010-01-02", until: "2014-12-27" },
  { radius: 2.8, phase: 4.8, period: -210, from: "2010-06-05", until: "2014-06-28" },
  { radius: 3.3, phase: 5.9, period: -140, from: "2011-03-05", until: "2013-11-30" },
  { radius: 2.9, phase: 0.6, period: 190, from: "2012-01-07", until: "2014-12-27" },
] as const;

export type ThreadKind = "trunk" | "lane" | "offshoot";

/** One strand. Its centre winds round the spine (lane offset), and it winds round that centre. */
export interface Thread {
  kind: ThreadKind;
  /** lane id for lane strands, null otherwise */
  lane: string | null;
  /** colour slot: 0 trunk, 1..LANES.length lanes, LANES.length + 1 offshoots */
  color: number;
  laneR: number;
  lanePhase: number;
  /** radians per world unit */
  lanePitch: number;
  strandR: number;
  strandPhase: number;
  strandPitch: number;
  /** y where it folds into the trunk going back (−Infinity: always there) */
  yOld: number;
  /** y where it folds in going forward (+Infinity: runs to the present) */
  yNew: number;
  merge: number;
  alpha: number;
  /** minimum on-screen half-width in px (glow included) */
  minPx: number;
}

export const NO_OLD = -1e9;
export const NO_NEW = 1e9;
const MERGE = 46; // ≈ 40 weeks

function yOfDate(data: FlightData, date: string): number {
  if (date < data.dates[data.dates.length - 1]) return NO_OLD; // before the first chart week
  return -targetIndex(data, date) * SP;
}

/** Deterministic hash in 0..1 so the braid is the same every load. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function buildThreads(data: FlightData): Thread[] {
  const out: Thread[] = [];
  const twist = (Math.PI * 2) / TWIST_PERIOD;
  for (let k = 0; k < BRAID_STRANDS; k++) {
    // a filled braid: most strands near the surface, some through the core
    const r = BRAID_R * (0.25 + 0.75 * Math.sqrt(hash(k)));
    out.push({
      kind: "trunk",
      lane: null,
      color: 0,
      laneR: 0,
      lanePhase: 0,
      lanePitch: 0,
      strandR: r,
      strandPhase: (k / BRAID_STRANDS) * Math.PI * 2,
      strandPitch: twist * (0.85 + 0.3 * hash(k + 91)),
      yOld: NO_OLD,
      yNew: NO_NEW,
      merge: MERGE,
      alpha: 0.13 + 0.2 * hash(k + 7),
      minPx: 1.5 + hash(k + 3),
    });
  }
  LANES.forEach((l, li) => {
    for (let k = 0; k < LANE_STRANDS; k++) {
      out.push({
        kind: "lane",
        lane: l.lane,
        color: li + 1,
        laneR: l.radius,
        lanePhase: l.phase,
        lanePitch: (Math.PI * 2) / l.period,
        strandR: 0.12 + 0.08 * hash(li * 13 + k),
        strandPhase: (k / LANE_STRANDS) * Math.PI * 2 + li,
        strandPitch: (twist * 1.6 * (k % 2 ? -1 : 1)) * (0.8 + 0.4 * hash(li + k * 5)),
        yOld: yOfDate(data, l.from),
        yNew: NO_NEW,
        merge: MERGE,
        alpha: 0.32,
        minPx: 1.6,
      });
    }
  });
  OFFSHOOTS.forEach((o, i) => {
    out.push({
      kind: "offshoot",
      lane: null,
      color: LANES.length + 1,
      laneR: o.radius,
      lanePhase: o.phase,
      lanePitch: (Math.PI * 2) / o.period,
      strandR: 0.05,
      strandPhase: i,
      strandPitch: twist,
      yOld: yOfDate(data, o.from),
      yNew: yOfDate(data, o.until),
      merge: 30,
      alpha: 0.14,
      minPx: 1.3,
    });
  });
  return out;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** 0..1: how far a strand has peeled away from the trunk at y (0 = merged / absent). */
export function presence(t: Thread, y: number): number {
  const grow = t.yOld <= NO_OLD ? 1 : smooth(t.yOld, t.yOld + t.merge, y);
  const shrink = t.yNew >= NO_NEW ? 1 : 1 - smooth(t.yNew - t.merge, t.yNew, y);
  return grow * shrink;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Centre of a strand's group at y (the lane's limb, or the spine for the trunk). */
export function groupAt(t: Thread, y: number, laneScale: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const r = t.laneR * laneScale * presence(t, y);
  const a = t.lanePhase + y * t.lanePitch;
  out.x = spineX(y) + Math.cos(a) * r;
  out.y = y;
  out.z = spineZ(y) + Math.sin(a) * r;
  return out;
}

/** World position of one strand at y. `braidScale` narrows the trunk braid (phones). */
export function threadAt(t: Thread, y: number, laneScale: number, out: Vec3 = { x: 0, y: 0, z: 0 }, braidScale = 1): Vec3 {
  groupAt(t, y, laneScale, out);
  const pres = t.kind === "trunk" ? 1 : presence(t, y);
  const b = t.strandPhase + y * t.strandPitch;
  const r = t.strandR * (0.3 + 0.7 * pres) * (t.kind === "trunk" ? braidScale : 1);
  out.x += Math.cos(b) * r;
  out.z += Math.sin(b) * r;
  return out;
}

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));

/**
 * GLSL for the same curves. Per-strand parameters ride on vertex attributes:
 * aA = (laneR, lanePhase, lanePitch, strandR), aB = (strandPhase, strandPitch, alpha, minPx),
 * aC = (yOld, yNew, merge, colour slot), aK = kind (0 trunk, 1 lane, 2 offshoot).
 */
export const GLSL_TREE = /* glsl */ `
vec2 spineXZ(float y) {
  return vec2(
    ${f(SX[0])} * sin(y * ${f(SX[1])} + ${f(SX[2])}) + ${f(SX[3])} * sin(y * ${f(SX[4])} + ${f(SX[5])}),
    ${f(SZ[0])} * sin(y * ${f(SZ[1])} + ${f(SZ[2])}) + ${f(SZ[3])} * sin(y * ${f(SZ[4])} + ${f(SZ[5])})
  );
}
float presenceAt(vec4 c, float y) {
  float grow = c.x < -1e8 ? 1.0 : smoothstep(c.x, c.x + c.z, y);
  float shrink = c.y > 1e8 ? 1.0 : 1.0 - smoothstep(c.y - c.z, c.y, y);
  return grow * shrink;
}
vec3 strandPos(vec4 a, vec4 b, vec4 c, float kind, float y, float laneScale, float braidScale, out float pres) {
  pres = presenceAt(c, y);
  float lr = a.x * laneScale * pres;
  float la = a.y + y * a.z;
  vec2 g = spineXZ(y) + vec2(cos(la), sin(la)) * lr;
  float sp = kind < 0.5 ? 1.0 : pres;
  float sb = b.x + y * b.y;
  g += vec2(cos(sb), sin(sb)) * a.w * (0.3 + 0.7 * sp) * (kind < 0.5 ? braidScale : 1.0);
  return vec3(g.x, y, g.y);
}
`;
