/**
 * The flight, composed as a timeline tree ("low-key Sacred Timeline"), seen
 * from the side.
 *
 * - Time runs down world Y: the present at the top, the past below.
 * - TRUNK: the Hot 100 #1 line, a braid of thin red strands twisted round one
 *   spine, about a twist a year. Each #1 RUN's cover is pinned to the trunk at
 *   its height, facing the camera, so the covers stack into a column that
 *   recedes below (the Time Machine feel).
 * - LANES: each genre chart is a looser strand group running beside the trunk;
 *   flying back, a lane folds into the trunk at the week its chart began.
 * - The camera rides a three-quarter side view ~6 units off the trunk and
 *   descends as the weeks go back. Desktop: trunk in the right third; phone: centred.
 * - Landing: the other charts peel off the trunk at the landed week as limbs
 *   that rise and split, each ending in a labelled node, while the camera
 *   dollies back to ~30 units and tilts up so the whole tree is in frame, the
 *   landed cover lit in a red frame where the DOM HUD leaves room for it.
 *
 * Budget: POOL_SIZE cover meshes recycled as the camera passes (pool.ts),
 * proximity texture loading through an LRU (textures.ts), every strand of the
 * tree in ONE draw call (curves evaluated in the vertex shader over a sliding
 * window, nothing rebuilt per frame), pooled rings, no lights, no shadows, no
 * post-processing, nothing rendered while hidden or still.
 *
 * No React here. Flight.tsx owns the lifecycle.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Fog,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  Vector4,
  WebGLRenderer,
  type CanvasTexture,
  type IUniform,
} from "three";
import { ease, easeVelocity, flightDuration, warp, yearsBetween } from "./easing";
import { firstGateAtOrAfter, passingAt, runsBetween, targetIndex, type FlightData, type PassingWeek } from "./data";
import { POOL_SIZE, SlotTable, slotOf } from "./pool";
import { BRAID_R, buildThreads, GLSL_TREE, groupAt, LANES, presence, SP, spineX, spineZ, type Thread } from "./tree";
import { canopyFrame, drawBranchLabel, shortLabel, type FlightBranch, type LabelSprite, type Point } from "./labels";
import {
  awaitFonts,
  canvasFonts,
  CoverStore,
  drawYearLabel,
  INK,
  SIGNAL,
  yearLabelTexture,
  type CanvasFonts,
} from "./textures";

export { SP };

const FOV = 62;
const RING_POOL = 6;
const IDLE_SPEED = 0.6; // units per second
const IDLE_WEEKS = 156; // the most recent ~3 years
const FADE_MS = 320;
const IDLE_FADE_S = 1.6;
/** Covers the camera passes slower than this (units/s) are on screen long enough to be worth fetching. */
const LOAD_SPEED = 320;
const START_PRELOAD = 40;
const PRELOAD_TIMEOUT_MS = 700;
const BEHIND_WEEKS = 4;
const AHEAD_WEEKS = 44;
/** Weeks either side of the destination fetched first at launch: the landing must be complete. */
const LANDING_BEHIND = 8;
const LANDING_AHEAD = 30;
const THREAD_WIN = 62; // world units of tree drawn below the window top
const THREAD_SEG = 0.31;
const PARTICLE_WIN = 44;
const NODE_INSET = 0.07;

// ride camera: three-quarter side view, above the focal week, looking down the trunk
const AZ = 0.62; // azimuth of the camera round the trunk (radians)
const RIDE_HD = 5.6; // horizontal distance from the trunk: ~6 units off it
const RIDE_H = 2.4; // height above the focal week
const LOOK_DROP = 3.0; // a 44° look down the trunk: the column recedes below, still reads vertical
const RIDE_SHIFT_X = 0.34; // desktop: lens shift puts the trunk in the right third, still vertical
// landing camera: dolly back and tilt up
const FINAL_D = 30;
const FINAL_EL = 0.1;
const FOG_RIDE: [number, number] = [8, 30];
const FOG_FINAL: [number, number] = [22, 86];

type Mode = "idle" | "preload" | "flying" | "arrived";

export interface TunnelOptions {
  canvas: HTMLCanvasElement;
  data: FlightData;
  target: string | null;
  freeze: number | null;
  branches?: FlightBranch[];
  onPassing?: (w: PassingWeek) => void;
  onArrive?: () => void;
}

export interface Tunnel {
  setTarget(date: string | null): void;
  setFreeze(p: number | null): void;
  setBranches(b: FlightBranch[] | undefined): void;
  skip(): void;
  dispose(): void;
}

/** progress p such that ease(p) ≈ f, from a 512-step lookup table (ease is monotonic). */
function makeInverseEase() {
  const N = 512;
  const lut = new Float64Array(N + 1);
  for (let k = 0; k <= N; k++) lut[k] = ease(k / N);
  return (f: number) => {
    if (f <= 0) return 0;
    if (f >= 1) return 1;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lut[mid] < f) lo = mid;
      else hi = mid;
    }
    const span = lut[hi] - lut[lo] || 1;
    return (lo + (f - lut[lo]) / span) / N;
  };
}

/** Deterministic PRNG so frozen frames are identical run to run. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------- shaders ----------

const STRAND_ATTRS = /* glsl */ `
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aC;
attribute float aK;
uniform vec4 uCol[NC];
uniform float uLaneScale;
uniform float uBraid;
`;

const THREAD_VERT = /* glsl */ `
${STRAND_ATTRS}
uniform float uY0;
uniform float uWin;
uniform float uPxK;
uniform float uHalfW;
attribute float aS;
attribute float aSide;
varying float vSide;
varying float vI;
varying vec3 vCol;
varying float vDepth;
varying float vY;
${GLSL_TREE}
void main() {
  float y = uY0 - aS * uWin;
  vY = y;
  float pres; float pres2;
  vec3 P = strandPos(aA, aB, aC, aK, y, uLaneScale, uBraid, pres);
  vec3 Q = strandPos(aA, aB, aC, aK, y - 0.25, uLaneScale, uBraid, pres2);
  vec4 mvP = modelViewMatrix * vec4(P, 1.0);
  vec4 mvQ = modelViewMatrix * vec4(Q, 1.0);
  vec3 side = cross(normalize(mvQ.xyz - mvP.xyz), normalize(mvP.xyz));
  float sl = length(side);
  side = sl > 1e-5 ? side / sl : vec3(1.0, 0.0, 0.0);
  float depth = max(0.05, -mvP.z);
  float halfW = max(uHalfW, aB.w * uPxK * depth);
  mvP.xyz += side * aSide * halfW;
  gl_Position = projectionMatrix * mvP;
  vSide = aSide;
  vDepth = depth;
  int ci = int(aC.w + 0.5);
  vCol = uCol[ci].rgb;
  vI = aB.z * uCol[ci].w * (aK < 0.5 ? 1.0 : pres);
}
`;

