/**
 * Cover textures for the tunnel: proximity loading, a small LRU, typeset
 * sleeves for songs with no art, and the canvas fonts they are drawn in.
 *
 * Nothing here fetches a cover the camera is not about to meet. The tunnel
 * calls `want()` each frame in priority order; `pump()` keeps at most
 * CONCURRENCY image requests in flight and drops the rest of the queue.
 */
import { CanvasTexture, LinearFilter, SRGBColorSpace, Texture } from "three";
import { artUrl, type FlightData } from "./data";
import { Lru } from "./pool";

export const SIGNAL = "#ff3b1f";
export const INK = "#f4f4f4";
const SLEEVE_GROUND = "#0b0b0b";

const CONCURRENCY = 6;
const LRU_CAPACITY = 180;
const SLEEVES_PER_FRAME = 3;
export const WALL_ART_SIZE = 200;
export const DEST_ART_SIZE = 600;

// ---------- fonts ----------

const DISPLAY_FALLBACK = '"Archivo Narrow", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif';
const MONO_FALLBACK = 'ui-monospace, "SF Mono", Menlo, monospace';

/** A loaded (or loadable) document font whose family matches, ignoring next/font's fallback faces. */
function findFamily(re: RegExp): string | null {
  if (typeof document === "undefined" || !document.fonts) return null;
  let hit: string | null = null;
  document.fonts.forEach((f) => {
    if (hit) return;
    const fam = f.family.replace(/^["']|["']$/g, "");
    if (re.test(fam) && !/fallback/i.test(fam)) hit = fam;
  });
  return hit;
}

export interface CanvasFonts {
  display: string;
  mono: string;
}

export function canvasFonts(): CanvasFonts {
  const archivo = findFamily(/archivo/i);
  const mono = findFamily(/jetbrains/i);
  return {
    display: archivo ? `"${archivo}", ${DISPLAY_FALLBACK}` : DISPLAY_FALLBACK,
    mono: mono ? `"${mono}", ${MONO_FALLBACK}` : MONO_FALLBACK,
  };
}

/** Resolve once Archivo + JetBrains Mono are usable, or after `timeoutMs`, whichever is first. */
export function awaitFonts(timeoutMs: number): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const loads: Promise<unknown>[] = [];
  const archivo = findFamily(/archivo/i);
  const mono = findFamily(/jetbrains/i);
  if (archivo) loads.push(document.fonts.load(`900 150px "${archivo}"`), document.fonts.load(`800 40px "${archivo}"`));
  if (mono) loads.push(document.fonts.load(`400 14px "${mono}"`));
  if (!loads.length) return Promise.resolve();
  return Promise.race([
    Promise.all(loads).then(() => undefined, () => undefined),
    new Promise<void>((r) => setTimeout(r, timeoutMs)),
  ]);
}

function condensed(g: CanvasRenderingContext2D, stretch: CanvasFontStretch = "condensed") {
  // Archivo is variable on wdth; canvas picks the axis through fontStretch where supported.
  if ("fontStretch" in g) g.fontStretch = stretch;
}

function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d canvas unavailable");
  return [c, g];
}

