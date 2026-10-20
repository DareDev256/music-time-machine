// Song resolver: typed text → a dated song, a date, or an honest "nothing found".
// Pure: every lookup is an injected dependency. Order (spec §5.3, rules §12.10):
//   1. own index (charts + lanes + archived heat + the hand-verified seed), whole text first
//   2. ONE MusicBrainz recording search + one iTunes search, in parallel, only when the index did not settle it
//   3. the year in the text, when no song can be named with confidence
// The earliest credible date wins. resolveQuery never throws and never waits on a dead dependency forever.

import type { DatedSong, Granularity, IndexFileRow, ResolveOutcome } from "./types";
import { CHART_START, extractDateDetail, flightTarget, localToday, padToGranularity, parsePartialDate, type DateDetail } from "./dates";
import {
  artistKeysLoose, artistNames, cleanQuery, compactSim, containsPhrase, FILLER, fuzzyPhrase, isStopword, norm, primaryArtistKey,
  primaryArtistName, primaryKeysLoose, soundKey, editDistance, stripTitle, titleForms, titleKey, tokenSim, tokens,
} from "./normalize";

export interface ResolverDeps {
  indexSearch(q: string): Promise<DatedSong[]>;
  musicbrainz(q: string): Promise<DatedSong[]>;
  itunes(q: string): Promise<DatedSong[]>;
}

const INDEX_MS = 5_000;
const EXTERNAL_MS = 8_000;
const MAX_CANDIDATES = 3;
const WHERE_ORDER: DatedSong["where"] = ["chart", "seed", "youtube", "musicbrainz", "itunes"];
const GRANULARITIES: Granularity[] = ["day", "month", "year"];

const LANE_LABELS: Record<string, string> = {
  rnb_hiphop: "Hot R&B/Hip-Hop Songs", rap: "Hot Rap Songs", country: "Hot Country Songs",
  rock_alt: "Alternative Airplay (Modern Rock Tracks)", dance: "Dance Club Songs", latin: "Hot Latin Songs",
  uk: "UK Singles Chart", canada: "Canadian Hot 100",
};
const HEAT_LABELS: Record<string, string> = {
  hotnewhiphop: "HotNewHipHop", hypem: "Hype Machine", billboard_rap: "Billboard Rap Songs", billboard_rnb: "Billboard R&B/Hip-Hop Songs",
};

// §12.10: karaoke / tribute / sound-alike releases never count.
const BAD_ARTIST = /karaoke|tribute|made famous|in the style of|sound-?alike|originally performed/i;
const BAD_TITLE = /karaoke|originally performed by|made famous by|in the style of/i;
const BAD_ALBUM = /karaoke|tribute to|made famous|in the style of|originally performed/i;
// TV / stage casts that charted covers (Glee Cast alone shares 163 titles with other songs in the index), and
// titles that say they are someone's version ("Rolling in the Deep (The Aretha Version)"). A cover never forces a
// picker against the song it covers.
const COVER_ACT = /\bglee cast\b|^(?:the )?cast of\b|\bcast recording\b|\b(?:broadway|london|motion picture|original) cast\b|\bkidz bop\b/i;
const COVER_TITLE = /[([][^)\]]*\b(?:cover|rendition)\b[^)\]]*[)\]]|[([]the [^)\]]+ version[)\]]/i;

// ── query ─────────────────────────────────────────────────────────────────────

interface QueryInfo {
  text: string; // cleaned, as typed
  whole: string; // normalised whole text
  rest: string; // normalised text without the date phrase ("" when the text is only a date)
  wholeTokens: Set<string>;
  content: string[]; // rest tokens that must be explained by a title or an artist
  dateTokens: string[]; // non-stopword tokens of the date phrase
  detail: DateDetail | null;
  year: number | null;
  pureDate: boolean; // the whole text is a date expression ("1999", "summer of '69", "March 2012")
  wholeList: string[];
  restList: string[];
  dateSet: Set<string>;
}

function queryInfo(text: string): QueryInfo {
  const detail = extractDateDetail(text);
  const whole = norm(text);
  const rest = detail ? norm(detail.rest) : whole;
  const restTokens = rest ? rest.split(" ") : [];
  const restSet = new Set(restTokens);
  const content = restTokens.filter((t) => !isStopword(t));
  return {
    text, whole, rest,
    wholeTokens: new Set(whole ? whole.split(" ") : []),
    content,
    dateTokens: (whole ? whole.split(" ") : []).filter((t) => !restSet.has(t) && !isStopword(t)),
    detail,
    year: detail ? Number(detail.date.slice(0, 4)) : null,
    pureDate: Boolean(detail) && content.length === 0,
    wholeList: whole ? whole.split(" ") : [],
    restList: restTokens,
    dateSet: new Set((whole ? whole.split(" ") : []).filter((t) => !restSet.has(t))),
  };
}

// ── rows ──────────────────────────────────────────────────────────────────────

/** Accept a row from any dependency only if it is shaped like a DatedSong; pad partial dates to mid-period. */
function sanitize(x: unknown): DatedSong | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Partial<DatedSong>;
  if (typeof r.song !== "string" || !r.song.trim() || typeof r.artist !== "string" || !r.artist.trim()) return null;
  const granularity: Granularity = GRANULARITIES.includes(r.granularity as Granularity) ? (r.granularity as Granularity) : "day";
  const parsed = parsePartialDate(r.date);
  if (!parsed) return null;
  const date = padToGranularity(parsed.date, parsed.granularity === "day" ? granularity : parsed.granularity);
  const where = Array.isArray(r.where) ? WHERE_ORDER.filter((w) => r.where!.includes(w)) : [];
  const out: DatedSong = {
    song: r.song.trim(), artist: r.artist.trim(), date,
    granularity: parsed.granularity === "day" ? granularity : parsed.granularity,
    dateSource: typeof r.dateSource === "string" ? r.dateSource : "",
    where, onDsp: typeof r.onDsp === "boolean" ? r.onDsp : null,
  };
  for (const k of ["art", "previewUrl", "youtubeId", "mbid", "isrc"] as const) {
    if (typeof r[k] === "string" && r[k]) out[k] = r[k];
  }
  if (validPeak(r.peak)) out.peak = r.peak;
  return out;
}

const validPeak = (p: unknown): p is number => typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= 100;

const sanitizeAll = (rows: unknown): DatedSong[] =>
  Array.isArray(rows) ? rows.map(sanitize).filter((r): r is DatedSong => r !== null) : [];

/** public/era/index.json row → DatedSong. Chart dates say "entered the Hot 100", never "released". */
export function indexRowToDatedSong(row: unknown): DatedSong | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Partial<IndexFileRow>;
  if (typeof r.s !== "string" || !r.s.trim() || typeof r.a !== "string" || !r.a.trim()) return null;
  const parsed = parsePartialDate(r.d);
  if (!parsed) return null;
  const g: Granularity = r.g === "month" || r.g === "year" ? r.g : parsed.granularity;
  const src = typeof r.src === "string" ? r.src : "";
  const ds = typeof r.ds === "string" && r.ds.trim() ? r.ds.trim() : "";
  const [kind, id = ""] = src.split(":");
  let where: DatedSong["where"];
  let dateSource: string;
  if (kind === "hot100") {
    where = ["chart"];
    dateSource = "entered the Hot 100";
  } else if (kind === "lane") {
    where = ["chart"];
    dateSource = ds || `#1 on ${LANE_LABELS[id] ?? id}`;
  } else if (kind === "heat") {
    where = ["chart"];
    dateSource = ds || `seen on ${HEAT_LABELS[id] ?? id} (archived capture)`;
  } else if (kind === "seed") {
    const w = new Set<string>(["seed", ...(Array.isArray(r.w) ? r.w.filter((x): x is string => typeof x === "string") : [])]);
    if (/youtube/i.test(ds) || typeof r.y === "string") w.add("youtube");
    where = WHERE_ORDER.filter((x) => w.has(x));
    dateSource = ds || "hand-verified";
  } else {
    where = [];
    dateSource = ds || "first seen";
  }
  const out: DatedSong = {
    song: r.s.trim(), artist: r.a.trim(), date: padToGranularity(parsed.date, g), granularity: g,
    dateSource, where, onDsp: typeof r.dsp === "boolean" ? r.dsp : null,
  };
  const yt = typeof r.y === "string" ? r.y : typeof r.yt === "string" ? r.yt : undefined;
  if (yt) out.youtubeId = yt;
  for (const k of ["art", "previewUrl", "mbid", "isrc"] as const) {
    if (typeof r[k] === "string" && r[k]) out[k] = r[k] as string;
  }
  if (validPeak(r.p)) out.peak = r.p;
  return out;
}

