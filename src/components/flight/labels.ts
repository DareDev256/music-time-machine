/**
 * Branch labels for the landing cross-section: two-line canvas labels (lane in
 * mono caps, song in condensed caps) laid out as callouts round the
 * destination cover. The layout is pure and tested; drawing needs a DOM.
 */
import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import { INK, SIGNAL, type CanvasFonts } from "./textures";

export interface FlightBranch {
  lane: string;
  label: string;
  song?: string;
  artist?: string;
  mine?: boolean;
}

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface CanopyView {
  w: number;
  h: number;
  narrow: boolean;
}

/** Where the landing frame puts things, in CSS px from the top-left. */
export interface CanopyFrame {
  /** centre of the landed cover */
  dest: Point;
  /** its width */
  destW: number;
  /** branch end nodes: labels hang to the left of `left`, to the right of `right` */
  left: Point[];
  right: Point[];
  labelMaxW: number;
  labelGap: number;
  /** regions the page's DOM HUD owns; the canvas draws no label, node or cover into them */
  hud: Rect[];
}

/**
 * The console's HUD zones. The round-3 contract said phone bottom 30% and desktop bottom-left
 * 45% × 32%, but the console's passing title grows upward for a two-line song: measured on the
 * live console it starts at ~54% of the height on a phone and ~52% on desktop. The zones follow
 * what the console actually draws.
 */
export function hudZones(w: number, h: number, narrow: boolean): Rect[] {
  return narrow
    ? [
        { x0: 0, y0: 0, x1: w, y1: 0.24 * h },
        { x0: 0, y0: 0.535 * h, x1: w, y1: h },
      ]
    : [
        { x0: 0, y0: 0, x1: 0.34 * w, y1: 0.3 * h },
        { x0: 0.7 * w, y0: 0, x1: w, y1: 0.22 * h },
        { x0: 0, y0: 0.5 * h, x1: 0.45 * w, y1: h },
      ];
}

/** Phones label at most this many branches at the landing (the era page lists every chart). */
export const PHONE_MAX_LABELS = 6;

/** At most `max` branches, the visitor's own lane first, the rest in their given order. */
export function pickBranches<T extends { mine?: boolean }>(list: T[], max: number): T[] {
  if (list.length <= max) return list;
  const keep = new Set<T>(list.filter((b) => b.mine).slice(0, max));
  for (const b of list) if (keep.size < max) keep.add(b);
  return list.filter((b) => keep.has(b));
}

/**
 * The landing frame ("the money shot"). Desktop: the landed cover in the free
 * right-centre, its labelled branches in two loose, unequal columns either
 * side. Phone: the cover high in the free band, the labelled branches below it.
 * Node positions carry a deterministic jitter (seeded per destination) so the
 * branches never read as a mirrored fan.
 */
export function canopyFrame(nLeft: number, nRight: number, v: CanopyView, seed = 0): CanopyFrame {
  const { w, h } = v;
  const jit = (k: number) => {
    const s = Math.sin((seed + 1) * 12.9898 + k * 78.233) * 43758.5453;
    return s - Math.floor(s) - 0.5;
  };
  if (v.narrow) {
    // the free band on a phone is 24%–53.5%: the cover high in it, up to three labels per column below
    const destW = Math.min(0.27 * w, 0.125 * h);
    const dest = { x: 0.56 * w, y: 0.315 * h };
    const gap = 7;
    const top = 0.405 * h;
    const bottom = 0.5 * h;
    const left = column(nLeft, 0.47 * w, top, bottom - 0.008 * h).map((p, k) => ({ x: p.x + jit(k) * 0.04 * w, y: p.y + jit(k + 9) * 0.006 * h }));
    const right = column(nRight, 0.53 * w, top + 0.008 * h, bottom).map((p, k) => ({ x: p.x + jit(k + 20) * 0.04 * w, y: p.y + jit(k + 29) * 0.006 * h }));
    return {
      dest,
      destW,
      left,
      right,
      labelMaxW: Math.max(80, 0.445 * w - gap - 16),
      labelGap: gap,
      hud: hudZones(w, h, true),
    };
  }
  const destW = Math.min(0.11 * w, 0.2 * h);
  const dest = { x: 0.73 * w, y: 0.4 * h };
  const gap = 10;
  // left labels end at their node and never reach left of 45% width: the page's passing title
  // (bottom-left) can grow up to half the height for a two-line song
  const lx = 0.63 * w;
  const left = column(nLeft, lx, 0.27 * h, 0.6 * h).map((p, k) => ({ x: p.x + jit(k) * 0.012 * w, y: p.y + jit(k + 9) * 0.02 * h }));
  const right = column(nRight, 0.83 * w, 0.28 * h, 0.66 * h).map((p, k) => ({ x: p.x + jit(k + 20) * 0.012 * w, y: p.y + jit(k + 29) * 0.02 * h }));
  return {
    dest,
    destW,
    left,
    right,
    labelMaxW: Math.min(230, lx - 0.006 * w - gap - 0.45 * w, w - 16 - (0.83 * w + 0.006 * w + gap)),
    labelGap: gap,
    hud: hudZones(w, h, false),
  };
}

function column(n: number, x: number, top: number, bottom: number): Point[] {
  const out: Point[] = [];
  for (let k = 0; k < n; k++) out.push({ x, y: n === 1 ? (top + bottom) / 2 : top + ((bottom - top) * k) / (n - 1) });
  return out;
}

