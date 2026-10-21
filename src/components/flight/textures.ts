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
import type { PlannedCover } from "./plan";

export const SIGNAL = "#ff3b1f";
export const INK = "#f4f4f4";
const SLEEVE_GROUND = "#0b0a0a";

/** Parallel cover requests (Apple's CDN is HTTP/2: many requests share a connection). */
const CONCURRENCY = 36;
/** Flight covers are small; covers near a slow camera upgrade; the destination is large. */
export const FLIGHT_ART_SIZE = 100;
export const NEAR_ART_SIZE = 300;
export const DEST_ART_SIZE = 600;
const ART_CAPACITY = 1000; // 100 px: 40 KB each, uploaded only once drawn
const NEAR_CAPACITY = 36;
const SLEEVE_CAPACITY = 220;
const SLEEVE_SIZE = 128;
const SLEEVES_PER_FRAME = 4;
/** A planned cover whose moment has passed by more than this is not fetched any more. */
const LATE_MS = 120;

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
 * A typeset sleeve: what a cover slot shows until its art arrives (and for good when a song has
 * no art). Title in condensed Archivo, artist in mono, on near-black with a thin hairline.
 */
export function drawSleeve(song: string, artist: string, size: number, fonts: CanvasFonts): CanvasTexture {
  const [c, g] = canvas2d(size, size);
  const u = size / 256;
  g.fillStyle = SLEEVE_GROUND;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = "rgba(244,244,244,.24)";
  g.lineWidth = Math.max(1, 1.5 * u);
  g.strokeRect(6 * u, 6 * u, size - 12 * u, size - 12 * u);

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

/** A plain sleeve (ground + hairline): the frame before a song's typeset sleeve is drawn. */
export function drawPlaceholder(): CanvasTexture {
  const [c, g] = canvas2d(128, 128);
  g.fillStyle = SLEEVE_GROUND;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(244,244,244,.24)";
  g.lineWidth = 1;
  g.strokeRect(3, 3, 122, 122);
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


type Tier = 0 | 1; // 0 = flight (100 px), 1 = near (300 px)

/**
 * Cover textures, keyed by artwork (two #1s sharing a sleeve share one request).
 *
 * - `plan()` takes the covers a flight will pass in the order the camera reaches them; `pump()`
 *   keeps CONCURRENCY requests going down that list, skipping any whose moment has passed.
 * - `want()` asks for covers round the camera outside a plan (idle drift, the landing).
 * - Until a cover's art arrives its slot shows `sleeve()`: the song's typeset sleeve (a few drawn
 *   per frame) or, before that, a plain sleeve. Never an empty slot.
 */
export class CoverStore {
  /** art id per song (songs with the same artwork share one) */
  readonly artId: Int32Array;
  private artUrl: string[] = [];
  private art: Lru<Texture>;
  private near: Lru<Texture>;
  private sleeves: Lru<CanvasTexture>;
  readonly blank: CanvasTexture;
  private inflight = new Map<number, HTMLImageElement>(); // key = artId * 2 + tier
  private failed = new Set<number>();
  private queue: number[] = [];
  private queuedStamp: Int32Array;
  private planned: PlannedCover[] = [];
  private planPos = 0;
  private stamp = 0;
  private sleevesThisFrame = 0;
  /** A typeset sleeve was wanted this frame but deferred to the next. */
  throttled = false;
  private disposed = false;
  private large = new Map<number, Texture>();
  private largeInflight = new Set<number>();
  private waiters: Array<{ ids: number[]; resolve: () => void }> = [];
  /** telemetry */
  requested = 0;
  loaded = 0;

  constructor(
    private data: FlightData,
    private fonts: () => CanvasFonts,
    private onReady: () => void,
  ) {
    const ids = new Map<string, number>();
    this.artId = new Int32Array(data.songs.length);
    data.songs.forEach((sg, i) => {
      const key = sg.art ?? `sleeve:${i}`;
      if (!ids.has(key)) {
        ids.set(key, ids.size);
        this.artUrl.push(sg.art ?? "");
      }
      this.artId[i] = ids.get(key)!;
    });
    this.art = new Lru<Texture>(ART_CAPACITY, (_k, t) => t.dispose());
    this.near = new Lru<Texture>(NEAR_CAPACITY, (_k, t) => t.dispose());
    this.sleeves = new Lru<CanvasTexture>(SLEEVE_CAPACITY, (_k, t) => t.dispose());
    this.queuedStamp = new Int32Array(ids.size * 2).fill(-1);
    this.blank = drawPlaceholder();
  }

  beginFrame(stamp: number): void {
    this.stamp = stamp;
    this.queue.length = 0;
    this.sleevesThisFrame = 0;
    this.throttled = false;
  }

  private hasArt(song: number): boolean {
    return !!this.artUrl[this.artId[song]] && !this.failed.has(this.artId[song]);
  }

  /** The best loaded art for a song (near tier first), or null. Marks it in use this frame. */
  get(song: number): Texture | null {
    const id = this.artId[song];
    return this.near.get(id, this.stamp) ?? this.art.get(id, this.stamp) ?? null;
  }

  has(song: number): boolean {
    const id = this.artId[song];
    return this.art.has(id) || this.near.has(id);
  }

  /** What the slot shows until the art is in: the song's typeset sleeve, or a plain one while that is drawn. */
  sleeve(song: number): Texture {
    const hit = this.sleeves.get(song, this.stamp);
    if (hit) return hit;
    if (this.sleevesThisFrame < SLEEVES_PER_FRAME) {
      this.sleevesThisFrame++;
      const s = this.data.songs[song];
      // a song with no art keeps its sleeve, so it is drawn sharper
      const t = drawSleeve(s.s, s.a, this.hasArt(song) ? SLEEVE_SIZE : 256, this.fonts());
      this.sleeves.set(song, t, this.stamp);
      return t;
    }
    this.throttled = true;
    return this.blank;
  }

  /** Ask for a cover round the camera (nearest first). Returns true if its art is in. */
  want(song: number, tier: Tier = 0): boolean {
    const id = this.artId[song];
    if (!this.hasArt(song)) return false;
    const lru = tier ? this.near : this.art;
    if (lru.has(id)) {
      lru.touch(id, this.stamp);
      return true;
    }
    const key = id * 2 + tier;
    if (this.queuedStamp[key] === this.stamp) return false;
    this.queuedStamp[key] = this.stamp;
    if (!this.inflight.has(key)) this.queue.push(key);
    return false;
  }

  /** The covers a flight will pass, in the order the camera reaches them. Replaces any earlier plan. */
  plan(list: PlannedCover[]): void {
    const seen = new Set<number>();
    this.planned = [];
    for (const p of list) {
      const id = this.artId[p.song];
      if (seen.has(id) || !this.hasArt(p.song)) continue;
      seen.add(id);
      this.planned.push(p);
    }
    this.planPos = 0;
  }

  /** Fraction of the plan's covers due before `until` that are loaded (1 when none are due). */
  readyBefore(until: number): number {
    let due = 0;
    let ok = 0;
    for (const p of this.planned) {
      if (p.at > until) break;
      due++;
      if (this.art.has(this.artId[p.song])) ok++;
    }
    return due ? ok / due : 1;
  }

  /** Keep CONCURRENCY requests going: this frame's local wants first, then down the plan. */
  pump(now: number): void {
    for (let k = 0; k < this.queue.length && this.inflight.size < CONCURRENCY; k++) {
      const key = this.queue[k];
      if (this.inflight.has(key)) continue;
      this.fetch(key >> 1, (key & 1) as Tier, k < 8);
    }
    while (this.inflight.size < CONCURRENCY && this.planPos < this.planned.length) {
      const p = this.planned[this.planPos++];
      const id = this.artId[p.song];
      if (p.until < now + LATE_MS) continue; // the camera will be past it before it can arrive
      if (this.art.has(id) || this.inflight.has(id * 2)) continue;
      this.fetch(id, 0, this.planPos < 24);
    }
  }

  get pending(): number {
    return this.inflight.size + this.queue.length;
  }

  private fetch(id: number, tier: Tier, high: boolean) {
    const url = this.artUrl[id];
    if (!url || this.failed.has(id)) return;
    const key = id * 2 + tier;
    this.requested++;
    const { img, done } = loadImage(artUrl(url, tier ? NEAR_ART_SIZE : FLIGHT_ART_SIZE), high);
    this.inflight.set(key, img);
    done.then(
      (im) => {
        this.inflight.delete(key);
        if (this.disposed) return;
        (tier ? this.near : this.art).set(id, imageTexture(im), this.stamp);
        this.loaded++;
        this.settleWaiters();
        this.onReady();
      },
      () => {
        this.inflight.delete(key);
        if (this.disposed) return;
        if (!tier) this.failed.add(id);
        this.settleWaiters();
        this.onReady();
      },
    );
  }

  private settleWaiters() {
    this.waiters = this.waiters.filter((w) => {
      const done = w.ids.every((id) => this.art.has(id) || this.failed.has(id));
      if (done) w.resolve();
      return !done;
    });
  }

  /** Load the flight-size art for `songs` now and resolve when all are in, or after `timeoutMs`. */
  preload(songs: number[], timeoutMs: number): Promise<void> {
    const ids = [...new Set(songs.filter((s) => this.hasArt(s)).map((s) => this.artId[s]))];
    for (const id of ids) if (!this.art.has(id) && !this.inflight.has(id * 2)) this.fetch(id, 0, true);
    const missing = ids.filter((id) => !this.art.has(id));
    if (!missing.length) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const w = { ids: missing, resolve };
      this.waiters.push(w);
      setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== w);
        resolve();
      }, timeoutMs);
    });
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
    this.sleeves.clear();
    for (const [song, t] of this.large) {
      if (!this.data.songs[song].art) {
        t.dispose();
        const s = this.data.songs[song];
        this.large.set(song, drawSleeve(s.s, s.a, 512, this.fonts()));
      }
    }
  }

  get size(): number {
    return this.art.size;
  }

  dispose(): void {
    this.disposed = true;
    for (const img of this.inflight.values()) img.src = "";
    this.inflight.clear();
    this.art.clear();
    this.near.clear();
    this.sleeves.clear();
    this.blank.dispose();
    for (const t of this.large.values()) t.dispose();
    this.large.clear();
    for (const w of this.waiters) w.resolve();
    this.waiters = [];
  }
}
