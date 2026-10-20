// Song resolver: typed text → a dated song, a date, or an honest "nothing found".
// Pure: every lookup is an injected dependency. Order (spec §5.3, rules §12.10):
//   1. own index (charts + lanes + archived heat + the hand-verified seed), whole text first
//   2. ONE MusicBrainz recording search + one iTunes search, in parallel, only when the index did not settle it
//   3. the year in the text, when no song can be named with confidence
// The earliest credible date wins. resolveQuery never throws and never waits on a dead dependency forever.

import type { DatedSong, Granularity, IndexFileRow, ResolveOutcome } from "./types";
import { CHART_START, extractDateDetail, flightTarget, localToday, padToGranularity, parsePartialDate, type DateDetail } from "./dates";
import {
  artistKeysLoose, artistNames, cleanQuery, containsPhrase, isStopword, norm, primaryArtistKey, primaryArtistName,
  primaryKeysLoose, stripTitle, titleForms, titleKey, tokens,
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
  return out;
}

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
  const credible = valid.filter((r) => !isSoft(r) || hard.length === 0 || hard.some((h) => gapDays(r, h) <= 366));
  const pool = credible.length ? credible : valid.length ? valid : rows;
  const sorted = [...pool].sort((a, b) => period(a)[0] - period(b)[0] || PRECISION[a.granularity] - PRECISION[b.granularity] || SOURCE_RANK(a) - SOURCE_RANK(b));
  let best = sorted[0];
  for (let i = 0; i < 2; i++) {
    const [s, e] = period(best);
    const finer = sorted.filter((r) => PRECISION[r.granularity] < PRECISION[best.granularity] && period(r)[0] >= s && period(r)[0] <= e);
    if (!finer.length) break;
    best = finer[0];
  }

  // Identity: a chart / seed row, else the plainest title ("Shutdown" over "Shutdown (Preditah Remix)").
  const identity =
    rows.find((r) => r.where.includes("chart") || r.where.includes("seed")) ?? rows.find((r) => stripTitle(r.song) === r.song.trim()) ?? rows[0];
  const where = WHERE_ORDER.filter((w) => rows.some((r) => r.where.includes(w)));
  const onDsp = rows.some((r) => r.onDsp === true) ? true : rows.some((r) => r.onDsp === false) ? false : null;
  const byDate = [...rows].sort((a, b) => period(a)[0] - period(b)[0]);
  const out: DatedSong = {
    song: identity.song, artist: identity.artist, date: best.date, granularity: best.granularity,
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
    // No other source knows this song: it may stand alone only when the text names its artist.
    const names = artistNames(r.artist);
    if (titleForms(r.song).some((f) => names.some((n) => containsPhrase(withoutTitle(qi, f), n)))) this.push(undefined, r, "itunes");
  }
}

/**
 * The query with the title's words taken out. An artist counts only for words the title did not use, so a
 * MusicBrainz "artist" named exactly like the song (measured: "Somebody That I Used to Know" by
 * "Somebody That I Used to Know", 2017) is not an artist match for a title-only query.
 */
function withoutTitle(qi: QueryInfo, form: string): string {
  const hay = ` ${qi.whole} `;
  const i = hay.indexOf(` ${form} `);
  if (i >= 0) return `${hay.slice(0, i)} ${hay.slice(i + form.length + 2)}`.trim().replace(/\s+/g, " ");
  const used = new Set(form.split(" "));
  return qi.whole.split(" ").filter((t) => !used.has(t)).join(" ");
}

interface Match {
  group: Group;
  score: number;
  artistHit: boolean;
  exactWhole: boolean;
  inYear: boolean;
}

