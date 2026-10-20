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

export interface Box {
  w: number;
  h: number;
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

export interface LayoutView {
  w: number;
  h: number;
  /** side margin, px */
  margin: number;
  /** usable vertical band, px from the top */
  top: number;
  bottom: number;
  /** the destination cover: labels never cover it */
  avoid: Rect;
  /** px between anchor and label, and between stacked labels */
  gap: number;
}

export interface Placed {
  x: number;
  y: number;
  w: number;
  h: number;
  side: "left" | "right";
  /** leader line from the anchor to the label's inner edge */
  from: Point;
  to: Point;
}

/**
 * Callout layout: each label goes on the side of the cover its anchor is on,
 * beside the anchor (or above/below it when there is no room beside it), then
 * a short relaxation pushes labels off each other, off every anchor dot and off
 * the cover, inside the viewport band.
 */
export function layoutLabels(anchors: Point[], boxes: Box[], v: LayoutView): Placed[] {
  const cx = (v.avoid.x0 + v.avoid.x1) / 2;
  const cy = (v.avoid.y0 + v.avoid.y1) / 2;
  const vertical = new Set<number>();
  const placed: Placed[] = anchors.map((a, i) => {
    const b = boxes[i];
    const side: Placed["side"] = a.x < cx ? "left" : "right";
    let x = side === "left" ? a.x - v.gap - b.w : a.x + v.gap;
    x = Math.max(v.margin, Math.min(v.w - v.margin - b.w, x));
    let y = a.y - b.h / 2;
    // no room beside the anchor (a phone, an anchor near the edge): sit above or below it instead
    if (a.x > x - v.gap * 0.5 && a.x < x + b.w + v.gap * 0.5) {
      vertical.add(i);
      y = a.y < cy ? a.y - b.h - v.gap * 0.6 : a.y + v.gap * 0.6;
    }
    return { x, y, w: b.w, h: b.h, side, from: a, to: a };
  });

  const pad = 4;
  const sep = v.gap * 0.5;
  const clampY = (p: Placed) => (p.y = Math.max(v.top, Math.min(v.bottom - p.h, p.y)));
  const clampX = (p: Placed) => (p.x = Math.max(v.margin, Math.min(v.w - v.margin - p.w, p.x)));
  placed.forEach(clampY);
  for (let iter = 0; iter < 80; iter++) {
    let moved = false;
    // labels off each other
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const p = placed[i];
        const q = placed[j];
        const ox = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x);
        const oy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) + sep;
        if (ox <= 0 || oy <= 0) continue;
        const [top, bot] = p.y + p.h / 2 <= q.y + q.h / 2 ? [p, q] : [q, p];
        top.y -= oy / 2;
        bot.y += oy / 2;
        if (top.y < v.top) {
          bot.y += v.top - top.y;
          top.y = v.top;
        }
        if (bot.y + bot.h > v.bottom) {
          top.y -= bot.y + bot.h - v.bottom;
          bot.y = v.bottom - bot.h;
        }
        moved = true;
      }
    // labels off their own anchor dot (others may pass under a label: labels draw on top, haloed)
    for (const p of placed) {
      const a = p.from;
      {
        if (!(a.x > p.x - pad && a.x < p.x + p.w + pad && a.y > p.y - pad && a.y < p.y + p.h + pad)) continue;
        const up = a.y - pad - (p.y + p.h);
        const down = a.y + pad - p.y;
        const canUp = p.y + up >= v.top;
        const canDown = p.y + down + p.h <= v.bottom;
        p.y += canUp && (!canDown || -up <= down) ? up - 0.5 : down + 0.5;
        moved = true;
      }
    }
    // labels off the cover: out sideways first
    for (const p of placed) {
      const c = v.avoid;
      const hit = p.x < c.x1 + sep && p.x + p.w > c.x0 - sep && p.y < c.y1 + sep && p.y + p.h > c.y0 - sep;
      if (!hit) continue;
      const before = p.x;
      if (p.side === "left") p.x = c.x0 - sep - p.w;
      else p.x = c.x1 + sep;
      clampX(p);
      if (Math.abs(p.x - before) < 0.5 || (p.x < c.x1 + sep && p.x + p.w > c.x0 - sep)) {
        p.y = p.y + p.h / 2 < cy ? c.y0 - sep - p.h : c.y1 + sep;
      }
      moved = true;
    }
    placed.forEach(clampY);
    if (!moved) break;
  }

  placed.forEach((p, i) => {
    const besideX = p.side === "left" ? p.x + p.w : p.x;
    const fromBeside = p.side === "left" ? p.from.x >= p.x + p.w : p.from.x <= p.x;
    if (vertical.has(i) || !fromBeside) {
      const tx = Math.max(p.x + 2, Math.min(p.x + p.w - 2, p.from.x));
      p.to = { x: tx, y: p.from.y < p.y ? p.y : p.y + p.h };
    } else {
      p.to = { x: besideX, y: Math.max(p.y + 2, Math.min(p.y + p.h - 2, p.y + p.h * 0.38)) };
    }
  });
  return placed;
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
  opts: { maxW: number; dpr: number; narrow: boolean; align: "left" | "right"; fonts: CanvasFonts },
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
  let songText = "";
  if (song) {
    measure.font = `800 ${songPx}px ${fonts.display}`;
    if ("fontStretch" in measure) measure.fontStretch = "condensed";
    if ("letterSpacing" in measure) (measure as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    songText = ellipsize(measure, song, opts.maxW);
    w = Math.max(w, measure.measureText(songText).width);
  }
  w = Math.ceil(Math.min(opts.maxW, w) + 4);
  const h = Math.ceil(monoPx * 1.25 + (song ? lineGap + songPx * 1.05 : 0) + 2);

  const c = (reuse?.image as HTMLCanvasElement | undefined) ?? document.createElement("canvas");
  c.width = Math.ceil(w * dpr);
  c.height = Math.ceil(h * dpr);
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
  if (songText) {
    g.font = `800 ${songPx}px ${fonts.display}`;
    if ("fontStretch" in g) g.fontStretch = "condensed";
    if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    g.lineWidth = 4;
    g.strokeText(songText, x, 1 + monoPx * 1.25 + lineGap);
    g.fillStyle = b.mine ? SIGNAL : INK;
    g.fillText(songText, x, 1 + monoPx * 1.25 + lineGap);
  }
  const tex = reuse ?? new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { tex, w, h };
}
