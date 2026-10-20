// The card as Satori JSX: a cassette J-card (spine strip, hairline rules) crossed with a
// time-circuit readout. Colours are the site tokens; the covers carry every other colour.
// Every text block is sized from measured advance widths (text.ts), so nothing relies on clipping.
/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- Satori renders <img>, not next/image */

import type { ReactNode } from "react";
import type { CardModel, DefaultModel } from "./model";
import { fit, textWidth, truncate, upper, wordsFit, wrap, type Fit } from "./text";

const INK = "#f4f4f4";
const DIM = "rgba(244,244,244,0.52)";
const FAINT = "rgba(244,244,244,0.16)";
const RED = "#ff3b1f";
const GHOST = "rgba(255,59,31,0.09)";
const SLEEVE = "#0b0a0a";

const DISPLAY = "Archivo";
const MONO = "JetBrains Mono";
const SEG = "DSEG7";

const LH = 0.9; // display line height
const TRACK = -0.01; // display tracking, em
const LABEL_TRACK = 0.28;
const SOURCES = "#1: BILLBOARD HOT 100 · COVER: ITUNES";

export type CardImages = { numberOne: string | null };

const Box = ({ h, w }: { h?: number; w?: number }) => <div style={{ display: "flex", height: h ?? 0, width: w ?? 0, flexShrink: 0 }} />;
const None = () => <div style={{ display: "none" }} />;

// ── Atoms ──────────────────────────────────────────────────────────────

const labelWidth = (text: string, size: number, tracking = LABEL_TRACK) => Math.ceil(textWidth(upper(text), "mono", size, tracking));

function Label({ text, size, color = DIM, tracking = LABEL_TRACK, weight = 400, width, align = "left" }: {
  text: string; size: number; color?: string; tracking?: number; weight?: number; width?: number; align?: "left" | "right";
}) {
  const shown = width ? truncate(upper(text), "mono", size, width, tracking) : upper(text);
  return (
    <div style={{
      display: "flex", fontFamily: MONO, fontWeight: weight, fontSize: size, lineHeight: 1, color, letterSpacing: `${tracking}em`,
      whiteSpace: "nowrap", flexShrink: 0, ...(width ? { width, justifyContent: align === "right" ? "flex-end" : "flex-start" } : {}),
    }}>
      {shown}
    </div>
  );
}

/** A label pair on one line; the left side is cut short before it can reach the right. */
function LabelRow({ left, right, size, width, rightColor = DIM, rightTracking = 0.16, rightSize }: {
  left: string; right?: string | null; size: number; width: number; rightColor?: string; rightTracking?: number; rightSize?: number;
}) {
  const rs = rightSize ?? size;
  // Measured width plus the slack truncate() keeps, so a label that fits is never cut.
  const rw = right ? Math.min(width * 0.62, Math.ceil(labelWidth(right, rs, rightTracking) * 1.04) + 2) : 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", width }}>
      <Label text={left} size={size} width={Math.floor(width - rw - (right ? size * 1.2 : 0))} />
      {right ? <Label text={right} size={rs} color={rightColor} tracking={rightTracking} width={Math.floor(rw)} align="right" /> : <None />}
    </div>
  );
}

function Wordmark({ size, color = INK }: { size: number; color?: string }) {
  return (
    <div style={{ display: "flex", fontFamily: MONO, fontWeight: 600, fontSize: size, lineHeight: 1, letterSpacing: "0.3em", color, flexShrink: 0 }}>
      <span>WAS</span>
      <span style={{ color: RED }}>·</span>
      <span>PLAYING</span>
    </div>
  );
}
const wordmarkWidth = (size: number) => Math.ceil(textWidth("WAS·PLAYING", "mono", size, 0.3));

/** Seven-segment readout over an all-segments ghost, like an unlit display behind lit digits. */
function Readout({ text, size }: { text: string; size: number }) {
  const ghost = text.replace(/[0-9-]/g, "8");
  const common = { fontFamily: SEG, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: "0.04em", whiteSpace: "nowrap" as const };
  return (
    <div style={{ display: "flex", position: "relative", height: size }}>
      <div style={{ ...common, display: "flex", position: "absolute", left: 0, top: 0, color: GHOST }}>{ghost}</div>
      <div style={{ ...common, display: "flex", color: RED, textShadow: `0 0 ${Math.round(size * 0.16)}px rgba(255,59,31,0.5)` }}>{text}</div>
    </div>
  );
}