// ── dates ─────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const dayNum = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const PRECISION: Record<Granularity, number> = { day: 0, month: 1, year: 2 };

function period(r: DatedSong): [number, number] {
  const y = Number(r.date.slice(0, 4));
  if (r.granularity === "year") return [dayNum(`${y}-01-01`), dayNum(`${y}-12-31`)];
  if (r.granularity === "month") {
    const m = Number(r.date.slice(5, 7));
    return [dayNum(`${r.date.slice(0, 7)}-01`), Math.floor(Date.UTC(y, m, 0) / DAY_MS)];
  }
  const d = dayNum(r.date);
  return [d, d];
}
const gapDays = (a: DatedSong, b: DatedSong) => {
  const [as, ae] = period(a);
  const [bs, be] = period(b);
  return Math.max(0, Math.max(as, bs) - Math.min(ae, be));
};
const isSoft = (r: DatedSong) => r.where.includes("seed") || r.where.includes("youtube");
const SOURCE_RANK = (r: DatedSong) => (r.where.includes("seed") ? 0 : r.where.includes("musicbrainz") ? 1 : r.where.includes("chart") ? 2 : 3);

function defaultSource(r: DatedSong): string {
  if (r.dateSource) return r.dateSource;
  if (r.where.includes("musicbrainz")) return "first release (MusicBrainz)";
  if (r.where.includes("itunes")) return "released (iTunes)";
  if (r.where.includes("chart")) return "entered the Hot 100";
  return "first seen";
}

/**
 * Merge rows that are the SAME song from different sources into one DatedSong.
 * The earliest credible date wins:
 *  - dates before 1900 or after today are ignored;
 *  - a YouTube / seed date counts only within 12 months of another source's date, or when it is the only date;
 *  - a finer date that falls inside a coarser one's period beats the period's start (MB "2012" vs YouTube 2012-04-28);
 * Identity (title, artist) comes from the first chart / seed row, else the first row.
 */
export function mergeSong(rowsIn: DatedSong[]): DatedSong {
  const rows = rowsIn.map(sanitize).filter((r): r is DatedSong => r !== null);
  if (!rows.length) throw new Error("mergeSong needs at least one row");
  const today = dayNum(localToday());
  const floor = dayNum("1900-01-01");
  const valid = rows.filter((r) => {
    const [s] = period(r);
    return s >= floor && s <= today;
  });
  const hard = valid.filter((r) => !isSoft(r));
  // An imprecise date (year or month only) is a weak claim: it counts within 12 months of another source's date,
  // or when no other source has a full date. Measured: MusicBrainz files "Tennessee Whiskey" (2015) under "2012".
  const otherSource = (a: DatedSong, b: DatedSong) => !a.where.some((w) => b.where.includes(w));
  const credible = valid.filter((r) => {
    if (isSoft(r) && hard.length && !hard.some((h) => gapDays(r, h) <= 366)) return false;
    if (r.granularity === "day" || isSoft(r)) return true;
    const others = valid.filter((o) => otherSource(r, o));
    if (!others.some((o) => o.granularity === "day")) return true;
    return others.some((o) => gapDays(r, o) <= 366);
  });
  const pool = credible.length ? credible : valid.length ? valid : rows;
  const sorted = [...pool].sort((a, b) => period(a)[0] - period(b)[0] || PRECISION[a.granularity] - PRECISION[b.granularity] || SOURCE_RANK(a) - SOURCE_RANK(b));
  let best = sorted[0];
  for (let i = 0; i < 2; i++) {
    const [s, e] = period(best);
    const finer = sorted.filter((r) => PRECISION[r.granularity] < PRECISION[best.granularity] && period(r)[0] >= s && period(r)[0] <= e);
    if (!finer.length) break;
    best = finer[0];
  }

  // Identity: the credit of a chart / seed row, else of the plainest title ("Shutdown" over "Shutdown (Preditah
  // Remix)"). The rows share one normalised title, so the shortest spelling of it is the least decorated one: an
  // index row kept from a blog post ("Hotline Bling (Cha Cha Remix) (CDQ)") does not name the song.
  const identity =
    rows.find((r) => r.where.includes("chart") || r.where.includes("seed")) ?? rows.find((r) => stripTitle(r.song) === r.song.trim()) ?? rows[0];
  const plainest = rows.reduce((a, r) => (r.song.trim().length < a.song.trim().length ? r : a), identity);
  const where = WHERE_ORDER.filter((w) => rows.some((r) => r.where.includes(w)));
  const onDsp = rows.some((r) => r.onDsp === true) ? true : rows.some((r) => r.onDsp === false) ? false : null;
  const byDate = [...rows].sort((a, b) => period(a)[0] - period(b)[0]);
  const out: DatedSong = {
    song: plainest.song, artist: identity.artist, date: best.date, granularity: best.granularity,
    dateSource: defaultSource(best), where, onDsp,
  };
  const art = rows.find((r) => r.art && r.where.includes("itunes"))?.art ?? rows.find((r) => r.art)?.art;
  if (art) out.art = art;
  const previewUrl = rows.find((r) => r.previewUrl)?.previewUrl;
  if (previewUrl) out.previewUrl = previewUrl;
  const youtubeId = rows.find((r) => r.youtubeId)?.youtubeId;
  if (youtubeId) out.youtubeId = youtubeId;
  const mbid = byDate.find((r) => r.mbid && r.where.includes("musicbrainz"))?.mbid ?? rows.find((r) => r.mbid)?.mbid;
  if (mbid) out.mbid = mbid;
  const isrc = byDate.find((r) => r.isrc)?.isrc;
  if (isrc) out.isrc = isrc;
  const peaks = rows.map((r) => r.peak).filter(validPeak);
  if (peaks.length) out.peak = Math.min(...peaks);
  return out;
}

// ── grouping and matching ─────────────────────────────────────────────────────

type Origin = "index" | "mb" | "itunes";
interface Group {
  key: string;
  rows: DatedSong[];
  origins: Set<Origin>;
  names: Set<string>; // loose artist keys of every row
  primaries: Set<string>;
  indexRank: number; // best position in the index's own ranking (Infinity when the index did not return it)
}

class Groups {
  readonly list: Group[] = [];

  /**
   * Same title, and each side's lead artist appears somewhere in the other's credit. "RiFF RAFF feat. Chief Keef"
   * joins "Chief Keef & Riff Raff"; "Alright" by someone else featuring Kendrick Lamar does not join Kendrick's.
   */
  private find(r: DatedSong): Group | undefined {
    const key = titleKey(r.song);
    const loose = artistKeysLoose(r.artist);
    const lead = primaryKeysLoose(r.artist);
    return this.list.find((g) => g.key === key && [...lead].some((p) => g.names.has(p)) && [...g.primaries].some((p) => loose.has(p)));
  }

