// Deterministic date extraction from typed text, and the week a date flies to.
// Every partial date lands mid-period (a year → 15 Jun, a month → the 15th), never on Jan 1.

import type { Granularity } from "./types";

export const CHART_START = "1958-08-04";

export interface DateDetail {
  date: string; // YYYY-MM-DD, partials padded to mid-period
  granularity: Granularity;
  rest: string; // the text with the date phrase lifted out
  label: string; // what was understood: "28 Apr 2012", "March 2012", "Summer 2012", "1999 · year only", "the 1990s"
}

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_BY_PREFIX: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const SEASON_MONTH: Record<string, number> = { spring: 4, summer: 7, fall: 10, autumn: 10, winter: 1 };

// Group 1 of every pattern is the left boundary (start of text or a non-word, non-apostrophe character);
// no lookbehind, so the patterns compile on older Safari.
const L = "(^|[^a-z0-9'‘’`])";
const R = "(?![a-z0-9])";
const MON = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const YEAR = "(19\\d{2}|20\\d{2})";
const YY = "['‘’`](\\d{2})";
const YEAR_OR_YY = `(?:${YEAR}|${YY})`;

type Hit = { y: number; m?: number; d?: number; kind: "day" | "month" | "season" | "year" | "decade"; word?: string };
type Build = (g: string[]) => Hit | "invalid";
interface Pattern {
  re: RegExp;
  build: Build;
  last?: boolean; // take the last occurrence (bare years: "prince 1999 2012" → 2012)
}

const pivot = (yy: number): number => (yy <= new Date().getFullYear() % 100 ? 2000 + yy : 1900 + yy);
const yearOf = (y?: string, yy?: string): number => (y ? Number(y) : pivot(Number(yy)));
const monthOf = (word: string): number => MONTH_BY_PREFIX[word.slice(0, 3).toLowerCase()] ?? 0;