function Display({ text, f, width, color = INK }: { text: string; f: Fit; width: number; color?: string }) {
  return (
    <div style={{
      display: "block", width, fontFamily: DISPLAY, fontWeight: 800, fontSize: f.size, lineHeight: LH,
      letterSpacing: `${TRACK}em`, color, wordBreak: "break-word", lineClamp: f.clamp,
    }}>
      {text}
    </div>
  );
}

/** One display line, cut with an ellipsis rather than wrapped. */
function DisplayLine({ text, size, width, color = INK }: { text: string; size: number; width: number; color?: string }) {
  return (
    <div style={{ display: "flex", width, fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: `${TRACK}em`, color, whiteSpace: "nowrap" }}>
      {truncate(text, "display", size, width, TRACK)}
    </div>
  );
}

function MonoBlock({ text, size, width, lines, color = DIM, tracking = 0.12, lh = 1.25 }: {
  text: string; size: number; width: number; lines: number; color?: string; tracking?: number; lh?: number;
}) {
  return (
    <div style={{ display: "block", width, fontFamily: MONO, fontSize: size, lineHeight: lh, letterSpacing: `${tracking}em`, color, lineClamp: lines }}>
      {upper(text)}
    </div>
  );
}

/** Flexible space with a hairline across its middle: rules stay evenly spaced whatever the content. */
function Gap({ min, rule = true }: { min: number; rule?: boolean }) {
  return (
    <div style={{ display: "flex", flexGrow: 1, minHeight: min, alignItems: "center" }}>
      {rule ? <div style={{ display: "flex", height: 1, flexGrow: 1, background: FAINT }} /> : <None />}
    </div>
  );
}

/** The typeset sleeve drawn when a cover cannot be fetched: never an empty box. */
function Sleeve({ size, song, artist }: { size: number; song: string; artist: string }) {
  const pad = Math.round(size * 0.1);
  const inner = size - 2 * pad;
  const title = upper(song);
  const f = fit(title, { face: "display", width: inner, maxHeight: inner * 0.66, maxLines: 5, max: Math.round(size * 0.2), min: Math.round(size * 0.07), lineHeight: LH, tracking: TRACK });
  const a = Math.max(9, Math.round(size * 0.045));
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size, background: SLEEVE, flexShrink: 0 }}>
      <div style={{ display: "flex", position: "absolute", left: Math.round(pad / 2), top: Math.round(pad / 2), width: size - pad, height: size - pad, border: `1px solid ${RED}` }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "absolute", left: pad, top: pad, width: inner, height: inner }}>
        <Display text={title} f={f} width={inner} />
        <Box h={Math.round(a * 1.2)} />
        <Label text={artist} size={a} tracking={0.12} width={inner} />
      </div>
    </div>
  );
}

/** A cover, optionally inside a thin red frame set off from it (the site's landing card). */
function Cover({ src, size, frame, line, song, artist }: {
  src: string | null; size: number; frame: number; line: number; song: string; artist: string;
}) {
  const art = src
    ? <img src={src} width={size} height={size} style={{ width: size, height: size, objectFit: "cover" }} />
    : <Sleeve size={size} song={song} artist={artist} />;
  if (!frame) return <div style={{ display: "flex", width: size, height: size, flexShrink: 0 }}>{art}</div>;
  const outer = size + 2 * frame + 2 * line;
  return (
    <div style={{ display: "flex", width: outer, height: outer, flexShrink: 0, border: `${line}px solid ${RED}`, alignItems: "center", justifyContent: "center" }}>
      {art}
    </div>
  );
}

/**
 * The J-card spine down the left edge. Laid out along its length and turned -90° about its own
 * centre (the one transform origin Satori is reliable with), so it reads bottom-to-top.
 */
