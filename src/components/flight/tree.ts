/**
 * The shape of the timeline tree. Pure math, no three.js, no DOM; the GLSL the
 * thread shader uses is generated from the same constants so the GPU and the
 * JS (camera, covers, rings, labels) agree on where every thread is.
 *
 * Axes: time runs along -z. Path week i (0 = newest chart week) sits at
 * z = -i * SP. The TRUNK is the Hot 100 #1 line, a slow meander about the
 * z axis. Each genre LANE is a branch that winds round the trunk in a loose
 * helix and, flying back in time, merges into the trunk at the week the lane
 * began. OFFSHOOTS are faint short filaments for the blog/mixtape years.
 */
import { targetIndex, type FlightData } from "./data";

/** World units per chart week. */
export const SP = 1.15;

// trunk meander: x = a0 sin(z a1 + a2) + a3 sin(z a4 + a5), same shape for y
const TX = [0.55, 0.031, 0.4, 0.25, 0.0113, 1.7] as const;
const TY = [0.38, 0.023, 2.1, 0.2, 0.0071, 0.3] as const;

export function trunkX(z: number): number {
  return TX[0] * Math.sin(z * TX[1] + TX[2]) + TX[3] * Math.sin(z * TX[4] + TX[5]);
}
export function trunkY(z: number): number {
  return TY[0] * Math.sin(z * TY[1] + TY[2]) + TY[3] * Math.sin(z * TY[4] + TY[5]);
}

export type ThreadKind = "trunk" | "lane" | "offshoot" | "strand";

export interface LaneSpec {
  lane: string;
  /** Short display name used when the page passes no label. */
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
  { lane: "rnb_hiphop", name: "R&B / Hip-Hop", from: "1958-01-06", radius: 1.6, phase: 0.3, period: 88 },
  { lane: "country", name: "Country", from: "1958-01-06", radius: 2.4, phase: 2.5, period: -122 },
  { lane: "uk", name: "UK", from: "1952-11-14", radius: 1.95, phase: 4.2, period: 104 },
  { lane: "dance", name: "Dance", from: "1976-01-03", radius: 2.7, phase: 1.3, period: -78 },
  { lane: "latin", name: "Latin", from: "1986-09-06", radius: 2.15, phase: 5.4, period: 96 },
  { lane: "rock_alt", name: "Rock / Alt", from: "1988-09-10", radius: 1.45, phase: 3.4, period: -68 },
  { lane: "rap", name: "Rap", from: "1989-03-11", radius: 1.8, phase: 0.95, period: 82 },
  { lane: "canada", name: "Canada", from: "2007-03-31", radius: 2.55, phase: 3.95, period: -112 },
];

/** Faint "off the charts" filaments, 2010–2014 only (the archived blog/upload years). */
const OFFSHOOTS = [
  { radius: 0.95, phase: 1.9, period: 44, from: "2010-01-02", until: "2014-12-27" },
  { radius: 3.05, phase: 4.8, period: -58, from: "2010-06-05", until: "2014-06-28" },
  { radius: 1.25, phase: 5.9, period: -36, from: "2011-03-05", until: "2013-11-30" },
  { radius: 2.9, phase: 0.6, period: 50, from: "2012-01-07", until: "2014-12-27" },
] as const;

/** A thread resolved against the chart path: where it exists, in world z. */
export interface Thread {
  kind: ThreadKind;
  lane: string | null;
  radius: number;
  phase: number;
  /** radians per world unit */
  pitch: number;
  /** z where it merges into the trunk going back in time (−Infinity: always there). */
  zOld: number;
  /** z where it merges going forward (+Infinity: runs to the present). */
  zNew: number;
  /** world units over which it peels away from / folds into the trunk */
  merge: number;
  /** base intensity 0..1 */
  alpha: number;
  /** world half-width of the ribbon and its minimum on-screen half-width in px (glow included) */
  halfWidth: number;
  minPx: number;
  /** A strand twisting round another thread: its index, and the twist's radius / phase / pitch. */
  parent: number;
  satR: number;
  satPhase: number;
  satPitch: number;
}

export const NO_OLD = -1e9;
export const NO_NEW = 1e9;
const MERGE = 46; // ≈ 40 weeks

function zOfDate(data: FlightData, date: string): number {
  if (date < data.dates[data.dates.length - 1]) return NO_OLD; // before the first chart week
  return -targetIndex(data, date) * SP;
}

