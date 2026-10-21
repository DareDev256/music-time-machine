/**
 * The shape of the timeline tree. Pure math, no three.js, no DOM; the GLSL
 * the strand shader runs is generated from the same constants so the GPU and
 * the JS (camera, covers, rings, landing) agree on where every strand is.
 *
 * Axes: time runs along -z. Path week i (0 = newest chart week) sits at
 * z = -i * SP; the camera flies toward -z, into the past, inside the tree.
 *
 * TRUNK: the Hot 100 #1 line, a loose helix of many red strands round one
 * slowly curving spine, each strand at its own radius (2–6, breathing as it
 * goes), twist, width and brightness, so strands sweep past near the lens.
 * LANES: each genre chart leaves the trunk in the week it began and splits
 * 3–5 ways at its own angles and lengths; some forks run to the present,
 * some stop after a few years. OFFSHOOTS: faint filaments, 2010–2014 only.
 */
import { targetIndex, type FlightData } from "./data";

/** World units per chart week. */
export const SP = 1.15;
export const TRUNK_STRANDS = 52;

// spine meander in x/y: a0 sin(z a1 + a2) + a3 sin(z a4 + a5)
const SX = [2.1, 0.0105, 0.4, 0.9, 0.0041, 1.7] as const;
const SY = [1.5, 0.0083, 2.1, 0.7, 0.0029, 0.3] as const;

export function spineX(z: number): number {
  return SX[0] * Math.sin(z * SX[1] + SX[2]) + SX[3] * Math.sin(z * SX[4] + SX[5]);
}
export function spineY(z: number): number {
  return SY[0] * Math.sin(z * SY[1] + SY[2]) + SY[3] * Math.sin(z * SY[4] + SY[5]);
}

export interface LaneSpec {
  lane: string;
  /** Short display name, used whenever the page's label is too long to sit beside a branch. */
  name: string;
  /** First chart week of the lane (public/era/lanes/index.json `from`). */
  from: string;
  /** Direction the lane leaves the trunk in (radians round the spine). */
  angle: number;
}

/** Lane start dates from public/era/lanes/index.json (built 2026-10-20). */
export const LANES: readonly LaneSpec[] = [
  { lane: "rnb_hiphop", name: "R&B / Hip-Hop", from: "1958-01-06", angle: 0.35 },
  { lane: "country", name: "Country", from: "1958-01-06", angle: 2.6 },
  { lane: "uk", name: "UK", from: "1952-11-14", angle: 4.35 },
  { lane: "dance", name: "Dance", from: "1976-01-03", angle: 1.45 },
  { lane: "latin", name: "Latin", from: "1986-09-06", angle: 5.4 },
  { lane: "rock_alt", name: "Rock / Alt", from: "1988-09-10", angle: 3.5 },
  { lane: "rap", name: "Rap", from: "1989-03-11", angle: 0.95 },
  { lane: "canada", name: "Canada", from: "2007-03-31", angle: 3.05 },
];

const OFFSHOOTS = [
  { from: "2010-01-02", until: "2014-12-27" },
  { from: "2010-06-05", until: "2014-06-28" },
  { from: "2011-03-05", until: "2013-11-30" },
  { from: "2012-01-07", until: "2014-12-27" },
  { from: "2010-09-04", until: "2012-12-29" },
] as const;

export type ThreadKind = "trunk" | "lane" | "offshoot";

/**
 * One strand. Its centre sits round the spine at radius R (breathing by rAmp),
 * angle ang0 + z * angPitch; the strand winds round that centre at sR. A fork
 * grows out from near the spine over `spread` units after zStart and fades
 * out at zEnd.
 */
export interface Thread {
  kind: ThreadKind;
  lane: string | null;
  /** fork number within its lane (0 = the fork that always runs to the present) */
  fork: number;
  /** colour slot: 0 trunk, 1..LANES.length lanes, LANES.length + 1 offshoots */
  color: number;
  R: number;
  ang0: number;
  angPitch: number;
  rAmp: number;
  rFreq: number;
  rPhase: number;
  sR: number;
  sPhase: number;
  sPitch: number;
  /** z where it leaves the trunk (going forward in time); NO_START: always out */
  zStart: number;
  spread: number;
  /** z where it stops (NO_END: runs to the present) */
  zEnd: number;
  fadeLen: number;
  alpha: number;
  minPx: number;
}