  private push(g: Group | undefined, r: DatedSong, origin: Origin, rank = Infinity): void {
    const names = artistKeysLoose(r.artist);
    const lead = primaryKeysLoose(r.artist);
    if (!g) {
      this.list.push({ key: titleKey(r.song), rows: [r], origins: new Set([origin]), names, primaries: lead, indexRank: rank });
      return;
    }
    if (origin === "index") g.rows.unshift(r);
    else g.rows.push(r);
    g.origins.add(origin);
    g.indexRank = Math.min(g.indexRank, rank);
    names.forEach((n) => g.names.add(n));
    lead.forEach((n) => g.primaries.add(n));
  }

  add(r: DatedSong, origin: "index" | "mb", rank = Infinity): void {
    this.push(this.find(r), r, origin, rank);
  }

  /** iTunes counts only when its primary artist matches the song's (§12.10); karaoke and tribute rows never. */
  addItunes(r: DatedSong, qi: QueryInfo): void {
    if (BAD_ARTIST.test(r.artist) || BAD_TITLE.test(r.song)) return;
    const g = this.find(r);
    if (g) return this.push(g, r, "itunes");
    // No other source knows this song: it may stand alone only when the text names its artist anywhere (typos and
    // run-together spellings allowed), in words the title did not use.
    const names = artistNames(r.artist).map((n) => n.split(" "));
    const named = titleForms(r.song).some((f) => {
      const used = fitTitle(f.split(" "), qi.wholeList).used;
      return findArtist(leftover(qi.wholeList, used), names).len > 0;
    });
    if (named) this.push(undefined, r, "itunes");
  }
}

interface Fit {
  cov: number; // weighted share of the title's words found in the text (typos count less)
  phraseSim: number; // > 0 when the title appears as one contiguous run
  used: Set<number>; // positions of the text the title consumed
  exact: boolean; // every title word matched as typed
}

/**
 * Where a title sits in the text: a contiguous run first ("rolling in the deap"; one short word may be an edit off
 * when the rest is exact, "shake it of"), then as one run-together word ("hotlinebling"), else word by word
 * ("chief keef my gear").
 */
function fitTitle(tt: string[], words: string[]): Fit {
  const run = fuzzyPhrase(words, tt, 0.8, true);
  if (run.start >= 0) {
    const used = new Set(tt.map((_, j) => run.start + j));
    return { cov: run.sim, phraseSim: run.sim, used, exact: run.sim === 1 };
  }
  const glued = words.findIndex((w) => compactSim(w, tt) >= 0.85);
  if (glued >= 0) {
    const sim = compactSim(words[glued], tt);
    return { cov: sim, phraseSim: sim, used: new Set([glued]), exact: false };
  }
  const used = new Set<number>();
  let sum = 0;
  for (const t of tt) {
    let bi = -1;
    let bs = 0;
    words.forEach((w, i) => {
      if (used.has(i)) return;
      const sim = tokenSim(w, t);
      if (sim > bs) {
        bs = sim;
        bi = i;
      }
    });
    if (bi >= 0) {
      used.add(bi);
      sum += bs;
    }
  }
  return { cov: tt.length ? sum / tt.length : 0, phraseSim: 0, used, exact: sum === tt.length };
}

/**
 * The text with the title's words taken out. An artist counts only for words the title did not use, so a
 * MusicBrainz "artist" named exactly like the song (measured: "Somebody That I Used to Know" by
 * "Somebody That I Used to Know", 2017) is not an artist match for a title-only query.
 */
const leftover = (words: string[], used: Set<number>) => words.filter((_, i) => !used.has(i));

/**
 * The longest artist name present in `words` as a whole: contiguous words (typos allowed) or one run-together word
 * ("chiefkeef", "popsmoke"). Returns its positions and the name's length in words (0 when none).
 */
function findArtist(words: string[], names: string[][]): { at: Set<number>; len: number } {
  let best = { at: new Set<number>(), len: 0 };
  for (const n of names) {
    if (n.length <= best.len) continue;
    const run = fuzzyPhrase(words, n);
    if (run.sim > 0) {
      best = { at: new Set(n.map((_, j) => run.start + j)), len: n.length };
      continue;
    }
    const glued = words.findIndex((w) => compactSim(w, n) >= 0.85);
    if (glued >= 0) best = { at: new Set([glued]), len: n.length };
  }
  return best;
}

interface Match {
  group: Group;
  score: number;
  artistHit: boolean;
  exactWhole: boolean;
  exact: boolean; // the title matched as typed, no typo tolerance needed
  inYear: boolean;
  explained: number; // typed words (not filler, not the date) this reading accounts for
  allExplained: boolean; // ...and it accounts for every one of them
  noisy: boolean; // a specific title found inside a longer description, with no artist to confirm it
}

// A year in the text refers to the song's own date (its earliest credible one), not to any stray compilation row.
const mergedYear = new WeakMap<Group, { n: number; year: number }>();
function groupYear(g: Group): number {
  const hit = mergedYear.get(g);
  if (hit && hit.n === g.rows.length) return hit.year;
  const year = Number(mergeSong(g.rows).date.slice(0, 4));
  mergedYear.set(g, { n: g.rows.length, year });
  return year;
}