function asTexture(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

// ---------- sleeves ----------

/** Break `text` into lines no wider than `max` at the current font. */
function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (line && g.measureText(t).width > max) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsize(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && g.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/**
 * A typeset sleeve for a #1 with no resolvable cover: intentional, never a grey box.
 * Title in condensed Archivo, artist in mono, a signal-red rule round the edge.
 */
export function drawSleeve(song: string, artist: string, size: number, fonts: CanvasFonts): CanvasTexture {
  const [c, g] = canvas2d(size, size);
  const u = size / 256;
  g.fillStyle = SLEEVE_GROUND;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = SIGNAL;
  g.lineWidth = 3 * u;
  g.strokeRect(9 * u, 9 * u, size - 18 * u, size - 18 * u);

  const pad = 24 * u;
  const maxW = size - pad * 2;
  const title = song.toUpperCase();
  let px = 50 * u;
  let lines: string[] = [];
  g.textBaseline = "top";
  g.fillStyle = INK;
  for (; px >= 20 * u; px -= 2 * u) {
    g.font = `800 ${px}px ${fonts.display}`;
    condensed(g);
    lines = wrap(g, title, maxW);
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    if (lines.length * px * 0.98 <= 150 * u && widest <= maxW) break;
  }
  lines.forEach((l, i) => g.fillText(l, pad, pad + i * px * 0.98, maxW));

  g.font = `400 ${13 * u}px ${fonts.mono}`;
  condensed(g, "normal");
  g.fillStyle = "rgba(244,244,244,.55)";
  g.textBaseline = "alphabetic";
  g.fillText(ellipsize(g, artist.toUpperCase(), maxW), pad, size - pad);
  return asTexture(c);
}

/** What a card shows while its cover is in flight: an empty sleeve outline, faint ink. */
export function drawPlaceholder(): CanvasTexture {
  const [c, g] = canvas2d(128, 128);
  g.fillStyle = SLEEVE_GROUND;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(244,244,244,.16)";
  g.lineWidth = 2;
  g.strokeRect(5, 5, 118, 118);
  return asTexture(c);
}

/** The year beside a ring, condensed Archivo in signal red, left-aligned, redrawn in place. */
export function drawYearLabel(tex: CanvasTexture, year: string, fonts: CanvasFonts): void {
  const c = tex.image as HTMLCanvasElement;
  const g = c.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = SIGNAL;
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.font = `800 ${Math.round(c.height * 0.86)}px ${fonts.display}`;
  condensed(g);
  g.fillText(year, 2, c.height * 0.54, c.width - 4);
  tex.needsUpdate = true;
}

export function yearLabelTexture(): CanvasTexture {
  const [c] = canvas2d(256, 96);
  return asTexture(c);
}

// ---------- the store ----------

function imageTexture(img: HTMLImageElement): Texture {
  const t = new Texture(img);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

function loadImage(url: string, high: boolean): { img: HTMLImageElement; done: Promise<HTMLImageElement> } {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  if ("fetchPriority" in img) (img as HTMLImageElement & { fetchPriority: string }).fetchPriority = high ? "high" : "low";
  img.src = url;
  // decode() keeps JPEG decoding off the frame that first draws the card
  const done = img.decode().then(() => img);
  return { img, done };
}

export class CoverStore {
  private lru: Lru<Texture>;
  private inflight = new Map<number, HTMLImageElement>();
  private failed = new Set<number>();
  private queue: number[] = [];
  private queuedStamp: Int32Array;
  private stamp = 0;
  private sleevesThisFrame = 0;
  /** A sleeve was wanted this frame but deferred to the next. */
  throttled = false;
  private disposed = false;
  private large = new Map<number, Texture>();
  private largeInflight = new Set<number>();
  /** Textures created, ever (telemetry). */
  created = 0;
  requested = 0;

  constructor(
    private data: FlightData,
    private fonts: () => CanvasFonts,
    private onReady: () => void,
  ) {
    this.lru = new Lru<Texture>(LRU_CAPACITY, (_k, t) => t.dispose());
    this.queuedStamp = new Int32Array(data.songs.length).fill(-1);
  }

  beginFrame(stamp: number): void {
    this.stamp = stamp;
    this.queue.length = 0;
    this.sleevesThisFrame = 0;
    this.throttled = false;
  }

  /** The ready texture for a song, or null while it loads. Marks it in use this frame. */
  get(song: number): Texture | null {
    return this.lru.get(song, this.stamp) ?? null;
  }

  has(song: number): boolean {
    return this.lru.has(song);
  }

  /** Ask for a song's wall texture; call in priority order, nearest first. Returns true if ready. */
  want(song: number): boolean {
    if (this.lru.has(song)) {
      this.lru.touch(song, this.stamp);
      return true;
    }
    if (this.queuedStamp[song] === this.stamp) return false;
    this.queuedStamp[song] = this.stamp;
    const s = this.data.songs[song];
    if (!s.art || this.failed.has(song)) {
      // typeset sleeve: drawn locally, a few per frame so a burst never drops one
      if (this.sleevesThisFrame < SLEEVES_PER_FRAME) {
        this.sleevesThisFrame++;
        this.put(song, drawSleeve(s.s, s.a, 256, this.fonts()));
        return true;
      }
      this.throttled = true;
      return false;
    }
    if (!this.inflight.has(song)) this.queue.push(song);
    return false;
  }

  /** Start requests from the front of this frame's queue, up to CONCURRENCY in flight. */
  pump(): void {
    for (let k = 0; k < this.queue.length && this.inflight.size < CONCURRENCY; k++) {
      const song = this.queue[k];
      if (this.inflight.has(song) || this.lru.has(song)) continue;
      this.fetch(song, k < 8);
    }
  }

  get pending(): number {
    return this.inflight.size + this.queue.length;
  }

  private put(song: number, t: Texture) {
    this.created++;
    this.lru.set(song, t, this.stamp);
  }

  private fetch(song: number, high: boolean) {
    const art = this.data.songs[song].art;
    if (!art) return;
    this.requested++;
    const { img, done } = loadImage(artUrl(art, WALL_ART_SIZE), high);
    this.inflight.set(song, img);
    done.then(
      (im) => {
        this.inflight.delete(song);
        if (this.disposed) return;
        this.put(song, imageTexture(im));
        this.onReady();
      },
      () => {
        this.inflight.delete(song);
        if (this.disposed) return;
        this.failed.add(song);
        this.onReady();
      },
    );
  }

  /** Load `songs` (deduped, in order) and resolve when all are ready or after `timeoutMs`. */
  preload(songs: number[], timeoutMs: number): Promise<void> {
    const uniq = [...new Set(songs)];
    const jobs: Promise<unknown>[] = [];
    for (const song of uniq) {
      if (this.lru.has(song)) continue;
      const s = this.data.songs[song];
      if (!s.art || this.failed.has(song)) {
        this.put(song, drawSleeve(s.s, s.a, 256, this.fonts()));
        continue;
      }
      if (this.inflight.has(song)) {
        const img = this.inflight.get(song)!;
        jobs.push(img.decode().catch(() => undefined));
        continue;
      }
      this.fetch(song, true);
      const img = this.inflight.get(song);
      if (img) jobs.push(img.decode().catch(() => undefined));
    }
    if (!jobs.length) return Promise.resolve();
    return Promise.race([
      Promise.all(jobs).then(() => undefined),
      new Promise<void>((r) => setTimeout(r, timeoutMs)),
    ]);
  }

  /** The destination card's 600×600 cover (or a large sleeve). Null until ready. */
  large600(song: number): Texture | null {
    const hit = this.large.get(song);
    if (hit) return hit;
    if (this.largeInflight.has(song)) return null;
    const s = this.data.songs[song];
    if (!s.art) {
      const t = drawSleeve(s.s, s.a, 512, this.fonts());
      this.large.set(song, t);
      return t;
    }
    this.largeInflight.add(song);
    const { done } = loadImage(artUrl(s.art, DEST_ART_SIZE), true);
    done.then(
      (im) => {
        this.largeInflight.delete(song);
        if (this.disposed) return;
        this.large.set(song, imageTexture(im));
        this.onReady();
      },
      () => {
        this.largeInflight.delete(song);
        if (this.disposed) return;
        this.large.set(song, drawSleeve(s.s, s.a, 512, this.fonts()));
        this.onReady();
      },
    );
    return null;
  }

  /** Drop typeset sleeves so they redraw in the real font once it arrives. */
  refreshSleeves(): void {
    for (let song = 0; song < this.data.songs.length; song++) {
      const s = this.data.songs[song];
      if ((!s.art || this.failed.has(song)) && this.lru.has(song)) {
        this.put(song, drawSleeve(s.s, s.a, 256, this.fonts()));
      }
    }
    for (const [song, t] of this.large) {
      const s = this.data.songs[song];
      if (!s.art || this.failed.has(song)) {
        t.dispose();
        this.large.set(song, drawSleeve(s.s, s.a, 512, this.fonts()));
      }
    }
  }

  get size(): number {
    return this.lru.size;
  }

  dispose(): void {
    this.disposed = true;
    for (const img of this.inflight.values()) img.src = "";
    this.inflight.clear();
    this.lru.clear();
    for (const t of this.large.values()) t.dispose();
    this.large.clear();
  }
}