export const NO_START = -1e9;
export const NO_END = 1e9;
const ROOT_R = 0.7; // forks grow out of the spine from this radius

function zOfDate(data: FlightData, date: string): number {
  if (date < data.dates[data.dates.length - 1]) return NO_START; // before the first chart week
  return -targetIndex(data, date) * SP;
}

/** Deterministic hash in 0..1 so the tree is the same every load. */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function buildThreads(data: FlightData): Thread[] {
  const out: Thread[] = [];
  const zNow = 0;
  for (let k = 0; k < TRUNK_STRANDS; k++) {
    const h = (o: number) => hash(k * 7.13 + o);
    out.push({
      kind: "trunk",
      lane: null,
      fork: 0,
      color: 0,
      R: 2.1 + 2.6 * h(1),
      ang0: h(2) * Math.PI * 2,
      angPitch: ((Math.PI * 2) / (90 + 260 * h(3))) * (h(4) < 0.3 ? -1 : 1),
      // the radius breathes, but every trunk strand stays between 2 and 6 from the spine
      rAmp: Math.max(0, Math.min(0.2 + 1.1 * h(5), 2.1 + 2.6 * h(1) - 2, 6 - (2.1 + 2.6 * h(1)))),
      rFreq: 0.01 + 0.03 * h(6),
      rPhase: h(7) * 6.28,
      sR: 0,
      sPhase: 0,
      sPitch: 0,
      zStart: NO_START,
      spread: 1,
      zEnd: NO_END,
      fadeLen: 1,
      // no two strands alike: brightness and width vary
      alpha: 0.07 + 0.38 * h(8) * h(8),
      minPx: 0.8 + 2.2 * h(9),
    });
  }
  LANES.forEach((l, li) => {
    const zStart = zOfDate(data, l.from);
    const forks = 3 + Math.floor(hash(li * 3.7) * 3); // 3–5 ways
    for (let f = 0; f < forks; f++) {
      const h = (o: number) => hash(li * 31.7 + f * 5.3 + o);
      // forks fan out at their own angles and radii, irregularly, never mirrored
      const delta = (f === 0 ? 0 : (h(1) < 0.5 ? -1 : 1) * (0.25 + 0.9 * h(2)));
      const R = 4.4 + 3.4 * h(3) + (f === 0 ? 0.6 : 0);
      // fork 0 runs to the present; the others stop after a few months to a few decades
      const len = f === 0 ? Infinity : 70 + 1400 * h(4) * h(4);
      const zEnd = zStart <= NO_START ? (f === 0 ? NO_END : -4100 + len + 600 * h(9)) : zStart + len;
      const strands = 2 + (h(5) < 0.5 ? 1 : 0);
      for (let s = 0; s < strands; s++) {
        const hs = (o: number) => hash(li * 31.7 + f * 5.3 + s * 1.9 + o);
        out.push({
          kind: "lane",
          lane: l.lane,
          fork: f,
          color: li + 1,
          R,
          ang0: l.angle + delta,
          angPitch: ((Math.PI * 2) / (600 + 900 * h(6))) * (h(7) < 0.5 ? -1 : 1),
          rAmp: 0.3 + 0.9 * h(8),
          rFreq: 0.006 + 0.02 * h(10),
          rPhase: h(11) * 6.28,
          sR: 0.08 + 0.22 * hs(12),
          sPhase: (s / strands) * Math.PI * 2,
          sPitch: ((Math.PI * 2) / (18 + 30 * hs(13))) * (s % 2 ? -1 : 1),
          zStart,
          spread: 30 + 60 * h(14),
          zEnd: Math.min(zEnd, NO_END),
          fadeLen: 25 + 40 * h(15),
          alpha: 0.12 + 0.3 * hs(16),
          minPx: 0.9 + 1.4 * hs(17),
        });
      }
    }
  });
  OFFSHOOTS.forEach((o, i) => {
    const h = (k: number) => hash(900 + i * 11.1 + k);
    out.push({
      kind: "offshoot",
      lane: null,
      fork: 0,
      color: LANES.length + 1,
      R: 6 + 3 * h(1),
      ang0: h(2) * 6.28,
      angPitch: (Math.PI * 2) / (200 + 300 * h(3)),
      rAmp: 0.5,
      rFreq: 0.02,
      rPhase: h(4) * 6.28,
      sR: 0,
      sPhase: 0,
      sPitch: 0,
      zStart: zOfDate(data, o.from),
      spread: 25,
      zEnd: Math.min(zOfDate(data, o.until) <= NO_START ? zNow : zOfDate(data, o.until), NO_END),
      fadeLen: 20,
      alpha: 0.1 + 0.08 * h(5),
      minPx: 0.9,
    });
  });
  return out;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** 0..1: how far a strand has grown out of the trunk at z. */
export function grown(t: Thread, z: number): number {
  return t.zStart <= NO_START ? 1 : smooth(t.zStart, t.zStart + t.spread, z);
}

/** 0..1: how visible a strand is at z (0 before its lane began or after its fork stopped). */
export function presence(t: Thread, z: number): number {
  const end = t.zEnd >= NO_END ? 1 : 1 - smooth(t.zEnd - t.fadeLen, t.zEnd, z);
  return grown(t, z) * end;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Centre of a strand's fork at z (for the trunk: the strand itself). */
export function groupAt(t: Thread, z: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const g = grown(t, z);
  const R = t.R + t.rAmp * Math.sin(z * t.rFreq + t.rPhase);
  const r = ROOT_R + (R - ROOT_R) * g;
  const a = t.ang0 + z * t.angPitch;
  out.x = spineX(z) + Math.cos(a) * r;
  out.y = spineY(z) + Math.sin(a) * r;
  out.z = z;
  return out;
}

/** World position of one strand at z. */
export function threadAt(t: Thread, z: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  groupAt(t, z, out);
  const b = t.sPhase + z * t.sPitch;
  const sr = t.sR * (0.3 + 0.7 * grown(t, z));
  out.x += Math.cos(b) * sr;
  out.y += Math.sin(b) * sr;
  return out;
}

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));