function matchGroup(g: Group, qi: QueryInfo): Match | null {
  // A MusicBrainz-only recording credited to an "artist" with the song's own name is a mislabelled upload.
  // (Self-titled songs that charted or are on iTunes, "Bad Company" by Bad Company, are unaffected.)
  if (!g.origins.has("index") && !g.origins.has("itunes") && g.names.has(g.key)) return null;
  const names = Array.from(new Set(g.rows.flatMap((r) => artistNames(r.artist)))).map((n) => n.split(" "));
  const forms = Array.from(new Set(g.rows.flatMap((r) => titleForms(r.song))));
  const strip = (s: string) => s.split(" ").filter((t) => !isStopword(t)).join(" ");
  // A text that is only a date yields to a title only when the FULL title is the whole text, as typed: "1999" is
  // Prince, but "2012" is not "2012 (It Ain't The End)".
  if (qi.pureDate) {
    const full = g.rows.map((r) => norm(String(r.song).replace(/[()[\]{}]/g, " ")));
    if (!full.some((f) => f === qi.whole || (strip(f) !== "" && strip(f) === strip(qi.whole)))) return null;
  }
  type Best = { score: number; exactWhole: boolean; artistHit: boolean; exact: boolean; explained: number; allExplained: boolean; noisy: boolean };
  let best: Best | null = null;
  for (const f of forms) {
    const tt = f.split(" ");
    // A title specific enough to stand inside a description: two content words, eight letters.
    const specific = tt.filter((t) => !isStopword(t)).length >= 2 && tt.join("").length >= 8;
    // With the date words (titles that hold a year: "1999 prince") and without them ("cuz my gear 2012").
    for (const words of [qi.wholeList, qi.restList]) {
      if (!words.length) continue;
      const fit = fitTitle(tt, words);
      const leftIdx = words.map((_, i) => i).filter((i) => !fit.used.has(i));
      const left = leftIdx.map((i) => words[i]);
      // The artist must match as a whole name; only then are its words explained ("anne marie" does not half-match
      // "Anne-Marie van Eeden" and excuse "marie").
      const found = findArtist(left, names);
      const artistAt = new Set([...found.at].map((i) => leftIdx[i]));
      const artistHit = found.len > 0;
      // People name an artist by a first or last word ("kendrick not like us", "cudi day n nite"): such a word is
      // explained (it is not an extra), though it is not a full artist match. A middle word is not.
      const byEdgeWord = (t: string) => names.some((n) => n.length > 1 && (tokenSim(t, n[0]) >= 0.8 || tokenSim(t, n[n.length - 1]) >= 0.8));
      const isExplained = (t: string, i: number) => fit.used.has(i) || artistAt.has(i) || tt.includes(t) || byEdgeWord(t);
      const partial = leftIdx.some((i) => !artistAt.has(i) && byEdgeWord(words[i]));
      const countable = words.map((t, i) => ({ t, i })).filter(({ t }) => !FILLER.has(t) && !qi.dateSet.has(t));
      const explained = countable.filter(({ t, i }) => isExplained(t, i)).length;
      const extras = countable.filter(({ t, i }) => !isExplained(t, i) && !isStopword(t)).length;
      const phrase = fit.phraseSim > 0;
      // Extra words veto a title only when it is too short to stand on its own; a description around a specific
      // title ("that song with the phone ringing, hotline bling") is context, not a contradiction.
      const strongRun = phrase && fit.phraseSim >= 0.9 && specific;
      const ok = (phrase && (extras === 0 || artistHit || strongRun)) || (fit.cov >= 0.6 && tt.length >= 2 && artistHit && extras === 0);
      if (!ok) continue;
      const noisy = !artistHit && extras > 0;
      const exactWhole = f === qi.whole || (strip(f) !== "" && strip(f) === strip(qi.whole));
      const exactRest = qi.rest !== "" && (f === qi.rest || (strip(f) !== "" && strip(f) === strip(qi.rest)));
      const score =
        10 * fit.cov + (phrase ? 4 * fit.phraseSim : 0) + (exactWhole || exactRest ? 3 : 0) + (artistHit ? 6 : partial ? 3 : 0) - 3 * extras +
        (countable.length ? (2 * explained) / countable.length : 0);
      if (!best || score > best.score) {
        best = { score, exactWhole, artistHit, exact: fit.exact, explained, allExplained: explained === countable.length, noisy };
      }
    }
  }
  if (!best) return null;
  const inYear = qi.year !== null && Math.abs(groupYear(g) - qi.year) <= 1;
  // Popularity priors for ordering a shared title: charted / seeded, its Hot 100 peak, the index's own rank, an
  // iTunes listing, more MusicBrainz releases. A cast cover sinks below the song it covers.
  const peak = groupPeak(g);
  const prior =
    (g.origins.has("index") ? 2 : 0) +
    (Number.isFinite(peak) ? (1.5 * (101 - peak)) / 100 : 0) +
    (Number.isFinite(g.indexRank) ? 0.5 * (1 - Math.min(g.indexRank, 8) / 8) : 0) +
    (g.origins.has("itunes") ? 1 : 0) +
    Math.min(g.rows.length, 4) * 0.1 -
    (isCoverAct(g) ? 3 : 0);
  return { group: g, ...best, score: best.score + (inYear ? 3 : 0) + prior, inYear };
}

const isCoverAct = (g: Group) => g.rows.every((r) => COVER_ACT.test(r.artist) || COVER_TITLE.test(r.song));
const mbRows = (g: Group) => g.rows.filter((r) => r.where.includes("musicbrainz")).length;
const groupPeak = (g: Group) => Math.min(Infinity, ...g.rows.map((r) => r.peak).filter(validPeak));

const matchAll = (groups: Groups, qi: QueryInfo): Match[] =>
  groups.list
    .map((g) => matchGroup(g, qi))
    .filter((m): m is Match => m !== null)
    .sort((a, b) => b.score - a.score);

/**
 * Typo tolerance only where nothing matches as typed: an exact index match ("hold on") drops fuzzy look-alikes
 * ("gold on"); any other exact match drops fuzzy non-index ones, but a charted song found through a typo
 * ("billy jean" → Billie Jean) still stands against an obscure recording spelled that way. A fuzzy reading that
 * accounts for more of what was typed than every exact one also stands ("shake it of": Shake It Off, not Shake It).
 */
function preferExact(ms: Match[]): Match[] {
  const exact = ms.filter((m) => m.exact);
  if (!exact.length) return ms;
  const most = Math.max(...exact.map((m) => m.explained));
  if (exact.some((m) => m.group.origins.has("index"))) return ms.filter((m) => m.exact || m.explained > most);
  return ms.filter((m) => m.exact || m.group.origins.has("index") || m.explained > most);
}

type Decision = { kind: "accept"; match: Match } | { kind: "ambiguous"; matches: Match[] } | { kind: "none" };

function decide(all: Match[], qi: QueryInfo): Decision {
  const matches = preferExact(all);
  if (!matches.length) return { kind: "none" };
  const hits = matches.filter((m) => m.artistHit);
  if (hits.length) {
    // A year in the text picks among the artist's songs: one within ±1 year beats a stronger title match outside it.
    const pool = qi.year !== null && hits.some((m) => m.inYear) ? hits.filter((m) => m.inYear) : hits;
    if (pool.length === 1 || pool[0].score > pool[1].score) return { kind: "accept", match: pool[0] };
    return { kind: "ambiguous", matches: pool };
  }
  // Only one song carries this title in everything we can see: not a common title.
  if (matches.length === 1) return { kind: "accept", match: matches[0] };
  // Every other candidate is a cast cover of it ("Rolling in the Deep": Adele vs Glee Cast).
  const originals = matches.filter((m) => !isCoverAct(m.group));
  if (originals.length === 1) return { kind: "accept", match: originals[0] };
  const pool = originals.length ? originals : matches;
  // A common title with no artist: a year that fits exactly one candidate settles it.
  const inYear = pool.filter((m) => m.inYear);
  if (qi.year !== null && inYear.length === 1) return { kind: "accept", match: inYear[0] };
  // So does accounting for every word typed when no other reading does ("shake it of": Shake It Off, not Shake It).
  const whole = pool.filter((m) => m.allExplained);
  if (whole.length === 1) return { kind: "accept", match: whole[0] };
  // So does the chart: one candidate made the top 10 and no other made the top 40 ("Billie Jean": Michael Jackson
  // #1, David Cook #47). Two big hits with one title ("Hold On": #1 and #2) still need a pick.
  const peaks = pool.map((m) => groupPeak(m.group));
  const bi = peaks.indexOf(Math.min(...peaks));
  if (peaks[bi] <= 10 && peaks.every((pk, i) => i === bi || pk > 40)) return { kind: "accept", match: pool[bi] };
  // So do two independent sources: the top candidate is on iTunes and in MusicBrainz, and no other candidate
  // is in either. A MusicBrainz-only match never qualifies (§12.10).
  const [top, ...others] = pool;
  if (top.group.origins.has("itunes") && mbRows(top.group) >= 2 && others.every((m) => !m.group.origins.has("itunes") && mbRows(m.group) === 0)) {
    return { kind: "accept", match: top };
  }
  return { kind: "ambiguous", matches };
}

// ── outcomes ──────────────────────────────────────────────────────────────────

function dateOutcome(d: DateDetail): ResolveOutcome {
  const target = flightTarget(d.date, d.granularity);
  let label = d.label;
  if (d.date < CHART_START) label += " · the Hot 100 starts 4 Aug 1958";
  else if (d.date > localToday()) label += " · flying to today";
  return { kind: "date", date: target, granularity: d.granularity, label };
}

const NONE_REASON = "No song or date found in that.";

function noneOutcome(qi: QueryInfo | null, indexRows: DatedSong[]): ResolveOutcome {
  // The artist is known but the song is not: hint the year they arrived (the most common year among their rows).
  const years = qi
    ? indexRows.filter((r) => artistNames(r.artist).some((n) => containsPhrase(qi.whole, n))).map((r) => Number(r.date.slice(0, 4)))
    : [];
  if (!years.length) return { kind: "none", reason: NONE_REASON };
  const counts = new Map<number, number>();
  years.forEach((y) => counts.set(y, (counts.get(y) ?? 0) + 1));
  const yearHint = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  return { kind: "none", reason: NONE_REASON, yearHint };
}

