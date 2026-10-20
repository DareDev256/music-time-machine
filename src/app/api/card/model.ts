// What a card says, assembled from the era shards. Rendering lives in render.tsx.

import { cardLine, seasonOf, type CardLine } from "@/lib/era/cardLine";
import {
  art, chartsThrough, heatFor, indexRow, normTitle, numberOneOn, primaryArtist,
  type HeatMonth, type HeatSource,
} from "@/lib/era/data";
import { FIRST_CHART_WEEK } from "./params";

export const COVER_PX = 600;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export interface NumberOneBlock {
  song: string;
  artist: string;
  cover: string | null;
  /** "WEEK 1 OF 8 AT #1" */
  run: string;
  /** Chart issue date, MM.DD.YYYY */
  chartDate: string;
}

export interface HeatPick { song: string; artist: string; source: string }

export interface CardModel {
  date: string;
  /** "04.28.2012" for the seven-segment readout. */
  readout: string;
  /** What the date is: "UPLOADED TO YOUTUBE", "THE HOT 100 STARTS 4 AUG 1958", or null. */
  dateNote: string | null;
  era: string;
  url: string;
  season: string;
  anchor: { song: string; artist: string | null } | null;
  numberOne: NumberOneBlock | null;
  line: CardLine;
  heat: HeatPick[];
  heatNote: string | null;
  through: string;
}

export interface DefaultCover { year: string; song: string; artist: string; cover: string | null }
export interface DefaultModel { url: string; covers: DefaultCover[]; first: string; through: string }

/** MM.DD.YYYY, the order of the time-circuit display. */
export const readoutOf = (iso: string) => `${iso.slice(5, 7)}.${iso.slice(8, 10)}.${iso.slice(0, 4)}`;

export function siteHost(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (raw) {
    try {
      const host = new URL(raw).host;
      if (host) return host;
    } catch {
      /* fall through to the deploy host */
    }
  }
  return "music-time-machine.vercel.app";
}

// Lead credit for matching rows: "Gotye Vs Notorious B.I.G." leads with Gotye.
const lead = (artist: string) => normTitle(primaryArtist(artist).split(/\s+(?:vs\.?|versus)\s+/i)[0]);
// HotNewHipHop titles carry producer credits ("Waiting Up (Prod By 40)"); the card drops them.
const cleanSong = (s: string) => s.replace(/\s*[([]\s*prod(?:uced)?\.?(?:\s+by)?\b[^)\]]*[)\]]/gi, "").trim();

const SOURCE_NAMES: Record<string, string> = {
  hotnewhiphop: "HOTNEWHIPHOP",
  hypem: "HYPE MACHINE POPULAR",
  billboard_rap: "BILLBOARD RAP SONGS",
  billboard_rnb: "BILLBOARD R&B/HIP-HOP",
};
// Off the Hot 100 first: the blogs, then Billboard's genre charts.
const SOURCE_ORDER = ["hotnewhiphop", "hypem", "billboard_rap", "billboard_rnb"];

