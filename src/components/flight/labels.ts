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
  /** regions the page's DOM HUD owns; the canvas draws no label or node into them */
  hud: Rect[];
}

/**
 * The landing frame ("the money shot"). Desktop: the landed cover in the right
 * half, clear of the passing title bottom-left and the readouts top-right; its
 * branches end in two columns of nodes above it. Phone: the cover centred in
 * the upper 55%, the branch nodes in a crown above it, below the readouts.
 */
export function canopyFrame(nLeft: number, nRight: number, v: CanopyView): CanopyFrame {
  const { w, h } = v;
  if (v.narrow) {
    const destW = Math.min(0.3 * w, 0.17 * h);
    const dest = { x: 0.5 * w, y: 0.47 * h };
    const lx = dest.x - Math.max(destW * 0.32, 0.1 * w);
    const rx = dest.x + Math.max(destW * 0.32, 0.1 * w);
    const top = 0.245 * h;
    const bottom = dest.y - destW / 2 - 0.035 * h;
    const gap = 7;
    return {
      dest,
      destW,
      left: column(nLeft, lx, top, bottom),
      right: column(nRight, rx, top, bottom),
      labelMaxW: Math.max(80, lx - gap - 16),
      labelGap: gap,
      hud: [
        { x0: 0, y0: 0, x1: w, y1: 0.2 * h },
        { x0: 0, y0: 0.57 * h, x1: w, y1: h },
      ],
    };
  }
  const destW = Math.min(0.12 * w, 0.24 * h);
  const dest = { x: 0.66 * w, y: 0.63 * h };
  // a wide crown: the limbs reach well out from the trunk before they end
  const rx = Math.min(dest.x + 0.15 * w, w - 16 - 10 - 230);
  const lx = Math.max(dest.x - 0.17 * w, 16 + 10 + 230);
  const gap = 10;
  return {
    dest,
    destW,
    left: column(nLeft, lx, 0.21 * h, 0.45 * h),
    right: column(nRight, rx, 0.24 * h, 0.48 * h),
    labelMaxW: Math.min(230, w - 16 - (rx + gap)),
    labelGap: gap,
    hud: [
      { x0: 0.72 * w, y0: 0, x1: w, y1: 0.18 * h },
      { x0: 0, y0: 0, x1: 0.22 * w, y1: 0.09 * h },
      { x0: 0, y0: 0.5 * h, x1: 0.45 * w, y1: h },
    ],
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
  const songPx = narrow ? 14 : 18;
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
  if (song) {
    measure.font = `800 ${songPx}px ${fonts.display}`;
    if ("fontStretch" in measure) measure.fontStretch = "condensed";
    if ("letterSpacing" in measure) (measure as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    if ((opts.songLines ?? 1) === 2 && measure.measureText(song).width > opts.maxW) {
      // two lines when there is room: break at a word, ellipsize the rest
      const words = song.split(/\s+/);
      let first = "";
      let k = 0;
      for (; k < words.length; k++) {
        const t = first ? `${first} ${words[k]}` : words[k];
        if (first && measure.measureText(t).width > opts.maxW) break;
        first = t;
      }
      songLines = [ellipsize(measure, first, opts.maxW)];
      const rest = words.slice(k).join(" ");
      if (rest) songLines.push(ellipsize(measure, rest, opts.maxW));
    } else songLines = [ellipsize(measure, song, opts.maxW)];
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
  return { tex, w, h };
}
