/**
 * The flight, composed as a timeline tree ("low-key Sacred Timeline"),
 * travelled from inside.
 *
 * - Time runs along -z. The camera rides inside the tree's volume, just off
 *   the trunk's spine, travelling into the past; the trunk's red strands
 *   (a loose helix, radius 2–6) sweep past near the lens.
 * - Each #1 RUN's cover is pinned to the trunk at its week, facing the camera,
 *   so covers come out of depth, pass close to the lens and go behind: the
 *   Time Machine stack.
 * - Each genre chart leaves the trunk in the week it began and splits 3–5 ways
 *   at its own angles and lengths (tree.ts).
 * - Arrival: the camera travels out along the destination week's branch, then
 *   pulls back and tilts so the tree stands upright in frame (present up),
 *   only the destination branch lit red, its cover in a thin red frame, the
 *   other charts' branches labelled in the space the page's HUD leaves free.
 *   It keeps drifting slowly while it holds.
 * - `pending` (the visitor pressed Go, the song is still resolving) starts the
 *   camera accelerating into the past; the flight picks up from there.
 *
 * Budget: POOL_SIZE cover meshes recycled as the camera passes (pool.ts),
 * proximity texture loading through an LRU (textures.ts), every strand of the
 * tree in ONE draw call (curves evaluated in the vertex shader over a sliding
 * window), pooled rings, no lights, no shadows, no post-processing, nothing
 * rendered while the tab is hidden.
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
  Quaternion,
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
import { ease, flightDuration, warp, yearsBetween } from "./easing";
import { flightPlan, prerollPlan } from "./plan";
import { firstGateAtOrAfter, passingAt, runsBetween, targetIndex, type FlightData, type PassingWeek } from "./data";
import { POOL_SIZE, SlotTable, slotOf } from "./pool";
import { buildThreads, GLSL_TREE, groupAt, hash, LANES, presence, SP, spineX, spineY, type Thread } from "./tree";
import {
  canopyFrame,
  drawBranchLabel,
  hudZones,
  labelBox,
  PHONE_MAX_LABELS,
  pickBranches,
  shortLabel,
  type FlightBranch,
  type Point,
  type Rect,
} from "./labels";
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
const IDLE_SPEED = 0.7; // units per second
const IDLE_SPAN = 156 * SP; // the most recent ~3 years
const FADE_MS = 360;
const IDLE_FADE_S = 1.4;
const PRE_SPEED = 110; // units per second the camera reaches while a search resolves
const BLEND_S = 0.55; // pre-roll → flight hand-over
/** A cold shared link waits (drifting) up to this long for the first covers before it launches. */
const LAUNCH_WAIT_MS = 1600;
/** ...and launches early once the covers due in this much of the flight are 85% in. */
const LAUNCH_READY_MS = 2000;
/** A search that resolves mid pre-roll keeps falling back up to this long for its first covers. */
const PRE_GATE_MS = 700;
const PRE_READY_MS = 1500;
const BEHIND_WEEKS = 2;
const AHEAD_WEEKS = 80;
const LANDING_BEHIND = 8;
const LANDING_AHEAD = 30;
const THREAD_WIN = 104;
const THREAD_SEG = 0.5;
const PARTICLE_WIN = 90;
const NODE_INSET = 0.05;
const COVER = 0.92; // cover width (world units)
const RING_R = 1.85;

// ride camera: inside the trunk, off its spine, looking down the time axis
const OFF_X = 1.45;
const OFF_Y = 0.6;
const LOOK_AHEAD = 16;
const FOG_RIDE: [number, number] = [6, 82];
const FOG_FINAL: [number, number] = [28, 150];

type Mode = "idle" | "preroll" | "return" | "preload" | "flying" | "arrived";

export interface TunnelOptions {
  canvas: HTMLCanvasElement;
  data: FlightData;
  target: string | null;
  freeze: number | null;
  pending?: boolean;
  branches?: FlightBranch[];
  onPassing?: (w: PassingWeek) => void;
  onArrive?: () => void;
}