function matchGroup(g: Group, qi: QueryInfo): Match | null {
  // A MusicBrainz-only recording credited to an "artist" with the song's own name is a mislabelled upload.
  // (Self-titled songs that charted or are on iTunes, "Bad Company" by Bad Company, are unaffected.)
  if (!g.origins.has("index") && !g.origins.has("itunes") && g.names.has(g.key)) return null;
  const names = new Set(g.rows.flatMap((r) => artistNames(r.artist)));
  const artistTokens = new Set([...names].flatMap((n) => n.split(" ")));
  const forms = Array.from(new Set(g.rows.flatMap((r) => titleForms(r.song))));
  const strip = (s: string) => s.split(" ").filter((t) => !isStopword(t)).join(" ");
  // A text that is only a date yields to a title only when the FULL title is the whole text: "1999" is Prince,
  // but "2012" is not "2012 (It Ain't The End)".
  if (qi.pureDate) {
    const full = g.rows.map((r) => norm(String(r.song).replace(/[()[\]{}]/g, " ")));
    if (!full.some((f) => f === qi.whole || (strip(f) !== "" && strip(f) === strip(qi.whole)))) return null;
  }
  let best: { score: number; exactWhole: boolean; artistHit: boolean } | null = null;
  for (const f of forms) {
    const tt = f.split(" ");
    const titleSet = new Set(tt);
    const left = withoutTitle(qi, f);
    const artistHit = [...names].some((n) => containsPhrase(left, n));
    const phrase = containsPhrase(qi.whole, f) || containsPhrase(qi.rest, f);
    const exactWhole = f === qi.whole || (strip(f) !== "" && strip(f) === strip(qi.whole));
    const exactRest = qi.rest !== "" && (f === qi.rest || (strip(f) !== "" && strip(f) === strip(qi.rest)));
    const cov = tt.filter((t) => qi.wholeTokens.has(t)).length / tt.length;
    const extras = qi.content.filter((t) => !titleSet.has(t) && !artistTokens.has(t)).length;
    const ok = (phrase && (extras === 0 || artistHit)) || (cov >= 0.6 && tt.length >= 2 && artistHit && extras === 0);
    if (!ok) continue;
    const score = 10 * cov + (phrase ? 4 : 0) + (exactWhole || exactRest ? 3 : 0) + (artistHit ? 6 : 0) - 3 * extras;
    if (!best || score > best.score) best = { score, exactWhole, artistHit };
  }
  if (!best) return null;
  const inYear = qi.year !== null && g.rows.some((r) => Math.abs(Number(r.date.slice(0, 4)) - qi.year!) <= 1);
  // Popularity priors for ordering a shared title: charted / seeded, the index's own rank, an iTunes listing, more
  // MusicBrainz releases. A cast cover sinks below the song it covers.
  const prior =
    (g.origins.has("index") ? 2 : 0) +
    (Number.isFinite(g.indexRank) ? 0.5 * (1 - Math.min(g.indexRank, 8) / 8) : 0) +
    (g.origins.has("itunes") ? 1 : 0) +
    Math.min(g.rows.length, 4) * 0.1 -
    (isCoverAct(g) ? 3 : 0);
  return { group: g, score: best.score + (inYear ? 3 : 0) + prior, artistHit: best.artistHit, exactWhole: best.exactWhole, inYear };
}

const isCoverAct = (g: Group) => g.rows.every((r) => COVER_ACT.test(r.artist) || COVER_TITLE.test(r.song));
const mbRows = (g: Group) => g.rows.filter((r) => r.where.includes("musicbrainz")).length;

const matchAll = (groups: Groups, qi: QueryInfo): Match[] =>
  groups.list
    .map((g) => matchGroup(g, qi))
    .filter((m): m is Match => m !== null)
    .sort((a, b) => b.score - a.score);

type Decision = { kind: "accept"; match: Match } | { kind: "ambiguous"; matches: Match[] } | { kind: "none" };

