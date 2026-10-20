// Text measurement for the card. Satori lays text out but cannot tell us whether it fit, so the
// sizes are chosen here from the real advance widths of the shipped fonts.

import { ARCHIVO_XB_ADV, ARCHIVO_XB_BASE, ARCHIVO_XB_EXTRA } from "./metrics";

export type Face = "display" | "mono";

const MONO_ADV = 0.6; // JetBrains Mono: every glyph is 600/1000 em.
const UNKNOWN_ADV = 0.56; // a Latin glyph missing from the table
const WIDE_ADV = 1.0; // CJK and other wide scripts arrive from a fallback font at about 1 em
// Satori applies kerning and may break at hyphens; measuring without either over-estimates, which is the safe side.
const SLACK = 0.97;

function displayAdv(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0x20;
  const i = cp - ARCHIVO_XB_BASE;
  if (i >= 0 && i < ARCHIVO_XB_ADV.length && ARCHIVO_XB_ADV[i]) return ARCHIVO_XB_ADV[i] / 1000;
  if (ARCHIVO_XB_EXTRA[cp]) return ARCHIVO_XB_EXTRA[cp] / 1000;
  if (cp >= 0x1100) return WIDE_ADV;
  const base = ch.normalize("NFKD").charAt(0);
  if (base && base !== ch) {
    const j = (base.codePointAt(0) ?? 0) - ARCHIVO_XB_BASE;
    if (j >= 0 && j < ARCHIVO_XB_ADV.length && ARCHIVO_XB_ADV[j]) return ARCHIVO_XB_ADV[j] / 1000;
  }
  return UNKNOWN_ADV;
}

function adv(ch: string, face: Face): number {
  if (face === "mono") return (ch.codePointAt(0) ?? 0) >= 0x1100 ? WIDE_ADV : MONO_ADV;
  return displayAdv(ch);
}

/** Width in px of `text` at `size`, with `tracking` letter-spacing in em applied after every glyph. */
export function textWidth(text: string, face: Face, size: number, tracking = 0): number {
  let w = 0;
  for (const ch of text) w += adv(ch, face) + tracking;
  return w * size;
}

/** Greedy word wrap at spaces; a word wider than the line is broken by character. */
export function wrap(text: string, face: Face, size: number, width: number, tracking = 0): string[] {
  const max = width * SLACK;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ").filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, face, size, tracking) <= max) { line = candidate; continue; }
    if (line) lines.push(line);
    line = "";
    // Break an over-long word into chunks that fit.
    let chunk = "";
    for (const ch of word) {
      if (textWidth(chunk + ch, face, size, tracking) > max && chunk) { lines.push(chunk); chunk = ""; }
      chunk += ch;
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export interface FitSpec {
  face: Face;
  width: number;
  maxHeight: number;
  maxLines: number;
  /** Largest and smallest font size to try, px. */
  max: number;
  min: number;
  lineHeight: number;
  tracking?: number;
}

export interface Fit { size: number; lines: number; clamp: number }

/** The largest size at which `text` wraps into at most maxLines lines and maxHeight px. */
export function fit(text: string, spec: FitSpec): Fit {
  const step = Math.max(1, Math.round((spec.max - spec.min) / 40));
  for (let size = spec.max; size >= spec.min; size -= step) {
    const lines = wrap(text, spec.face, size, spec.width, spec.tracking).length;
    if (lines <= spec.maxLines && lines * size * spec.lineHeight <= spec.maxHeight) return { size, lines, clamp: lines };
  }
  // Still too long at the floor: keep the floor and clamp to the lines that fit (Satori adds the ellipsis).
  const size = spec.min;
  const lines = wrap(text, spec.face, size, spec.width, spec.tracking).length;
  const room = Math.max(1, Math.min(spec.maxLines, Math.floor(spec.maxHeight / (size * spec.lineHeight))));
  return { size, lines: Math.min(lines, room), clamp: room };
}

/** Cut `text` to one line of `width` px, ending in an ellipsis when cut. */
export function truncate(text: string, face: Face, size: number, width: number, tracking = 0): string {
  const max = width * SLACK;
  if (textWidth(text, face, size, tracking) <= max) return text;
  let out = "";
  for (const ch of text) {
    if (textWidth(`${out}${ch}…`, face, size, tracking) > max) break;
    out += ch;
  }
  return `${out.trimEnd()}…`;
}

/** Uppercase the way the card shows titles. */
export const upper = (s: string) => s.toLocaleUpperCase("en-US");