export function buildThreads(data: FlightData): Thread[] {
  const threads: Thread[] = [
    {
      kind: "trunk",
      lane: null,
      radius: 0,
      phase: 0,
      pitch: 0,
      zOld: NO_OLD,
      zNew: NO_NEW,
      merge: MERGE,
      alpha: 1,
      halfWidth: 0.008,
      minPx: 4.2,
      parent: -1,
      satR: 0,
      satPhase: 0,
      satPitch: 0,
    },
  ];
  for (const l of LANES) {
    threads.push({
      kind: "lane",
      lane: l.lane,
      radius: l.radius,
      phase: l.phase,
      pitch: (Math.PI * 2) / l.period,
      zOld: zOfDate(data, l.from),
      zNew: NO_NEW,
      merge: MERGE,
      alpha: 0.4,
      halfWidth: 0.004,
      minPx: 3,
      parent: -1,
      satR: 0,
      satPhase: 0,
      satPitch: 0,
    });
  }
  for (const o of OFFSHOOTS) {
    threads.push({
      kind: "offshoot",
      lane: null,
      radius: o.radius,
      phase: o.phase,
      pitch: (Math.PI * 2) / o.period,
      zOld: zOfDate(data, o.from),
      zNew: zOfDate(data, o.until),
      merge: 30,
      alpha: 0.16,
      halfWidth: 0.003,
      minPx: 2.2,
      parent: -1,
      satR: 0,
      satPhase: 0,
      satPitch: 0,
    });
  }
  // hair strands twisting round the trunk and each lane: the threads read as braided, not single wires
  const strands = (parent: number, n: number, radius: number, period: number, alpha: number, px: number) => {
    for (let k = 0; k < n; k++) {
      const p = threads[parent];
      threads.push({
        ...p,
        kind: "strand",
        lane: null,
        alpha,
        halfWidth: 0.002,
        minPx: px,
        parent,
        satR: radius * (1 + k * 0.35),
        satPhase: (k * Math.PI * 2) / n + parent,
        satPitch: (Math.PI * 2) / (period * (k % 2 ? -1 : 1) * (1 + k * 0.25)),
      });
    }
  };
  const base = threads.length;
  strands(0, 3, 0.09, 11, 0.32, 2);
  for (let i = 1; i < base; i++) if (threads[i].kind === "lane") strands(i, 2, 0.11, 9, 0.17, 1.8);
  return threads;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** 0..1: how far a thread has peeled away from the trunk at z (0 = merged / absent). */
export function presence(t: Thread, z: number): number {
  const grow = t.zOld <= NO_OLD ? 1 : smooth(t.zOld, t.zOld + t.merge, z);
  const shrink = t.zNew >= NO_NEW ? 1 : 1 - smooth(t.zNew - t.merge, t.zNew, z);
  return grow * shrink;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** World position of a thread at z (the trunk itself when radius is 0 or it has merged). */
export function threadAt(t: Thread, z: number, radiusScale: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const r = t.radius * radiusScale * presence(t, z);
  const a = t.phase + z * t.pitch;
  out.x = trunkX(z) + Math.cos(a) * r;
  out.y = trunkY(z) + Math.sin(a) * r;
  out.z = z;
  return out;
}

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));

/** GLSL for trunkXY(z) and threadPos(...) built from the constants above. */
export const GLSL_TREE = /* glsl */ `
vec2 trunkXY(float z) {
  return vec2(
    ${f(TX[0])} * sin(z * ${f(TX[1])} + ${f(TX[2])}) + ${f(TX[3])} * sin(z * ${f(TX[4])} + ${f(TX[5])}),
    ${f(TY[0])} * sin(z * ${f(TY[1])} + ${f(TY[2])}) + ${f(TY[3])} * sin(z * ${f(TY[4])} + ${f(TY[5])})
  );
}
// a = (radius, phase, pitch, alpha), b = (zOld, zNew, merge, halfWidth), d = (parent, satR, satPhase, satPitch)
float presenceAt(vec4 b, float z) {
  float grow = b.x < -1e8 ? 1.0 : smoothstep(b.x, b.x + b.z, z);
  float shrink = b.y > 1e8 ? 1.0 : 1.0 - smoothstep(b.y - b.z, b.y, z);
  return grow * shrink;
}
vec3 threadPos(vec4 a, vec4 b, float z, float rScale, out float pres) {
  pres = presenceAt(b, z);
  float r = a.x * rScale * pres;
  float ang = a.y + z * a.z;
  return vec3(trunkXY(z) + vec2(cos(ang), sin(ang)) * r, z);
}
vec3 strandPos(int t, float z, float rScale, out float pres) {
  vec4 d = uD[t];
  if (d.x < -0.5) return threadPos(uA[t], uB[t], z, rScale, pres);
  int p = int(d.x + 0.5);
  vec3 c = threadPos(uA[p], uB[p], z, rScale, pres);
  float ang = d.z + z * d.w;
  return c + vec3(cos(ang), sin(ang), 0.0) * d.y * (0.3 + 0.7 * pres);
}
`;