/**
 * GLSL for the same curves. Per-strand parameters ride on vertex attributes:
 * aA = (R, ang0, angPitch, rAmp), aB = (rFreq, rPhase, sR, sPhase),
 * aC = (sPitch, zStart, spread, zEnd), aD = (fadeLen, alpha, minPx, colour slot).
 */
export const GLSL_TREE = /* glsl */ `
vec2 spineXY(float z) {
  return vec2(
    ${f(SX[0])} * sin(z * ${f(SX[1])} + ${f(SX[2])}) + ${f(SX[3])} * sin(z * ${f(SX[4])} + ${f(SX[5])}),
    ${f(SY[0])} * sin(z * ${f(SY[1])} + ${f(SY[2])}) + ${f(SY[3])} * sin(z * ${f(SY[4])} + ${f(SY[5])})
  );
}
vec3 strandPos(vec4 a, vec4 b, vec4 c, vec4 d, float z, out float vis) {
  float g = c.y < -1e8 ? 1.0 : smoothstep(c.y, c.y + c.z, z);
  float e = c.w > 1e8 ? 1.0 : 1.0 - smoothstep(c.w - d.x, c.w, z);
  vis = g * e;
  float R = a.x + a.w * sin(z * b.x + b.y);
  float r = ${f(ROOT_R)} + (R - ${f(ROOT_R)}) * g;
  float an = a.y + z * a.z;
  vec2 p = spineXY(z) + vec2(cos(an), sin(an)) * r;
  float sb = b.w + z * c.x;
  p += vec2(cos(sb), sin(sb)) * b.z * (0.3 + 0.7 * g);
  return vec3(p, z);
}
`;