const GLOW_FRAG = /* glsl */ `
uniform float uFogNear;
uniform float uFogFar;
uniform float uFade;
uniform float uCut;
uniform float uCutK;
varying float vSide;
varying float vI;
varying vec3 vCol;
varying float vDepth;
varying float vY;
void main() {
  float d = abs(vSide);
  float core = 1.0 - smoothstep(0.22, 0.42, d);
  float glow = exp(-d * d * 6.0) * 0.36;
  float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
  // on landing, the tree above the landed week dims: its canopy is the other charts' limbs
  float cut = 1.0 - uCutK * 0.94 * smoothstep(uCut + 0.2, uCut + 2.2, vY);
  float i = (core + glow) * vI * fog * uFade * cut;
  if (i < 0.002) discard;
  gl_FragColor = vec4(vCol, i);
  #include <colorspace_fragment>
}
`;

const PARTICLE_VERT = /* glsl */ `
${STRAND_ATTRS}
uniform float uTop;
uniform float uFlow;
uniform float uLen;
uniform float uPWin;
attribute float aSeed;
attribute float aEnd;
varying float vI;
varying vec3 vCol;
varying float vDepth;
varying float vY;
varying float vSide;
${GLSL_TREE}
void main() {
  float yy = uTop - mod(aSeed + uTop + uFlow, uPWin);
  float y = yy + (aEnd - 0.5) * uLen;
  vY = y;
  vSide = 0.0;
  float pres;
  vec3 P = strandPos(aA, aB, aC, aK, y, uLaneScale, uBraid, pres);
  vec4 mv = modelViewMatrix * vec4(P, 1.0);
  gl_Position = projectionMatrix * mv;
  vDepth = -mv.z;
  int ci = int(aC.w + 0.5);
  vCol = uCol[ci].rgb;
  vI = (aK < 0.5 ? 1.0 : pres) * (aB.z * 1.6 + 0.25) * uCol[ci].w;
}
`;

const PARTICLE_FRAG = /* glsl */ `
uniform float uFogNear;
uniform float uFogFar;
uniform float uFade;
uniform float uWarp;
uniform float uCut;
uniform float uCutK;
varying float vI;
varying vec3 vCol;
varying float vDepth;
varying float vY;
varying float vSide;
void main() {
  float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
  float cut = 1.0 - uCutK * smoothstep(uCut + 0.2, uCut + 2.2, vY);
  float i = vI * fog * uFade * cut * (0.3 + 0.7 * uWarp);
  if (i < 0.003) discard;
  gl_FragColor = vec4(vCol, i);
  #include <colorspace_fragment>
}
`;

const CANOPY_VERT = /* glsl */ `
uniform vec4 uCol[NC];
attribute float aSide;
attribute float aT;
attribute float aCi;
varying float vSide;
varying float vI;
varying vec3 vCol;
varying float vDepth;
varying float vY;
uniform float uGrow;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vSide = aSide;
  vDepth = -mv.z;
  vY = -1e9;
  int ci = int(aCi + 0.5);
  vCol = uCol[ci].rgb;
  // limbs grow out of the trunk: visible up to uGrow along their length, a bright growing tip
  float g = 1.0 - smoothstep(uGrow - 0.05, uGrow, aT);
  vI = g * (0.55 + 0.45 * aT) * uCol[ci].w * 1.4;
}
`;

const NODE_VERT = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

// The quad holds the cover inset by uInset on every side; the margin carries a thin edge and its glow.
const NODE_FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uInset;
uniform float uLine;
uniform float uGlow;
uniform vec3 uEdge;
uniform float uEdgeA;
uniform float uBright;
uniform float uOpacity;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFade;
uniform float uFogK;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec2 q = (vUv - uInset) / (1.0 - 2.0 * uInset);
  vec2 out2 = max(vec2(0.0), max(-q, q - 1.0));
  float outside = length(out2);
  bool inside = outside <= 0.0;
  float toEdge = inside ? min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)) : outside;
  float line = 1.0 - smoothstep(uLine * 0.5, uLine, toEdge);
  float maxOut = uInset / (1.0 - 2.0 * uInset);
  float glow = inside ? 0.0 : exp(-outside * uGlow) * 0.55 * (1.0 - smoothstep(maxOut * 0.45, maxOut, outside));
  vec3 col;
  float a;
  if (inside) {
    col = texture2D(map, q).rgb * uBright;
    col = mix(col, uEdge, line * uEdgeA);
    a = 1.0;
  } else {
    col = uEdge;
    a = clamp(line * uEdgeA + glow * uEdgeA, 0.0, 1.0);
  }
  float fog = 1.0 - uFogK * smoothstep(uFogNear, uFogFar, vDepth);
  a *= uOpacity;
  col *= fog * uFade;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

