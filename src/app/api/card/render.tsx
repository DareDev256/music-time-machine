// The card as Satori JSX: a cassette J-card (spine strip, hairline rules) crossed with a
// time-circuit readout. Colours are the site tokens; the covers carry every other colour.
// Every text block is sized from measured advance widths (text.ts), so nothing relies on clipping.
/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- Satori renders <img>, not next/image */

import type { ReactNode } from "react";
import type { CardModel, DefaultModel } from "./model";
import { fit, textWidth, truncate, upper, wrap, type Fit } from "./text";

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
const SOURCES = "BILLBOARD HOT 100 · ITUNES COVERS · INTERNET ARCHIVE";

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

/** Where the #1 would be when the week is newer than the chart data: say how far the data runs. */
function NoChart({ through, width, label, title, note }: { through: string; width: number; label: number; title: number; note: number }) {
  const t = `${through.slice(5, 7)}.${through.slice(8, 10)}.${through.slice(0, 4)}`;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Label text="Billboard Hot 100" size={label} />
      <Box h={Math.round(label * 1.1)} />
      <DisplayLine text="NOT IN THE DATA YET" size={title} width={width} color={DIM} />
      <Box h={Math.round(label * 0.8)} />
      <Label text={`Charts through ${t}`} size={note} tracking={0.16} width={width} />
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

function SpineTitle({ season, rest, size, restSize, room }: { season: string; rest: string; size: number; restSize: number; room: number }) {
  const sw = Math.ceil(textWidth(season, "display", size, TRACK));
  const gap = Math.round(size * 0.5);
  const restW = room - sw - gap;
  return (
    <div style={{ display: "flex", alignItems: "center", width: room }}>
      <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: `${TRACK}em`, color: INK, flexShrink: 0 }}>{season}</div>
      {rest && restW > 60 ? <Box w={gap} /> : <None />}
      {rest && restW > 60 ? <Label text={rest} size={restSize} tracking={0.2} width={restW} /> : <None />}
    </div>
  );
}

function spineRest(m: CardModel): string {
  if (m.anchor) return [m.anchor.song, m.anchor.artist].filter(Boolean).join(" · ");
  return m.numberOne ? `THE #1 · ${m.numberOne.song} · ${m.numberOne.artist}` : "";
}

function heroOf(m: CardModel) {
  const hero = m.anchor ? upper(m.anchor.song) : m.numberOne ? upper(m.numberOne.song) : "NOT CHARTED YET";
  const by = m.anchor ? m.anchor.artist : m.numberOne ? m.numberOne.artist : `THE HOT 100 DATA RUNS THROUGH ${m.through}`;
  return { hero, by: by ?? "" };
}

/** Both contrast lines share one size, the largest at which each fits on one line (two at the floor). */
function contrastFit(me: string, world: string, width: number, max: number, min: number) {
  let size = max;
  const step = Math.max(1, Math.round((max - min) / 30));
  const oneLine = (t: string, s: number) => !t || wrap(t, "display", s, width, TRACK).length === 1;
  while (size > min && !(oneLine(me, size) && oneLine(world, size))) size -= step;
  size = Math.max(min, size);
  const lines = (t: string) => (t ? Math.min(2, wrap(t, "display", size, width, TRACK).length) : 0);
  return { size, me: { size, lines: lines(me), clamp: lines(me) }, world: { size, lines: lines(world), clamp: lines(world) } };
}

// ── Story 1080×1920 ───────────────────────────────────────────────────