export interface Tunnel {
  setTarget(date: string | null): void;
  setFreeze(p: number | null): void;
  setBranches(b: FlightBranch[] | undefined): void;
  setPending(p: boolean): void;
  skip(): void;
  dispose(): void;
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
attribute vec4 aD;
uniform vec4 uCol[NC];
`;

const THREAD_VERT = /* glsl */ `
${STRAND_ATTRS}
uniform float uZ0;
uniform float uWin;
uniform float uPxK;
attribute float aS;
attribute float aSide;
varying float vSide;
varying float vI;
varying vec3 vCol;
varying float vDepth;
varying float vZ;
${GLSL_TREE}
void main() {
  float z = uZ0 - aS * uWin;
  vZ = z;
  float vis; float vis2;
  vec3 P = strandPos(aA, aB, aC, aD, z, vis);
  vec3 Q = strandPos(aA, aB, aC, aD, z - 0.4, vis2);
  vec4 mvP = modelViewMatrix * vec4(P, 1.0);
  vec4 mvQ = modelViewMatrix * vec4(Q, 1.0);
  vec3 side = cross(normalize(mvQ.xyz - mvP.xyz), normalize(mvP.xyz));
  float sl = length(side);
  side = sl > 1e-5 ? side / sl : vec3(1.0, 0.0, 0.0);
  float depth = max(0.05, -mvP.z);
  float halfW = max(0.0025, aD.z * uPxK * depth);
  mvP.xyz += side * aSide * halfW;
  gl_Position = projectionMatrix * mvP;
  vSide = aSide;
  vDepth = depth;
  int ci = int(aD.w + 0.5);
  vCol = uCol[ci].rgb;
  // strands right at the lens are only a soft sweep, never a bar across the frame
  vI = aD.y * uCol[ci].w * vis * smoothstep(0.25, 1.4, depth);
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
varying float vZ;
void main() {
  float d = abs(vSide);
  float core = 1.0 - smoothstep(0.22, 0.42, d);
  float glow = exp(-d * d * 6.0) * 0.34;
  float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
  // landed: the tree after the destination week dims, so the landed moment is the crown
  float cut = 1.0 - uCutK * 0.82 * smoothstep(uCut + 0.5, uCut + 5.0, vZ);
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
varying float vZ;
varying float vSide;
${GLSL_TREE}
void main() {
  float zz = uTop - mod(aSeed + uTop + uFlow, uPWin);
  float z = zz - aEnd * uLen;
  vZ = z;
  vSide = 0.0;
  float vis;
  vec3 P = strandPos(aA, aB, aC, aD, z, vis);
  vec4 mv = modelViewMatrix * vec4(P, 1.0);
  gl_Position = projectionMatrix * mv;
  vDepth = -mv.z;
  int ci = int(aD.w + 0.5);
  vCol = uCol[ci].rgb;
  vI = vis * (aD.y * 1.5 + 0.2) * uCol[ci].w * (aEnd > 0.5 ? 0.25 : 1.0) * smoothstep(0.6, 3.0, vDepth);
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
varying float vZ;
varying float vSide;
void main() {
  float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
  float cut = 1.0 - uCutK * smoothstep(uCut + 0.5, uCut + 5.0, vZ);
  float i = vI * fog * uFade * cut * (0.25 + 0.75 * uWarp);
  if (i < 0.003) discard;
  gl_FragColor = vec4(vCol, i);
  #include <colorspace_fragment>
}
`;

// limbs drawn at landing: a polyline ribbon that faces whatever the camera is doing
const LIMB_VERT = /* glsl */ `
uniform vec4 uCol[NC];
uniform float uPxK;
uniform float uGrowA;
uniform float uGrowB;
attribute vec3 aNext;
attribute float aSide;
attribute float aT;
attribute float aCi;
attribute float aW;
attribute float aAlpha;
attribute float aStage;
varying float vSide;
varying float vI;
varying vec3 vCol;
varying float vDepth;
varying float vZ;
void main() {
  vec4 mvP = modelViewMatrix * vec4(position, 1.0);
  vec4 mvQ = modelViewMatrix * vec4(aNext, 1.0);
  vec3 side = cross(normalize(mvQ.xyz - mvP.xyz + vec3(1e-6)), normalize(mvP.xyz));
  float sl = length(side);
  side = sl > 1e-5 ? side / sl : vec3(1.0, 0.0, 0.0);
  float depth = max(0.05, -mvP.z);
  mvP.xyz += side * aSide * max(0.003, aW * uPxK * depth);
  gl_Position = projectionMatrix * mvP;
  vSide = aSide;
  vDepth = depth;
  vZ = -1e9;
  int ci = int(aCi + 0.5);
  vCol = uCol[ci].rgb;
  float grow = aStage < 0.5 ? uGrowA : uGrowB;
  vI = (1.0 - smoothstep(grow - 0.06, grow, aT)) * aAlpha;
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

// The cover with a thin flat edge (no glow): the quad holds the cover inset by uInset.
const NODE_FRAG = /* glsl */ `
uniform sampler2D map;
uniform sampler2D map2;
uniform float uMix;
uniform float uInset;
uniform float uLine;
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
  bool inside = q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0;
  vec2 out2 = max(vec2(0.0), max(-q, q - 1.0));
  float outside = length(out2);
  vec3 col;
  float a;
  if (inside) {
    // the slot's sleeve (map) crossfades to its art (map2) as the art arrives
    col = mix(texture2D(map, q).rgb, texture2D(map2, q).rgb, uMix) * uBright;
    a = 1.0;
  } else {
    // a flat frame just outside the art
    float frame = 1.0 - step(uLine, outside);
    col = uEdge;
    a = frame * uEdgeA;
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
  const camera = new PerspectiveCamera(FOV, 1, 0.08, 500);
  const solver = new PerspectiveCamera(FOV, 1, 0.08, 500); // plans the landing frame
  const overlay = new Scene();
  const ortho = new OrthographicCamera(0, 1, 1, 0, -10, 10);

  let width = -1;
  let height = -1;
  let narrow = (canvas.clientWidth || window.innerWidth) < 640;
  let fonts: CanvasFonts = canvasFonts();
  let disposed = false;
  let stamp = 0;
  let hud: Rect[] = [];

  const shared = {
    uFogNear: { value: FOG_RIDE[0] } as IUniform<number>,
    uFogFar: { value: FOG_RIDE[1] } as IUniform<number>,
    uFade: { value: 1 } as IUniform<number>,
    uCut: { value: 0 } as IUniform<number>,
    uCutK: { value: 0 } as IUniform<number>,
  };

  // ---------- colours: slot 0 trunk, 1..8 lanes, 9 offshoots, 10 the destination branch ----------
  const red = new Color(SIGNAL);
  const ink = new Color(INK);
  const NC = LANES.length + 3;
  const DEST_SLOT = LANES.length + 2;
  const uCol = Array.from({ length: NC }, (_, i) => {
    const c = i === 0 || i === DEST_SLOT ? red : ink;
    return new Vector4(c.r, c.g, c.b, 1);
  });
  const colorUniforms = { uCol: { value: uCol } };

  // ---------- the tree: one draw call ----------
  const threads: Thread[] = buildThreads(data);
  const NT = threads.length;
  const laneFork0 = new Map<string, Thread>();
  threads.forEach((t) => t.lane && t.fork === 0 && !laneFork0.has(t.lane) && laneFork0.set(t.lane, t));

  function strandAttributes(geo: BufferGeometry, threadOf: (v: number) => Thread, n: number) {
    const aA = new Float32Array(n * 4);
    const aB = new Float32Array(n * 4);
    const aC = new Float32Array(n * 4);
    const aD = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) {
      const t = threadOf(v);
      const o = v * 4;
      aA[o] = t.R;
      aA[o + 1] = t.ang0;
      aA[o + 2] = t.angPitch;
      aA[o + 3] = t.rAmp;
      aB[o] = t.rFreq;
      aB[o + 1] = t.rPhase;
      aB[o + 2] = t.sR;
      aB[o + 3] = t.sPhase;
      aC[o] = t.sPitch;
      aC[o + 1] = t.zStart;
      aC[o + 2] = t.spread;
      aC[o + 3] = t.zEnd;
      aD[o] = t.fadeLen;
      aD[o + 1] = t.alpha;
      aD[o + 2] = t.minPx;
      aD[o + 3] = t.color;
    }
    geo.setAttribute("aA", new BufferAttribute(aA, 4));
    geo.setAttribute("aB", new BufferAttribute(aB, 4));
    geo.setAttribute("aC", new BufferAttribute(aC, 4));
    geo.setAttribute("aD", new BufferAttribute(aD, 4));
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
  const pxK = { value: 0.001 } as IUniform<number>;
  const threadMat = new ShaderMaterial({
    defines: { NC },
    uniforms: { ...colorUniforms, uZ0: { value: 0 }, uWin: { value: THREAD_WIN }, uPxK: pxK, ...shared },
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
    const pick: Thread[] = [];
    for (let i = 0; i < 260; i++) pick.push(trunk[Math.floor(rand() * trunk.length)]);
    for (let i = 0; i < 220; i++) pick.push(lanes[Math.floor(rand() * lanes.length)]);
    const n = pick.length * 2;
    const aSeed = new Float32Array(n);
    const aEnd = new Float32Array(n);
    for (let p = 0; p < pick.length; p++) {
      aSeed[p * 2] = aSeed[p * 2 + 1] = rand() * PARTICLE_WIN;
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
  const particles = new LineSegments(particleGeo, particleMat);
  particles.frustumCulled = false;
  particles.renderOrder = 2;
  scene.add(particles);

  // ---------- cover nodes, one per #1 run, pooled ----------
  const store = new CoverStore(data, () => fonts, () => requestRender());
  const quadGeo = new PlaneGeometry(1, 1);
  type NodeMat = ShaderMaterial & { uniforms: Record<string, IUniform> };
  const blank = store.blank; // a plain sleeve: no slot is ever empty
  function nodeMaterial(edge: Color, edgeA: number, line: number): NodeMat {
    return new ShaderMaterial({
      uniforms: {
        map: { value: blank },
        map2: { value: blank },
        uMix: { value: 0 },
        uInset: { value: NODE_INSET },
        uLine: { value: line },
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
  const nodes: Mesh<PlaneGeometry, NodeMat>[] = [];
  const nodePos = Array.from({ length: POOL_SIZE }, () => new Vector3());
  const nodeSize = new Float32Array(POOL_SIZE);
  const nodeReadyAt = new Float64Array(POOL_SIZE).fill(-1);
  /** when the slot's art arrived (-Infinity: it was already in when the slot was placed) */
  const nodeArtAt = new Float64Array(POOL_SIZE).fill(-1);
  for (let k = 0; k < POOL_SIZE; k++) {
    const m = new Mesh(quadGeo, nodeMaterial(ink, 0.22, 0.012));
    m.matrixAutoUpdate = false;
    m.visible = false;
    m.renderOrder = 4;
    nodes.push(m);
    scene.add(m);
  }
  const slots = new SlotTable(POOL_SIZE);

  function placeNode(slot: number, run: number) {
    const a = data.runStart[run];
    const b = data.runEnd[run];
    const len = b - a + 1;
    const z = -((a + b) / 2) * SP;
    // pinned to the trunk at its week, a little off the spine so the stack is not a single file
    const j = run * 2.39996 + hash(run * 1.37) * 0.5; // golden-angle spiral round the spine
    const r = 0.75 + 0.45 * hash(run * 2.11);
    nodePos[slot].set(spineX(z) + Math.cos(j) * r, spineY(z) + Math.sin(j) * r, z);
    nodeSize[slot] = COVER * Math.min(1.25, 0.9 + 0.1 * Math.log2(len));
    nodeReadyAt[slot] = -1;
    nodeArtAt[slot] = store.has(data.song[a]) ? -Infinity : -1;
    nodes[slot].visible = false;
  }

  // ---------- destination: that week's #1 at 600×600, a thin flat red frame ----------
  const destMat = nodeMaterial(red, 1, 0.02);
  destMat.uniforms.uFogK.value = 0;
  const dest = new Mesh(quadGeo, destMat);
  dest.matrixAutoUpdate = false;
  dest.visible = false;
  dest.renderOrder = 5;
  scene.add(dest);
  let destZ = 0;
  let targetRun = -1;
  let destReadyAt = -1;

  // ---------- year rings ----------
  const ringGeo = new RingGeometry(0.985, 1, 128, 1);
  const ringMat = new MeshBasicMaterial({
    color: red,
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: true,
    side: DoubleSide,
  });
  interface Ring {
    ring: Mesh;
    ordinal: number;
    year: string;
    z: number;
  }
  const rings: Ring[] = [];
  for (let k = 0; k < RING_POOL; k++) {
    const ring = new Mesh(ringGeo, ringMat);
    ring.matrixAutoUpdate = false;
    ring.visible = false;
    ring.renderOrder = 3;
    scene.add(ring);
    rings.push({ ring, ordinal: -1, year: "", z: 0 });
  }
  function hideRing(r: Ring) {
    r.ring.visible = false;
    r.ordinal = -1;
  }
  function placeRing(r: Ring, ordinal: number) {
    const i = data.gates[ordinal];
    const z = -i * SP + SP / 2;
    r.ordinal = ordinal;
    r.z = z;
    r.year = data.dates[i].slice(0, 4);
    r.ring.position.set(spineX(z), spineY(z), z);
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
  const dotMat = new PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthTest: false });
  const dots = new Points(dotGeo, dotMat);
  dots.frustumCulled = false;
  dots.renderOrder = 2;
  overlay.add(dots);

  function drawYear(s: Sprite, year: string) {
    const px = narrow ? 12 : 14;
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

  // ---------- landing plan ----------
  let branchInfo: FlightBranch[] | undefined = opts.branches;
  const destPos = new Vector3();
  const branchBase = new Vector3();
  const posA = new Vector3();
  const posF = new Vector3();
  const lookF = new Vector3();
  const qA = new Quaternion();
  const qF = new Quaternion();
  const shiftF = { x: 0, y: 0 };
  /** the landed cover's width as a fraction of the viewport width, in the final frame */
  let destScreenFrac = 0.1;
  interface Limb {
    lane: string;
    side: "left" | "right";
    node: Vector3;
    branch: FlightBranch;
  }
  let limbs: Limb[] = [];
  let limbMesh: Mesh<BufferGeometry, ShaderMaterial> | null = null;
  const limbMat = new ShaderMaterial({
    defines: { NC },
    uniforms: {
      uCol: colorUniforms.uCol,
      uPxK: pxK,
      uGrowA: { value: 0 },
      uGrowB: { value: 0 },
      uFogNear: { value: 1e4 },
      uFogFar: { value: 2e4 },
      uFade: shared.uFade,
      uCut: { value: 0 },
      uCutK: { value: 0 },
    },
    vertexShader: LIMB_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  let planKey = "";
  let labelGap = 10;

  function destinationBranches(): FlightBranch[] {
    const out: FlightBranch[] = [];
    for (const spec of LANES) {
      const t = laneFork0.get(spec.lane)!;
      if (presence(t, destZ) < 0.5) continue;
      const given = branchInfo?.find((b) => b.lane === spec.lane);
      const label = shortLabel(given?.label ?? "", spec.name, narrow);
      out.push(given ? { ...given, label } : { lane: spec.lane, label: spec.name });
    }
    return narrow ? pickBranches(out, PHONE_MAX_LABELS) : out;
  }

  function applyShift(cam: PerspectiveCamera, sx: number, sy: number) {
    cam.updateProjectionMatrix();
    cam.projectionMatrix.elements[8] = -sx;
    cam.projectionMatrix.elements[9] = -sy;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  /** The landing: where the destination branch goes, where the camera ends, and the labelled limbs. */
  function planLanding() {
    if (targetIdx < 0 || width <= 0) return;
    const list = destinationBranches();
    const key = `${targetIdx}|${width}x${height}|${JSON.stringify(list)}|${fonts.display}`;
    if (key === planKey) return;
    planKey = key;
    const T = new Vector3(spineX(destZ), spineY(destZ), destZ);
    const zhat = new Vector3(0, 0, 1);
    // the final camera sits on the side the ride camera was on; the branch points to its right
    const s = new Vector3(OFF_X, OFF_Y, 0).normalize();
    // looking back along -s with the present up, screen-right is (-s) × z: the branch points there
    const b = new Vector3().crossVectors(s.clone().negate(), zhat).normalize();
    // the branch runs from the trunk out to the landed cover; on a phone it reaches in from the left,
    // above the label columns, so it is not hidden behind the cover
    const Lb = narrow ? 8.5 : 6.5;
    const Hb = narrow ? 1.6 : 4.5;
    destPos.copy(T).addScaledVector(b, Lb).addScaledVector(zhat, Hb);
    branchBase.copy(T).addScaledVector(b, 0.6);
    const D = narrow ? 44 : 31;
    const el = narrow ? 0.5 : 0.42; // above the landed week, looking down the trunk into the past
    posF.copy(destPos).addScaledVector(s, D * Math.cos(el)).addScaledVector(zhat, D * Math.sin(el));
    lookF.copy(destPos);
    solver.aspect = width / height;
    solver.fov = FOV;
    solver.position.copy(posF);
    solver.up.copy(zhat);
    solver.lookAt(lookF);
    solver.updateMatrixWorld();
    qF.copy(solver.quaternion);
    const nl = narrow ? Math.floor(list.length / 2) : list.length - Math.round(list.length * 0.55);
    const frame = canopyFrame(nl, list.length - nl, { w: width, h: height, narrow }, targetIdx);
    shiftF.x = (frame.dest.x / width) * 2 - 1;
    shiftF.y = 1 - (frame.dest.y / height) * 2;
    applyShift(solver, shiftF.x, shiftF.y);
    const fwd = new Vector3(0, 0, -1).applyQuaternion(solver.quaternion);
    const zD = destPos.clone().sub(posF).dot(fwd);
    destScreenFrac = frame.destW / width;
    // out along the branch: back from it and looking across it, so the trunk, the red branch
    // growing out of it and the landed cover are in frame together (a phone's narrow view needs
    // to stand further back)
    const across = T.clone().lerp(destPos, 0.6);
    posA.copy(across).addScaledVector(s, narrow ? 19 : 10).addScaledVector(zhat, narrow ? 2.6 : 1.6);
    solver.position.copy(posA);
    solver.up.copy(zhat);
    solver.lookAt(across);
    qA.copy(solver.quaternion);
    // back to the final pose for the unprojections below
    solver.position.copy(posF);
    solver.lookAt(lookF);
    solver.updateMatrixWorld();
    applyShift(solver, shiftF.x, shiftF.y);
    const unproject = (p: Point) => {
      const r = new Vector3((p.x / width) * 2 - 1, 1 - (p.y / height) * 2, 0.5).unproject(solver).sub(posF).normalize();
      return posF.clone().addScaledVector(r, zD / r.dot(fwd));
    };

    // labelled limbs: each lane leaves from its branch at the landed week, leftmost lanes to the left column
    const anchors = list.map((br) => {
      const g = groupAt(laneFork0.get(br.lane)!, destZ);
      const a = new Vector3(g.x, g.y, g.z);
      return { br, a, sx: a.clone().project(solver).x, sy: a.clone().project(solver).y };
    });
    anchors.sort((p, q) => p.sx - q.sx);
    const leftSet = anchors.slice(0, nl).sort((p, q) => q.sy - p.sy);
    const rightSet = anchors.slice(nl).sort((p, q) => q.sy - p.sy);
    limbs = [
      ...leftSet.map((x, k) => ({ lane: x.br.lane, side: "left" as const, node: unproject(frame.left[k]), branch: x.br, a: x.a })),
      ...rightSet.map((x, k) => ({ lane: x.br.lane, side: "right" as const, node: unproject(frame.right[k]), branch: x.br, a: x.a })),
    ];

    // limb geometry: the red destination branch (stage 0) and the labelled lane limbs (stage 1)
    const pos: number[] = [];
    const nxt: number[] = [];
    const sideA: number[] = [];
    const tA: number[] = [];
    const ciA: number[] = [];
    const wA: number[] = [];
    const alA: number[] = [];
    const stA: number[] = [];
    const idx: number[] = [];
    const N = 48;
    const p0 = new Vector3();
    const p1 = new Vector3();
    const p2 = new Vector3();
    const p3 = new Vector3();
    const c = new Vector3();
    const tan = new Vector3();
    const nrm = new Vector3();
    const tmp = new Vector3();
    const bez = (t: number, out: Vector3) => {
      const u = 1 - t;
      return out.copy(p0).multiplyScalar(u * u * u).addScaledVector(p1, 3 * u * u * t).addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t);
    };
    let chordLen = 1;
    const strand = (seed: number, ci: number, alpha: number, wpx: number, stage: number, endT: number, spreadK: number) => {
      const pts: Vector3[] = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * endT;
        bez(t, c);
        bez(Math.min(1, t + 0.01), tmp);
        tan.copy(tmp).sub(c).normalize();
        nrm.copy(tan).cross(fwd).normalize();
        // strands of one limb split apart toward its end, in proportion to its length (no loops)
        const spread = (hash(seed) - 0.5) * 2 * spreadK * chordLen * 0.07 * Math.pow(t, 1.3);
        c.addScaledVector(nrm, spread);
        pts.push(c.clone());
      }
      const base = pos.length / 3;
      for (let i = 0; i <= N; i++) {
        const p = pts[i];
        const q = pts[Math.min(N, i + 1)];
        const qq = i === N ? p.clone().add(p.clone().sub(pts[N - 1])) : q;
        for (const sd of [-1, 1]) {
          pos.push(p.x, p.y, p.z);
          nxt.push(qq.x, qq.y, qq.z);
          sideA.push(sd);
          tA.push(i / N);
          ciA.push(ci);
          wA.push(wpx);
          alA.push(alpha);
          stA.push(stage);
        }
        if (i < N) {
          const a = base + i * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    };
    // the destination branch: four red strands out of the trunk to the landed cover
    p0.copy(branchBase);
    p3.copy(destPos);
    p1.copy(T).addScaledVector(b, Lb * 0.45).addScaledVector(zhat, Hb * 0.05);
    p2.copy(destPos).addScaledVector(b, -Lb * 0.2).addScaledVector(zhat, -Hb * 0.45);
    chordLen = destPos.distanceTo(branchBase);
    for (let j = 0; j < 5; j++) strand(31 + j * 7.7, DEST_SLOT, 0.7 + 0.3 * hash(j + 3), 1.8 + 1.6 * hash(j + 9), 0, 1, 0.45);
    // the other charts at that week: each limb rises out of its branch and reaches its label, splitting as it goes
    limbs.forEach((limb, li) => {
      const a = (limb as Limb & { a: Vector3 }).a;
      const L = a.distanceTo(limb.node);
      const h = (o: number) => hash(targetIdx * 0.37 + li * 9.1 + o);
      p0.copy(a);
      p3.copy(limb.node);
      // a limb leaves its branch and bows out to its label: control points along the chord, bowed sideways
      const chord = tmp.copy(limb.node).sub(a);
      const bow = new Vector3().crossVectors(chord, fwd).normalize().multiplyScalar(L * (0.08 + 0.14 * h(1)) * (h(2) < 0.5 ? -1 : 1));
      p1.copy(a).addScaledVector(chord, 0.3 + 0.08 * h(3)).add(bow);
      p2.copy(a).addScaledVector(chord, 0.7 + 0.08 * h(4)).addScaledVector(bow, 0.6);
      chordLen = L;
      const ci = LANES.findIndex((l) => l.lane === limb.lane) + 1;
      const n = 2 + Math.floor(h(5) * 2);
      for (let j = 0; j < n; j++) strand(li * 13 + j * 3.3, ci, 0.35 + 0.35 * h(6 + j), 0.9 + 1.3 * h(9 + j), 1, j === 0 ? 1 : 0.55 + 0.4 * h(12 + j), 0.8 + 0.6 * h(15));
    });
    if (limbMesh) {
      limbMesh.geometry.dispose();
      scene.remove(limbMesh);
      limbMesh = null;
    }
    if (pos.length) {
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
      g.setAttribute("aNext", new BufferAttribute(new Float32Array(nxt), 3));
      g.setAttribute("aSide", new BufferAttribute(new Float32Array(sideA), 1));
      g.setAttribute("aT", new BufferAttribute(new Float32Array(tA), 1));
      g.setAttribute("aCi", new BufferAttribute(new Float32Array(ciA), 1));
      g.setAttribute("aW", new BufferAttribute(new Float32Array(wA), 1));
      g.setAttribute("aAlpha", new BufferAttribute(new Float32Array(alA), 1));
      g.setAttribute("aStage", new BufferAttribute(new Float32Array(stA), 1));
      g.setIndex(idx);
      limbMesh = new Mesh(g, limbMat);
      limbMesh.frustumCulled = false;
      limbMesh.renderOrder = 2;
      limbMesh.visible = false;
      scene.add(limbMesh);
    }

    // labels for the limbs: one line, unless the title would be cut and there is room in its column
    // for a second (balanced) line; columns are top → bottom, so the room above is already known
    const dpr = renderer.getPixelRatio();
    labelRects = [];
    for (const side of ["left", "right"] as const) {
      const col = side === "left" ? frame.left : frame.right;
      const ks = limbs.map((l, k) => (l.side === side ? k : -1)).filter((k) => k >= 0);
      let prevBottom = -Infinity;
      ks.forEach((k, j) => {
        const limb = limbs[k];
        const sp = labelSprites[k];
        const node = col[j];
        const optsFor = (lines: 1 | 2) => ({
          maxW: frame.labelMaxW,
          dpr,
          narrow,
          align: (side === "left" ? "right" : "left") as "left" | "right",
          fonts,
          songLines: lines,
        });
        let drawn = drawBranchLabel(limb.branch, optsFor(1), sp.tex ?? undefined);
        if (drawn.cut) {
          const nextTop = j + 1 < col.length ? col[j + 1].y - (narrow ? 16 : 20) : height * (narrow ? 0.53 : 0.72);
          const two = drawBranchLabel(limb.branch, optsFor(2), drawn.tex);
          const fits = node.y - two.h / 2 >= prevBottom + 3 && node.y + two.h / 2 <= nextTop - 3;
          drawn = fits ? two : drawBranchLabel(limb.branch, optsFor(1), two.tex);
        }
        prevBottom = node.y + drawn.h / 2;
        sp.tex = drawn.tex;
        sp.w = drawn.w;
        sp.h = drawn.h;
        sp.mesh.material.map = drawn.tex;
        sp.mesh.material.needsUpdate = true;
        labelRects.push(labelBox(node, side, drawn.w, drawn.h, frame.labelGap));
      });
    }
    for (let k = limbs.length; k < labelSprites.length; k++) labelSprites[k].mesh.visible = false;
    labelGap = frame.labelGap;
  }
  let labelRects: Rect[] = [];

  function applyMine() {
    LANES.forEach((spec, i) => {
      const mine = !!branchInfo?.find((b) => b.lane === spec.lane)?.mine;
      uCol[i + 1].set(ink.r, ink.g, ink.b, mine ? 1.8 : 1);
    });
  }

  const tmpV = new Vector3();
  function project(p: Vector3): Point {
    tmpV.copy(p).project(camera);
    return { x: ((tmpV.x + 1) / 2) * width, y: ((1 - tmpV.y) / 2) * height };
  }
  /** Fraction of a screen rect covered by any of `rects`. */
  function rectsOverlap(rects: Rect[], x0: number, y0: number, x1: number, y1: number): number {
    const area = Math.max(1, (x1 - x0) * (y1 - y0));
    let o = 0;
    for (const z of rects) {
      const w = Math.min(x1, z.x1) - Math.max(x0, z.x0);
      const h = Math.min(y1, z.y1) - Math.max(y0, z.y0);
      if (w > 0 && h > 0) o += w * h;
    }
    return Math.min(1, o / area);
  }
  /** Fraction of a screen rect that falls in the page's HUD zones. */
  function hudOverlap(x0: number, y0: number, x1: number, y1: number): number {
    const area = Math.max(1, (x1 - x0) * (y1 - y0));
    let o = 0;
    for (const z of hud) {
      const w = Math.min(x1, z.x1) - Math.max(x0, z.x0);
      const h = Math.min(y1, z.y1) - Math.max(y0, z.y0);
      if (w > 0 && h > 0) o += w * h;
    }
    return Math.min(1, o / area);
  }

  // ---------- flight state ----------
  let mode: Mode = "idle";
  let freeze: number | null = opts.freeze;
  let targetIdx = -1;
  let d0 = 0;
  let d1 = 0;
  let dur = 2.6;
  let t0 = 0;
  let fadeStart: number | null = null;
  let idleStart = now();
  let idleBase = 0;
  let idleEnd = idleStart + (IDLE_SPAN / IDLE_SPEED) * 1000;
  let idleFadeIn = false;
  let preloadStart = 0;
  let preloadToken = 0;
  let prerollPlannedAt = -1;
  let targetAt = 0;
  let camD = 0;
  let vel = IDLE_SPEED;
  let preVel = 0;
  let blendFrom = 0;
  let speed = 0;
  let lastT = now();
  let lastShown = -1;
  let launchToken = 0;
  let arrivedNotified = false;
  let pending = !!opts.pending;
  let arrivedAt = 0;

  function now() {
    return performance.now();
  }

  function distanceForProgress(p: number) {
    return d0 + (d1 - d0) * ease(p);
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

  /** Fog limit the plan treats as "in view" (units ahead of the camera). */
  const VIEW_AHEAD = FOG_RIDE[1] * 0.9;
  const flightShape = () => ({ d0, d1, dur, sp: SP, targetIdx, landingBehind: LANDING_BEHIND, landingAhead: LANDING_AHEAD, viewAhead: VIEW_AHEAD });

  function startIdle(from: number, fadeIn: boolean) {
    mode = "idle";
    idleBase = from;
    idleStart = now();
    idleEnd = idleStart + Math.max(10, (IDLE_SPAN - from) / IDLE_SPEED) * 1000;
    idleFadeIn = fadeIn;
    vel = IDLE_SPEED;
  }

  function launch(token: number) {
    if (disposed || token !== launchToken) return;
    preVel = mode === "preroll" || mode === "return" || mode === "preload" ? vel : 0;
    blendFrom = camD;
    planFlight(camD);
    mode = "flying";
    t0 = now();
    store.plan(flightPlan(data, flightShape(), t0)); // re-timed for the real launch
    requestRender();
  }

  function setTarget(date: string | null) {
    const token = ++launchToken;
    arrivedNotified = false;
    lastShown = -1;
    if (fadeStart === null) fadeStart = now() - FADE_MS; // the first frame is already the tree, never black
    if (!date) {
      targetIdx = -1;
      targetRun = -1;
      dest.visible = false;
      if (limbMesh) limbMesh.visible = false;
      if (pending && !reduced && freeze === null) mode = "preroll";
      else if (mode !== "idle") mode = "return";
      requestRender();
      return;
    }
    targetIdx = targetIndex(data, date);
    targetRun = data.runOf[targetIdx];
    destZ = -targetIdx * SP;
    destReadyAt = -1;
    planKey = "";
    planFlight(freeze !== null ? 0 : camD);
    store.large600(data.song[targetIdx]);
    store.plan(flightPlan(data, flightShape(), now() + 300));
    planLanding();
    if (reduced || freeze !== null) {
      mode = "flying";
      t0 = now() - (reduced ? dur * 1000 : 0);
      preVel = 0;
      requestRender();
      return;
    }
    if (mode === "preroll" && d1 - camD > VIEW_AHEAD * 2) {
      // the search resolved mid pre-roll: keep falling back while the first covers of the path
      // arrive (the frame loop launches once they are in, or after PRE_GATE_MS), then fly on
      targetAt = now();
      preloadToken = token;
      requestRender();
      return;
    }
    if (mode === "preroll" || mode === "return" || (mode === "idle" && stamp > 2 && store.size >= 8)) {
      // already moving through a warm tree: carry straight on into the flight
      launch(token);
      return;
    }
    // a shared link opened cold: drift while the first ~2 s of the path's covers load (or the wait
    // runs out), then launch from there. The frame loop checks and launches.
    mode = "preload";
    preloadStart = now();
    preloadToken = token;
    requestRender();
  }

  function setPending(p: boolean) {
    pending = p;
    if (reduced || freeze !== null) return;
    if (p && targetIdx < 0 && (mode === "idle" || mode === "return")) {
      mode = "preroll";
      prerollPlannedAt = -1;
      requestRender();
    } else if (!p && targetIdx < 0 && mode === "preroll") {
      mode = "return";
      requestRender();
    }
  }

  function skip() {
    if (mode === "flying" || mode === "preload") {
      launchToken++;
      if (mode === "preload") planFlight(camD);
      mode = "flying";
      preVel = 0;
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
    applyMine();
    requestRender();
  }
  applyMine();

  // ---------- layout ----------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (w === width && h === height) return;
    width = w;
    height = h;
    narrow = w < 640;
    hud = hudZones(w, h, narrow);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 640 ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ortho.right = w;
    ortho.top = h;
    ortho.updateProjectionMatrix();
    slots.invalidate();
    for (const s of yearSprites) s.key = "";
    planKey = "";
    planLanding();
    requestRender();
  }

  // ---------- camera ----------
  const ridePos = new Vector3();
  const rideLook = new Vector3();
  const qRide = new Quaternion();
  const qTmp = new Quaternion();
  const posTmp = new Vector3();
  const up = new Vector3();
  function ridePose(d: number, t: number) {
    const z = -d;
    // a slow sway round the spine keeps the strands sweeping even at idle speed
    const sway = Math.sin(d * 0.013 + t * 0.11) * 0.35;
    ridePos.set(spineX(z) + OFF_X + sway * 0.5, spineY(z) + OFF_Y + sway * 0.3, z);
    const lz = z - LOOK_AHEAD;
    rideLook.set(spineX(lz) + 0.35, spineY(lz) + 0.2, lz);
    const roll = Math.sin(d * 0.009 + t * 0.07) * 0.05;
    up.set(Math.sin(roll), Math.cos(roll), 0);
    solver.position.copy(ridePos);
    solver.up.copy(up);
    solver.lookAt(rideLook);
    qRide.copy(solver.quaternion);
  }
  const rideShift = () => (narrow ? { x: 0, y: 0.06 } : { x: 0.2, y: -0.02 });

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
  const seenArt = new Int32Array(data.songs.length).fill(-1);
  let lastCovers = "";
  function frame(ts: number) {
    raf = 0;
    if (disposed || hidden) return;
    stamp++;
    const t = ts || now();
    const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
    lastT = t;
    let p = 0;
    let continuous = true;
    let fadeTarget = 1;

    if (freeze !== null && targetIdx >= 0) {
      p = freeze;
      camD = distanceForProgress(p);
      speed = warp(p, d1 - d0, dur);
      continuous = false;
    } else if (freeze !== null) {
      camD = freeze * IDLE_SPAN;
      speed = 0;
      continuous = false;
    } else if (mode === "idle") {
      if (!reduced) {
        if (t > idleEnd) startIdle(0, true);
        camD = idleBase + ((t - idleStart) / 1000) * IDLE_SPEED;
        fadeTarget = Math.min(1, (idleEnd - t) / (IDLE_FADE_S * 1000), idleFadeIn ? (t - idleStart) / (IDLE_FADE_S * 1000) : 1);
      } else continuous = false;
      speed *= 0.9;
    } else if (mode === "preroll") {
      if (targetIdx >= 0) {
        // target known, still pre-rolling: launch when the next ~1.5 s of covers are mostly in
        if (store.readyBefore(t + PRE_READY_MS) >= 0.85 || t - targetAt > PRE_GATE_MS || d1 - camD < VIEW_AHEAD * 1.2) {
          const tok = preloadToken;
          queueMicrotask(() => launch(tok));
        }
      } else if (prerollPlannedAt < 0 || t - prerollPlannedAt > 700) {
        store.plan(prerollPlan(data, camD, PRE_SPEED, SP, VIEW_AHEAD, t));
        prerollPlannedAt = t;
      }
      vel = lerp(vel, PRE_SPEED, 1 - Math.exp(-dt * 1.8));
      camD += vel * dt;
      speed = Math.min(1, vel / 420);
    } else if (mode === "return") {
      vel = lerp(vel, IDLE_SPEED, 1 - Math.exp(-dt * 2.5));
      camD += vel * dt;
      speed = Math.min(1, vel / 420);
      if (vel < IDLE_SPEED * 1.6) startIdle(camD, false);
    } else if (mode === "preload") {
      camD = d0 + (reduced ? 0 : ((t - preloadStart) / 1000) * IDLE_SPEED);
      vel = IDLE_SPEED;
      speed = 0;
      // launch once the covers due in the first ~2 s of flight are mostly in, or the wait runs out
      if (store.readyBefore(t + 300 + LAUNCH_READY_MS) >= 0.85 || t - preloadStart > LAUNCH_WAIT_MS) {
        const tok = preloadToken;
        queueMicrotask(() => launch(tok));
      }
    } else if (mode === "flying") {
      const el = (t - t0) / 1000;
      p = Math.min(1, el / dur);
      const flightD = distanceForProgress(p);
      // hand over from the pre-roll without a jolt: blend from where it was heading
      const k = preVel > 0 ? smooth(0, BLEND_S, el) : 1;
      camD = lerp(blendFrom + preVel * el, flightD, k);
      speed = warp(p, d1 - d0, dur);
      if (p >= 1) {
        mode = "arrived";
        arrivedAt = t;
      }
    } else {
      p = 1;
      camD = d1;
      speed *= 0.9;
    }
    const landing = targetIdx >= 0 && (mode === "flying" || mode === "arrived" || freeze !== null) ? smooth(0.6, 1, p) : 0;

    let fade = fadeStart === null ? 1 : Math.min(1, Math.max(0, (t - fadeStart) / FADE_MS));
    fade = Math.min(fade, fadeTarget);
    const fs = fade * fade * (3 - 2 * fade);
    shared.uFade.value = fs;
    const fNear = lerp(FOG_RIDE[0], FOG_FINAL[0], landing);
    const fFar = lerp(FOG_RIDE[1], FOG_FINAL[1], landing);
    shared.uFogNear.value = fNear;
    shared.uFogFar.value = fFar;
    fog.near = fNear * fs;
    fog.far = Math.max(fog.near + 0.01, fFar * fs);
    shared.uCut.value = destZ;
    shared.uCutK.value = landing;
    // landed: only the destination branch stays red; the trunk goes quiet
    const trunkRed = 1 - landing;
    uCol[0].set(lerp(ink.r * 0.7, red.r, trunkRed), lerp(ink.g * 0.7, red.g, trunkRed), lerp(ink.b * 0.7, red.b, trunkRed), lerp(0.55, 1, trunkRed));

    // camera: ride inside the tree; at the landing, out along the branch, then back and upright
    const tIdle = (t - idleStart) / 1000;
    ridePose(camD, mode === "idle" ? tIdle : 0);
    const rs = rideShift();
    let sx = rs.x;
    let sy = rs.y;
    if (landing > 0) {
      const k1 = smooth(0, 0.42, landing);
      const k2 = smooth(0.42, 1, landing);
      if (landing < 0.42) {
        posTmp.copy(ridePos).lerp(posA, k1);
        qTmp.copy(qRide).slerp(qA, k1);
        sx = lerp(rs.x, 0, k1);
        sy = lerp(rs.y, 0, k1);
      } else {
        posTmp.copy(posA).lerp(posF, k2);
        qTmp.copy(qA).slerp(qF, k2);
        sx = lerp(0, shiftF.x, k2);
        sy = lerp(0, shiftF.y, k2);
      }
      // holding on the landed frame, the camera keeps drifting round the tree (never a still frame)
      if (mode === "arrived" && freeze === null && !reduced) {
        const h = (t - arrivedAt) / 1000;
        const orbit = Math.sin(h * 0.16) * 0.06 * smooth(0, 2.5, h);
        camQ.copy(posTmp).sub(destPos).applyAxisAngle(new Vector3(0, 0, 1), orbit);
        posTmp.copy(destPos).add(camQ);
        posTmp.z += Math.sin(h * 0.23) * 0.25 * smooth(0, 2.5, h);
        solver.position.copy(posTmp);
        solver.up.set(0, 0, 1);
        solver.lookAt(destPos);
        qTmp.copy(solver.quaternion);
      }
      camera.position.copy(posTmp);
      camera.quaternion.copy(qTmp);
    } else {
      camera.position.copy(ridePos);
      camera.quaternion.copy(qRide);
    }
    camera.fov = FOV + speed * 28;
    applyShift(camera, sx, sy);
    camera.updateMatrixWorld();
    if (mode === "arrived" && reduced) continuous = false;

    // the window of weeks round the camera
    const camWeek = Math.max(0, camD / SP);
    const wFrom = Math.max(0, Math.floor(camWeek) - BEHIND_WEEKS - Math.round(landing * 14));
    const wTo = Math.min(total - 1, Math.floor(camWeek) + Math.round(lerp(AHEAD_WEEKS, 24, landing)));
    const [r0, r1raw] = runsBetween(data, wFrom, wTo);
    const r1 = Math.min(r1raw, r0 + POOL_SIZE - 1, runs - 1);
    const count = r1 - r0 + 1;
    store.beginFrame(stamp);
    slots.sync(r0, count, placeNode);
    syncRings(wFrom, wTo);

    // textures: in a live flight or pre-roll the path plan drives loading (store.plan); otherwise
    // (idle drift, the landing, a frozen frame) ask for the covers round the camera, nearest first
    const planned = freeze === null && (mode === "flying" || mode === "preroll" || mode === "preload");
    let wantedMissing = 0;
    if (targetIdx >= 0) {
      const [la, lb] = runsBetween(data, targetIdx - LANDING_BEHIND, targetIdx + LANDING_AHEAD);
      for (let r = la; r <= lb; r++) if (!store.want(data.song[data.runStart[r]])) wantedMissing++;
    }
    if (!planned) {
      for (let r = r0; r <= r1; r++) {
        const mid = (data.runStart[r] + data.runEnd[r]) / 2;
        if (mid < camWeek - BEHIND_WEEKS) continue;
        if (!store.want(data.song[data.runStart[r]])) wantedMissing++;
      }
    }
    store.pump(t);

    // covers: every slot shows something (its typeset sleeve until the art arrives, then a
    // crossfade), facing the camera; one cover per artwork in view (a song that went back to #1
    // shows once), never over the HUD, faded right at the lens
    const pxPerUnit = height / (2 * Math.tan(((camera.fov / 2) * Math.PI) / 180));
    const artId = store.artId;
    for (let r = r0; r <= r1; r++) seenArt[artId[data.song[data.runStart[r]]]] = -1;
    if (targetIdx >= 0) seenArt[artId[data.song[targetIdx]]] = -1;
    let animating = false;
    let shownArt = 0;
    let shownSleeve = 0;
    const viewLimit = fFar * 0.85;
    const slow = speed < 0.06;
    for (let r = r0; r <= r1; r++) {
      const k = slotOf(r, POOL_SIZE);
      const m = nodes[k];
      if (slots.weekOf[k] !== r || (r === targetRun && targetIdx >= 0)) {
        m.visible = false;
        continue;
      }
      const song = data.song[data.runStart[r]];
      const art = artId[song];
      if (seenArt[art] >= 0 || (targetIdx >= 0 && art === artId[data.song[targetIdx]])) {
        m.visible = false;
        continue;
      }
      if (nodeReadyAt[k] < 0) nodeReadyAt[k] = t;
      const u = m.material.uniforms;
      const artTex = store.get(song);
      if (artTex && nodeArtAt[k] === -1) nodeArtAt[k] = t;
      // fades scale with speed: at warp a cover is on screen for ~70 ms, so it must arrive solid
      const fadeMs = 20 + 220 * (1 - speed);
      const mix = artTex ? Math.min(1, (t - nodeArtAt[k]) / fadeMs) : 0;
      if (mix < 1) {
        // the sleeve shows until the art arrives, and under the crossfade
        const sl = store.sleeve(song);
        if (u.map.value !== sl) u.map.value = sl;
        if (artTex) animating = true;
      } else if (u.map.value !== artTex) u.map.value = artTex;
      const second = artTex ?? u.map.value;
      if (u.map2.value !== second) u.map2.value = second;
      u.uMix.value = mix;
      const s = nodeSize[k];
      const q = s / (1 - 2 * NODE_INSET);
      m.position.copy(nodePos[k]);
      m.quaternion.copy(camera.quaternion);
      m.scale.set(q, q, 1);
      m.updateMatrix();
      tmpV.copy(nodePos[k]).applyMatrix4(camera.matrixWorldInverse);
      const depth = -tmpV.z;
      if (depth < 0.2) {
        m.visible = false;
        continue;
      }
      // close to a slow camera, a cover upgrades to 300 px
      if (slow && depth < 9 && artTex) store.want(song, 1);
      const c = project(nodePos[k]);
      const half = ((s / depth) * pxPerUnit) / 2;
      const inHud = Math.max(
        hudOverlap(c.x - half, c.y - half, c.x + half, c.y + half),
        landing > 0 ? landing * rectsOverlap(labelRects, c.x - half - 4, c.y - half - 4, c.x + half + 4, c.y + half + 4) * 4 : 0,
      );
      const appear = Math.min(1, (t - nodeReadyAt[k]) / fadeMs);
      if (appear < 1) animating = true;
      const near = smooth(0.9, 2.4, depth);
      const futureFade = landing > 0 ? 1 - landing * smooth(destZ - 0.05, destZ + 0.8, nodePos[k].z) : 1;
      const op = appear * near * futureFade * (1 - smooth(0.04, 0.3, inHud));
      u.uOpacity.value = op;
      m.material.depthWrite = op > 0.98; // a fading cover must not punch a hole in what is behind it
      m.visible = op > 0.004;
      if (m.visible) {
        seenArt[art] = r;
        // telemetry: a cover counts as on screen inside the frame, nearer than the fog limit, and solid
        // (screen position from the real projection, lens shift included; at least half of it on screen)
        if (op > 0.3 && depth < viewLimit && c.x > 0 && c.x < width && c.y > 0 && c.y < height) {
          if (mix > 0.5) shownArt++;
          else shownSleeve++;
        }
      }
    }
    for (let k = 0; k < POOL_SIZE; k++) {
      const run = slots.weekOf[k];
      if (run < r0 || run > r1) nodes[k].visible = false;
    }
    if (targetIdx >= 0) {
      const song = data.song[targetIdx];
      const artTex = store.large600(song) ?? store.get(song);
      const tex = artTex ?? store.sleeve(song);
      if (tex) {
        if (destReadyAt < 0) destReadyAt = t;
        destMat.uniforms.map.value = tex;
        destMat.uniforms.map2.value = tex;
        destMat.uniforms.uMix.value = 1;
        // on the trunk until the landing, then out at the end of its branch; from mid-landing it
        // keeps its final on-screen size, so it never balloons across the page's HUD
        const k = smooth(0.06, 0.36, landing);
        posTmp.set(spineX(destZ), spineY(destZ), destZ).lerp(destPos, k);
        const dDepth = Math.max(0.3, -tmpV.copy(posTmp).applyMatrix4(camera.matrixWorldInverse).z);
        const screenSize = destScreenFrac * 2 * dDepth * Math.tan(((camera.fov / 2) * Math.PI) / 180) * camera.aspect;
        const s = lerp(COVER * 1.1, screenSize, smooth(0.12, 0.4, landing));
        const q = s / (1 - 2 * NODE_INSET);
        dest.position.copy(posTmp);
        dest.quaternion.copy(camera.quaternion);
        dest.scale.set(q, q, 1);
        dest.updateMatrix();
        tmpV.copy(posTmp).applyMatrix4(camera.matrixWorldInverse);
        const depth = -tmpV.z;
        const appear = Math.min(1, (t - destReadyAt) / 240);
        if (appear < 1) animating = true;
        destMat.uniforms.uOpacity.value = appear * (landing > 0 ? 1 : smooth(0.9, 2.4, depth));
        destMat.uniforms.uEdgeA.value = landing;
        destMat.uniforms.uFogK.value = 1 - landing;
        dest.visible = depth > 0.2;
        // the destination is a cover on screen too (it counts as art once its own art is in)
        const dc = project(posTmp);
        if (dest.visible && depth < viewLimit && dc.x > 0 && dc.x < width && dc.y > 0 && dc.y < height) {
          if (artTex) shownArt++;
          else shownSleeve++;
        }
      } else dest.visible = false;
    }
    const coversKey = `${shownArt + shownSleeve}|${shownArt}`;
    if (coversKey !== lastCovers) {
      lastCovers = coversKey;
      canvas.dataset.coversVisible = String(shownArt + shownSleeve);
      canvas.dataset.coversArt = String(shownArt);
      canvas.dataset.coversSleeve = String(shownSleeve);
    }

    // the tree and its particles follow the camera
    const zTop = Math.max(camera.position.z, -camD) + 6 + landing * 26;
    threadMat.uniforms.uZ0.value = Math.ceil(zTop / THREAD_SEG) * THREAD_SEG;
    // pulled back, draw far more of the tree into the past (same vertices, longer segments)
    threadMat.uniforms.uWin.value = lerp(THREAD_WIN, 420, smooth(0.45, 0.9, landing));
    pxK.value = (2 * Math.tan(((camera.fov / 2) * Math.PI) / 180)) / Math.max(1, height);
    particleMat.uniforms.uTop.value = -camD + 3;
    particleMat.uniforms.uFlow.value = (mode === "idle" || mode === "preload") && freeze === null ? ((t / 1000) * 1.6) % PARTICLE_WIN : 0;
    particleMat.uniforms.uLen.value = 0.08 + speed * 7;
    particleMat.uniforms.uWarp.value = speed;
    if (limbMesh) {
      limbMat.uniforms.uGrowA.value = smooth(0.1, 0.55, landing) * 1.07;
      limbMat.uniforms.uGrowB.value = smooth(0.5, 0.95, landing) * 1.07;
      limbMesh.visible = landing > 0.05;
    }

    // passing readout (also while pre-rolling, so the dates already tick back)
    if (targetIdx >= 0 || mode === "preroll") {
      const raw = Math.round(camD / SP);
      const shown = targetIdx < 0 ? raw : d1 >= d0 ? Math.min(targetIdx, raw) : Math.max(targetIdx, raw);
      const i = mode === "arrived" ? targetIdx : Math.max(0, Math.min(total - 1, shown));
      if (i !== lastShown && mode !== "preload") {
        lastShown = i;
        opts.onPassing?.(passingAt(data, i));
      }
    }

    // overlay: year labels beside their rings (small, never in the HUD), branch labels on landing
    let overlayOn = false;
    const yearA = (1 - landing) * fs;
    const camRight = tmpV.set(1, 0, 0).applyQuaternion(camera.quaternion).clone();
    rings.forEach((r, k) => {
      const s = yearSprites[k];
      if (r.ordinal < 0 || yearA < 0.01) {
        s.mesh.visible = false;
        return;
      }
      drawYear(s, r.year);
      camQ.set(spineX(r.z), spineY(r.z), r.z).addScaledVector(camRight, RING_R + 0.15);
      tmpV.copy(camQ).applyMatrix4(camera.matrixWorldInverse);
      const depth = -tmpV.z;
      if (depth < 3) {
        s.mesh.visible = false;
        return;
      }
      const at = project(camQ);
      const x = at.x + 6;
      const ok = x > 16 && x + s.w < width - 16 && at.y > s.h && at.y < height - s.h && hudOverlap(x, at.y - s.h / 2, x + s.w, at.y + s.h / 2) === 0;
      if (!ok) {
        s.mesh.visible = false;
        return;
      }
      const fogA = 1 - smooth(fNear, fFar, depth);
      s.mesh.scale.set(s.w, s.h, 1);
      s.mesh.position.set(x + s.w / 2, height - at.y, 0);
      s.mesh.material.opacity = yearA * fogA * smooth(3, 8, depth);
      s.mesh.visible = s.mesh.material.opacity > 0.02;
      overlayOn ||= s.mesh.visible;
    });
    const labelA = smooth(0.86, 1, landing) * fs;
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
      const c = limb.branch.mine ? red : ink;
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
    const pendingNow = wantedMissing + (targetIdx >= 0 && !dest.visible && destReadyAt < 0 ? 1 : 0) + (fade < 1 ? 1 : 0);
    if (pendingNow !== lastPending) {
      lastPending = pendingNow;
      canvas.dataset.pending = String(pendingNow);
    }
    setState(freeze !== null ? "frozen" : mode);

    if (mode === "arrived" && !arrivedNotified && freeze === null) {
      arrivedNotified = true;
      opts.onArrive?.();
    }

    if (continuous || animating || store.throttled || pendingNow > 0) requestRender();
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
      if (mode === "idle") {
        idleStart += gap;
        idleEnd += gap;
      }
      if (mode === "preload") preloadStart += gap;
      if (mode === "arrived") arrivedAt += gap;
      lastT = now();
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
    nodes[0].material.uniforms.map2.value = warmTex;
    destMat.uniforms.map.value = warmTex;
    labelSprites[0].mesh.material.map = warmTex;
    const g = new BufferGeometry();
    for (const [name, size] of [["position", 3], ["aNext", 3], ["aSide", 1], ["aT", 1], ["aCi", 1], ["aW", 1], ["aAlpha", 1], ["aStage", 1]] as const) {
      g.setAttribute(name, new BufferAttribute(new Float32Array(3 * size), size));
    }
    const warmLimb = new Mesh(g, limbMat);
    scene.add(warmLimb);
    renderer.compile(scene, camera);
    renderer.compile(overlay, ortho);
    scene.remove(warmLimb);
    g.dispose();
    hiddenNow.forEach((o, k) => (o.visible = was[k]));
    nodes[0].material.uniforms.map.value = blank;
    nodes[0].material.uniforms.map2.value = blank;
    destMat.uniforms.map.value = blank;
    labelSprites[0].mesh.material.map = null;
    warmTex.dispose();
  }
  // the idle tree's first covers start loading at once; strands are on screen from the first frame
  store.preload(songsForWeeks(0, 12), 0);
  setTarget(opts.target);

  function dispose() {
    disposed = true;
    launchToken++;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    ro?.disconnect();
    store.dispose(); // also disposes the shared plain sleeve
    for (const m of nodes) m.material.dispose();
    destMat.dispose();
    quadGeo.dispose();
    threadGeo.dispose();
    threadMat.dispose();
    particleGeo.dispose();
    particleMat.dispose();
    limbMesh?.geometry.dispose();
    limbMat.dispose();
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

  return { setTarget, setFreeze, setBranches, setPending, skip, dispose };
}