export function createTunnel(opts: TunnelOptions): Tunnel {
  const { canvas, data } = opts;
  const total = data.dates.length;
  const runs = data.runStart.length;
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- renderer ----------
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", alpha: false });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x000000, 1);
  renderer.autoClear = false;

  const scene = new Scene();
  scene.background = new Color(0x000000);
  const fog = new Fog(0x000000, FOG_RIDE[0], FOG_RIDE[1]);
  scene.fog = fog;
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 400);
  const solver = new PerspectiveCamera(FOV, 1, 0.1, 400); // plans the landing frame
  const overlay = new Scene();
  const ortho = new OrthographicCamera(0, 1, 1, 0, -10, 10);

  let width = -1;
  let height = -1;
  let narrow = (canvas.clientWidth || window.innerWidth) < 640;
  let fonts: CanvasFonts = canvasFonts();
  let disposed = false;
  let stamp = 0;

  const shared = {
    uFogNear: { value: FOG_RIDE[0] } as IUniform<number>,
    uFogFar: { value: FOG_RIDE[1] } as IUniform<number>,
    uFade: { value: 0 } as IUniform<number>,
    uCut: { value: 0 } as IUniform<number>,
    uCutK: { value: 0 } as IUniform<number>,
  };

  // ---------- colours: slot 0 trunk, 1..8 lanes, 9 offshoots ----------
  const trunkColor = new Color(SIGNAL);
  const inkColor = new Color(INK);
  const NC = LANES.length + 2;
  const uCol = Array.from({ length: NC }, (_, i) => {
    const c = i === 0 ? trunkColor : inkColor;
    return new Vector4(c.r, c.g, c.b, 1);
  });
  const colorUniforms = { uCol: { value: uCol }, uLaneScale: { value: narrow ? 0.55 : 1 }, uBraid: { value: narrow ? 0.7 : 1 } };

  // ---------- the tree: trunk braid + lanes + offshoots, one draw call ----------
  const threads: Thread[] = buildThreads(data);
  const NT = threads.length;
  const laneFirst = new Map<string, Thread>();
  threads.forEach((t) => t.lane && !laneFirst.has(t.lane) && laneFirst.set(t.lane, t));
  const kindOf = (t: Thread) => (t.kind === "trunk" ? 0 : t.kind === "lane" ? 1 : 2);

  function strandAttributes(geo: BufferGeometry, threadOf: (v: number) => Thread, n: number) {
    const aA = new Float32Array(n * 4);
    const aB = new Float32Array(n * 4);
    const aC = new Float32Array(n * 4);
    const aK = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      const t = threadOf(v);
      const o = v * 4;
      aA[o] = t.laneR;
      aA[o + 1] = t.lanePhase;
      aA[o + 2] = t.lanePitch;
      aA[o + 3] = t.strandR;
      aB[o] = t.strandPhase;
      aB[o + 1] = t.strandPitch;
      aB[o + 2] = t.alpha;
      aB[o + 3] = t.minPx;
      aC[o] = t.yOld;
      aC[o + 1] = t.yNew;
      aC[o + 2] = t.merge;
      aC[o + 3] = t.color;
      aK[v] = kindOf(t);
    }
    geo.setAttribute("aA", new BufferAttribute(aA, 4));
    geo.setAttribute("aB", new BufferAttribute(aB, 4));
    geo.setAttribute("aC", new BufferAttribute(aC, 4));
    geo.setAttribute("aK", new BufferAttribute(aK, 1));
  }

  const SEGS = Math.round(THREAD_WIN / THREAD_SEG);
  const threadGeo = new BufferGeometry();
  {
    const vPer = (SEGS + 1) * 2;
    const n = NT * vPer;
    const aS = new Float32Array(n);
    const aSide = new Float32Array(n);
    const index = new Uint32Array(NT * SEGS * 6);
    let ix = 0;
    for (let t = 0; t < NT; t++) {
      const base = t * vPer;
      for (let j = 0; j <= SEGS; j++) {
        aS[base + j * 2] = aS[base + j * 2 + 1] = j / SEGS;
        aSide[base + j * 2] = -1;
        aSide[base + j * 2 + 1] = 1;
      }
      for (let j = 0; j < SEGS; j++) {
        const a = base + j * 2;
        index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], ix);
        ix += 6;
      }
    }
    threadGeo.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
    threadGeo.setAttribute("aS", new BufferAttribute(aS, 1));
    threadGeo.setAttribute("aSide", new BufferAttribute(aSide, 1));
    strandAttributes(threadGeo, (v) => threads[Math.floor(v / vPer)], n);
    threadGeo.setIndex(new BufferAttribute(index, 1));
  }
  const threadMat = new ShaderMaterial({
    defines: { NC },
    uniforms: {
      ...colorUniforms,
      uY0: { value: 0 },
      uWin: { value: THREAD_WIN },
      uPxK: { value: 0.001 },
      uHalfW: { value: 0.003 },
      ...shared,
    },
    vertexShader: THREAD_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const threadMesh = new Mesh(threadGeo, threadMat);
  threadMesh.frustumCulled = false;
  threadMesh.renderOrder = 1;
  scene.add(threadMesh);

  // ---------- particles streaming along the strands ----------
  const particleGeo = new BufferGeometry();
  {
    const rand = mulberry32(256);
    const trunk = threads.filter((t) => t.kind === "trunk");
    const lanes = threads.filter((t) => t.kind === "lane");
    const offs = threads.filter((t) => t.kind === "offshoot");
    const pick: Thread[] = [];
    for (let i = 0; i < 170; i++) pick.push(trunk[Math.floor(rand() * trunk.length)]);
    for (let i = 0; i < 260; i++) pick.push(lanes[Math.floor(rand() * lanes.length)]);
    for (let i = 0; i < 30; i++) pick.push(offs[Math.floor(rand() * offs.length)]);
    const n = pick.length * 2;
    const aSeed = new Float32Array(n);
    const aEnd = new Float32Array(n);
    for (let p = 0; p < pick.length; p++) {
      const seed = rand() * PARTICLE_WIN;
      aSeed[p * 2] = aSeed[p * 2 + 1] = seed;
      aEnd[p * 2] = 0;
      aEnd[p * 2 + 1] = 1;
    }
    particleGeo.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
    particleGeo.setAttribute("aSeed", new BufferAttribute(aSeed, 1));
    particleGeo.setAttribute("aEnd", new BufferAttribute(aEnd, 1));
    strandAttributes(particleGeo, (v) => pick[v >> 1], n);
  }
  const particleMat = new ShaderMaterial({
    defines: { NC },
    uniforms: {
      ...colorUniforms,
      uTop: { value: 0 },
      uFlow: { value: 0 },
      uLen: { value: 0.06 },
      uPWin: { value: PARTICLE_WIN },
      uWarp: { value: 0 },
      ...shared,
    },
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const particles = new LineSegments(particleGeo, particleMat); // GL lines that stretch with the warp
  particles.frustumCulled = false;
  particles.renderOrder = 2;
  scene.add(particles);

  // ---------- cover nodes, one per #1 run, pooled ----------
  const store = new CoverStore(data, () => fonts, () => requestRender());
  const quadGeo = new PlaneGeometry(1, 1);
  type NodeMat = ShaderMaterial & { uniforms: Record<string, IUniform> };
  const blank = yearLabelTexture(); // never sampled: nodes stay hidden until their cover is ready
  function nodeMaterial(edge: Color, edgeA: number, line: number, glow: number): NodeMat {
    return new ShaderMaterial({
      uniforms: {
        map: { value: blank },
        uInset: { value: NODE_INSET },
        uLine: { value: line },
        uGlow: { value: glow },
        uEdge: { value: edge },
        uEdgeA: { value: edgeA },
        uBright: { value: 1 },
        uOpacity: { value: 1 },
        uFogK: { value: 1 },
        uFogNear: shared.uFogNear,
        uFogFar: shared.uFogFar,
        uFade: shared.uFade,
      },
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
      transparent: true,
      depthWrite: true,
      blending: NormalBlending,
    }) as NodeMat;
  }
  const nodeEdge = new Color(INK);
  const nodes: Mesh<PlaneGeometry, NodeMat>[] = [];
  const nodeY = new Float32Array(POOL_SIZE);
  const nodeSize = new Float32Array(POOL_SIZE);
  const nodeReadyAt = new Float64Array(POOL_SIZE).fill(-1);
  for (let k = 0; k < POOL_SIZE; k++) {
    const m = new Mesh(quadGeo, nodeMaterial(nodeEdge, 0.32, 0.01, 30));
    m.matrixAutoUpdate = false;
    m.visible = false;
    m.renderOrder = 4;
    nodes.push(m);
    scene.add(m);
  }
  const slots = new SlotTable(POOL_SIZE);
  /** cover width at the camera's focal height: ~20% of the viewport width */
  let rideCover = 1;

  function placeNode(slot: number, run: number) {
    const a = data.runStart[run];
    const b = data.runEnd[run];
    const len = b - a + 1;
    nodeY[slot] = -((a + b) / 2) * SP;
    nodeSize[slot] = rideCover * Math.min(1.2, 0.9 + 0.1 * Math.log2(len));
    // a cover already in the cache shows at once; one that arrives later fades in
    nodeReadyAt[slot] = store.has(data.song[a]) ? 0 : -1;
    nodes[slot].visible = false;
  }

  // ---------- destination: that week's #1 at 600×600 in a red frame ----------
  const destMat = nodeMaterial(trunkColor, 1, 0.02, 11);
  destMat.uniforms.uFogK.value = 0;
  const dest = new Mesh(quadGeo, destMat);
  dest.matrixAutoUpdate = false;
  dest.visible = false;
  dest.renderOrder = 5;
  scene.add(dest);
  let destY = 0;
  let targetRun = -1;
  let destReadyAt = -1;

  // ---------- year rings ----------
  const RING_R = BRAID_R + 0.3;
  const ringGeo = new RingGeometry(0.975, 1, 128, 1);
  const ringMat = new MeshBasicMaterial({
    color: trunkColor,
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: true,
    side: DoubleSide,
  });
  interface Ring {
    ring: Mesh;
    ordinal: number;
    year: string;
    y: number;
  }
  const rings: Ring[] = [];
  for (let k = 0; k < RING_POOL; k++) {
    const ring = new Mesh(ringGeo, ringMat);
    ring.matrixAutoUpdate = false;
    ring.visible = false;
    ring.renderOrder = 3;
    scene.add(ring);
    rings.push({ ring, ordinal: -1, year: "", y: 0 });
  }
  function hideRing(r: Ring) {
    r.ring.visible = false;
    r.ordinal = -1;
  }
  function placeRing(r: Ring, ordinal: number) {
    const i = data.gates[ordinal];
    const y = -i * SP + SP / 2;
    r.ordinal = ordinal;
    r.y = y;
    r.year = data.dates[i].slice(0, 4);
    r.ring.position.set(spineX(y), y, spineZ(y));
    r.ring.rotation.set(-Math.PI / 2, 0, 0);
    r.ring.scale.set(RING_R, RING_R, 1);
    r.ring.updateMatrix();
    r.ring.visible = true;
  }
  function syncRings(fromWeek: number, toWeek: number) {
    const g0 = firstGateAtOrAfter(data, fromWeek + 1);
    const g1 = firstGateAtOrAfter(data, toWeek);
    for (const r of rings) if (r.ordinal >= 0 && (r.ordinal < g0 || r.ordinal >= g1)) hideRing(r);
    for (let o = g0; o < g1 && o < g0 + RING_POOL; o++) {
      const r = rings[slotOf(o, RING_POOL)];
      if (r.ordinal !== o) placeRing(r, o);
    }
  }

  // ---------- overlay (pixel space): year labels, branch labels, branch nodes ----------
  interface Sprite {
    mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
    tex: CanvasTexture | null;
    w: number;
    h: number;
    key: string;
  }
  function sprite(): Sprite {
    const mesh = new Mesh(quadGeo, new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, opacity: 0 }));
    mesh.visible = false;
    mesh.renderOrder = 3;
    overlay.add(mesh);
    return { mesh, tex: null, w: 0, h: 0, key: "" };
  }
  const yearSprites = rings.map(() => sprite());
  const labelSprites = LANES.map(() => sprite());
  const dotPos = new Float32Array(LANES.length * 3);
  const dotCol = new Float32Array(LANES.length * 3);
  const dotGeo = new BufferGeometry();
  dotGeo.setAttribute("position", new BufferAttribute(dotPos, 3));
  dotGeo.setAttribute("color", new BufferAttribute(dotCol, 3));
  const dotMat = new PointsMaterial({
    size: 5,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const dots = new Points(dotGeo, dotMat);
  dots.frustumCulled = false;
  dots.renderOrder = 2;
  overlay.add(dots);

  function drawYear(s: Sprite, year: string) {
    const px = narrow ? 13 : 15;
    const key = `${year}|${px}|${fonts.display}`;
    if (s.key === key) return;
    s.key = key;
    const dpr = renderer.getPixelRatio();
    const w = Math.ceil(px * 2.4);
    const h = Math.ceil(px * 1.2);
    const cw = Math.ceil(w * dpr);
    const ch = Math.ceil(h * dpr);
    const old = s.tex?.image as HTMLCanvasElement | undefined;
    if (!s.tex || !old || old.width !== cw || old.height !== ch) {
      // a GPU texture keeps the size it was first uploaded at: a new size gets a new texture
      s.tex?.dispose();
      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      const tex = yearLabelTexture();
      tex.image = c;
      s.tex = tex;
      s.mesh.material.map = tex;
      s.mesh.material.needsUpdate = true;
    }
    drawYearLabel(s.tex, year, fonts);
    s.w = w;
    s.h = h;
  }

  /** Off-axis lens shift: moves the image without turning the camera, so verticals stay vertical. */
  function applyShift(cam: PerspectiveCamera, sx: number, sy: number) {
    cam.updateProjectionMatrix();
    cam.projectionMatrix.elements[8] = -sx;
    cam.projectionMatrix.elements[9] = -sy;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  const finalShift = { x: 0, y: 0 };

  // ---------- landing plan: final camera, canopy limbs and their nodes ----------
  let branchInfo: FlightBranch[] | undefined = opts.branches;
  const finalPos = new Vector3();
  const finalLook = new Vector3();
  interface Limb {
    lane: string;
    side: "left" | "right";
    node: Vector3; // world
    screen: Point; // where the frame puts it
    branch: FlightBranch;
  }
  let limbs: Limb[] = [];
  let canopyMesh: Mesh<BufferGeometry, ShaderMaterial> | null = null;
  const canopyMat = new ShaderMaterial({
    defines: { NC },
    uniforms: { uCol: colorUniforms.uCol, uGrow: { value: 0 }, ...shared, uCutK: { value: 0 }, uCut: { value: 0 } },
    vertexShader: CANOPY_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  let planKey = "";
  let finalDestSize = 1;

  function destinationBranches(): FlightBranch[] {
    const out: FlightBranch[] = [];
    for (const spec of LANES) {
      const t = laneFirst.get(spec.lane)!;
      if (presence(t, destY) < 0.5) continue;
      const given = branchInfo?.find((b) => b.lane === spec.lane);
      const label = shortLabel(given?.label ?? "", spec.name, narrow);
      out.push(given ? { ...given, label } : { lane: spec.lane, label: spec.name });
    }
    return out;
  }

  /** Where the camera ends, and the canopy limbs it looks at. Rebuilt per target, size and branch set. */
  function planLanding() {
    if (targetIdx < 0 || width <= 0) return;
    const list = destinationBranches();
    const key = `${targetIdx}|${width}x${height}|${JSON.stringify(list)}`;
    if (key === planKey) return;
    planKey = key;
    const D = new Vector3(spineX(destY), destY, spineZ(destY));
    finalPos.set(Math.sin(AZ) * Math.cos(FINAL_EL), Math.sin(FINAL_EL), Math.cos(AZ) * Math.cos(FINAL_EL)).multiplyScalar(FINAL_D).add(D);
    solver.aspect = width / height;
    solver.fov = FOV;
    solver.updateProjectionMatrix();
    const nl = Math.ceil(list.length / 2);
    const frame = canopyFrame(nl, list.length - nl, { w: width, h: height, narrow });
    // look straight at the landed cover; a lens shift puts it where the frame wants it
    finalShift.x = (frame.dest.x / width) * 2 - 1;
    finalShift.y = 1 - (frame.dest.y / height) * 2;
    const tanV = Math.tan((FOV / 2) * (Math.PI / 180));
    const tanH = tanV * solver.aspect;
    finalLook.copy(D);
    solver.position.copy(finalPos);
    solver.up.set(0, 1, 0);
    solver.lookAt(finalLook);
    solver.updateMatrixWorld();
    applyShift(solver, finalShift.x, finalShift.y);
    const fwd = new Vector3(0, 0, -1).applyQuaternion(solver.quaternion);
    const zD = D.clone().sub(finalPos).dot(fwd);
    const visW = 2 * zD * tanH;
    finalDestSize = (frame.destW / width) * visW;
    const unproject = (p: Point) => {
      const r = new Vector3((p.x / width) * 2 - 1, 1 - (p.y / height) * 2, 0.5).unproject(solver).sub(finalPos).normalize();
      return finalPos.clone().addScaledVector(r, zD / r.dot(fwd));
    };

    // limbs: each present lane leaves the trunk at the landed week, left lanes to the left column
    const starts = list.map((b) => {
      const g = groupAt(laneFirst.get(b.lane)!, destY, colorUniforms.uLaneScale.value);
      const s = new Vector3(g.x, g.y, g.z);
      return { b, s, sx: s.clone().project(solver).x };
    });
    starts.sort((p, q) => p.sx - q.sx);
    limbs = starts.map((st, k) => {
      const side: "left" | "right" = k < nl ? "left" : "right";
      const screen = side === "left" ? frame.left[k] : frame.right[k - nl];
      return { lane: st.b.lane, side, node: unproject(screen), screen, branch: st.b };
    });

    // canopy geometry: 4 strands per limb, a cubic that rises then reaches its node, splitting as it goes
    const N = 56;
    const STR = 4;
    const pos: number[] = [];
    const sideA: number[] = [];
    const tA: number[] = [];
    const ciA: number[] = [];
    const idx: number[] = [];
    const pxK = (2 * tanV) / height;
    const p0 = new Vector3();
    const p1 = new Vector3();
    const p2 = new Vector3();
    const p3 = new Vector3();
    const c = new Vector3();
    const c2 = new Vector3();
    const tan = new Vector3();
    const nrm = new Vector3();
    const toCam = new Vector3();
    const off = new Vector3();
    const bez = (t: number, out: Vector3) => {
      const u = 1 - t;
      return out
        .copy(p0)
        .multiplyScalar(u * u * u)
        .addScaledVector(p1, 3 * u * u * t)
        .addScaledVector(p2, 3 * u * t * t)
        .addScaledVector(p3, t * t * t);
    };
    limbs.forEach((limb, li) => {
      const st = starts[li];
      p0.copy(st.s);
      p3.copy(limb.node);
      const L = p3.distanceTo(p0);
      p1.copy(p0).add(new Vector3(0, 0.5 * L, 0));
      p2.set(p3.x + (p0.x - p3.x) * 0.35, p3.y - 0.16 * L, p3.z + (p0.z - p3.z) * 0.35);
      const ci = LANES.findIndex((l) => l.lane === limb.lane) + 1;
      for (let j = 0; j < STR; j++) {
        const base = pos.length / 3;
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          bez(t, c);
          bez(Math.min(1, t + 0.01), c2);
          tan.copy(c2).sub(c);
          if (tan.lengthSq() < 1e-10) tan.set(0, 1, 0);
          tan.normalize();
          nrm.copy(tan).cross(fwd).normalize();
          // the strands of a limb split apart as it rises, and twist a little in depth
          const spread = ((j - (STR - 1) / 2) / ((STR - 1) / 2)) * (0.05 + 0.6 * Math.pow(t, 1.5));
          off.copy(nrm).multiplyScalar(spread).addScaledVector(fwd, Math.sin(t * 6 + j * 1.7) * 0.25 * t);
          c.add(off);
          toCam.copy(finalPos).sub(c);
          const depth = toCam.length();
          const halfW = Math.max(0.004, 1.7 * pxK * depth);
          const sideV = tan.clone().cross(toCam).normalize().multiplyScalar(halfW);
          pos.push(c.x - sideV.x, c.y - sideV.y, c.z - sideV.z, c.x + sideV.x, c.y + sideV.y, c.z + sideV.z);
          sideA.push(-1, 1);
          tA.push(t, t);
          ciA.push(ci, ci);
          if (i < N) {
            const a = base + i * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
        }
      }
    });
    if (canopyMesh) {
      canopyMesh.geometry.dispose();
      scene.remove(canopyMesh);
      canopyMesh = null;
    }
    if (pos.length) {
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
      g.setAttribute("aSide", new BufferAttribute(new Float32Array(sideA), 1));
      g.setAttribute("aT", new BufferAttribute(new Float32Array(tA), 1));
      g.setAttribute("aCi", new BufferAttribute(new Float32Array(ciA), 1));
      g.setIndex(idx);
      canopyMesh = new Mesh(g, canopyMat);
      canopyMesh.frustumCulled = false;
      canopyMesh.renderOrder = 2;
      canopyMesh.visible = false;
      scene.add(canopyMesh);
    }

    // labels for the limbs; a column with room between its nodes lets a long title take two lines
    const dpr = renderer.getPixelRatio();
    const roomy = (col: Point[]) => col.length < 2 || col[1].y - col[0].y >= (narrow ? 50 : 60);
    labelSprites.forEach((s, k) => {
      const limb = limbs[k];
      if (!limb) {
        s.mesh.visible = false;
        return;
      }
      const sp: LabelSprite = drawBranchLabel(
        limb.branch,
        {
          maxW: frame.labelMaxW,
          dpr,
          narrow,
          align: limb.side === "left" ? "right" : "left",
          fonts,
          songLines: roomy(limb.side === "left" ? frame.left : frame.right) ? 2 : 1,
        },
        s.tex ?? undefined,
      );
      s.tex = sp.tex;
      s.w = sp.w;
      s.h = sp.h;
      s.mesh.material.map = sp.tex;
      s.mesh.material.needsUpdate = true;
      s.key = limb.side;
    });
    labelGap = frame.labelGap;
    applyBranchColors();
  }
  let labelGap = 10;

  function applyBranchColors() {
    LANES.forEach((spec, i) => {
      const mine = !!branchInfo?.find((b) => b.lane === spec.lane)?.mine;
      const c = mine ? trunkColor : inkColor;
      uCol[i + 1].set(c.r, c.g, c.b, mine ? 2.2 : 1);
    });
  }

  const tmpV = new Vector3();
  function project(p: Vector3): Point {
    tmpV.copy(p).project(camera);
    return { x: ((tmpV.x + 1) / 2) * width, y: ((1 - tmpV.y) / 2) * height };
  }

  // ---------- flight state ----------
  const inverseEase = makeInverseEase();
  let mode: Mode = "idle";
  let freeze: number | null = opts.freeze;
  let targetIdx = -1;
  let d0 = 0;
  let d1 = 0;
  let dur = 2.6;
  let t0 = 0;
  let fadeStart: number | null = null;
  let idleStart = now();
  let preloadStart = 0;
  let camD = 0;
  let speed = 0;
  let lastShown = -1;
  let launchToken = 0;
  let arrivedNotified = false;

  function now() {
    return performance.now();
  }

  function distanceForProgress(p: number) {
    return d0 + (d1 - d0) * ease(p);
  }

  /** Camera speed (units/s) when it passes path week `week` on the current flight. */
  function passingSpeed(week: number): number {
    const span = d1 - d0;
    if (!span) return 0;
    const f = (week * SP - d0) / span;
    if (f >= 1) return 0;
    if (f <= 0) return (Math.abs(span) * easeVelocity(0)) / dur;
    return (easeVelocity(inverseEase(f)) * Math.abs(span)) / dur;
  }

  function planFlight(from: number): number {
    d0 = from;
    d1 = targetIdx * SP;
    const fromWeek = Math.max(0, Math.min(total - 1, Math.round(d0 / SP)));
    dur =
      Math.abs(d1 - d0) < SP
        ? 1.6
        : flightDuration(yearsBetween(data.dates[fromWeek], data.dates[Math.max(0, targetIdx)]));
    return fromWeek;
  }

  function songsForWeeks(fromWeek: number, n: number): number[] {
    const out: number[] = [];
    const a = Math.max(0, Math.floor(fromWeek));
    for (let i = a; i < Math.min(total, a + n); i++) out.push(data.song[i]);
    return out;
  }

  /** The tree is on screen from the first frame; covers fade in as they arrive. */
  function beginFade(at: number) {
    if (fadeStart === null) fadeStart = reduced || freeze !== null ? at - FADE_MS : at;
  }

  function setTarget(date: string | null) {
    const token = ++launchToken;
    arrivedNotified = false;
    lastShown = -1;
    beginFade(now());
    if (!date) {
      targetIdx = -1;
      targetRun = -1;
      dest.visible = false;
      if (canopyMesh) canopyMesh.visible = false;
      mode = "idle";
      idleStart = now() - (camD / IDLE_SPEED) * 1000; // drift on from wherever the camera is
      d0 = d1 = 0;
      requestRender();
      return;
    }
    targetIdx = targetIndex(data, date);
    targetRun = data.runOf[targetIdx];
    destY = -targetIdx * SP;
    destReadyAt = -1;
    planKey = "";
    const fromWeek = planFlight(freeze !== null ? 0 : camD);
    store.large600(data.song[targetIdx]);
    planLanding();
    if (reduced || freeze !== null) {
      // reduced motion lands at once; a frozen frame needs no launch, only its own window
      mode = "flying";
      t0 = now() - (reduced ? dur * 1000 : 0);
      requestRender();
      return;
    }
    // keep drifting while the first covers load (a shared link opened cold), then launch from there
    mode = "preload";
    preloadStart = now();
    const startD = camD;
    const warm = stamp > 2 && store.size >= 8;
    store.preload(songsForWeeks(fromWeek, START_PRELOAD), warm ? 0 : PRELOAD_TIMEOUT_MS).then(() => {
      if (disposed || token !== launchToken) return;
      planFlight(Math.max(startD, camD));
      mode = "flying";
      t0 = now();
      requestRender();
    });
    requestRender();
  }

  function skip() {
    if (mode === "flying" || mode === "preload") {
      launchToken++;
      if (mode === "preload") planFlight(camD);
      mode = "flying";
      t0 = now() - dur * 1000;
      requestRender();
    }
  }

  function setFreeze(p: number | null) {
    freeze = p === null || !Number.isFinite(p) ? null : Math.max(0, Math.min(1, p));
    if (freeze !== null && targetIdx >= 0) planFlight(0);
    requestRender();
  }

  function setBranches(b: FlightBranch[] | undefined) {
    branchInfo = b;
    planKey = "";
    planLanding();
    applyBranchColors();
    requestRender();
  }
  applyBranchColors();

  // ---------- layout ----------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (w === width && h === height) return;
    width = w;
    height = h;
    narrow = w < 640;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 640 ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ortho.right = w;
    ortho.top = h;
    ortho.updateProjectionMatrix();
    colorUniforms.uLaneScale.value = narrow ? 0.55 : 1;
    colorUniforms.uBraid.value = narrow ? 0.7 : 1;
    const focal = Math.hypot(RIDE_HD, RIDE_H);
    rideCover = 0.2 * 2 * focal * Math.tan((FOV / 2) * (Math.PI / 180)) * camera.aspect;
    slots.invalidate();
    for (const s of yearSprites) s.key = "";
    planKey = "";
    planLanding();
    requestRender();
  }

  // ---------- camera ----------
  const look = new Vector3();
  const right = new Vector3(Math.cos(AZ), 0, -Math.sin(AZ));
  const ride = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, roll: 0 };
  /** Ride pose: three-quarter side view above the focal week, looking down the trunk. */
  function ridePose(d: number, t: number) {
    const y = -d;
    ride.px = spineX(y) + Math.sin(AZ) * RIDE_HD;
    ride.py = y + RIDE_H;
    ride.pz = spineZ(y) + Math.cos(AZ) * RIDE_HD;
    const ly = y - LOOK_DROP;
    ride.lx = spineX(ly);
    ride.ly = ly;
    ride.lz = spineZ(ly);
    ride.roll = Math.sin(d * 0.011 + t * 0.2) * 0.022;
  }

  // ---------- frame ----------
  let raf = 0;
  let hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
  let hiddenAt = now();
  let firstFrameMarked = false;
  let lastPending = -1;
  let lastState = "";

  function requestRender() {
    if (disposed || hidden || raf) return;
    raf = requestAnimationFrame(frame);
  }

  function setState(s: string) {
    if (s !== lastState) {
      lastState = s;
      canvas.dataset.state = s;
    }
  }

  const camQ = new Vector3();
  function frame(ts: number) {
    raf = 0;
    if (disposed || hidden) return;
    stamp++;
    const t = ts || now();
    let p = 0;
    let continuous = false;
    let fadeTarget = 1;
    const idleCycle = (IDLE_WEEKS * SP) / IDLE_SPEED;

    if (freeze !== null && targetIdx >= 0) {
      p = freeze;
      camD = distanceForProgress(p);
      speed = warp(p, d1 - d0, dur);
    } else if (freeze !== null) {
      camD = freeze * IDLE_WEEKS * SP;
      speed = 0;
    } else if (mode === "idle") {
      if (!reduced) {
        const e = (((t - idleStart) / 1000) % idleCycle + idleCycle) % idleCycle;
        camD = e * IDLE_SPEED;
        fadeTarget = Math.min(1, (idleCycle - e) / IDLE_FADE_S, e / IDLE_FADE_S + (stamp < 3 ? 1 : 0));
        continuous = true;
      }
      speed *= 0.9;
    } else if (mode === "preload") {
      camD = d0 + (reduced ? 0 : ((t - preloadStart) / 1000) * IDLE_SPEED);
      speed = 0;
      continuous = true;
    } else if (mode === "flying") {
      p = Math.min(1, (t - t0) / (dur * 1000));
      camD = distanceForProgress(p);
      speed = warp(p, d1 - d0, dur);
      continuous = true;
      if (p >= 1) mode = "arrived";
    } else {
      p = 1;
      camD = d1;
      speed *= 0.9;
      if (speed > 0.01) continuous = true;
    }
    const landing = targetIdx >= 0 && mode !== "idle" && mode !== "preload" ? smooth(0.6, 1, p) : 0;

    let fade = fadeStart === null ? 0 : Math.min(1, Math.max(0, (t - fadeStart) / FADE_MS));
    if (fade < 1 && fadeStart !== null) continuous = true;
    fade = Math.min(fade, fadeTarget);
    const fs = fade * fade * (3 - 2 * fade);
    shared.uFade.value = fs;
    const fNear = lerp(FOG_RIDE[0], FOG_FINAL[0], landing);
    const fFar = lerp(FOG_RIDE[1], FOG_FINAL[1], landing);
    shared.uFogNear.value = fNear;
    shared.uFogFar.value = fFar;
    fog.near = fNear * fs;
    fog.far = Math.max(fog.near + 0.01, fFar * fs);
    shared.uCut.value = destY;
    shared.uCutK.value = landing;
    // pulled back, 48 strands land on a few pixels: dim the braid so it stays a braid, not a bar
    uCol[0].w = 1 - (narrow ? 0.62 : 0.45) * landing;

    // camera: ride the trunk down, then dolly back and tilt up over the landing
    ridePose(camD, mode === "idle" ? (t - idleStart) / 1000 : 0);
    let { px, py, pz, lx, ly, lz } = ride;
    if (landing > 0) {
      const k = landing * landing * (3 - 2 * landing);
      px = lerp(px, finalPos.x, k);
      py = lerp(py, finalPos.y, k);
      pz = lerp(pz, finalPos.z, k);
      lx = lerp(lx, finalLook.x, k);
      ly = lerp(ly, finalLook.y, k);
      lz = lerp(lz, finalLook.z, k);
    }
    const roll = ride.roll * (1 - landing);
    camera.position.set(px, py, pz);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    look.set(lx, ly, lz);
    camera.lookAt(look);
    camera.fov = FOV + speed * 30;
    const rideShift = narrow ? 0 : RIDE_SHIFT_X;
    const kk = landing * landing * (3 - 2 * landing);
    applyShift(camera, lerp(rideShift, finalShift.x, kk), lerp(0, finalShift.y, kk));
    camera.updateMatrixWorld();

    // the window of weeks round the focal height (wider as the camera pulls back)
    const camWeek = Math.max(0, camD / SP);
    const wFrom = Math.max(0, Math.floor(camWeek) - BEHIND_WEEKS - Math.round(landing * 4));
    const wTo = Math.min(total - 1, Math.floor(camWeek) + AHEAD_WEEKS);
    const [r0, r1raw] = runsBetween(data, wFrom, wTo);
    const r1 = Math.min(r1raw, r0 + POOL_SIZE - 1, runs - 1);
    const count = r1 - r0 + 1;
    store.beginFrame(stamp);
    slots.sync(r0, count, placeNode);
    syncRings(wFrom, wTo);

    // textures: landing first, then what is just ahead, skipping runs passed at warp
    const flightLive = targetIdx >= 0 && (mode === "flying" || mode === "preload") && freeze === null;
    let wantedMissing = 0;
    if (targetIdx >= 0) {
      const [la, lb] = runsBetween(data, targetIdx - LANDING_BEHIND, targetIdx + LANDING_AHEAD);
      for (let r = la; r <= lb; r++) if (!store.want(data.song[data.runStart[r]])) wantedMissing++;
    }
    for (let r = r0; r <= r1; r++) {
      const mid = (data.runStart[r] + data.runEnd[r]) / 2;
      if (mid < camWeek - BEHIND_WEEKS) continue;
      if (flightLive && passingSpeed(mid) > LOAD_SPEED) continue;
      if (!store.want(data.song[data.runStart[r]])) wantedMissing++;
    }
    store.pump();

    // covers: shown only once their texture is in (never an empty square), facing the camera,
    // pinned to the trunk; on desktop they sit just left of the braid so the braid stays visible
    const sideK = narrow ? 0 : 1 - landing;
    for (let k = 0; k < POOL_SIZE; k++) {
      const run = slots.weekOf[k];
      const m = nodes[k];
      if (run < 0 || run < r0 || run > r1 || (run === targetRun && targetIdx >= 0)) {
        m.visible = false;
        continue;
      }
      const tex = store.get(data.song[data.runStart[run]]);
      if (!tex) {
        m.visible = false;
        continue;
      }
      if (nodeReadyAt[k] < 0) nodeReadyAt[k] = t;
      const u = m.material.uniforms;
      if (u.map.value !== tex) u.map.value = tex;
      const y = nodeY[k];
      const s = nodeSize[k];
      const q = s / (1 - 2 * NODE_INSET);
      const off = -(s / 2 + BRAID_R * colorUniforms.uBraid.value + 0.2) * sideK;
      m.position.set(spineX(y) + right.x * off, y, spineZ(y) + right.z * off);
      m.quaternion.copy(camera.quaternion);
      m.scale.set(q, q, 1);
      m.updateMatrix();
      const appear = Math.min(1, (t - nodeReadyAt[k]) / 220);
      if (appear < 1) continuous = true;
      // fade the covers above the landed week: the canopy grows there, and none may sit over the landed cover
      const op = appear * (landing > 0 ? 1 - landing * smooth(destY - 0.05, destY + 0.6, y) : 1);
      u.uOpacity.value = op;
      m.material.depthWrite = op > 0.98; // a fading cover must not punch a hole in what is behind it
      m.visible = op > 0.004;
    }
    if (targetIdx >= 0) {
      const song = data.song[targetIdx];
      const tex = store.large600(song) ?? store.get(song);
      if (tex) {
        if (destReadyAt < 0) destReadyAt = t;
        destMat.uniforms.map.value = tex;
        const s = lerp(rideCover * 1.1, finalDestSize, landing);
        const q = s / (1 - 2 * NODE_INSET);
        const off = -(s / 2 + BRAID_R * colorUniforms.uBraid.value + 0.2) * sideK;
        dest.position.set(spineX(destY) + right.x * off, destY, spineZ(destY) + right.z * off);
        dest.quaternion.copy(camera.quaternion);
        dest.scale.set(q, q, 1);
        dest.updateMatrix();
        const appear = Math.min(1, (t - destReadyAt) / 220);
        if (appear < 1) continuous = true;
        destMat.uniforms.uOpacity.value = appear;
        destMat.uniforms.uBright.value = 0.75 + 0.25 * landing;
        destMat.uniforms.uEdgeA.value = 0.5 + 0.5 * landing;
        // far off it fades like any cover; landed, it is lit
        destMat.uniforms.uFogK.value = 1 - landing;
        dest.visible = true;
      } else dest.visible = false;
    }

    // the tree and its particles follow the camera
    const top = Math.max(-camD, -camD + 6) + landing * 4;
    threadMat.uniforms.uY0.value = Math.ceil((top + 6) / THREAD_SEG) * THREAD_SEG;
    threadMat.uniforms.uPxK.value = (2 * Math.tan(((camera.fov / 2) * Math.PI) / 180)) / Math.max(1, height);
    particleMat.uniforms.uTop.value = -camD + 5;
    particleMat.uniforms.uFlow.value = (mode === "idle" || mode === "preload") && freeze === null ? ((t / 1000) * 1.4) % PARTICLE_WIN : 0;
    particleMat.uniforms.uLen.value = 0.08 + speed * 4.5;
    particleMat.uniforms.uWarp.value = speed;
    if (canopyMesh) {
      const grow = smooth(0.35, 0.97, landing);
      canopyMat.uniforms.uGrow.value = grow * 1.05;
      canopyMesh.visible = grow > 0.001;
    }

    // passing readout
    if (targetIdx >= 0) {
      const raw = Math.round(camD / SP);
      const shown = d1 >= d0 ? Math.min(targetIdx, raw) : Math.max(targetIdx, raw);
      const i = mode === "arrived" ? targetIdx : Math.max(0, Math.min(total - 1, shown));
      if (i !== lastShown && mode !== "preload") {
        lastShown = i;
        opts.onPassing?.(passingAt(data, i));
      }
    }

    // overlay: year labels beside their rings (small, never in the top 20%), branch labels on landing
    let overlayOn = false;
    const yearA = (1 - landing) * fs;
    rings.forEach((r, k) => {
      const s = yearSprites[k];
      if (r.ordinal < 0 || yearA < 0.01) {
        s.mesh.visible = false;
        return;
      }
      drawYear(s, r.year);
      const reach = RING_R + 0.12;
      camQ.set(spineX(r.y) + right.x * reach, r.y, spineZ(r.y) + right.z * reach);
      tmpV.copy(camQ).project(camera);
      const sx = ((tmpV.x + 1) / 2) * width;
      const sy = ((1 - tmpV.y) / 2) * height;
      const behind = tmpV.z >= 1;
      let x = sx + 6;
      if (x + s.w > width - 16) {
        // no room to the right of the ring: sit to its left
        tmpV.set(spineX(r.y) - right.x * reach, r.y, spineZ(r.y) - right.z * reach).project(camera);
        x = ((tmpV.x + 1) / 2) * width - 6 - s.w;
      }
      const ok = !behind && sy > height * 0.2 + s.h && sy < height - s.h && x > 16 && x + s.w < width - 16;
      if (!ok) {
        s.mesh.visible = false;
        return;
      }
      // fade with depth like the ring it belongs to
      const depth = camQ.distanceTo(camera.position);
      const fogA = 1 - smooth(fNear, fFar, depth);
      s.mesh.scale.set(s.w, s.h, 1);
      s.mesh.position.set(x + s.w / 2, height - sy, 0);
      s.mesh.material.opacity = yearA * fogA;
      s.mesh.visible = fogA > 0.02;
      overlayOn ||= s.mesh.visible;
    });
    const labelA = smooth(0.84, 1, landing) * fs;
    labelSprites.forEach((s, k) => {
      const limb = limbs[k];
      if (!limb || labelA < 0.01 || !s.tex) {
        s.mesh.visible = false;
        return;
      }
      const at = project(limb.node);
      const x = limb.side === "left" ? at.x - labelGap - s.w : at.x + labelGap;
      s.mesh.scale.set(s.w, s.h, 1);
      s.mesh.position.set(x + s.w / 2, height - at.y, 0);
      s.mesh.material.opacity = labelA;
      s.mesh.visible = true;
      overlayOn = true;
      const mine = !!limb.branch.mine;
      const c = mine ? trunkColor : inkColor;
      dotPos.set([at.x, height - at.y, 0], k * 3);
      dotCol.set([c.r, c.g, c.b], k * 3);
    });
    dots.visible = labelA > 0.01 && limbs.length > 0;
    if (dots.visible) {
      dotGeo.setDrawRange(0, limbs.length);
      dotGeo.attributes.position.needsUpdate = true;
      dotGeo.attributes.color.needsUpdate = true;
      dotMat.opacity = labelA;
    }

    renderer.clear();
    renderer.render(scene, camera);
    if (overlayOn) {
      renderer.clearDepth();
      renderer.render(overlay, ortho);
    }

    if (!firstFrameMarked) {
      firstFrameMarked = true;
      canvas.dataset.firstFrame = String(Math.round(now()));
    }
    // pending = covers still loading for this view, the destination cover, or the fade-in
    const pendingNow = wantedMissing + (targetIdx >= 0 && !dest.visible ? 1 : 0) + (fade < 1 ? 1 : 0);
    if (pendingNow !== lastPending) {
      lastPending = pendingNow;
      canvas.dataset.pending = String(pendingNow);
    }
    setState(freeze !== null ? "frozen" : mode);

    if (mode === "arrived" && !arrivedNotified && freeze === null) {
      arrivedNotified = true;
      opts.onArrive?.();
    }

    // sleeves are drawn a few per frame: keep going until the window is complete
    if (continuous || store.throttled) requestRender();
  }

  // ---------- environment ----------
  const onResize = () => resize();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      hidden = true;
      hiddenAt = now();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else if (hidden) {
      hidden = false;
      const gap = now() - hiddenAt;
      // resume where it paused rather than jumping; anything started while hidden starts now
      const resume = (x: number) => (x <= hiddenAt ? x + gap : now());
      if (mode === "flying") t0 = resume(t0);
      if (mode === "idle") idleStart += gap;
      if (mode === "preload") preloadStart += gap;
      if (fadeStart !== null) fadeStart = resume(fadeStart);
      requestRender();
    }
  };
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(onResize);
    ro.observe(canvas);
  }

  // fonts: draw with what is there now, redraw sleeves and labels once Archivo lands
  awaitFonts(2500).then(() => {
    if (disposed) return;
    fonts = canvasFonts();
    for (const s of yearSprites) s.key = "";
    store.refreshSleeves();
    planKey = "";
    planLanding();
    requestRender();
  });

  resize();
  // compile every program now, not on first use mid-flight (a phone stalls on a shader compile)
  {
    const warmTex = yearLabelTexture();
    const hiddenNow: Array<{ visible: boolean }> = [nodes[0], dest, rings[0].ring, dots, labelSprites[0].mesh];
    const was = hiddenNow.map((o) => o.visible);
    hiddenNow.forEach((o) => (o.visible = true));
    nodes[0].material.uniforms.map.value = warmTex;
    destMat.uniforms.map.value = warmTex;
    labelSprites[0].mesh.material.map = warmTex;
    const warmCanopy = new Mesh(new PlaneGeometry(0.01, 0.01), canopyMat);
    warmCanopy.geometry.setAttribute("aSide", new BufferAttribute(new Float32Array(4), 1));
    warmCanopy.geometry.setAttribute("aT", new BufferAttribute(new Float32Array(4), 1));
    warmCanopy.geometry.setAttribute("aCi", new BufferAttribute(new Float32Array(4), 1));
    scene.add(warmCanopy);
    renderer.compile(scene, camera);
    renderer.compile(overlay, ortho);
    scene.remove(warmCanopy);
    warmCanopy.geometry.dispose();
    hiddenNow.forEach((o, k) => (o.visible = was[k]));
    nodes[0].material.uniforms.map.value = blank;
    destMat.uniforms.map.value = blank;
    labelSprites[0].mesh.material.map = null;
    warmTex.dispose();
  }
  setTarget(opts.target);

  function dispose() {
    disposed = true;
    launchToken++;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    ro?.disconnect();
    store.dispose();
    blank.dispose();
    for (const m of nodes) m.material.dispose();
    destMat.dispose();
    quadGeo.dispose();
    threadGeo.dispose();
    threadMat.dispose();
    particleGeo.dispose();
    particleMat.dispose();
    canopyMesh?.geometry.dispose();
    canopyMat.dispose();
    ringGeo.dispose();
    ringMat.dispose();
    for (const s of [...yearSprites, ...labelSprites]) {
      s.tex?.dispose();
      s.mesh.material.dispose();
    }
    dotGeo.dispose();
    dotMat.dispose();
    scene.clear();
    overlay.clear();
    renderer.dispose();
  }

  return { setTarget, setFreeze, setBranches, skip, dispose };
}