export function sourceLabel(src: HeatSource, rank: number): string {
  if (src.id === "hotnewhiphop") return src.list === "ranked" ? `HOTNEWHIPHOP TOP 100 #${rank}` : "HOTNEWHIPHOP FRONT PAGE";
  const name = SOURCE_NAMES[src.id] ?? src.label.split("(")[0].replace(/·/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  return src.list === "ranked" ? `${name} #${rank}` : name;
}

/** Up to `max` archived off-chart rows: the anchor artist's own rows first (at most 2), then each source's top row. */
export function offChart(
  heat: HeatMonth | null,
  anchorArtist: string | null,
  numberOne: { song: string; artist?: string } | null,
  max: number,
): HeatPick[] {
  if (!heat || max <= 0) return [];
  const order = (s: HeatSource) => {
    const i = SOURCE_ORDER.indexOf(s.id);
    return (i < 0 ? SOURCE_ORDER.length : i) * 2 + (s.list === "ranked" ? 0 : 1);
  };
  const sources = [...heat.sources].sort((a, b) => order(a) - order(b));
  const picks: HeatPick[] = [];
  const seen = new Set<string>();
  const n1 = numberOne ? normTitle(numberOne.song) : null;
  // The #1's artist is already on the card; their remixes and mashups are not "off the charts".
  const n1Artist = numberOne?.artist ? lead(numberOne.artist) : null;
  const mine = anchorArtist ? lead(anchorArtist) : null;
  const take = (src: HeatSource, row: HeatSource["rows"][number]) => {
    const key = `${normTitle(row.song)}|${lead(row.artist)}`;
    const by = lead(row.artist);
    if (seen.has(key) || normTitle(row.song) === n1 || (by && by === n1Artist && by !== mine)) return false;
    seen.add(key);
    picks.push({ song: cleanSong(row.song) || row.song, artist: row.artist, source: sourceLabel(src, row.rank) });
    return true;
  };

  if (mine) {
    const rows = sources
      .flatMap((src) => src.rows.filter((r) => lead(r.artist) === mine).map((row) => ({ src, row })))
      .sort((a, b) => a.row.rank - b.row.rank);
    let n = 0;
    for (const { src, row } of rows) {
      if (n >= 2 || picks.length >= max) break;
      if (take(src, row)) n++;
    }
  }
  const usedSources = new Set(picks.map((p) => p.source.split(" #")[0]));
  for (const src of sources) {
    if (picks.length >= max) break;
    if (usedSources.has(sourceLabel(src, 0).split(" #")[0])) continue;
    for (const row of [...src.rows].sort((a, b) => a.rank - b.rank)) {
      if (take(src, row)) { usedSources.add(sourceLabel(src, 0).split(" #")[0]); break; }
    }
  }
  return picks.slice(0, max);
}

export function buildCard(input: { song: string | null; artist: string | null; date: string; clamped: boolean }, heatMax: number): CardModel {
  const { song, artist, date } = input;
  const n1 = numberOneOn(date);
  const line = cardLine({ song, artist, date, numberOne: n1 ? { song: n1.song, artist: n1.artist } : null });
  const month = date.slice(0, 7);
  const heat = heatFor(month);

  let dateNote: string | null = null;
  if (input.clamped) dateNote = "THE HOT 100 STARTS 4 AUG 1958";
  else if (song && artist) {
    const row = indexRow(song, artist);
    if (row && row.d === date && row.ds) dateNote = row.ds.toUpperCase();
  }

  return {
    date,
    readout: readoutOf(date),
    dateNote,
    era: month,
    url: `${siteHost()}/era/${month}`,
    season: seasonOf(date),
    anchor: song ? { song, artist } : null,
    numberOne: n1
      ? {
          song: n1.song,
          artist: n1.artist,
          cover: art(n1.art, COVER_PX),
          run: `WEEK ${n1.runWeek} OF ${n1.runLength} AT #1`,
          chartDate: readoutOf(n1.date),
        }
      : null,
    line,
    heat: offChart(heat, song ? artist : null, n1, heatMax),
    heatNote: heat ? `INTERNET ARCHIVE CAPTURES · ${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}` : null,
    through: chartsThrough(),
  };
}

// One #1 per decade from 1979 on; the shards hold no cover art for any earlier #1.
export const DEFAULT_DATES = ["1979-12-22", "1983-03-05", "1992-11-28", "2004-03-06", "2012-04-28", "2020-04-11"];

export function buildDefault(): DefaultModel {
  const covers: DefaultCover[] = [];
  for (const d of DEFAULT_DATES) {
    const n = numberOneOn(d);
    if (n) covers.push({ year: d.slice(0, 4), song: n.song, artist: n.artist, cover: art(n.art, COVER_PX) });
  }
  return { url: siteHost(), covers, first: FIRST_CHART_WEEK, through: chartsThrough() };
}