function decide(matches: Match[], qi: QueryInfo): Decision {
  if (!matches.length) return { kind: "none" };
  const hits = matches.filter((m) => m.artistHit);
  if (hits.length) {
    if (hits.length === 1 || hits[0].score > hits[1].score) return { kind: "accept", match: hits[0] };
    const inYear = hits.filter((m) => m.inYear);
    if (inYear.length === 1) return { kind: "accept", match: inYear[0] };
    return { kind: "ambiguous", matches: hits };
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
    return songOutcome(fromIndex.match, others, yearOrSong);
  }

  // 2. One MusicBrainz call and one iTunes call. Aimed at the index's song when it named one.
  const target = fromIndex.kind === "accept" ? fromIndex.match.group : null;
  let mbText = text;
  // iTunes gets the title words as typed (stopwords too: "somebody that i used to know"), minus the date and filler.
  let itText = mbTokens(qi.detail ? qi.detail.rest : text).filter((t) => t !== "by").join(" ") || qi.whole || text;
  if (target) {
    const id = target.rows[0];
    const title = stripTitle(id.song);
    mbText = `${title} by ${primaryArtistName(id.artist)}`;
    itText = `${title} ${primaryArtistName(id.artist)}`;
  }
  const [mbRes, itRes] = await Promise.all([
    call(() => deps.musicbrainz(mbText), EXTERNAL_MS),
    call(() => deps.itunes(itText), EXTERNAL_MS),
  ]);
  mbRes.rows.forEach((r) => groups.add(r, "mb"));
  itRes.rows.forEach((r) => groups.addItunes(r, qi));
  const matches = matchAll(groups, qi);

  if (target) {
    const self = matches.find((m) => m.group === target) ?? { group: target, score: 0, artistHit: false, exactWhole: false, inYear: false };
    return songOutcome(self, matches.filter((m) => m.group !== target), yearOrSong);
  }

  const decision = decide(matches, qi);
  if (decision.kind === "accept") {
    return songOutcome(decision.match, matches.filter((m) => m.group !== decision.match.group), false);
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
  title: Set<string>;
  artist: Set<string>;
  forms: string[];
  year: number;
  bonus: number;
}
export interface PreparedIndex {
  rows: PreparedRow[];
  postings: Map<string, number[]>;
}

const SRC_BONUS = (src: string) => (src === "seed" ? 0.75 : src === "hot100" ? 0.5 : src.startsWith("lane:") ? 0.25 : 0);
/** Optional `p` (best Hot 100 peak, 1–100) breaks ties between songs sharing a title; worth less than one artist word. */
const PEAK_BONUS = (p: unknown) => (typeof p === "number" && p >= 1 && p <= 100 ? (0.9 * (101 - p)) / 100 : 0);

export function prepareIndex(rows: unknown): PreparedIndex {
  const out: PreparedIndex = { rows: [], postings: new Map() };
  if (!Array.isArray(rows)) return out;
  const parsed = rows.map((raw) => ({ raw: raw as IndexFileRow, song: indexRowToDatedSong(raw) }));
  // An artist's chart footprint (rows in the index) ranks songs that share a title until a peak field exists:
  // "Hold On" has 19 charted songs and the famous ones are by artists with many hits.
  const footprint = new Map<string, number>();
  for (const { song } of parsed) if (song) footprint.set(primaryArtistKey(song.artist), (footprint.get(primaryArtistKey(song.artist)) ?? 0) + 1);
  for (const { raw: r, song } of parsed) {
    if (!song) continue;
    const forms = titleForms(song.song);
    const title = new Set(forms.flatMap((f) => f.split(" ")));
    const artist = new Set(tokens(song.artist));
    const id = out.rows.length;
    const fame = Math.min(Math.log2((footprint.get(primaryArtistKey(song.artist)) ?? 0) + 1), 7) * 0.08;
    out.rows.push({ song, title, artist, forms, year: Number(song.date.slice(0, 4)), bonus: SRC_BONUS(String(r.src ?? "")) + PEAK_BONUS(r.p) + fame });
    for (const t of new Set([...title, ...artist])) {
      const list = out.postings.get(t);
      if (list) list.push(id);
      else out.postings.set(t, [id]);
    }
  }
  return out;
}

/**
 * Fuzzy own-index lookup. Every non-filler word must appear in the title or artist; date words are optional
 * (they boost rows within ±1 year) unless the text is only a date, when the title itself must carry them ("1999").
 * Title words weigh 3, artist words 1, an exact title 5.
 */
export function searchIndex(index: PreparedIndex, q: string, limit = 8): DatedSong[] {
  const text = cleanQuery(q);
  if (!text) return [];
  const qi = queryInfo(text);
  const required = qi.content;
  const seedTokens = required.length ? required : qi.dateTokens;
  if (!seedTokens.length) return [];
  const lists = seedTokens.map((t) => index.postings.get(t) ?? []);
  if (required.length && lists.some((l) => l.length === 0)) return [];
  const shortest = lists.reduce((a, b) => (b.length < a.length ? b : a));
  const scored: Array<{ row: PreparedRow; score: number }> = [];
  for (const id of shortest) {
    const row = index.rows[id];
    if (required.length) {
      if (!required.every((t) => row.title.has(t) || row.artist.has(t))) continue;
    } else if (!qi.dateTokens.every((t) => row.title.has(t))) continue;
    let score = row.bonus;
    for (const t of qi.wholeTokens) {
      if (row.title.has(t)) score += 3;
      else if (row.artist.has(t)) score += 1;
    }
    if (row.forms.some((f) => f === qi.whole || (qi.rest !== "" && f === qi.rest))) score += 5;
    if (qi.year !== null && Math.abs(row.year - qi.year) <= 1) score += 4;
    scored.push({ row, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => ({ ...row.song, where: [...row.song.where] }));
}

// ── browser dependencies ──────────────────────────────────────────────────────

const MB_FILLER = new Set(["ft", "feat", "featuring", "prod", "song", "track"]);
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
  const raw = cleanQuery(text);
  const clauses: string[] = [];
  const add = (c: string) => {
    if (!clauses.includes(c)) clauses.push(c);
  };
  const detail = extractDateDetail(raw);
  const texts = [raw];
  if (detail && detail.rest.trim()) texts.push(detail.rest);
  for (const t of texts) for (const [title, artist] of splitReadings(t)) add(`(recording:"${title}" AND artist:"${artist}")^3`);
  for (const t of texts) {
    const toks = mbTokens(t).slice(0, 10);
    // "cuz my gear in" (a bare "in" left before the year) also tries "cuz my gear".
    const trimmed = [...toks];
    while (trimmed.length > 1 && TRAILING_SOFT.has(trimmed[trimmed.length - 1])) trimmed.pop();
    for (const v of trimmed.length !== toks.length ? [toks, trimmed] : [toks]) {
      if (!v.length) continue;
      add(`recording:"${v.join(" ")}"^2`);
      if (v.length > 8) continue;
      for (let k = 1; k < v.length; k++) {
        const left = v.slice(0, k).join(" ");
        const right = v.slice(k).join(" ");
        add(`(artist:"${left}" AND recording:"${right}")`);
        add(`(recording:"${left}" AND artist:"${right}")`);
      }
    }
  }
  if (!clauses.length) clauses.push(`recording:"${norm(raw) || "unknown"}"`);
  return `(${clauses.join(" OR ")}) AND NOT comment:live`;
}

type MbCredit = { name?: unknown; joinphrase?: unknown; artist?: { name?: unknown } };

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
      const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(buildMbQuery(q))}&fmt=json&limit=8`;
      return mapMusicBrainz(await getJson(url, EXTERNAL_MS, true));
    },
    async itunes(q: string) {
      const url = `https://itunes.apple.com/search?media=music&entity=song&limit=8&term=${encodeURIComponent(cleanQuery(q))}`;
      return mapItunes(await getJson(url, EXTERNAL_MS, true));
    },
  };
}
