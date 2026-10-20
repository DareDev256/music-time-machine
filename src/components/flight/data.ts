/**
 * flight.json → the arrays the tunnel walks. Pure, no three.js, no DOM.
 *
 * Path order is newest → oldest: path index 0 is the latest chart week and the
 * camera flies toward higher indices. flight.json stores weeks oldest → newest.
 */

export interface FlightSong {
  s: string;
  a: string;
  art: string | null;
}

export interface FlightDoc {
  through: string;
  songs: FlightSong[];
  weeks: Array<[string, number]>;
}

export interface FlightData {
  through: string;
  songs: FlightSong[];
  /** ISO date per path index (newest first). */
  dates: string[];
  /** Song index per path index. */
  song: Int32Array;
  /** Chronological week of the #1 run this path week sits in (1 = first week at #1). */
  runWeek: Int32Array;
  runLength: Int32Array;
  /** Path indices i where the year of i differs from i - 1: a year ring sits between them. */
  gates: Int32Array;
  /** #1 runs in path order (newest first): run r spans path weeks runStart[r]..runEnd[r]. */
  runStart: Int32Array;
  runEnd: Int32Array;
  /** Run ordinal of each path week. */
  runOf: Int32Array;
}

export interface PassingWeek {
  date: string;
  song: string;
  artist: string;
  runWeek: number;
  runLength: number;
}

export function isFlightDoc(x: unknown): x is FlightDoc {
  if (!x || typeof x !== "object") return false;
  const d = x as Partial<FlightDoc>;
  if (!Array.isArray(d.songs) || !Array.isArray(d.weeks) || d.weeks.length === 0) return false;
  const n = d.songs.length;
  for (const w of d.weeks) {
    if (!Array.isArray(w) || typeof w[0] !== "string" || typeof w[1] !== "number") return false;
    if (w[1] < 0 || w[1] >= n) return false;
  }
  return true;
}

export function prepare(doc: FlightDoc): FlightData {
  const n = doc.weeks.length;
  const dates = new Array<string>(n);
  const song = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const w = doc.weeks[n - 1 - i];
    dates[i] = w[0];
    song[i] = w[1];
  }
  const runWeek = new Int32Array(n);
  const runLength = new Int32Array(n);
  const runOf = new Int32Array(n);
  const starts: number[] = [];
  const ends: number[] = [];
  let a = 0;
  while (a < n) {
    let b = a;
    while (b + 1 < n && song[b + 1] === song[a]) b++;
    for (let i = a; i <= b; i++) {
      runLength[i] = b - a + 1;
      runWeek[i] = b - i + 1; // path runs newest → oldest, so the oldest week of the run is week 1
      runOf[i] = starts.length;
    }
    starts.push(a);
    ends.push(b);
    a = b + 1;
  }
  const gates: number[] = [];
  for (let i = 1; i < n; i++) if (dates[i].slice(0, 4) !== dates[i - 1].slice(0, 4)) gates.push(i);
  return {
    through: doc.through || dates[0],
    songs: doc.songs,
    dates,
    song,
    runWeek,
    runLength,
    gates: Int32Array.from(gates),
    runStart: Int32Array.from(starts),
    runEnd: Int32Array.from(ends),
    runOf,
  };
}

/** Path index of the chart week in force on `date` (latest week ≤ date), clamped to the path. */
export function targetIndex(data: FlightData, date: string): number {
  const n = data.dates.length;
  if (!date || date >= data.dates[0]) return 0;
  // dates are descending: binary search for the first index with dates[i] <= date
  let lo = 0;
  let hi = n - 1;
  if (data.dates[hi] > date) return hi; // before the first chart week → land on it
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data.dates[mid] <= date) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function passingAt(data: FlightData, i: number): PassingWeek {
  const k = Math.max(0, Math.min(data.dates.length - 1, i));
  const s = data.songs[data.song[k]];
  return {
    date: data.dates[k],
    song: s.s,
    artist: s.a,
    runWeek: data.runWeek[k],
    runLength: data.runLength[k],
  };
}

/** First gate ordinal whose path index is ≥ week (binary search). */
export function firstGateAtOrAfter(data: FlightData, week: number): number {
  const g = data.gates;
  let lo = 0;
  let hi = g.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (g[mid] < week) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The runs overlapping path weeks [from, to] (inclusive), as [firstRun, lastRun]. */
export function runsBetween(data: FlightData, from: number, to: number): [number, number] {
  const n = data.dates.length;
  const a = Math.max(0, Math.min(n - 1, Math.floor(from)));
  const b = Math.max(0, Math.min(n - 1, Math.floor(to)));
  return [data.runOf[a], data.runOf[b]];
}

/** iTunes art template → a concrete square size. */
export function artUrl(template: string, size: number): string {
  return template.replace("{w}x{h}", `${size}x${size}`);
}

let docPromise: Promise<FlightDoc> | null = null;

/** Fetch /era/flight.json once per page load. A failed fetch is not cached. */
export function loadFlightDoc(url = "/era/flight.json"): Promise<FlightDoc> {
  if (docPromise) return docPromise;
  docPromise = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`flight.json ${r.status}`);
      return r.json();
    })
    .then((j: unknown) => {
      if (!isFlightDoc(j)) throw new Error("flight.json has the wrong shape");
      return j;
    })
    .catch((e) => {
      docPromise = null;
      throw e;
    });
  return docPromise;
}