function Spine({ length, thickness, pad, start, end }: { length: number; thickness: number; pad: number; start: ReactNode; end: ReactNode }) {
  return (
    <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: thickness, height: length }}>
      <div style={{
        display: "flex", position: "absolute", left: thickness / 2 - length / 2, top: length / 2 - thickness / 2,
        width: length, height: thickness, transform: "rotate(-90deg)", alignItems: "center", justifyContent: "space-between",
        paddingLeft: pad, paddingRight: pad,
      }}>
        {start}
        {end}
      </div>
      <div style={{ display: "flex", position: "absolute", left: thickness - 1, top: 0, width: 1, height: length, background: FAINT }} />
    </div>
  );
}

function SpineSeason({ season, size }: { season: string; size: number }) {
  return (
    <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: `${TRACK}em`, color: INK, flexShrink: 0 }}>
      {season}
    </div>
  );
}

// ── The statement ─────────────────────────────────────────────────────

/** The two lines the card exists to say: "I WAS ON CHIEF KEEF & RIFF RAFF." / "THE WORLD WAS ON GOTYE." */
export function statements(m: CardModel): { me: string; world: string } {
  const end = (s: string) => (!s ? "" : /[.!?]$/.test(s) ? upper(s) : `${upper(s)}.`);
  // Keep "&" with the name after it, so a line never ends on a bare ampersand.
  const bind = (s: string) => s.replace(/ & /g, " &\u00A0");
  return { me: bind(end(m.line.me)), world: bind(end(m.line.world)) };
}

export interface HeroFit { size: number; me: number; world: number; height: number }
const HERO_GAP = 0.2; // space between the two statements, em

/** One shared size for both statements: the largest whose wrapped lines fit `room` px. */
export function heroFit(me: string, world: string, width: number, room: number, max: number, min: number): HeroFit {
  const at = (size: number): HeroFit => {
    const a = wrap(me, "display", size, width, TRACK).length;
    const b = world ? wrap(world, "display", size, width, TRACK).length : 0;
    return { size, me: a, world: b, height: (a + b) * size * LH + (world ? size * HERO_GAP : 0) };
  };
  for (let size = max; size >= min; size -= 2) {
    if (!wordsFit(me, "display", size, width, TRACK) || (world && !wordsFit(world, "display", size, width, TRACK))) continue;
    const f = at(size);
    if (f.height <= room) return f;
  }
  // Still too tall at the floor: clamp the lines that do not fit (Satori draws the ellipsis).
  const f = at(min);
  const lines = Math.max(2, Math.floor((room - (world ? min * HERO_GAP : 0)) / (min * LH)));
  const a = Math.min(f.me, Math.max(1, lines - Math.min(f.world, 1)));
  const b = Math.min(f.world, Math.max(0, lines - a));
  return { size: min, me: a, world: b, height: (a + b) * min * LH + (world ? min * HERO_GAP : 0) };
}

/** Each statement on one line, at the largest size where both fit; null when none down to `min` does. */
function oneLineFit(me: string, world: string, width: number, max: number, min: number): HeroFit | null {
  for (let size = max; size >= min; size -= 2) {
    const ok = (t: string) => !t || wrap(t, "display", size, width, TRACK).length === 1;
    if (ok(me) && ok(world)) return { size, me: 1, world: world ? 1 : 0, height: (world ? 2 : 1) * size * LH + (world ? size * HERO_GAP : 0) };
  }
  return null;
}

function Hero({ me, world, f, width }: { me: string; world: string; f: HeroFit; width: number }) {
  const text = { display: "block" as const, width, fontFamily: DISPLAY, fontWeight: 800, fontSize: f.size, lineHeight: LH, letterSpacing: `${TRACK}em` };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ ...text, color: INK, lineClamp: Math.max(1, f.me) }}>{me}</div>
      {world && f.world ? <Box h={Math.round(f.size * HERO_GAP)} /> : <None />}
      {world && f.world ? <div style={{ ...text, color: DIM, lineClamp: f.world }}>{world}</div> : <None />}
    </div>
  );
}