export function StoryCard({ m, images }: { m: CardModel; images: CardImages }) {
  const W = 1080, H = 1920, SP = 100, PY = 72;
  const x0 = SP + 60, colW = W - x0 - 64, inner = H - 2 * PY;
  const label = 22, minGap = 26;
  const { hero, by } = heroOf(m);
  const artistSize = 26, artistLH = 1.25;
  const artistLines = by ? Math.min(2, wrap(upper(by), "mono", artistSize, colW, 0.12).length) : 0;

  const showContrast = Boolean(m.anchor && m.line.me);
  const me = upper(m.line.me), world = upper(m.line.world);
  const c = contrastFit(me, world, colW, 72, 40);
  const contrastH = showContrast ? label + 18 + c.me.lines * c.size * 0.95 + (world ? 10 + c.world.lines * c.size * 0.95 : 0) : 0;

  const COVER = 300, FRAME = 16, LINE = 2;
  const coverOuter = COVER + 2 * FRAME + 2 * LINE;
  const n1H = m.numberOne ? label + 24 + coverOuter : m.anchor ? label + 24 + 56 + 18 + 20 : 0;
  const ROW = 10 + 34 + 8 + 20 + 10 + 1;
  const heatH = label + 10 + (m.heat.length ? m.heat.length * ROW : 44);
  const topH = 24, readH = label + 20 + 120, footH = 16 + 14 + 28;
  const gaps = 2 + (m.numberOne || m.anchor ? 1 : 0) + (showContrast ? 1 : 0) + 1; // ruled gaps between sections
  const fixed = topH + readH + (label + 22 + 26 + artistLines * artistSize * artistLH) + n1H + contrastH + heatH + footH;
  const titleRoom = Math.min(440, inner - fixed - gaps * minGap - minGap);
  const tFit = fit(hero, { face: "display", width: colW, maxHeight: titleRoom, maxLines: 6, max: 168, min: 56, lineHeight: LH, tracking: TRACK });

  const n1W = colW - coverOuter - 36;
  const n1Title = m.numberOne ? upper(m.numberOne.song) : "";
  const n1Fit = fit(n1Title, { face: "display", width: n1W, maxHeight: 214, maxLines: 4, max: 84, min: 36, lineHeight: LH, tracking: TRACK });

  const spineRoom = H - 2 * PY - wordmarkWidth(20) - 60;

  return (
    <div style={{ display: "flex", position: "relative", width: W, height: H, background: "#000", color: INK, fontFamily: MONO }}>
      <Spine length={H} thickness={SP} pad={PY}
        start={<SpineTitle season={m.season} rest={spineRest(m)} size={50} restSize={20} room={spineRoom} />}
        end={<Wordmark size={20} color={DIM} />} />

      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: x0, top: PY, width: colW, height: inner }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: topH }}>
          <Wordmark size={24} />
          <Label text={`ERA ${m.era}`} size={22} />
        </div>
        <Gap min={minGap} />

        {/* destination readout */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <LabelRow left="Destination" right={m.dateNote} size={label} width={colW} />
          <Box h={20} />
          <Readout text={m.readout} size={120} />
        </div>
        <Gap min={minGap} />

        {/* what you were playing */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Label text={m.anchor ? "I was playing" : `The #1 was · ${m.season}`} size={label} />
          <Box h={22} />
          <Display text={hero} f={tFit} width={colW} />
          <Box h={Math.round(18 + tFit.size * 0.1)} />
          {by ? <MonoBlock text={by} size={artistSize} width={colW} lines={2} lh={artistLH} /> : <None />}
        </div>

        {m.numberOne ? <Gap min={minGap} /> : <None />}
        {m.numberOne ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <LabelRow left={m.anchor ? "The #1 was · Hot 100" : "Billboard Hot 100"} right={m.numberOne.run} size={label} width={colW} rightColor={RED} rightTracking={0.2} />
            <Box h={24} />
            <div style={{ display: "flex" }}>
              <Cover src={images.numberOne} size={COVER} frame={FRAME} line={LINE} song={m.numberOne.song} artist={m.numberOne.artist} />
              <Box w={36} />
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: n1W, paddingTop: FRAME - 4, paddingBottom: FRAME }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {m.anchor ? <Display text={n1Title} f={n1Fit} width={n1W} /> : <None />}
                  {m.anchor ? <Box h={Math.round(14 + n1Fit.size * 0.1)} /> : <None />}
                  {m.anchor ? <MonoBlock text={m.numberOne.artist} size={22} width={n1W} lines={2} /> : <None />}
                </div>
                <Label text={`Chart dated ${m.numberOne.chartDate}`} size={20} tracking={0.16} width={n1W} />
              </div>
            </div>
          </div>
        ) : <None />}

        {!m.numberOne && m.anchor ? <Gap min={minGap} /> : <None />}
        {!m.numberOne && m.anchor ? <NoChart through={m.through} width={colW} label={label} title={56} note={20} /> : <None />}

        {showContrast ? <Gap min={minGap} /> : <None />}
        {showContrast ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Label text={m.season} size={label} color={RED} />
            <Box h={18} />
            <div style={{ display: "block", width: colW, fontFamily: DISPLAY, fontWeight: 800, fontSize: c.size, lineHeight: 0.95, letterSpacing: `${TRACK}em`, lineClamp: 2 }}>{me}</div>
            {world ? <Box h={10} /> : <None />}
            {world ? <div style={{ display: "block", width: colW, fontFamily: DISPLAY, fontWeight: 800, fontSize: c.size, lineHeight: 0.95, letterSpacing: `${TRACK}em`, color: DIM, lineClamp: 2 }}>{world}</div> : <None />}
          </div>
        ) : <None />}

        <Gap min={minGap} />
        {/* off the charts */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <LabelRow left="Off the charts" right={m.heatNote} size={label} rightSize={18} width={colW} />
          <Box h={10} />
          {m.heat.length ? m.heat.map((h, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", paddingTop: 10, paddingBottom: 10, borderTop: `1px solid ${i ? FAINT : "rgba(0,0,0,0)"}` }}>
              <DisplayLine text={upper(h.song)} size={34} width={colW} />
              <Box h={8} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Label text={h.artist} size={20} tracking={0.12} width={colW - labelWidth(h.source, 20, 0.08) - 32} />
                <Label text={h.source} size={20} tracking={0.08} />
              </div>
            </div>
          )) : (
            <div style={{ display: "flex", paddingTop: 12, height: 44 }}>
              <Label text="No archived capture for this month" size={22} tracking={0.16} />
            </div>
          )}
        </div>

        <Gap min={minGap} rule={false} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Label text={SOURCES} size={16} tracking={0.12} width={colW} />
          <Box h={14} />
          <div style={{ display: "flex", fontFamily: MONO, fontWeight: 600, fontSize: 28, lineHeight: 1, letterSpacing: "0.06em", color: INK }}>
            {truncate(m.url, "mono", 28, colW, 0.06)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wide 1200×630 ─────────────────────────────────────────────────────

export function WideCard({ m, images }: { m: CardModel; images: CardImages }) {
  const W = 1200, H = 630, SP = 64, PY = 36;
  const x0 = SP + 40, inner = H - 2 * PY;
  const L = 596, G = 44, R = W - x0 - 40 - L - G;
  const label = 13, minGap = 14;
  const { hero, by } = heroOf(m);

  const showContrast = Boolean(m.anchor && m.line.me);
  const me = upper(m.line.me), world = upper(m.line.world);
  const c = contrastFit(me, world, L, 36, 22);
  const contrastH = showContrast ? 13 + 10 + 2 * 36 : 0;
  const fixedL = 14 + (13 + 10 + 80) + (13 + 10 + 12 + 16) + contrastH + 16 + 4 * minGap + 14;
  const tFit = fit(hero, { face: "display", width: L, maxHeight: Math.min(200, inner - fixedL), maxLines: 4, max: 112, min: 32, lineHeight: LH, tracking: TRACK });

  const COVER = 176, FRAME = 10, LINE = 1.5;
  const coverOuter = COVER + 2 * FRAME + 2 * LINE;
  const n1W = R - coverOuter - 18;
  const n1Title = m.numberOne ? upper(m.numberOne.song) : "";
  const n1Fit = fit(n1Title, { face: "display", width: n1W, maxHeight: 112, maxLines: 4, max: 44, min: 18, lineHeight: LH, tracking: TRACK });
  const spineRoom = H - 2 * PY - wordmarkWidth(11) - 30;

  return (
    <div style={{ display: "flex", position: "relative", width: W, height: H, background: "#000", color: INK, fontFamily: MONO }}>
      <Spine length={H} thickness={SP} pad={PY}
        start={<SpineTitle season={m.season} rest={spineRest(m)} size={28} restSize={11} room={spineRoom} />}
        end={<Wordmark size={11} color={DIM} />} />

      {/* left: you */}
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: x0, top: PY, width: L, height: inner }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 14 }}>
          <Wordmark size={14} />
          <Label text={`ERA ${m.era}`} size={13} />
        </div>
        <Gap min={minGap + 6} rule={false} />
        <LabelRow left="Destination" right={m.dateNote} size={label} width={L} />
        <Box h={10} />
        <Readout text={m.readout} size={80} />
        <Gap min={minGap} />
        <Label text={m.anchor ? "I was playing" : `The #1 was · ${m.season}`} size={label} />
        <Box h={10} />
        <Display text={hero} f={tFit} width={L} />
        <Box h={Math.round(10 + tFit.size * 0.1)} />
        {by ? <Label text={by} size={16} tracking={0.12} width={L} /> : <None />}
        {showContrast ? <Gap min={minGap} /> : <Gap min={minGap} rule={false} />}
        {showContrast ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Label text={m.season} size={13} color={RED} />
            <Box h={10} />
            <DisplayLine text={me} size={c.size} width={L} />
            {world ? <Box h={6} /> : <None />}
            {world ? <DisplayLine text={world} size={c.size} width={L} color={DIM} /> : <None />}
          </div>
        ) : <None />}
        {showContrast ? <Gap min={minGap} rule={false} /> : <None />}
        <div style={{ display: "flex", fontFamily: MONO, fontWeight: 600, fontSize: 16, lineHeight: 1, letterSpacing: "0.06em" }}>
          {truncate(m.url, "mono", 16, L, 0.06)}
        </div>
      </div>

      <div style={{ display: "flex", position: "absolute", left: x0 + L + G / 2, top: PY, width: 1, height: inner, background: FAINT }} />

      {/* right: the world */}
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: x0 + L + G, top: PY, width: R, height: inner }}>
        {m.numberOne ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <LabelRow left={m.anchor ? "The #1 was · Hot 100" : "Billboard Hot 100"} right={m.numberOne.run.replace("WEEK", "WK")} size={label} width={R} rightColor={RED} />
            <Box h={14} />
            <div style={{ display: "flex" }}>
              <Cover src={images.numberOne} size={COVER} frame={FRAME} line={LINE} song={m.numberOne.song} artist={m.numberOne.artist} />
              <Box w={18} />
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: n1W, paddingTop: FRAME - 2, paddingBottom: FRAME }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {m.anchor ? <Display text={n1Title} f={n1Fit} width={n1W} /> : <None />}
                  {m.anchor ? <Box h={Math.round(8 + n1Fit.size * 0.1)} /> : <None />}
                  {m.anchor ? <MonoBlock text={m.numberOne.artist} size={12} width={n1W} lines={2} tracking={0.1} lh={1.3} /> : <None />}
                </div>
                <Label text={`Chart dated ${m.numberOne.chartDate}`} size={11} tracking={0.12} width={n1W} />
              </div>
            </div>
          </div>
        ) : <None />}
        {!m.numberOne ? <NoChart through={m.through} width={R} label={label} title={36} note={11} /> : <None />}
        <Gap min={2 * minGap + 8} />

        <LabelRow left="Off the charts" right={m.heatNote ? m.heatNote.replace("INTERNET ARCHIVE CAPTURES · ", "WAYBACK · ") : null} size={label} rightSize={11} rightTracking={0.12} width={R} />
        <Box h={4} />
        {m.heat.length ? m.heat.map((h, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", paddingTop: 8, paddingBottom: 8, borderTop: `1px solid ${i ? FAINT : "rgba(0,0,0,0)"}` }}>
            <DisplayLine text={upper(h.song)} size={24} width={R} />
            <Box h={5} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Label text={h.artist} size={11} tracking={0.1} width={R - labelWidth(h.source, 11, 0.04) - 16} />
              <Label text={h.source} size={11} tracking={0.04} />
            </div>
          </div>
        )) : (
          <div style={{ display: "flex", paddingTop: 10 }}>
            <Label text="No archived capture for this month" size={12} tracking={0.12} />
          </div>
        )}

        <Gap min={minGap} rule={false} />
        <Label text={SOURCES} size={10} tracking={0.08} width={R} />
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