// onDsp is never set to false from an iTunes miss: search omits real catalogue tracks (measured 2026-10-20:
// "Nikes Frank Ocean" returns five other Blonde tracks and a piano tribute, not Nikes). Only a verified row
// (the seed's dsp: false) can say "not on Apple Music".
function songOutcome(best: Match, others: Match[], needsPick: boolean): ResolveOutcome {
  const merged = mergeSong(best.group.rows);
  const candidates = [merged, ...others.filter((m) => m !== best).slice(0, MAX_CANDIDATES - 1).map((m) => mergeSong(m.group.rows))];
  return needsPick ? { kind: "song", best: merged, candidates, needsPick: true } : { kind: "song", best: merged, candidates };
}

// ── dependency calls ──────────────────────────────────────────────────────────

type CallResult = { ok: true; rows: DatedSong[] } | { ok: false; rows: [] };
const FAILED: CallResult = { ok: false, rows: [] };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function call(fn: () => Promise<DatedSong[]>, ms: number): Promise<CallResult> {
  try {
    const rows = await withTimeout(Promise.resolve().then(fn), ms);
    return { ok: true, rows: sanitizeAll(rows) };
  } catch {
    return FAILED;
  }
}

const dedupe = (rows: DatedSong[]) => {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.song}|${r.artist}|${r.date}|${r.dateSource}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// ── resolveQuery ──────────────────────────────────────────────────────────────

/**
 * Split "title artist" / "artist title" using artist names the index returned: the longest name that matches
 * (typos allowed) a run at the start or the end of the text, leaving a non-empty title. The artist comes back as
 * the index spells it ("chif keef" → "chief keef").
 */
function knownArtistSplit(qi: QueryInfo, rows: DatedSong[]): { title: string; artist: string } | null {
  // Both views are scored together: without the date ("cuz my gear 2012 chief keef") and with it, where a
  // date-looking word next to a known artist is the title ("2002 anne marie": §12.10, a year is a year only if the
  // rest still resolves). The artist may sit anywhere ("that drake song with the phone ring") and may be typed as
  // one word ("popsmoke"). The longest artist name wins, then a name at either end, then the closer spelling, then
  // the view without the date, so "anne marie" + "2002" beats "mario" (one fuzzy word) + "anne".
  const names = Array.from(new Set(rows.flatMap((r) => artistNames(r.artist)))).map((n) => n.split(" "));
  const views = qi.detail ? [mbTokens(qi.detail.rest), mbTokens(qi.text)] : [mbTokens(qi.text)];
  type Cand = { title: string; artist: string; len: number; edge: boolean; sim: number };
  let best: Cand | null = null;
  const better = (a: Cand, b: Cand) => a.len !== b.len ? a.len > b.len : a.edge !== b.edge ? a.edge : a.sim > b.sim;
  for (const words of views) {
    for (const n of names) {
      const hits: Array<{ start: number; span: number; sim: number }> = [];
      const run = fuzzyPhrase(words, n);
      if (run.sim > 0) hits.push({ start: run.start, span: n.length, sim: run.sim });
      words.forEach((w, i) => {
        const sim = compactSim(w, n);
        if (sim >= 0.85) hits.push({ start: i, span: 1, sim });
      });
      for (const h of hits) {
        const title = [...words.slice(0, h.start), ...words.slice(h.start + h.span)];
        if (!title.length) continue;
        const cand = { title: title.join(" "), artist: n.join(" "), len: n.length, edge: h.start === 0 || h.start + h.span === words.length, sim: h.sim };
        if (!best || better(cand, best)) best = cand;
      }
    }
  }
  return best ? { title: best.title, artist: best.artist } : null;
}

async function resolveInner(q: string, deps: ResolverDeps): Promise<ResolveOutcome> {
  const text = cleanQuery(q);
  if (!text) return { kind: "none", reason: "Type a song, an artist and a year, or a date." };
  const qi = queryInfo(text);

  // 1. Own index: the whole text first (titles that look like years), and the text without its date.
  const restText = qi.detail?.rest ?? "";
  const [whole, rest] = await Promise.all([
    call(() => deps.indexSearch(text), INDEX_MS),
    restText && norm(restText) !== qi.whole ? call(() => deps.indexSearch(restText), INDEX_MS) : Promise.resolve(FAILED),
  ]);
  const indexRows = dedupe([...whole.rows, ...rest.rows]);
  const groups = new Groups();
  indexRows.forEach((r, i) => groups.add(r, "index", i));
  const fromIndex = decide(matchAll(groups, qi), qi);

  // A text that is only a date stays a date unless the index (charts + seed) holds a song with exactly that title.
  // MusicBrainz is not asked: it has a recording called almost every year, so it can never outvote the date.
  if (qi.pureDate && fromIndex.kind !== "accept") return dateOutcome(qi.detail!);

  // A bare year that is also a charted title ("1999", "1985") is the song, but the year is as likely a reading:
  // flag it so the caller offers both. Season / month phrases ("Summer of '69") are titles first.
  const yearOrSong = qi.pureDate && qi.detail!.granularity === "year";

  // The hand-verified seed is the answer as it stands: zero external calls.
  if (fromIndex.kind === "accept" && fromIndex.match.group.rows.some((r) => r.where.includes("seed"))) {
    const others = matchAll(groups, qi).filter((m) => m.group !== fromIndex.match.group);
    return songOutcome(fromIndex.match, others, yearOrSong || fromIndex.match.noisy);
  }

  // 2. One MusicBrainz call and one iTunes call. Aimed at the index's song when it named one.
  const targetMatch = fromIndex.kind === "accept" ? fromIndex.match : null;
  const target = targetMatch ? targetMatch.group : null;
  let mbText = text;
  // iTunes gets the title words as typed (stopwords too: "somebody that i used to know"), minus the date and filler.
  let itText = mbTokens(qi.detail ? qi.detail.rest : text).filter((t) => t !== "by").join(" ") || qi.whole || text;
  if (target) {
    const id = target.rows[0];
    const title = stripTitle(id.song);
    mbText = `${title} by ${primaryArtistName(id.artist)}`;
    itText = `${title} ${primaryArtistName(id.artist)}`;
  } else {
    // "title artist" with no separator: an artist the index knows at either end of the text (typos allowed) splits
    // it, and MusicBrainz searches the rest as a title by that artist, spelled the way the charts spell it.
    const split = knownArtistSplit(qi, indexRows);
    if (split) {
      mbText = `${split.title} by ${split.artist}`;
      itText = `${split.title} ${split.artist}`;
    }
  }
  const [mbRes, itRes] = await Promise.all([
    call(() => deps.musicbrainz(mbText), EXTERNAL_MS),
    call(() => deps.itunes(itText), EXTERNAL_MS),
  ]);
  mbRes.rows.forEach((r) => groups.add(r, "mb"));
  itRes.rows.forEach((r) => groups.addItunes(r, qi));
  let matches = matchAll(groups, qi);

  // Nothing matched as typed: ONE fuzzy MusicBrainz retry (so at most 2 MB calls per resolve; browserDeps spaces
  // them ≥ 1.1 s apart for the 1 req/s rule). Not after a failed call: a busy MusicBrainz is not asked again.
  if (!target && mbRes.ok && decide(matches, qi).kind === "none") {
    const retry = await call(() => deps.musicbrainz(MB_FUZZY + mbText), EXTERNAL_MS);
    retry.rows.forEach((r) => groups.add(r, "mb"));
    matches = matchAll(groups, qi);
  }

  if (target) {
    const self = matches.find((m) => m.group === target) ?? targetMatch!;
    // A title found inside a description, with no artist to confirm it, is offered as a pick rather than launched.
    return songOutcome(self, matches.filter((m) => m.group !== target), yearOrSong || self.noisy);
  }

  const decision = decide(matches, qi);
  if (decision.kind === "accept") {
    return songOutcome(decision.match, matches.filter((m) => m.group !== decision.match.group), decision.match.noisy);
  }
  if (decision.kind === "ambiguous") {
    // §3.2: ambiguous input with a year falls back to that year; without one, show up to 3 and let them pick.
    if (qi.detail) return dateOutcome(qi.detail);
    const [first, ...rest] = decision.matches;
    return songOutcome(first, rest, true);
  }
  if (qi.detail) return dateOutcome(qi.detail);
  return noneOutcome(qi, indexRows);
}