/** The Hot 100 #1 as a small stamp: a framed cover and one line. */
function Stamp({ m, cover, size, frame, line, text, width }: {
  m: CardModel; cover: string | null; size: number; frame: number; line: number; text: number; width: number;
}) {
  const tr = 0.04;
  // Satori drops spaces at the edge of a text box, so segments are separated by boxes, not spaces.
  const space = Math.round(text * 0.6);
  const seg = (t: string, color: string, weight = 400) => (
    <div style={{ display: "flex", fontFamily: MONO, fontWeight: weight, fontSize: text, lineHeight: 1, letterSpacing: `${tr}em`, color, whiteSpace: "nowrap", flexShrink: 0 }}>{t}</div>
  );
  if (!m.numberOne) {
    const t = `${m.through.slice(5, 7)}.${m.through.slice(8, 10)}.${m.through.slice(0, 4)}`;
    return <div style={{ display: "flex" }}>{seg(truncate(`THE #1 THAT WEEK IS NOT IN THE CHART DATA YET · CHARTS THROUGH ${t}`, "mono", text, width, tr), DIM)}</div>;
  }
  const n = m.numberOne;
  const outer = size + 2 * frame + 2 * line;
  const gap = Math.round(text * 1.1);
  const head = m.anchor ? "THE #1 WAS" : "HOT 100 #1";
  const tail = `· ${n.run}`;
  const fixedW = textWidth(head, "mono", text, tr) + textWidth(tail, "mono", text, tr) + 2 * space;
  const title = m.anchor ? truncate(upper(n.song), "mono", text, Math.max(0, width - outer - gap - fixedW), tr) : "";
  return (
    <div style={{ display: "flex", alignItems: "center", width }}>
      <Cover src={cover} size={size} frame={frame} line={line} song={n.song} artist={n.artist} />
      <Box w={gap} />
      {seg(head, DIM)}
      <Box w={space} />
      {title ? seg(title, INK, 600) : <None />}
      {title ? <Box w={space} /> : <None />}
      {seg(tail, RED)}
    </div>
  );
}

// ── Story 1080×1920 ───────────────────────────────────────────────────

const STORY = { W: 1080, H: 1920, SP: 100, PY: 72, X0: 160, COL: 856 };

/** Sizes for the story card, exported so tests can hold the hierarchy: the statement outranks the title. */
export function storyMetrics(m: CardModel) {
  const colW = STORY.COL, inner = STORY.H - 2 * STORY.PY;
  const { me, world } = statements(m);
  const title = m.anchor ? upper(m.anchor.song) : "";
  const by = m.anchor?.artist ? upper(m.anchor.artist) : "";
  const byLines = by ? Math.min(2, wrap(by, "mono", 24, colW, 0.12).length) : 0;
  const titleExtra = title ? 44 + 12 + byLines * 24 * 1.25 : 0;
  const ledH = 120 + (m.dateNote ? 18 + 20 : 0);
  const stampH = m.numberOne ? 100 + 2 * 6 + 3 : 20;
  const footH = 14 + 14 + 22;
  const gaps = 2 * 56 + 1 + 2 * 48 + 1 + 40;
  const base = inner - ledH - stampH - footH - gaps - titleExtra;
  // The statement first, leaving room for at least a one-line title...
  const hero = heroFit(me, world, colW, Math.min(base - (title ? 72 : 0), 980), 192, 64);
  // ...then the title takes what is left, up to about 0.6 of the statement so it never competes.
  let tFit: Fit | null = null;
  if (title) {
    const max = Math.max(56, Math.min(140, Math.round(hero.size * 0.62)));
    const spec = { face: "display" as const, width: colW, maxLines: 3, max, min: 52, lineHeight: LH, tracking: TRACK };
    const room = Math.max(52, base - hero.height);
    const many = fit(title, { ...spec, maxHeight: room });
    const one = fit(title, { ...spec, maxLines: 1, maxHeight: room });
    // A title on one line reads faster; take it unless it costs more than 15% of the size.
    tFit = one.lines === 1 && wrap(title, "display", one.size, colW, TRACK).length === 1 && one.size >= many.size * 0.85 ? one : many;
  }
  return { colW, inner, me, world, hero, title, tFit, by };
}