/** The box a label occupies beside its node (left column: ends at the node; right: starts at it). */
export function labelBox(node: Point, side: "left" | "right", w: number, h: number, gap: number): Rect {
  const x0 = side === "left" ? node.x - gap - w : node.x + gap;
  return { x0, y0: node.y - h / 2, x1: x0 + w, y1: node.y + h / 2 };
}

/** Short name when the page's chart label would not fit beside a branch. */
export function shortLabel(label: string, fallback: string, narrow: boolean): string {
  return label && label.length <= (narrow ? 12 : 22) ? label : fallback;
}

// ---------- drawing ----------

export interface LabelSprite {
  tex: CanvasTexture;
  /** CSS px */
  w: number;
  h: number;
  /** the title had to be cut with an ellipsis */
  cut: boolean;
}

function ellipsize(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && g.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/**
 * Draw one label at device resolution. `align` right for labels left of the
 * cover so the text ends at the leader line.
 */
export function drawBranchLabel(
  b: FlightBranch,
  opts: { maxW: number; dpr: number; narrow: boolean; align: "left" | "right"; fonts: CanvasFonts; songLines?: 1 | 2 },
  reuse?: CanvasTexture,
): LabelSprite {
  const { dpr, narrow, fonts } = opts;
  const monoPx = narrow ? 9 : 10.5;
  let songPx = narrow ? 14 : 18;
  const lineGap = narrow ? 3 : 4;
  // on a phone the lane name alone: the song is the fact, the artist would only truncate
  const top = (b.artist && !narrow ? `${b.label} · ${b.artist}` : b.label).toUpperCase();
  const song = b.song ? b.song.toUpperCase() : "";

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("2d canvas unavailable");
  measure.font = `400 ${monoPx}px ${fonts.mono}`;
  if ("letterSpacing" in measure) (measure as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0.14em";
  const topText = ellipsize(measure, top, opts.maxW);
  let w = measure.measureText(topText).width;
  let songLines: string[] = [];
  let cut = false;
  if (song) {
    measure.font = `800 ${songPx}px ${fonts.display}`;
    if ("fontStretch" in measure) measure.fontStretch = "condensed";
    if ("letterSpacing" in measure) (measure as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    if ((opts.songLines ?? 1) === 2 && measure.measureText(song).width > opts.maxW) {
      // two balanced lines: the split that makes the longer line shortest (no lonely last word)
      const words = song.split(/\s+/);
      let best = 1;
      let bestW = Infinity;
      for (let k = 1; k < words.length; k++) {
        const wMax = Math.max(measure.measureText(words.slice(0, k).join(" ")).width, measure.measureText(words.slice(k).join(" ")).width);
        if (wMax < bestW) {
          bestW = wMax;
          best = k;
        }
      }
      songLines = words.length > 1 ? [words.slice(0, best).join(" "), words.slice(best).join(" ")] : [song];
      songLines = songLines.map((l) => ellipsize(measure, l, opts.maxW));
    } else {
      // one line: shrink a long title (down to 78%) before it is ever cut
      const wide = measure.measureText(song).width;
      if (wide > opts.maxW) {
        songPx = Math.max(songPx * 0.78, Math.floor(songPx * (opts.maxW / wide) * 10) / 10);
        measure.font = `800 ${songPx}px ${fonts.display}`;
      }
      songLines = [ellipsize(measure, song, opts.maxW)];
    }
    cut = songLines.some((l) => l.endsWith("…"));
    for (const l of songLines) w = Math.max(w, measure.measureText(l).width);
  }
  w = Math.ceil(Math.min(opts.maxW, w) + 4);
  const h = Math.ceil(monoPx * 1.25 + (songLines.length ? lineGap + songPx * 1.02 * songLines.length : 0) + 2);

  const cw = Math.ceil(w * dpr);
  const ch = Math.ceil(h * dpr);
  // a GPU texture keeps the size it was first uploaded at: a new size gets a new texture
  const old = reuse?.image as HTMLCanvasElement | undefined;
  if (reuse && (!old || old.width !== cw || old.height !== ch)) {
    reuse.dispose();
    reuse = undefined;
  }
  const c = (reuse?.image as HTMLCanvasElement | undefined) ?? document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d canvas unavailable");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.textBaseline = "top";
  g.textAlign = opts.align;
  const x = opts.align === "right" ? w - 2 : 2;
  g.font = `400 ${monoPx}px ${fonts.mono}`;
  if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0.14em";
  // a black halo keeps the text legible where a thread or another leader passes under it
  g.lineJoin = "round";
  g.strokeStyle = "rgba(0,0,0,.9)";
  g.lineWidth = 3;
  g.strokeText(topText, x, 1);
  g.fillStyle = b.mine ? SIGNAL : "rgba(244,244,244,.62)";
  g.fillText(topText, x, 1);
  if (songLines.length) {
    g.font = `800 ${songPx}px ${fonts.display}`;
    if ("fontStretch" in g) g.fontStretch = "condensed";
    if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    songLines.forEach((line, i) => {
      const y = 1 + monoPx * 1.25 + lineGap + i * songPx * 1.02;
      g.lineWidth = 4;
      g.strokeText(line, x, y);
      g.fillStyle = b.mine ? SIGNAL : INK;
      g.fillText(line, x, y);
    });
  }
  const tex = reuse ?? new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { tex, w, h, cut };
}
