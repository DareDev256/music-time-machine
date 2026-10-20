/**
 * The flight, composed as a timeline tree ("low-key Sacred Timeline"):
 *
 * - TRUNK: the Hot 100 #1 line, one red filament running away from the camera
 *   along the time axis (newest near, oldest far). Each #1 RUN is a cover
 *   node on the trunk, a little larger the longer it held #1.
 * - BRANCHES: the genre lanes, ink filaments winding round the trunk in loose
 *   helices. Flying back, each folds into the trunk at the week its chart began.
 * - Year rings of light round the trunk at every January, the year beside them.
 * - Particles stream along every thread and stretch with the warp.
 * - Landing: the camera slows, rises and pulls back so the destination week
 *   reads as a cross-section: the #1 cover in a red frame, each branch labelled.
 *
 * Budget rules kept from the tunnel port: POOL_SIZE cover meshes recycled as
 * the camera passes (pool.ts), covers fetched by proximity through an LRU
 * (textures.ts), pooled rings, every thread in ONE draw call (the curve is
 * evaluated in the vertex shader, so nothing is rebuilt per frame), no lights,
 * no shadows, no post-processing, nothing rendered while hidden or still.
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
  LineBasicMaterial,
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
  type Texture,
} from "three";
import { ease, easeVelocity, flightDuration, warp, yearsBetween } from "./easing";
import { firstGateAtOrAfter, passingAt, runsBetween, targetIndex, type FlightData, type PassingWeek } from "./data";
import { POOL_SIZE, SlotTable, slotOf } from "./pool";
import { buildThreads, GLSL_TREE, LANES, presence, SP, threadAt, trunkX, trunkY, type Thread } from "./tree";
import { drawBranchLabel, layoutLabels, type FlightBranch, type LabelSprite, type Point } from "./labels";
import {
  awaitFonts,
  canvasFonts,
  CoverStore,
  drawPlaceholder,
  drawYearLabel,
  INK,
  SIGNAL,
  yearLabelTexture,
  type CanvasFonts,
} from "./textures";

export { SP };

const FOG_NEAR = 8;
const FOG_FAR = 120;
const RING_POOL = 6;
const IDLE_SPEED = 0.6; // units per second
const IDLE_WEEKS = 156; // the most recent ~3 years
const FADE_MS = 450;
const IDLE_FADE_S = 1.6;
/** Covers the camera passes slower than this (units/s) are on screen long enough to be worth fetching. */
const LOAD_SPEED = 320;
const START_PRELOAD = 40;
const PRELOAD_TIMEOUT_MS = 900;
const BEHIND_WEEKS = 4;
const AHEAD_WEEKS = 118;
/** Weeks either side of the destination fetched first at launch: the landing must be complete. */
const LANDING_BEHIND = 10;
const LANDING_AHEAD = 70;
const THREAD_WIN = 160; // world units of thread drawn, from just behind the camera
const THREAD_SEG = 0.5;
const PARTICLE_WIN = 120;

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

interface Layout {
  narrow: boolean;
  rScale: number;
  rideX: number;
  rideY: number;
  ringR: number;
  nodeScale: number;
  destSize: number;
  pull: number;
  rise: number;
  lookDy: number;
}

