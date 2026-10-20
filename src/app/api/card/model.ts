// What a card says, assembled from the era shards. Rendering lives in render.tsx.

import { cardLine, seasonOf, type CardLine } from "@/lib/era/cardLine";
import { art, chartsThrough, indexRow, numberOneOn } from "@/lib/era/data";
import { FIRST_CHART_WEEK } from "./params";

export const COVER_PX = 600;

export interface NumberOneBlock {
  song: string;
  artist: string;
  cover: string | null;
  /** "WEEK 1 OF 8" */
  run: string;
  /** Chart issue date, MM.DD.YYYY */
  chartDate: string;
}

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

export function buildCard(input: { song: string | null; artist: string | null; date: string; clamped: boolean }): CardModel {
  const { song, artist, date } = input;
  const n1 = numberOneOn(date);
  const line = cardLine({ song, artist, date, numberOne: n1 ? { song: n1.song, artist: n1.artist } : null });
  const month = date.slice(0, 7);

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
          run: `WEEK ${n1.runWeek} OF ${n1.runLength}`,
          chartDate: readoutOf(n1.date),
        }
      : null,
    line,
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