export async function resolveQuery(q: string, deps: ResolverDeps): Promise<ResolveOutcome> {
  try {
    return await resolveInner(q, deps);
  } catch {
    try {
      const d = extractDateDetail(cleanQuery(q));
      if (d) return dateOutcome(d);
    } catch {
      /* fall through */
    }
    return { kind: "none", reason: NONE_REASON };
  }
}

// ── /api/resolve: own-index search (pure; the route owns the file) ────────────

interface PreparedRow {
  song: DatedSong;
  titleList: string[]; // the stripped title's words, in order
  all: Set<string>; // every title word (parentheticals too) and artist word
  leads: string[][]; // the lead credit's names as word lists ("chief keef", "lil reese")
  forms: string[];
  year: number;
  bonus: number;
  specific: boolean; // the title can stand inside a description: two content words, eight letters
}
export interface PreparedIndex {
  rows: PreparedRow[];
  postings: Map<string, number[]>;
  vocab: Map<number, string[]>; // index words by length, for typo expansion
  sounds: Map<string, string[]>; // index words by sound key
  glued: Map<string, string>; // multi-word artist names and titles with the spaces removed → spaced ("chiefkeef" → "chief keef")
  gluedByLen: Map<number, string[]>;
}

const SRC_BONUS = (src: string) => (src === "seed" ? 0.75 : src === "hot100" ? 0.5 : src.startsWith("lane:") ? 0.25 : 0);
/** `p` (best Hot 100 peak, 1–100) breaks ties between songs sharing a title; worth less than one artist word. */
const PEAK_BONUS = (p: unknown) => (validPeak(p) ? (0.9 * (101 - p)) / 100 : 0);

const bucket = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
};

export function prepareIndex(rows: unknown): PreparedIndex {
  const out: PreparedIndex = { rows: [], postings: new Map(), vocab: new Map(), sounds: new Map(), glued: new Map(), gluedByLen: new Map() };
  const glue = (words: string[]) => {
    if (words.length < 2) return;
    const k = words.join("");
    if (k.length >= 6 && !/\d/.test(k) && !out.glued.has(k)) {
      out.glued.set(k, words.join(" "));
      bucket(out.gluedByLen, k.length, k);
    }
  };
  if (!Array.isArray(rows)) return out;
  // Artists repeat across rows (one prolific artist, dozens of rows): normalise each credit once.
  const credits = new Map<string, { key: string; words: string[]; leads: string[][] }>();
  const credit = (a: string) => {
    let c = credits.get(a);
    if (!c) {
      c = { key: primaryArtistKey(a), words: tokens(a), leads: [...primaryKeysLoose(a)].map((n) => n.split(" ")) };
      credits.set(a, c);
    }
    return c;
  };
  const parsed = rows.map((raw) => {
    const song = indexRowToDatedSong(raw);
    return { raw: raw as IndexFileRow, song, credit: song ? credit(song.artist) : null };
  });
  // An artist's chart footprint (rows in the index) is a weak popularity signal for songs that share a title.
  const footprint = new Map<string, number>();
  for (const { credit: c } of parsed) if (c) footprint.set(c.key, (footprint.get(c.key) ?? 0) + 1);
  for (const { raw: r, song, credit: c } of parsed) {
    if (!song || !c) continue;
    const forms = titleForms(song.song);
    const titleList = (forms[0] ?? "").split(" ").filter(Boolean);
    const all = new Set([...forms.flatMap((f) => f.split(" ")), ...c.words]);
    const leads = c.leads;
    const id = out.rows.length;
    const fame = Math.min(Math.log2((footprint.get(c.key) ?? 0) + 1), 7) * 0.08;
    const specific = titleList.filter((t) => !isStopword(t)).length >= 2 && titleList.join("").length >= 8;
    out.rows.push({ song, titleList, all, leads, forms, year: Number(song.date.slice(0, 4)), bonus: SRC_BONUS(String(r.src ?? "")) + PEAK_BONUS(r.p) + fame, specific });
    glue(titleList);
    leads.forEach(glue);
    for (const t of all) bucket(out.postings, t, id);
  }
  for (const t of out.postings.keys()) {
    if (/\d/.test(t)) continue;
    bucket(out.vocab, t.length, t);
    if (t.length >= 3) bucket(out.sounds, soundKey(t), t);
  }
  return out;
}

/** Index words a typed word may mean, with their similarity (exact, sound key, one or two edits, prefix). */
function expand(index: PreparedIndex, q: string): Map<string, number> {
  const out = new Map<string, number>();
  if (index.postings.has(q)) out.set(q, 1);
  if (/\d/.test(q)) return out;
  const put = (t: string) => {
    const sim = tokenSim(q, t);
    if (sim > (out.get(t) ?? 0)) out.set(t, sim);
  };
  if (q.length >= 3) (index.sounds.get(soundKey(q)) ?? []).forEach(put);
  const max = q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
  for (let len = Math.max(4, q.length - max); max && len <= q.length + max; len++) {
    for (const t of index.vocab.get(len) ?? []) if (editDistance(q, t, max) <= max) put(t);
  }
  if (q.length >= 3) {
    for (let len = q.length + 1; len <= Math.floor(q.length / 0.6); len++) {
      for (const t of index.vocab.get(len) ?? []) if (t.startsWith(q)) put(t);
    }
  }
  return out;
}

/**
 * Own-index lookup, typo tolerant. A row is a candidate when most of its title is in the text (and the text is
 * mostly explained by it), when every word of the text is explained by its title and artist, or when its lead
 * artist sits at either end of the text (so the resolver learns that artist's spelling). Date words are optional
 * (rows within ±1 year are boosted) unless the text is only a date, when the title itself must carry them ("1999").
 * Score: title coverage 6, text coverage 2, artist coverage 1.5, an exact title 5, the year 4, then source / peak.
 */
