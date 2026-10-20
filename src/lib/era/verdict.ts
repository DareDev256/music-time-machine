// The fact-check verdict for a listener's "this was hot in YYYY-MM" claim, as a pure function.
// Dates keep their granularity: "2012" (year only), "2012-05" (month), "2012-05-17" (day).
// A year-only date spans its whole year, so it is never called "before release" or "blew up later"
// on the strength of a month it might not be.

export type Verdict = "consistent" | "blew-up-later" | "before-release" | "unverified";
export type EvidenceSource = "index" | "musicbrainz" | "itunes";

export interface KnownDate { source: EvidenceSource | string; date: string; label: string }
export interface Evidence { known: KnownDate[]; earliest?: string; verdict: Verdict }

/** Released more than this many months before the claimed month: allowed, flagged "blew up later". */
export const BLEW_UP_AFTER_MONTHS = 24;
/** A claim up to this many months before the first known date still counts as consistent (leaks, early plays). */
export const BEFORE_RELEASE_GRACE_MONTHS = 2;

const DATE_RE = /^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isDate(d: string): boolean {
  return DATE_RE.test(d);
}

/** Months since year 0: "2012-05" → 2012*12 + 4. */
export function monthIndex(ym: string): number {
  const m = MONTH_RE.exec(ym);
  if (!m) throw new Error(`not a month: ${ym}`);
  return Number(m[1]) * 12 + Number(m[2]) - 1;
}

/** The first and last month a date could mean: "2012" → [2012-01, 2012-12]; "2012-05-17" → [2012-05, 2012-05]. */
export function periodMonths(date: string): [number, number] {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`not a date: ${date}`);
  const y = Number(m[1]);
  if (!m[2]) return [y * 12, y * 12 + 11];
  const i = y * 12 + Number(m[2]) - 1;
  return [i, i];
}

/**
 * The earliest of the known dates, by the LAST month each could mean, so a bare "2024" does not
 * outrank a precise "2024-05-04" it contains (while "2023" still beats it). Ties go to the finer date.
 */
export function earliestOf(known: KnownDate[]): KnownDate | null {
  const valid = known.filter((k) => isDate(k.date));
  if (!valid.length) return null;
  return valid.reduce((a, b) => {
    const [, ea] = periodMonths(a.date), [, eb] = periodMonths(b.date);
    if (ea !== eb) return eb < ea ? b : a;
    if (a.date.length !== b.date.length) return b.date.length > a.date.length ? b : a;
    return b.date < a.date ? b : a;
  });
}

/**
 * consistent      earliest known date is on or before the claimed month (or at most 2 months after it)
 *                 and within 24 months of it
 * blew-up-later   released more than 24 months before the claimed month (allowed, just flagged)
 * before-release  the claimed month is more than 2 months before every known date (suspicious)
 * unverified      nothing dated was found
 */
export function verdictFor(claimedMonth: string, known: KnownDate[]): Evidence {
  const claimed = monthIndex(claimedMonth);
  const kept = known.filter((k) => isDate(k.date));
  const first = earliestOf(kept);
  if (!first) return { known: kept, verdict: "unverified" };
  const [start, end] = periodMonths(first.date);
  let verdict: Verdict;
  if (start - claimed > BEFORE_RELEASE_GRACE_MONTHS) verdict = "before-release";
  else if (claimed - end > BLEW_UP_AFTER_MONTHS) verdict = "blew-up-later";
  else verdict = "consistent";
  return { known: kept, earliest: first.date, verdict };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  consistent: "consistent",
  "blew-up-later": "blew up later",
  "before-release": "before release",
  unverified: "unverified",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2012-05-17" → "May 2012"; "2012" → "2012". */
export function shortDate(date: string): string {
  const m = DATE_RE.exec(date);
  if (!m) return date;
  return m[2] ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : m[1];
}

/** The small per-row note on the public list, e.g. "released 2010, blew up later". */
export function verdictNote(verdict: string, earliest?: string): string {
  if (!earliest || !isDate(earliest)) return "no release date on file";
  const year = earliest.slice(0, 4);
  switch (verdict) {
    case "blew-up-later": return `released ${year}, blew up later`;
    case "before-release": return `remembered before its first listed date, ${shortDate(earliest)}`;
    case "consistent": return `released ${shortDate(earliest)}`;
    default: return "no release date on file";
  }
}