function layoutFor(w: number): Layout {
  const narrow = w < 640;
  return narrow
    ? { narrow, rScale: 0.72, rideX: 0.62, rideY: 0.5, ringR: 0.84, nodeScale: 0.9, destSize: 1.2, pull: 8.4, rise: 0.95, lookDy: -0.62 }
    : { narrow, rScale: 1, rideX: 1.05, rideY: 0.62, ringR: 1.16, nodeScale: 1, destSize: 1.45, pull: 6.6, rise: 0.8, lookDy: -0.12 };
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

const THREAD_VERT = /* glsl */ `
uniform vec4 uA[NT];
uniform vec4 uB[NT];
uniform vec4 uC[NT];
uniform vec4 uD[NT];
uniform float uZ0;
uniform float uWin;
uniform float uRScale;
uniform float uPxK;
attribute float aS;
attribute float aSide;
attribute float aThread;
varying float vSide;
varying float vI;
varying vec3 vCol;
varying float vDepth;
varying float vZ;
${GLSL_TREE}
void main() {
  int t = int(aThread + 0.5);
  float z = uZ0 - aS * uWin;
  vZ = z;
  float pres; float pres2;
  vec3 P = strandPos(t, z, uRScale, pres);
  vec3 Q = strandPos(t, z - 0.3, uRScale, pres2);
  vec4 mvP = modelViewMatrix * vec4(P, 1.0);
  vec4 mvQ = modelViewMatrix * vec4(Q, 1.0);
  vec3 tang = mvQ.xyz - mvP.xyz;
  vec3 side = cross(normalize(tang), normalize(mvP.xyz));
  float sl = length(side);
  side = sl > 1e-5 ? side / sl : vec3(1.0, 0.0, 0.0);
  float depth = max(0.05, -mvP.z);
  float halfW = max(uB[t].w, uC[t].w * uPxK * depth);
  mvP.xyz += side * aSide * halfW;
  gl_Position = projectionMatrix * mvP;
  vSide = aSide;
  vDepth = depth;
  vI = uA[t].w * pres;
  vCol = uC[t].rgb;
}
`;

const THREAD_FRAG = /* glsl */ `
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
  float core = 1.0 - smoothstep(0.2, 0.38, d);
  float glow = exp(-d * d * 6.0) * 0.38;
  float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
  // on landing, the stretch between the camera and the destination week dims: the cross-section reads
  float cut = 1.0 - uCutK * 0.92 * smoothstep(uCut + 0.05, uCut + 1.6, vZ);
  float i = (core + glow) * vI * fog * uFade * cut;
  if (i < 0.002) discard;
  gl_FragColor = vec4(vCol, i);
  #include <colorspace_fragment>
}
`;

const PARTICLE_VERT = /* glsl */ `
uniform vec4 uA[NT];
uniform vec4 uB[NT];
uniform vec4 uC[NT];
uniform vec4 uD[NT];
uniform float uCamZ;
uniform float uFlow;
uniform float uLen;
uniform float uRScale;
uniform float uPWin;
attribute float aThread;
attribute float aSeed;
attribute float aEnd;
attribute vec2 aJit;
varying float vI;
varying vec3 vCol;
varying float vDepth;
${GLSL_TREE}
void main() {
  int t = int(aThread + 0.5);
  float zz = uCamZ - mod(aSeed + uCamZ + uFlow, uPWin);
  float z = zz - aEnd * uLen;
  float pres;
  vec3 P = strandPos(t, z, uRScale, pres);
  P.xy += aJit;
  vec4 mv = modelViewMatrix * vec4(P, 1.0);
  gl_Position = projectionMatrix * mv;
  vDepth = -mv.z;
  vI = pres * (uA[t].w * 0.8 + 0.2) * (aEnd > 0.5 ? 0.2 : 1.0) * smoothstep(0.8, 3.0, vDepth);
  vCol = uC[t].rgb;
}
`;

const PARTICLE_FRAG = /* glsl */ `
uniform float uFogNear;
uniform float uFogFar;
uniform float uFade;
uniform float uWarp;
varying float vI;
varying vec3 vCol;
varying float vDepth;
void main() {
  float fog = 1.0 - smoothstep(uFogNear * 0.5, uFogFar * 0.8, vDepth);
  float i = vI * fog * uFade * (0.28 + 0.72 * uWarp);
  if (i < 0.003) discard;
  gl_FragColor = vec4(vCol, i);
  #include <colorspace_fragment>
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
uniform float uFog;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFade;
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
  float fog = uFog > 0.5 ? 1.0 - smoothstep(uFogNear, uFogFar, vDepth) : 1.0;
  float nearFade = smoothstep(0.55, 2.0, vDepth);
  a *= uOpacity * nearFade;
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
  const fog = new Fog(0x000000, FOG_NEAR, FOG_FAR);
  scene.fog = fog;
  const camera = new PerspectiveCamera(62, 1, 0.1, 400);
  const overlay = new Scene();
  const ortho = new OrthographicCamera(0, 1, 1, 0, -10, 10);

  let width = -1;
  let height = -1;
  let L: Layout = layoutFor(canvas.clientWidth || window.innerWidth);
  let fonts: CanvasFonts = canvasFonts();
  let disposed = false;
  let stamp = 0;

  // shared uniforms (one object, referenced by every material that fogs or fades)
  const shared = {
    uFogNear: { value: FOG_NEAR } as IUniform<number>,
    uFogFar: { value: FOG_FAR } as IUniform<number>,
    uFade: { value: 0 } as IUniform<number>,
  };

  // ---------- threads: trunk + lanes + offshoots, one draw call ----------
  const threads: Thread[] = buildThreads(data);
  const NT = threads.length;
  const laneThread = new Map<string, number>();
  threads.forEach((t, i) => t.lane && laneThread.set(t.lane, i));
  const trunkColor = new Color(SIGNAL);
  const inkColor = new Color(INK);
  const uA = threads.map((t) => new Vector4(t.radius, t.phase, t.pitch, t.alpha));
  const uB = threads.map((t) => new Vector4(t.zOld, t.zNew, t.merge, t.halfWidth));
  const isRed = (t: Thread) => t.kind === "trunk" || (t.kind === "strand" && threads[t.parent].kind === "trunk");
  const uC = threads.map((t) => {
    const c = isRed(t) ? trunkColor : inkColor;
    return new Vector4(c.r, c.g, c.b, t.minPx);
  });
  const uD = threads.map((t) => new Vector4(t.parent, t.satR, t.satPhase, t.satPitch));
  const treeUniforms = {
    uA: { value: uA },
    uB: { value: uB },
    uC: { value: uC },
    uD: { value: uD },
    uRScale: { value: L.rScale },
  };

  const SEGS = Math.round(THREAD_WIN / THREAD_SEG);
  const threadGeo = new BufferGeometry();
  {
    const vPer = (SEGS + 1) * 2;
    const aS = new Float32Array(NT * vPer);
    const aSide = new Float32Array(NT * vPer);
    const aThread = new Float32Array(NT * vPer);
    const index = new Uint32Array(NT * SEGS * 6);
    let v = 0;
    let ix = 0;
    for (let t = 0; t < NT; t++) {
      const base = v;
      for (let j = 0; j <= SEGS; j++) {
        for (const side of [-1, 1]) {
          aS[v] = j / SEGS;
          aSide[v] = side;
          aThread[v] = t;
          v++;
        }
      }
      for (let j = 0; j < SEGS; j++) {
        const a = base + j * 2;
        index[ix++] = a;
        index[ix++] = a + 1;
        index[ix++] = a + 2;
        index[ix++] = a + 1;
        index[ix++] = a + 3;
        index[ix++] = a + 2;
      }
    }
    threadGeo.setAttribute("position", new BufferAttribute(new Float32Array(NT * vPer * 3), 3));
    threadGeo.setAttribute("aS", new BufferAttribute(aS, 1));
    threadGeo.setAttribute("aSide", new BufferAttribute(aSide, 1));
    threadGeo.setAttribute("aThread", new BufferAttribute(aThread, 1));
    threadGeo.setIndex(new BufferAttribute(index, 1));
  }
  const threadMat = new ShaderMaterial({
    defines: { NT },
    uniforms: {
      ...treeUniforms,
      uZ0: { value: 0 },
      uWin: { value: THREAD_WIN },
      uPxK: { value: 0.001 },
      uCut: { value: 0 },
      uCutK: { value: 0 },
      ...shared,
    },
    vertexShader: THREAD_VERT,
    fragmentShader: THREAD_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const threadMesh = new Mesh(threadGeo, threadMat);
  threadMesh.frustumCulled = false;
  // threads draw first and write no depth; covers draw after them, so a thread never crosses a cover's art
  threadMesh.renderOrder = 1;
  scene.add(threadMesh);

  // ---------- particles streaming along the threads ----------
  const particleGeo = new BufferGeometry();
  {
    const rand = mulberry32(256);
    const per = threads.map((t): number => (t.kind === "trunk" ? 150 : t.kind === "lane" ? 54 : t.kind === "offshoot" ? 16 : 0));
    const n = per.reduce((a, b) => a + b, 0);
    const aThread = new Float32Array(n * 2);
    const aSeed = new Float32Array(n * 2);
    const aEnd = new Float32Array(n * 2);
    const aJit = new Float32Array(n * 4);
    let k = 0;
    threads.forEach((t, ti) => {
      for (let i = 0; i < per[ti]; i++) {
        const seed = rand() * PARTICLE_WIN;
        const jr = (t.kind === "trunk" ? 0.07 : 0.035) * Math.sqrt(rand());
        const ja = rand() * Math.PI * 2;
        for (let e = 0; e < 2; e++) {
          aThread[k] = ti;
          aSeed[k] = seed;
          aEnd[k] = e;
          aJit[k * 2] = Math.cos(ja) * jr;
          aJit[k * 2 + 1] = Math.sin(ja) * jr;
          k++;
        }
      }
    });
    particleGeo.setAttribute("position", new BufferAttribute(new Float32Array(n * 2 * 3), 3));
    particleGeo.setAttribute("aThread", new BufferAttribute(aThread, 1));
    particleGeo.setAttribute("aSeed", new BufferAttribute(aSeed, 1));
    particleGeo.setAttribute("aEnd", new BufferAttribute(aEnd, 1));
    particleGeo.setAttribute("aJit", new BufferAttribute(aJit, 2));
  }
  const particleMat = new ShaderMaterial({
    defines: { NT },
    uniforms: {
      ...treeUniforms,
      uCamZ: { value: 0 },
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
  const placeholder = drawPlaceholder();
  const store = new CoverStore(data, () => fonts, () => requestRender());
  const quadGeo = new PlaneGeometry(1, 1);
  const NODE_INSET = 0.09;
  type NodeMat = ShaderMaterial & { uniforms: Record<string, IUniform> };
  function nodeMaterial(edge: Color, edgeA: number, line: number, glow: number): NodeMat {
    return new ShaderMaterial({
      uniforms: {
        map: { value: placeholder },
        uInset: { value: NODE_INSET },
        uLine: { value: line },
        uGlow: { value: glow },
        uEdge: { value: edge },
        uEdgeA: { value: edgeA },
        uBright: { value: 1 },
        uOpacity: { value: 1 },
        uFog: { value: 1 },
        ...shared,
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
  const nodeZ = new Float32Array(POOL_SIZE);
  for (let k = 0; k < POOL_SIZE; k++) {
    const m = new Mesh(quadGeo, nodeMaterial(nodeEdge, 0.3, 0.012, 26));
    m.matrixAutoUpdate = false;
    m.visible = false;
    m.renderOrder = 4;
    nodes.push(m);
    scene.add(m);
  }
  const slots = new SlotTable(POOL_SIZE);

  function placeNode(slot: number, run: number) {
    const m = nodes[slot];
    const a = data.runStart[run];
    const b = data.runEnd[run];
    const len = b - a + 1;
    const z = -((a + b) / 2) * SP;
    const s = Math.min(0.95, 0.5 + 0.1 * Math.log2(len)) * L.nodeScale;
    const q = s / (1 - 2 * NODE_INSET);
    m.position.set(trunkX(z), trunkY(z), z);
    m.scale.set(q, q, 1);
    m.updateMatrix();
    nodeZ[slot] = z;
    m.visible = true;
    m.material.uniforms.map.value = store.get(data.song[a]) ?? placeholder;
  }

  // ---------- destination: that week's #1 at 600×600 in a red frame ----------
  const destMat = nodeMaterial(trunkColor, 1, 0.022, 9);
  destMat.uniforms.uFog.value = 0;
  const dest = new Mesh(quadGeo, destMat);
  dest.visible = false;
  dest.renderOrder = 5;
  scene.add(dest);
  let destZ = 0;
  let targetRun = -1;

  // ---------- year rings ----------
  const ringGeo = new RingGeometry(0.985, 1, 160, 1);
  const ringMat = new MeshBasicMaterial({
    color: trunkColor,
    transparent: true,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: true,
  });
  const yearGeo = new PlaneGeometry(1, 96 / 256);
  interface Ring {
    ring: Mesh;
    label: Mesh<PlaneGeometry, MeshBasicMaterial>;
    tex: CanvasTexture;
    ordinal: number;
    year: string;
  }
  const rings: Ring[] = [];
  for (let k = 0; k < RING_POOL; k++) {
    const ring = new Mesh(ringGeo, ringMat);
    const tex = yearLabelTexture();
    const label = new Mesh(yearGeo, new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }));
    ring.matrixAutoUpdate = label.matrixAutoUpdate = false;
    ring.visible = label.visible = false;
    ring.renderOrder = label.renderOrder = 3;
    scene.add(ring, label);
    rings.push({ ring, label, tex, ordinal: -1, year: "" });
  }
  function hideRing(r: Ring) {
    r.ring.visible = r.label.visible = false;
    r.ordinal = -1;
  }
  function placeRing(r: Ring, ordinal: number) {
    const i = data.gates[ordinal];
    const z = -i * SP + SP / 2;
    const x = trunkX(z);
    const y = trunkY(z);
    r.ordinal = ordinal;
    r.ring.position.set(x, y, z);
    r.ring.scale.set(L.ringR, L.ringR, 1);
    r.ring.updateMatrix();
    const lw = L.narrow ? 0.56 : 0.72;
    const off = L.ringR * 0.74;
    r.label.position.set(x + off + lw / 2 + 0.06, y + off, z);
    r.label.scale.set(lw, lw, 1);
    r.label.updateMatrix();
    const year = data.dates[i].slice(0, 4);
    if (year !== r.year) {
      r.year = year;
      drawYearLabel(r.tex, year, fonts);
    }
    r.ring.visible = r.label.visible = true;
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

  // ---------- branch labels (overlay, pixel space) ----------
  const MAX_LABELS = LANES.length;
  let branchInfo: FlightBranch[] | undefined = opts.branches;
  interface LabelSlot {
    mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
    sprite: LabelSprite | null;
    branch: FlightBranch | null;
    align: "left" | "right";
  }
  const labelSlots: LabelSlot[] = [];
  for (let k = 0; k < MAX_LABELS; k++) {
    const mesh = new Mesh(
      quadGeo,
      new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, opacity: 0 }),
    );
    mesh.visible = false;
    mesh.renderOrder = 3; // labels over their leaders and dots
    overlay.add(mesh);
    labelSlots.push({ mesh, sprite: null, branch: null, align: "left" });
  }
  const leaderPos = new Float32Array(MAX_LABELS * 6);
  const leaderCol = new Float32Array(MAX_LABELS * 6);
  const leaderGeo = new BufferGeometry();
  leaderGeo.setAttribute("position", new BufferAttribute(leaderPos, 3));
  leaderGeo.setAttribute("color", new BufferAttribute(leaderCol, 3));
  const leaderMat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthTest: false });
  const leaders = new LineSegments(leaderGeo, leaderMat);
  leaders.frustumCulled = false;
  overlay.add(leaders);
  const dotPos = new Float32Array(MAX_LABELS * 3);
  const dotCol = new Float32Array(MAX_LABELS * 3);
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
  overlay.add(dots);
  let labelsKey = "";

  /** Lanes that exist at the destination week, with what the page told us about them. */
  function destinationBranches(): FlightBranch[] {
    const out: FlightBranch[] = [];
    for (const spec of LANES) {
      const t = threads[laneThread.get(spec.lane)!];
      if (presence(t, destZ) < 0.5) continue;
      const given = branchInfo?.find((b) => b.lane === spec.lane);
      out.push(given ? { ...given, label: given.label || spec.name } : { lane: spec.lane, label: spec.name });
    }
    return out;
  }

  function applyBranchColors() {
    for (const spec of LANES) {
      const ti = laneThread.get(spec.lane)!;
      const mine = !!branchInfo?.find((b) => b.lane === spec.lane)?.mine;
      const c = mine ? trunkColor : inkColor;
      threads.forEach((t, k) => {
        if (k !== ti && t.parent !== ti) return;
        uC[k].set(c.r, c.g, c.b, t.minPx * (mine ? 1.2 : 1));
        uA[k].w = mine ? Math.min(1, t.alpha * 2.2) : t.alpha;
      });
    }
  }

  const labelMaxW = () => (L.narrow ? Math.max(84, Math.min(132, width / 2 - 88)) : 230);

  function drawLabel(s: LabelSlot) {
    if (!s.branch) return;
    s.sprite = drawBranchLabel(
      s.branch,
      { maxW: labelMaxW(), dpr: renderer.getPixelRatio(), narrow: L.narrow, align: s.align, fonts },
      s.sprite?.tex,
    );
    s.mesh.material.map = s.sprite.tex;
    s.mesh.material.needsUpdate = true;
  }

  function buildLabels() {
    const list = targetIdx >= 0 ? destinationBranches() : [];
    const key = `${targetIdx}|${width}|${L.narrow}|${fonts.display}|${JSON.stringify(list)}`;
    if (key === labelsKey) return;
    labelsKey = key;
    labelSlots.forEach((s, k) => {
      s.branch = list[k] ?? null;
      if (!s.branch) s.mesh.visible = false;
      else drawLabel(s);
    });
  }

  const tmpV = new Vector3();
  const tmpP = { x: 0, y: 0, z: 0 };
  function project(x: number, y: number, z: number): Point {
    tmpV.set(x, y, z).project(camera);
    return { x: ((tmpV.x + 1) / 2) * width, y: ((1 - tmpV.y) / 2) * height };
  }

  /** Lay the branch labels out round the destination; returns true if one had to be redrawn. */
  function updateLabels(alpha: number): boolean {
    const show = alpha > 0.001 && targetIdx >= 0;
    leaders.visible = dots.visible = show;
    if (!show) {
      for (const s of labelSlots) s.mesh.visible = false;
      return false;
    }
    buildLabels();
    const used = labelSlots.filter((s) => s.branch && s.sprite);
    const anchors: Point[] = used.map((s) => {
      threadAt(threads[laneThread.get(s.branch!.lane)!], destZ, L.rScale, tmpP);
      return project(tmpP.x, tmpP.y, tmpP.z);
    });
    const half = (L.destSize * 1.04) / 2;
    const c0 = project(trunkX(destZ) - half, trunkY(destZ) + half, destZ);
    const c1 = project(trunkX(destZ) + half, trunkY(destZ) - half, destZ);
    const placed = layoutLabels(
      anchors,
      used.map((s) => ({ w: s.sprite!.w, h: s.sprite!.h })),
      {
        w: width,
        h: height,
        margin: 16,
        top: height * (L.narrow ? 0.17 : 0.13),
        bottom: height * (L.narrow ? 0.66 : 0.8),
        avoid: { x0: c0.x, y0: c0.y, x1: c1.x, y1: c1.y },
        gap: L.narrow ? 8 : 12,
      },
    );
    let redrawn = false;
    used.forEach((s, k) => {
      const p = placed[k];
      // the text hugs its leader line: right-aligned on the left of the cover
      const want = p.side === "left" ? "right" : "left";
      if (s.align !== want) {
        s.align = want;
        drawLabel(s);
        redrawn = true;
      }
      const sp = s.sprite!;
      s.mesh.scale.set(sp.w, sp.h, 1);
      s.mesh.position.set(p.x + sp.w / 2, height - (p.y + sp.h / 2), 0);
      s.mesh.material.opacity = alpha;
      s.mesh.visible = true;
      const mine = !!s.branch!.mine;
      const col = mine ? trunkColor : inkColor;
      const la = mine ? 0.9 : 0.4;
      leaderPos.set([p.from.x, height - p.from.y, 0, p.to.x, height - p.to.y, 0], k * 6);
      leaderCol.set([col.r * la, col.g * la, col.b * la, col.r * la, col.g * la, col.b * la], k * 6);
      dotPos.set([p.from.x, height - p.from.y, 0], k * 3);
      dotCol.set([col.r, col.g, col.b], k * 3);
    });
    for (const s of labelSlots) if (!used.includes(s)) s.mesh.visible = false;
    leaderGeo.setDrawRange(0, used.length * 2);
    dotGeo.setDrawRange(0, used.length);
    leaderGeo.attributes.position.needsUpdate = true;
    leaderGeo.attributes.color.needsUpdate = true;
    dotGeo.attributes.position.needsUpdate = true;
    dotGeo.attributes.color.needsUpdate = true;
    leaderMat.opacity = alpha;
    dotMat.opacity = alpha;
    return redrawn;
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
  let fadeStart: number | null = null; // null = still black
  let idleStart = 0;
  let camD = 0;
  let speed = 0;
  let lastShown = -1;
  let launchToken = 0;
  let arrivedNotified = false;

  const now = () => performance.now();

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
        ? 1.2
        : flightDuration(yearsBetween(data.dates[fromWeek], data.dates[Math.max(0, targetIdx)]));
    return fromWeek;
  }

  function songsForWeeks(fromWeek: number, n: number): number[] {
    const out: number[] = [];
    const a = Math.max(0, Math.floor(fromWeek));
    for (let i = a; i < Math.min(total, a + n); i++) out.push(data.song[i]);
    return out;
  }

  function beginFade(at: number) {
    fadeStart = reduced || freeze !== null ? at - FADE_MS : at;
  }

  function placeDest() {
    if (targetIdx < 0) return;
    const q = L.destSize / (1 - 2 * NODE_INSET);
    dest.position.set(trunkX(destZ), trunkY(destZ), destZ);
    dest.scale.set(q, q, 1);
    dest.visible = true;
  }

  function setTarget(date: string | null) {
    const token = ++launchToken;
    arrivedNotified = false;
    lastShown = -1;
    labelsKey = "";
    if (!date) {
      targetIdx = -1;
      targetRun = -1;
      dest.visible = false;
      mode = "idle";
      d0 = d1 = 0;
      fadeStart = null;
      store.preload(songsForWeeks(0, START_PRELOAD), PRELOAD_TIMEOUT_MS).then(() => {
        if (disposed || token !== launchToken) return;
        idleStart = now();
        beginFade(idleStart);
        requestRender();
      });
      requestRender();
      return;
    }
    targetIdx = targetIndex(data, date);
    targetRun = data.runOf[targetIdx];
    destZ = -targetIdx * SP;
    const fromWeek = planFlight(freeze !== null ? 0 : camD);
    placeDest();
    store.large600(data.song[targetIdx]);
    if (reduced || freeze !== null) {
      // reduced motion lands at once; a frozen frame needs no launch, only its own window
      mode = "flying";
      t0 = now() - (reduced ? dur * 1000 : 0);
      beginFade(now());
      requestRender();
      return;
    }
    mode = "preload";
    const wasVisible = fadeStart !== null;
    store.preload(songsForWeeks(fromWeek, START_PRELOAD), wasVisible ? 0 : PRELOAD_TIMEOUT_MS).then(() => {
      if (disposed || token !== launchToken) return;
      mode = "flying";
      t0 = now();
      if (!wasVisible) beginFade(t0);
      requestRender();
    });
    requestRender();
  }

  function skip() {
    if (mode === "flying" || mode === "preload") {
      launchToken++;
      mode = "flying";
      t0 = now() - dur * 1000;
      if (fadeStart === null) beginFade(now() - FADE_MS);
      requestRender();
    }
  }

  function setFreeze(p: number | null) {
    freeze = p === null || !Number.isFinite(p) ? null : Math.max(0, Math.min(1, p));
    if (freeze !== null) {
      if (targetIdx >= 0) planFlight(0);
      beginFade(now());
    }
    requestRender();
  }

  function setBranches(b: FlightBranch[] | undefined) {
    branchInfo = b;
    applyBranchColors();
    labelsKey = "";
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 640 ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ortho.right = w;
    ortho.top = h;
    ortho.updateProjectionMatrix();
    const next = layoutFor(w);
    if (next.narrow !== L.narrow) applyLayout(next);
    labelsKey = "";
    requestRender();
  }

  /** Radii, cover sizes and the landing framing change at 640 px: re-place what depends on them. */
  function applyLayout(next: Layout) {
    L = next;
    treeUniforms.uRScale.value = L.rScale;
    for (const r of rings) hideRing(r);
    slots.invalidate();
    placeDest();
  }

  // ---------- camera ----------
  const look = new Vector3();
  const ride = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, roll: 0 };
  /** Ride pose: just above the trunk, looking down the time axis, banking with the meander. */
  function ridePose(d: number, t: number) {
    const z = -d;
    // ride beside and above the trunk so the covers string out along a diagonal, not a stack
    ride.px = trunkX(z) + L.rideX;
    ride.py = trunkY(z) + L.rideY;
    ride.pz = z;
    const lz = z - 18;
    ride.lx = trunkX(lz) + L.rideX * 0.3;
    ride.ly = trunkY(lz) + L.rideY * 0.25;
    ride.lz = lz;
    // bank into the curve ahead, plus a slow sway as the branches swing past
    ride.roll = (ride.lx - ride.px) * 0.07 + Math.sin(d * 0.019 + t * 0.15) * 0.035;
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

  function frame(ts: number) {
    raf = 0;
    if (disposed || hidden) return;
    stamp++;
    const t = ts || now();
    let p = 0;
    let continuous = false;
    let fadeTarget = 1;

    if (freeze !== null && targetIdx >= 0) {
      p = freeze;
      camD = distanceForProgress(p);
      speed = warp(p, d1 - d0, dur);
    } else if (freeze !== null) {
      camD = freeze * IDLE_WEEKS * SP;
      speed = 0;
    } else if (mode === "idle") {
      if (fadeStart !== null && !reduced) {
        const cycle = (IDLE_WEEKS * SP) / IDLE_SPEED;
        const e = ((t - idleStart) / 1000) % cycle;
        camD = e * IDLE_SPEED;
        fadeTarget = Math.min(1, e / IDLE_FADE_S, (cycle - e) / IDLE_FADE_S);
        continuous = true;
      } else camD = 0;
      speed *= 0.9;
      if (speed > 0.01) continuous = true;
    } else if (mode === "preload") {
      camD = d0;
      speed = 0;
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

    // fade from black once the first covers are in
    let fade = fadeStart === null ? 0 : Math.min(1, Math.max(0, (t - fadeStart) / FADE_MS));
    if (fade < 1 && fadeStart !== null) continuous = true;
    fade = Math.min(fade, fadeTarget);
    const fs = fade * fade * (3 - 2 * fade);
    shared.uFade.value = fs;
    fog.near = FOG_NEAR * fs;
    fog.far = Math.max(fog.near + 0.01, FOG_FAR * fs);

    // camera: ride the trunk, then rise and pull back over the landing
    ridePose(camD, mode === "idle" ? (t - idleStart) / 1000 : 0);
    let { px, py, pz, lx, ly, lz } = ride;
    let roll = ride.roll;
    if (landing > 0) {
      const tx = trunkX(destZ);
      const ty = trunkY(destZ);
      px = lerp(px, tx, landing);
      py = lerp(py, ty + L.rise, landing);
      pz = lerp(pz, destZ + L.pull, landing);
      lx = lerp(lx, tx, landing);
      ly = lerp(ly, ty + L.lookDy, landing);
      lz = lerp(lz, destZ, landing);
      roll *= 1 - landing;
    }
    camera.position.set(px, py, pz);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    look.set(lx, ly, lz);
    camera.lookAt(look);
    camera.fov = 62 + speed * 36;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // nodes: the runs in the window round the camera
    const camWeek = Math.max(0, -pz / SP);
    const wFrom = Math.max(0, Math.floor(camWeek) - BEHIND_WEEKS);
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
      if (mid < camWeek - 1) continue;
      if (flightLive && passingSpeed(mid) > LOAD_SPEED) continue;
      if (!store.want(data.song[data.runStart[r]])) wantedMissing++;
    }
    store.pump();

    // covers: swap in what arrived (get() also stamps on-screen covers so the LRU keeps them),
    // hide the destination run's node (the 600×600 card stands in), fade what would block the landing
    for (let k = 0; k < POOL_SIZE; k++) {
      const run = slots.weekOf[k];
      const m = nodes[k];
      if (run < 0 || run < r0 || run > r1 || (run === targetRun && targetIdx >= 0)) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      const u = m.material.uniforms;
      const tex: Texture = store.get(data.song[data.runStart[run]]) ?? placeholder;
      if (u.map.value !== tex) u.map.value = tex;
      u.uOpacity.value = landing > 0 ? 1 - landing * smooth(destZ + 0.2, destZ + 1.4, nodeZ[k]) : 1;
    }
    if (targetIdx >= 0) {
      const song = data.song[targetIdx];
      destMat.uniforms.map.value = store.large600(song) ?? store.get(song) ?? placeholder;
      destMat.uniforms.uBright.value = 0.72 + 0.28 * landing;
      destMat.uniforms.uEdgeA.value = 0.55 + 0.45 * landing;
    }

    // threads + particles follow the camera
    threadMat.uniforms.uZ0.value = Math.ceil((pz + 8) / THREAD_SEG) * THREAD_SEG;
    threadMat.uniforms.uPxK.value = (2 * Math.tan(((camera.fov / 2) * Math.PI) / 180)) / Math.max(1, height);
    particleMat.uniforms.uCamZ.value = pz;
    particleMat.uniforms.uFlow.value = mode === "idle" && freeze === null ? ((t / 1000) * 1.1) % PARTICLE_WIN : 0;
    particleMat.uniforms.uLen.value = 0.06 + speed * 5.5;
    threadMat.uniforms.uCut.value = destZ;
    threadMat.uniforms.uCutK.value = targetIdx >= 0 ? landing : 0;
    particleMat.uniforms.uWarp.value = speed;

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

    const labelAlpha = smooth(0.82, 1, landing) * fs;
    const relaid = updateLabels(labelAlpha);

    renderer.clear();
    renderer.render(scene, camera);
    if (labelAlpha > 0.001) {
      renderer.clearDepth();
      renderer.render(overlay, ortho);
    }

    if (!firstFrameMarked) {
      firstFrameMarked = true;
      canvas.dataset.firstFrame = String(Math.round(now()));
    }
    // pending = covers still loading for this view, the destination cover, or the fade-in
    const pendingNow =
      wantedMissing +
      (targetIdx >= 0 && destMat.uniforms.map.value === placeholder ? 1 : 0) +
      (fade < 1 ? 1 : 0);
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
    if (continuous || store.throttled || relaid) requestRender();
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
      if (mode === "idle") idleStart = resume(idleStart);
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

  // fonts: draw with what is there now, redraw year labels, sleeves and branch labels once Archivo lands
  awaitFonts(2500).then(() => {
    if (disposed) return;
    fonts = canvasFonts();
    for (const r of rings) if (r.year) drawYearLabel(r.tex, r.year, fonts);
    store.refreshSleeves();
    slots.invalidate();
    labelsKey = "";
    requestRender();
  });

  resize();
  // compile every program now, not on first use mid-flight (a phone stalls on a shader compile)
  {
    const hiddenNow = [nodes[0], dest, rings[0].ring, rings[0].label, leaders, dots, labelSlots[0].mesh];
    const was = hiddenNow.map((o) => o.visible);
    hiddenNow.forEach((o) => (o.visible = true));
    renderer.compile(scene, camera);
    renderer.compile(overlay, ortho);
    hiddenNow.forEach((o, k) => (o.visible = was[k]));
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
    placeholder.dispose();
    for (const m of nodes) m.material.dispose();
    destMat.dispose();
    quadGeo.dispose();
    threadGeo.dispose();
    threadMat.dispose();
    particleGeo.dispose();
    particleMat.dispose();
    ringGeo.dispose();
    ringMat.dispose();
    yearGeo.dispose();
    for (const r of rings) {
      r.tex.dispose();
      r.label.material.dispose();
    }
    for (const s of labelSlots) {
      s.sprite?.tex.dispose();
      s.mesh.material.dispose();
    }
    leaderGeo.dispose();
    leaderMat.dispose();
    dotGeo.dispose();
    dotMat.dispose();
    scene.clear();
    overlay.clear();
    renderer.dispose();
  }

  return { setTarget, setFreeze, setBranches, skip, dispose };
}