export function searchIndex(index: PreparedIndex, q: string, limit = 8): DatedSong[] {
  const cleaned = cleanQuery(q);
  if (!cleaned) return [];
  const text = unglue(index, cleaned);
  const qi = queryInfo(text);
  const scored: Array<{ row: PreparedRow; score: number }> = [];
  const yearBoost = (row: PreparedRow) => (qi.year !== null && Math.abs(row.year - qi.year) <= 1 ? 4 : 0);
  const exactTitle = (row: PreparedRow) => row.forms.some((f) => f === qi.whole || (qi.rest !== "" && f === qi.rest));

  if (!qi.content.length) {
    // Only a date: titles that carry every date word, as typed.
    if (!qi.dateTokens.length) return [];
    const lists = qi.dateTokens.map((t) => index.postings.get(t) ?? []);
    const shortest = lists.reduce((a, b) => (b.length < a.length ? b : a));
    for (const id of shortest) {
      const row = index.rows[id];
      if (!qi.dateTokens.every((t) => row.forms.some((f) => f.split(" ").includes(t)))) continue;
      scored.push({ row, score: 6 + (exactTitle(row) ? 5 : 0) + yearBoost(row) + row.bonus });
    }
  } else {
    const exp = new Map(qi.content.map((t) => [t, expand(index, t)] as const));
    const sim = (w: string, t: string) => (w === t ? 1 : exp.get(w)?.get(t) ?? 0);
    const best = (w: string, ts: Iterable<string>) => {
      let b = 0;
      for (const t of ts) {
        const v = sim(w, t);
        if (v > b) b = v;
      }
      return b;
    };
    const candidates = new Set<number>();
    for (const m of exp.values()) for (const t of m.keys()) for (const id of index.postings.get(t) ?? []) candidates.add(id);
    for (const id of candidates) {
      const row = index.rows[id];
      const tsims = row.titleList.map((t) => bestOf(qi.wholeList, t, sim));
      // One short title word may be one edit off what was typed ("shake it of") when the rest matched exactly.
      const missing = tsims.flatMap((v, j) => (v === 0 ? [j] : []));
      let shortWord = "";
      if (missing.length === 1 && tsims.every((v, j) => v === 1 || j === missing[0])) {
        const t = row.titleList[missing[0]];
        const exactLetters = row.titleList.reduce((n, x, j) => (j === missing[0] ? n : n + x.length), 0);
        const w = t.length <= 4 && exactLetters >= 4 ? qi.wholeList.find((x) => x.length >= 2 && x.length <= 3 && Math.min(x.length, t.length) <= 3 && editDistance(x, t, 1) <= 1) : undefined;
        if (w) {
          tsims[missing[0]] = 0.75;
          shortWord = w;
        }
      }
      const titleCov = row.titleList.length ? tsims.reduce((a, b) => a + b, 0) / row.titleList.length : 0;
      const textCov = qi.content.reduce((acc, w) => acc + best(w, row.all), 0) / qi.content.length;
      let artistCov = 0;
      let artistNamed = false;
      for (const lead of row.leads) {
        const cov = lead.reduce((acc, a) => acc + bestOf(qi.content, a, sim), 0) / lead.length;
        artistCov = Math.max(artistCov, cov);
        // The lead artist named anywhere, with other words beside it: return the row so the resolver learns the name.
        if (lead.length < qi.content.length && fuzzyPhrase(qi.content, lead).sim > 0) artistNamed = true;
      }
      // A specific title as one contiguous run stands even inside a long description.
      const inDescription = row.specific && titleCov >= 0.85 && fuzzyPhrase(qi.wholeList, row.titleList, 0.8, true).sim > 0;
      if (!((titleCov >= 0.6 && textCov >= 0.5) || textCov >= 0.999 || artistNamed || inDescription)) continue;
      // The row that accounts for every typed word (filler and the date aside) ranks above ones that leave a word.
      const accountsForAll = qi.wholeList.every((w) => FILLER.has(w) || qi.dateSet.has(w) || w === shortWord || best(w, row.all) >= 0.8);
      const score = 6 * titleCov + 2 * textCov + 1.5 * artistCov + (exactTitle(row) ? 5 : 0) + (accountsForAll ? 4 : 0) + yearBoost(row) + row.bonus;
      scored.push({ row, score });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => ({ ...row.song, where: [...row.song.where] }));
}

/**
 * Rewrite a typed run-together word ("chiefkeef", "lilpeep", "hotlinebling") as the index's spaced name when the
 * index does not know the word itself; one or two typos allowed by length, as in tokenSim.
 */
function unglue(index: PreparedIndex, text: string): string {
  let changed = false;
  const out = text.split(/(\s+)/).map((piece) => {
    const w = norm(piece);
    if (w.length < 6 || w.includes(" ") || /\d/.test(w) || index.postings.has(w)) return piece;
    let spaced = index.glued.get(w);
    if (!spaced) {
      const max = w.length >= 8 ? 2 : 1;
      let bestD = max + 1;
      for (let len = w.length - max; len <= w.length + max; len++) {
        for (const k of index.gluedByLen.get(len) ?? []) {
          if (k[0] !== w[0]) continue;
          const d = editDistance(w, k, max);
          if (d < bestD) {
            bestD = d;
            spaced = index.glued.get(k);
          }
        }
      }
    }
    if (!spaced) return piece;
    changed = true;
    return spaced;
  });
  return changed ? out.join("") : text;
}

/** Best similarity of index word `t` against any typed word (typed words outside the expansion match only exactly). */
function bestOf(words: string[], t: string, sim: (w: string, t: string) => number): number {
  let b = 0;
  for (const w of words) {
    const v = sim(w, t);
    if (v > b) b = v;
  }
  return b;
}

// ── browser dependencies ──────────────────────────────────────────────────────

const MB_FILLER = new Set(["ft", "feat", "featuring", "prod", "song", "track", "word", "official", "video", "lyrics", "lyric", "audio", "remix"]);
/** Prefix on the text handed to `musicbrainz(q)` that asks for the fuzzy retry query (Lucene `~` on each word). */
export const MB_FUZZY = "~ ";
const TRAILING_SOFT = new Set(["in", "from", "around", "during", "back", "on"]);
const mbTokens = (s: string) => tokens(s).filter((t) => !MB_FILLER.has(t));

function splitReadings(raw: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const lower = raw.toLowerCase();
  const by = lower.lastIndexOf(" by ");
  if (by > 0) {
    const t = mbTokens(raw.slice(0, by)).join(" ");
    const a = mbTokens(raw.slice(by + 4)).join(" ");
    if (t && a) out.push([t, a]);
  }
  const dash = raw.split(/\s+[-–—]\s+/);
  if (dash.length === 2) {
    const l = mbTokens(dash[0]).join(" ");
    const r = mbTokens(dash[1]).join(" ");
    // "Artist - Title" is the upload convention, so that reading goes first.
    if (l && r) out.push([r, l], [l, r]);
  }
  return out;
}

/**
 * One Lucene query for MusicBrainz WS/2 recording search. Free text only searches recording titles, so a typed
 * "artist + title" needs fields: an explicit "title by artist" / "a - b" split, the whole phrase as a title, and
 * every artist | title boundary (measured: "chief keef my gear" → Cuz My Gear, 4 of 4 rows). Tried with and
 * without the date phrase. Only normalised words reach the query, so input cannot inject Lucene syntax.
 */
export function buildMbQuery(text: string): string {
  const fuzzy = typeof text === "string" && text.startsWith(MB_FUZZY);
  const raw = cleanQuery(fuzzy ? text.slice(MB_FUZZY.length) : text);
  const clauses: string[] = [];
  const add = (c: string) => {
    if (!clauses.includes(c)) clauses.push(c);
  };
  // Exact: a phrase. Fuzzy retry: every word with an edit allowance (1 for 4–7 letters, 2 for 8+; numbers exact).
  const fz = (t: string) => (/\d/.test(t) ? t : t.length >= 8 ? `${t}~2` : t.length >= 4 ? `${t}~1` : t);
  const field = (name: string, words: string[]) => (fuzzy ? `${name}:(${words.map(fz).join(" AND ")})` : `${name}:"${words.join(" ")}"`);
  const detail = extractDateDetail(raw);
  const texts = [raw];
  if (detail && detail.rest.trim()) texts.push(detail.rest);
  for (const t of texts) {
    for (const [title, artist] of splitReadings(t)) {
      const tw = title.split(" ");
      const aw = artist.split(" ");
      add(`(${field("recording", tw)} AND ${field("artist", aw)})^3`);
      // A known artist with a title half-remembered ("hot n" for "Hot N*gga"): any of the title's words.
      if (!fuzzy) add(`(${field("artist", aw)} AND recording:(${tw.join(" ")}))^2`);
    }
  }
  for (const t of texts) {
    const toks = mbTokens(t).slice(0, 10);
    // "cuz my gear in" (a bare "in" left before the year) also tries "cuz my gear".
    const trimmed = [...toks];
    while (trimmed.length > 1 && TRAILING_SOFT.has(trimmed[trimmed.length - 1])) trimmed.pop();
    for (const v of trimmed.length !== toks.length ? [toks, trimmed] : [toks]) {
      if (!v.length) continue;
      add(`${field("recording", v)}^2`);
      if (v.length > 8) continue;
      for (let k = 1; k < v.length; k++) {
        const left = v.slice(0, k);
        const right = v.slice(k);
        add(`(${field("artist", left)} AND ${field("recording", right)})`);
        add(`(${field("recording", left)} AND ${field("artist", right)})`);
      }
    }
  }
  if (!clauses.length) clauses.push(`recording:"${norm(raw) || "unknown"}"`);
  return `(${clauses.join(" OR ")}) AND NOT comment:live`;
}

type MbCredit = { name?: unknown; joinphrase?: unknown; artist?: { name?: unknown } };
const LIVE_TITLE = /[([][^)\]]*\b(?:live|session|sessions|performance)\b[^)\]]*[)\]]|\s[-\u2013\u2014]\s(?:live|session)\b/i;

