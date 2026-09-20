// Hot 100 #1 lookups over the full Billboard history (1958-08-04 → today).
// Data: data/hot100-number-ones.json, built by data/scripts/hot100_number_ones.py
// from Wikipedia's per-year lists. One row per issue week; runs are derived here.

import dataset from "../../data/hot100-number-ones.json";

export interface Hot100Week {
  date: string;   // issue date, ISO YYYY-MM-DD
  song: string;
  artist: string;
}

export interface NumberOne extends Hot100Week {
  weeksAtOne: number;  // length of the consecutive run this week belongs to
  runStart: string;    // issue date the run began
  runEnd: string;      // last issue date of the run
}

export const HOT100_FIRST_ISSUE = "1958-08-04";

const WEEKS: Hot100Week[] = (dataset as { weeks: Hot100Week[] }).weeks;
export const HOT100_LAST_ISSUE = WEEKS[WEEKS.length - 1].date;

/** Parse an ISO date as UTC midnight so a lookup never shifts by timezone. */
export function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : d;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Index of the issue week in effect on `iso` (last issue dated <= iso), or -1 before the chart existed. */
function weekIndexOn(iso: string): number {
  let lo = 0, hi = WEEKS.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (WEEKS[mid].date <= iso) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

function sameRecord(a: Hot100Week, b: Hot100Week): boolean {
  return a.song === b.song && a.artist === b.artist;
}

function runAt(i: number): NumberOne {
  let s = i, e = i;
  while (s > 0 && sameRecord(WEEKS[s - 1], WEEKS[i])) s--;
  while (e < WEEKS.length - 1 && sameRecord(WEEKS[e + 1], WEEKS[i])) e++;
  return { ...WEEKS[i], weeksAtOne: e - s + 1, runStart: WEEKS[s].date, runEnd: WEEKS[e].date };
}

/** The Hot 100 #1 in effect on a calendar date. Null before 1958-08-04. */
export function numberOneOn(iso: string): NumberOne | null {
  if (!parseIsoDate(iso)) return null;
  const i = weekIndexOn(iso);
  return i < 0 ? null : runAt(i);
}

/** Every distinct #1 whose run touches [fromIso, toIso], in chart order. */
export function numberOnesBetween(fromIso: string, toIso: string): NumberOne[] {
  if (!parseIsoDate(fromIso) || !parseIsoDate(toIso) || fromIso > toIso) return [];
  const out: NumberOne[] = [];
  for (let i = Math.max(weekIndexOn(fromIso), 0); i < WEEKS.length && WEEKS[i].date <= toIso; i++) {
    const run = runAt(i);
    if (!out.length || out[out.length - 1].runStart !== run.runStart) out.push(run);
  }
  return out;
}

/** Conception window for a birth date: 38 weeks (266 days) before, ±7 days. */
export function conceptionWindow(birthIso: string): { from: string; to: string } | null {
  const birth = parseIsoDate(birthIso);
  if (!birth) return null;
  const centre = new Date(birth.getTime() - 266 * 86_400_000);
  return {
    from: toIso(new Date(centre.getTime() - 7 * 86_400_000)),
    to: toIso(new Date(centre.getTime() + 7 * 86_400_000)),
  };
}

/** Total weeks in the dataset — exposed so the health endpoint can publish it. */
export function hot100WeekCount(): number {
  return WEEKS.length;
}