export function StoryCard({ m, images }: { m: CardModel; images: CardImages }) {
  const { W, H, SP, PY, X0 } = STORY;
  const { colW, inner, me, world, hero, title, tFit, by } = storyMetrics(m);
  return (
    <div style={{ display: "flex", position: "relative", width: W, height: H, background: "#000", color: INK, fontFamily: MONO }}>
      <Spine length={H} thickness={SP} pad={PY} start={<SpineSeason season={m.season} size={50} />} end={<Wordmark size={20} color={DIM} />} />

      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: X0, top: PY, width: colW, height: inner }}>
        <Readout text={m.readout} size={120} />
        {m.dateNote ? <Box h={18} /> : <None />}
        {m.dateNote ? <Label text={m.dateNote} size={20} tracking={0.2} width={colW} /> : <None />}
        <Gap min={2 * 56 + 1} />

        <Hero me={me} world={world} f={hero} width={colW} />
        {tFit ? <Box h={44} /> : <None />}
        {tFit ? <Display text={title} f={tFit} width={colW} /> : <None />}
        {tFit ? <Box h={Math.round(12 + tFit.size * 0.1)} /> : <None />}
        {tFit && by ? <MonoBlock text={by} size={24} width={colW} lines={2} /> : <None />}
        <Gap min={2 * 48 + 1} />

        <Stamp m={m} cover={images.numberOne} size={100} frame={6} line={1.5} text={20} width={colW} />
        <Gap min={40} rule={false} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <Label text={SOURCES} size={14} tracking={0.12} width={colW} />
          <Box h={14} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Wordmark size={18} />
            <div style={{ display: "flex", fontFamily: MONO, fontSize: 22, lineHeight: 1, letterSpacing: "0.04em", color: INK }}>
              {truncate(m.url, "mono", 22, colW - wordmarkWidth(18) - 40, 0.04)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wide 1200×630 ─────────────────────────────────────────────────────

const WIDE = { W: 1200, H: 630, SP: 64, PY: 40, X0: 104, COL: 1056 };

export function wideMetrics(m: CardModel) {
  const colW = WIDE.COL;
  const { me, world } = statements(m);
  const hero = oneLineFit(me, world, colW, 104, 44) ?? heroFit(me, world, colW, 230, 64, 30);
  const title = m.anchor ? upper(m.anchor.song) : "";
  let tSize = 52;
  while (title && tSize > 28 && wrap(title, "display", tSize, colW, TRACK).length > 1) tSize -= 2;
  return { colW, me, world, hero, title, tSize };
}

export function WideCard({ m, images }: { m: CardModel; images: CardImages }) {
  const { W, H, SP, PY, X0 } = WIDE;
  const inner = H - 2 * PY;
  const { colW, me, world, hero, title, tSize } = wideMetrics(m);
  const urlSize = 15;
  const urlW = Math.min(colW * 0.42, Math.ceil(textWidth(m.url, "mono", urlSize, 0.04) * 1.04) + 2);
  return (
    <div style={{ display: "flex", position: "relative", width: W, height: H, background: "#000", color: INK, fontFamily: MONO }}>
      <Spine length={H} thickness={SP} pad={PY} start={<SpineSeason season={m.season} size={28} />} end={<Wordmark size={11} color={DIM} />} />

      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: X0, top: PY, width: colW, height: inner }}>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <Readout text={m.readout} size={60} />
          {m.dateNote ? <Box w={28} /> : <None />}
          {m.dateNote ? <Label text={m.dateNote} size={13} tracking={0.2} width={colW - 480} /> : <None />}
        </div>
        <Gap min={2 * 20 + 1} />

        <Hero me={me} world={world} f={hero} width={colW} />
        {title ? <Box h={22} /> : <None />}
        {title ? <DisplayLine text={title} size={tSize} width={colW} /> : <None />}
        {title && m.anchor?.artist ? <Box h={10} /> : <None />}
        {title && m.anchor?.artist ? <Label text={m.anchor.artist} size={15} tracking={0.12} width={colW} /> : <None />}
        <Gap min={2 * 20 + 1} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <Stamp m={m} cover={images.numberOne} size={60} frame={5} line={1.5} text={13} width={colW - urlW - 32} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: urlW }}>
            <Label text={SOURCES} size={9} tracking={0.08} width={urlW} align="right" />
            <Box h={8} />
            <div style={{ display: "flex", fontFamily: MONO, fontSize: urlSize, lineHeight: 1, letterSpacing: "0.04em", color: INK }}>
              {truncate(m.url, "mono", urlSize, urlW, 0.04)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Default (no params): the site's og:image ──────────────────────────

export function DefaultCard({ m, images, format }: { m: DefaultModel; images: (string | null)[]; format: "story" | "wide" }) {
  const story = format === "story";
  const W = story ? 1080 : 1200, H = story ? 1920 : 630;
  const SP = story ? 100 : 64, PY = story ? 72 : 36;
  const x0 = SP + (story ? 60 : 40), colW = W - x0 - (story ? 64 : 40), inner = H - 2 * PY;
  const label = story ? 22 : 13;
  const minGap = story ? 28 : 12;
  const range = `THE #1 EVERY WEEK · ${m.first} → ${m.through}`;

  const markLines = story ? ["WAS·", "PLAYING"] : ["WAS·PLAYING"];
  const markFit = story
    ? fit("PLAYING", { face: "display", width: colW, maxHeight: 300, maxLines: 1, max: 250, min: 120, lineHeight: LH, tracking: TRACK })
    : fit("WAS·PLAYING", { face: "display", width: colW, maxHeight: 150, maxLines: 1, max: 150, min: 80, lineHeight: LH, tracking: TRACK });

  const n = m.covers.length;
  const perRow = story ? 3 : Math.max(1, n);
  const cg = story ? 32 : 28;
  const cs = Math.floor((colW - (perRow - 1) * cg) / perRow);
  const rows: number[][] = [];
  for (let i = 0; i < n; i += perRow) rows.push(Array.from({ length: Math.min(perRow, n - i) }, (_, k) => i + k));
  const tagSize = story ? 30 : 18;
  const sw = story ? 20 : 11;

  return (
    <div style={{ display: "flex", position: "relative", width: W, height: H, background: "#000", color: INK, fontFamily: MONO }}>
      <Spine length={H} thickness={SP} pad={PY}
        start={<Label text={range} size={sw} tracking={0.2} />}
        end={<Wordmark size={sw} color={DIM} />} />

      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: x0, top: PY, width: colW, height: inner }}>
        <LabelRow left="Destination" right={m.url} size={label} width={colW} rightColor={INK} rightTracking={0.12} />
        <Box h={story ? 22 : 12} />
        <Readout text="--.--.----" size={story ? 120 : 60} />
        <Gap min={story ? 40 : 16} rule={false} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          {markLines.map((t) => (
            <div key={t} style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 800, fontSize: markFit.size, lineHeight: LH, letterSpacing: `${TRACK}em`, whiteSpace: "nowrap" }}>
              {t.split("·").map((part, i, all) => (
                <span key={i} style={{ display: "flex" }}>
                  {part}
                  {i < all.length - 1 ? <span style={{ color: RED }}>·</span> : null}
                </span>
              ))}
            </div>
          ))}
        </div>
        <Box h={story ? 40 : 18} />
        <MonoBlock text="Name a song. Fly back to the week it was playing." size={tagSize} width={colW} lines={2} color={INK} lh={1.35} />
        <Gap min={minGap} />

        <LabelRow left="One #1 from each decade" right="Covers: iTunes" size={label} width={colW} />
        <Box h={story ? 24 : 12} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: "flex", marginTop: ri ? cg : 0 }}>
              {row.map((i, k) => {
                const cv = m.covers[i];
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", marginLeft: k ? cg : 0, width: cs }}>
                    <Cover src={images[i] ?? null} size={cs} frame={0} line={0} song={cv.song} artist={cv.artist} />
                    <Box h={story ? 14 : 8} />
                    <LabelRow left={cv.year} right="#1" size={story ? 22 : 12} width={cs} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {story ? <Gap min={minGap} /> : <None />}
        {story ? <Label text="Billboard Hot 100 · iTunes covers" size={18} tracking={0.12} /> : <None />}
      </div>
    </div>
  );
}