/**
 * A recording's first-release-date counts bootlegs and promos. When the search lists the releases, date the
 * recording by its official ones (status missing counts as official); a recording only on bootlegs has no credible
 * date. The earliest official date wins, and a day inside that earliest period beats the period's start.
 */
function officialDate(rec: Record<string, unknown>): { date: string; granularity: Granularity } | null {
  const releases = Array.isArray(rec.releases) ? (rec.releases as Array<{ status?: unknown; date?: unknown }>) : [];
  if (!releases.length) return parsePartialDate(rec["first-release-date"]);
  const official = releases.filter((r) => typeof r?.status !== "string" || /^official$/i.test(r.status));
  if (!official.length) return null;
  const dates = official
    .map((r) => parsePartialDate(r?.date))
    .filter((d): d is { date: string; granularity: Granularity } => d !== null)
    .map((d) => ({ ...d, start: d.granularity === "year" ? `${d.date.slice(0, 4)}-01-01` : d.granularity === "month" ? `${d.date.slice(0, 7)}-01` : d.date }));
  if (!dates.length) return parsePartialDate(rec["first-release-date"]);
  dates.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : PRECISION[a.granularity] - PRECISION[b.granularity]));
  const first = dates[0];
  const end = first.granularity === "year" ? `${first.date.slice(0, 4)}-12-31` : first.granularity === "month" ? `${first.date.slice(0, 7)}-31` : first.date;
  const finer = dates.find((d) => d.granularity === "day" && d.start >= first.start && d.start <= end);
  return finer ? { date: finer.date, granularity: "day" } : { date: first.date, granularity: first.granularity };
}

/** MusicBrainz recording search JSON → DatedSong[]; first-release-date keeps its granularity. Undated rows are dropped. */
export function mapMusicBrainz(json: unknown): DatedSong[] {
  const recs = (json as { recordings?: unknown } | null)?.recordings;
  if (!Array.isArray(recs)) return [];
  const out: DatedSong[] = [];
  for (const rec of recs as Array<Record<string, unknown>>) {
    if (!rec || typeof rec.title !== "string") continue;
    const parsed = officialDate(rec);
    if (!parsed) continue;
    const credit = Array.isArray(rec["artist-credit"]) ? (rec["artist-credit"] as MbCredit[]) : [];
    const artist = credit
      .map((c) => `${typeof c?.name === "string" ? c.name : typeof c?.artist?.name === "string" ? c.artist.name : ""}${typeof c?.joinphrase === "string" ? c.joinphrase : ""}`)
      .join("")
      .trim();
    if (!artist) continue;
    const row: DatedSong = {
      song: rec.title, artist, date: parsed.date, granularity: parsed.granularity,
      dateSource: "first release (MusicBrainz)", where: ["musicbrainz"], onDsp: null,
    };
    if (typeof rec.id === "string") row.mbid = rec.id;
    const isrcs = rec.isrcs;
    if (Array.isArray(isrcs) && typeof isrcs[0] === "string") row.isrc = isrcs[0];
    out.push(row);
  }
  return out;
}

/** iTunes Search JSON → DatedSong[]; art becomes the {w}x{h} size template; karaoke albums are dropped here too. */
export function mapItunes(json: unknown): DatedSong[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const out: DatedSong[] = [];
  for (const x of results as Array<Record<string, unknown>>) {
    if (!x || x.kind !== "song" || typeof x.trackName !== "string" || typeof x.artistName !== "string") continue;
    if (typeof x.collectionName === "string" && BAD_ALBUM.test(x.collectionName)) continue;
    // A live take or session is a performance, not the release, and its date misleads (measured: "Last Last
    // (Apple Music Live)" is dated a year before the single). MusicBrainz excludes the same with NOT comment:live.
    if (LIVE_TITLE.test(x.trackName)) continue;
    const day = typeof x.releaseDate === "string" ? x.releaseDate.slice(0, 10) : "";
    const parsed = parsePartialDate(day);
    if (!parsed) continue;
    // iTunes files catalogue tracks it cannot date under 1 Jan (measured: Prince "1999" → 1982-01-01).
    // That is a year, not a day: it flies mid-year and loses to a real date inside that year.
    const yearOnly = day.endsWith("-01-01");
    const row: DatedSong = {
      song: x.trackName, artist: x.artistName,
      date: yearOnly ? `${day.slice(0, 4)}-06-15` : parsed.date, granularity: yearOnly ? "year" : parsed.granularity,
      dateSource: "released (iTunes)", where: ["itunes"], onDsp: true,
    };
    if (typeof x.artworkUrl100 === "string") row.art = x.artworkUrl100.replace(/\/\d+x\d+bb\./, "/{w}x{h}bb.");
    if (typeof x.previewUrl === "string") row.previewUrl = x.previewUrl;
    out.push(row);
  }
  return out;
}

const MB_SPACING_MS = 1_100;
let lastMbAt = 0;

async function getJson(url: string, ms: number, external: boolean): Promise<unknown> {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), ms);
  try {
    const init: RequestInit = external ? { credentials: "omit" } : {};
    if (ctl) init.signal = ctl.signal;
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Live dependencies for the browser. MusicBrainz and iTunes both send access-control-allow-origin: *, so their
 * rate limits are per visitor. MusicBrainz cannot get a User-Agent from a browser; fmt=json and one call per resolve.
 */
export function browserDeps(): ResolverDeps {
  return {
    async indexSearch(q: string) {
      const body = await getJson(`/api/resolve?q=${encodeURIComponent(cleanQuery(q))}`, INDEX_MS, false);
      const rows = (body as { rows?: unknown } | null)?.rows;
      return Array.isArray(rows) ? (rows as DatedSong[]) : [];
    },
    async musicbrainz(q: string) {
      // MusicBrainz allows 1 request per second per client; a resolve can make two (exact, then fuzzy).
      // Clamped to one spacing: a clock that steps backwards must never stall a resolve.
      const wait = Math.min(MB_SPACING_MS, MB_SPACING_MS - (Date.now() - lastMbAt));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastMbAt = Date.now();
      const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(buildMbQuery(q))}&fmt=json&limit=8`;
      return mapMusicBrainz(await getJson(url, EXTERNAL_MS, true));
    },
    async itunes(q: string) {
      const url = `https://itunes.apple.com/search?media=music&entity=song&limit=8&term=${encodeURIComponent(cleanQuery(q))}`;
      return mapItunes(await getJson(url, EXTERNAL_MS, true));
    },
  };
}