function validDay(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const validYear = (y: number) => y >= 1900 && y <= 2099;

const day = (y: number, m: number, d: number): Hit | "invalid" => (validDay(y, m, d) ? { y, m, d, kind: "day" } : "invalid");
const month = (y: number, m: number): Hit | "invalid" => (validYear(y) && m >= 1 && m <= 12 ? { y, m, kind: "month" } : "invalid");

const P = (body: string, build: Build, last = false): Pattern => ({ re: new RegExp(L + body + R, "gi"), build, last });

// Most specific first.
const PATTERNS: Pattern[] = [
  P("(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})", (g) => day(+g[2], +g[3], +g[4])),
  P("(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{4}|\\d{2})", (g) => {
    const a = +g[2], b = +g[3];
    const y = g[4].length === 2 ? pivot(+g[4]) : +g[4];
    return a > 12 ? day(y, b, a) : day(y, a, b); // US month/day unless the first number cannot be a month
  }),
  P(`${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, (g) => day(+g[4], monthOf(g[2]), +g[3])),
  P(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON},?\\s+(\\d{4})`, (g) => day(+g[4], monthOf(g[3]), +g[2])),
  P("(\\d{4})-(\\d{1,2})(?![-/.]?\\d)", (g) => month(+g[2], +g[3])),
  P(`${MON}\\s+(?:of\\s+)?${YEAR_OR_YY}`, (g) => month(yearOf(g[3], g[4]), monthOf(g[2]))),
  P(`(spring|summer|fall|autumn|winter)\\s+(?:of\\s+)?${YEAR_OR_YY}`, (g) => {
    const y = yearOf(g[3], g[4]);
    return validYear(y) ? { y, m: SEASON_MONTH[g[2].toLowerCase()], kind: "season", word: g[2] } : "invalid";
  }),
  P("(?:the\\s+)?(?:(?:early|mid|late)[\\s-]+)?['‘’`]?(\\d{2}|\\d{4})s", (g) => {
    const n = g[2];
    if (!n.endsWith("0")) return "invalid";
    const y = n.length === 2 ? pivot(+n) : +n;
    return validYear(y) ? { y, kind: "decade" } : "invalid";
  }),
  P(`(?:early|mid|late)[\\s-]+(?:in\\s+)?${YEAR_OR_YY}`, (g) => {
    const y = yearOf(g[2], g[3]);
    return validYear(y) ? { y, kind: "year" } : "invalid";
  }),
  P(YEAR, (g) => ({ y: +g[2], kind: "year" }), true),
  P(YY, (g) => ({ y: pivot(+g[2]), kind: "year" }), true),
];

const pad = (n: number) => String(n).padStart(2, "0");

function shape(hit: Hit): { date: string; granularity: Granularity; label: string } {
  switch (hit.kind) {
    case "day":
      return { date: `${hit.y}-${pad(hit.m!)}-${pad(hit.d!)}`, granularity: "day", label: `${hit.d} ${MONTHS_LONG[hit.m! - 1].slice(0, 3)} ${hit.y}` };
    case "month":
      return { date: `${hit.y}-${pad(hit.m!)}-15`, granularity: "month", label: `${MONTHS_LONG[hit.m! - 1]} ${hit.y}` };
    case "season": {
      const w = hit.word!.toLowerCase();
      return { date: `${hit.y}-${pad(hit.m!)}-15`, granularity: "month", label: `${w[0].toUpperCase()}${w.slice(1)} ${hit.y}` };
    }
    case "decade":
      // A decade flies to its middle year.
      return { date: `${hit.y + 5}-06-15`, granularity: "year", label: `the ${hit.y}s` };
    default:
      return { date: `${hit.y}-06-15`, granularity: "year", label: `${hit.y} · year only` };
  }
}

// Joining words dropped from the end of the text before the date. A bare "in" or "on" stays unless a comma
// precedes it: titles end in them ("Let Me In", "Hold On").
const TAIL_AFTER_COMMA = /\s*[,;:]\s*(?:back\s+in|in|from|on|around|during|since|circa|about)?\s*$/i;
const TAIL_ALWAYS = /(?:^|\s+)(?:back\s+in|back\s+around|back\s+when|sometime\s+in|around|during|circa|since)\s*$/i;
const HEAD_ONLY = /^\s*(?:back\s+)?(?:in|from|around|during|since|circa)\s*$/i;

function restOf(text: string, start: number, end: number): string {
  let left = text.slice(0, start);
  let right = text.slice(end);
  if (HEAD_ONLY.test(left)) left = "";
  left = left.replace(TAIL_ALWAYS, "").replace(TAIL_AFTER_COMMA, "");
  right = right.replace(/^\s*[,;:]/, " ");
  return `${left} ${right}`
    .replace(/\(\s*\)|\[\s*\]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "")
    .trim();
}

/** extractDate plus a human label of what was understood. */
export function extractDateDetail(q: string): DateDetail | null {
  try {
    const text = typeof q === "string" ? q.slice(0, 500) : "";
    if (!text.trim()) return null;
    let work = text;
    for (const p of PATTERNS) {
      p.re.lastIndex = 0;
      let chosen: { hit: Hit; start: number; end: number } | null = null;
      const invalid: Array<[number, number]> = [];
      for (const m of work.matchAll(p.re)) {
        const start = (m.index ?? 0) + m[1].length;
        const end = (m.index ?? 0) + m[0].length;
        const hit = p.build(Array.from(m, (x) => x ?? ""));
        if (hit === "invalid") {
          invalid.push([start, end]);
          continue;
        }
        chosen = { hit, start, end };
        if (!p.last) break;
      }
      if (chosen) {
        const s = shape(chosen.hit);
        return { ...s, rest: restOf(text, chosen.start, chosen.end) };
      }
      // An impossible date ("2012-02-30") is masked so a looser pattern cannot pick a year out of it.
      for (const [a, b] of invalid) work = work.slice(0, a) + " ".repeat(b - a) + work.slice(b);
    }
    return null;
  } catch {
    return null;
  }
}

export function extractDate(q: string): { date: string; granularity: Granularity; rest: string } | null {
  const d = extractDateDetail(q);
  return d ? { date: d.date, granularity: d.granularity, rest: d.rest } : null;
}

/** "2012" / "2012-05" / "2012-05-17" → a validated YYYY-MM-DD padded to mid-period, with its granularity. */
export function parsePartialDate(s: unknown): { date: string; granularity: Granularity } | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(typeof s === "string" ? s.trim() : "");
  if (!m) return null;
  const y = +m[1];
  if (!validYear(y)) return null;
  if (!m[2]) return { date: `${m[1]}-06-15`, granularity: "year" };
  if (!m[3]) return +m[2] >= 1 && +m[2] <= 12 ? { date: `${m[1]}-${m[2]}-15`, granularity: "month" } : null;
  return validDay(y, +m[2], +m[3]) ? { date: `${m[1]}-${m[2]}-${m[3]}`, granularity: "day" } : null;
}

/** Re-pad a full date to its granularity's mid-period: ("2012-01-01", "year") → "2012-06-15". */
export function padToGranularity(date: string, g: Granularity): string {
  if (g === "year") return `${date.slice(0, 4)}-06-15`;
  if (g === "month") return `${date.slice(0, 7)}-15`;
  return date;
}

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The date a flight targets: year → YYYY-06-15, month → YYYY-MM-15, clamped to [CHART_START, today]. Unparseable → today. */
export function flightTarget(date: string, g: Granularity): string {
  const today = localToday();
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(typeof date === "string" ? date.trim() : "");
  if (!m) return today;
  let out: string;
  if (g === "year" || !m[2]) out = `${m[1]}-06-15`;
  else if (g === "month" || !m[3]) out = `${m[1]}-${m[2]}-15`;
  else out = `${m[1]}-${m[2]}-${m[3]}`;
  if (!parsePartialDate(out)) return today;
  if (out < CHART_START) return CHART_START;
  if (out > today) return today;
  return out;
}
