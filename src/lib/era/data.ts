// Server-side readers for the static era shards in public/era/ (built by data/scripts/).
// History is immutable, so each file is read once per server instance and kept in memory.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const ERA = path.join(process.cwd(), "public", "era");
const DAY = 86_400_000;

export interface ChartRow { rank: number; song: string; artist: string; last: number | null; new?: boolean; peak: number | null; weeks: number | null }
export interface ChartWeek { date: string; top: ChartRow[] }
export interface LaneHit { lane: string; label: string; date: string; song: string; artist: string; page?: string }
export interface HeatRow { rank: number; song: string; artist: string }
export interface HeatSource { id: string; label: string; list: "ranked" | "front"; capture: string; captured: string; rows: HeatRow[] }
export interface HeatMonth { month: string; sources: HeatSource[] }
export interface FlightData { through: string; songs: { s: string; a: string; art: string | null }[]; weeks: [string, number][] }
export interface NumberOneWeek { date: string; song: string; artist: string; art: string | null; runWeek: number; runLength: number; ongoing: boolean }
export interface IndexRow { s: string; a: string; d: string; g: "day" | "month" | "year"; src: string; ds: string; k: string; y?: string; n?: string }

const cache = new Map<string, unknown>();
function load<T>(rel: string): T | null {
  if (cache.has(rel)) return cache.get(rel) as T | null;
  const file = path.join(ERA, rel);
  const value = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null;
  cache.set(rel, value);
  return value;
}

const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Latest entry dated on or before `date` and no more than `maxGapDays` before it. */
function onOrBefore<T extends { date: string }>(rows: T[], date: string, maxGapDays: number): T | null {
  let lo = 0, hi = rows.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].date <= date) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (best < 0) return null;
  return (ms(date) - ms(rows[best].date)) / DAY <= maxGapDays ? rows[best] : null;
}

/** The Hot 100 week in effect on `date` (the chart dated on or before it). */
export function weekNearest(date: string): ChartWeek | null {
  const year = Number(date.slice(0, 4));
  const doc = load<{ weeks: ChartWeek[] }>(`hot100/${year}.json`);
  const prev = load<{ weeks: ChartWeek[] }>(`hot100/${year - 1}.json`);
  const weeks = [...(prev?.weeks ?? []), ...(doc?.weeks ?? [])];
  return onOrBefore(weeks, date, 13);
}

/** The chart weeks of a calendar month, for the month page's week links. */
export function weeksInMonth(month: string): string[] {
  const doc = load<{ weeks: ChartWeek[] }>(`hot100/${month.slice(0, 4)}.json`);
  return (doc?.weeks ?? []).filter((w) => w.date.startsWith(month)).map((w) => w.date);
}

/** The #1 in each lane that passed its canary, for the week in effect on `date`. */
export function lanesOn(date: string): LaneHit[] {
  const index = load<{ lanes: { lane: string; label: string; from: string; through: string; file: string }[] }>("lanes/index.json");
  const hits: LaneHit[] = [];
  for (const lane of index?.lanes ?? []) {
    if (date < lane.from || date > addDays(lane.through, 7)) continue;
    const doc = load<{ weeks: { date: string; song: string; artist: string; page?: string }[] }>(`lanes/${lane.file}`);
    // UK weeks have used a different issue day than Billboard; allow one extra day of drift.
    const w = doc ? onOrBefore(doc.weeks, date, 8) : null;
    if (w) hits.push({ lane: lane.lane, label: lane.label, date: w.date, song: w.song, artist: w.artist, page: w.page });
  }
  return hits;
}

/** Archived off-chart lists for a month; null when no source passed (or the month is outside the crawl). */
export function heatFor(month: string): HeatMonth | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const doc = load<HeatMonth>(`heat/${month}.json`);
  return doc && doc.sources?.length ? doc : null;
}

/** The months the off-chart crawl has covered, for the honest empty state. */
export function heatRange(): [string, string] | null {
  const idx = load<{ range?: [string, string] }>("heat/index.json");
  return idx?.range ?? null;
}

/** Last chart week the era pages can show in full: the weekly top 10 (the #1 list can run a week ahead). */
export function chartsThrough(): string {
  const year = new Date().getUTCFullYear();
  const top10 = load<{ through?: string }>(`hot100/${year}.json`)?.through ?? load<{ through?: string }>(`hot100/${year - 1}.json`)?.through;
  const flight = load<FlightData>("flight.json")?.through;
  if (top10 && flight) return top10 < flight ? top10 : flight;
  return top10 ?? flight ?? "1958-08-04";
}

/** First and last month with a published off-chart file, read from the files themselves. */
export function heatMonthSpan(): [string, string] | null {
  if (cache.has("heat:span")) return cache.get("heat:span") as [string, string] | null;
  let months: string[] = [];
  try {
    months = readdirSync(path.join(ERA, "heat")).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 7)).sort();
  } catch {
    months = [];
  }
  const span: [string, string] | null = months.length ? [months[0], months[months.length - 1]] : null;
  cache.set("heat:span", span);
  return span;
}

/** The Hot 100 #1 in effect on `date`, with its cover and position in its run. */
export function numberOneOn(date: string): NumberOneWeek | null {
  const f = load<FlightData>("flight.json");
  if (!f) return null;
  const rows = f.weeks.map(([d, i]) => ({ date: d, i }));
  const at = onOrBefore(rows, date, 13);
  if (!at) return null;
  const idx = rows.indexOf(at);
  let a = idx, b = idx;
  while (a > 0 && rows[a - 1].i === at.i) a--;
  while (b < rows.length - 1 && rows[b + 1].i === at.i) b++;
  const s = f.songs[at.i];
  // A run that reaches the newest week in the data has not ended: its length is not known yet.
  return { date: at.date, song: s.s, artist: s.a, art: s.art, runWeek: idx - a + 1, runLength: b - a + 1, ongoing: b === rows.length - 1 };
}

/** Cover template for a song that was a #1, if we hold one. */
export function coverFor(song: string, artist: string): string | null {
  const f = load<FlightData>("flight.json");
  const k = indexKey(song, artist);
  return f?.songs.find((s) => indexKey(s.s, s.a) === k)?.art ?? null;
}

/** Look a song up in the index by its normalised key. */
export function indexRow(song: string, artist: string): IndexRow | null {
  const idx = load<{ rows: IndexRow[] }>("index.json");
  const k = indexKey(song, artist);
  return idx?.rows.find((r) => r.k === k) ?? null;
}

// Same normalisation as data/scripts/build_index.py (keep them in step).
export function normTitle(s: string): string {
  return s
    .normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[([][^)\]]*[)\]]/g, "").replace(/&/g, " and ")
    .replace(/^\s*(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}
export function primaryArtist(a: string): string {
  return a.split(/\s+(?:featuring|feat\.?|ft\.?|with|x|&|and|,)\s+/i)[0].trim();
}
export function indexKey(song: string, artist: string): string {
  return `${normTitle(song)}|${normTitle(primaryArtist(artist))}`;
}

export function addDays(iso: string, days: number): string {
  return new Date(ms(iso) + days * DAY).toISOString().slice(0, 10);
}

/** Size an iTunes art template ({w}x{h}) to a square pixel size. */
export function art(template: string | null | undefined, px: number): string | null {
  return template ? template.replace("{w}x{h}", `${px}x${px}`) : null;
}

export interface IndustryYear {
  year: number;
  totalUsdM: number;
  shares: Record<"streaming" | "downloads" | "physical" | "sync" | "other", number>;
  top: string;
  formats: Record<string, number>;
  globalStreaming: number | null;
}

/** US recorded-music revenue by format for a year (RIAA, wholesale), plus IFPI's global streaming share. */
export function industryFor(year: number): IndustryYear | null {
  const doc = load<{
    us: Record<string, { total_usd_m: number; shares: IndustryYear["shares"]; top_format: string; formats: Record<string, number> }>;
    global: Record<string, { streaming_share: number }>;
  }>("industry.json");
  const y = doc?.us[String(year)];
  if (!y) return null;
  return {
    year, totalUsdM: y.total_usd_m, shares: y.shares, top: y.top_format, formats: y.formats ?? {},
    globalStreaming: doc?.global[String(year)]?.streaming_share ?? null,
  };
}

export interface RedditRow { rank: number; song: string; artist: string; title: string; score: number; comments: number; url: string; posted: string }
export interface RedditSource { id: string; label: string; rows: RedditRow[] }

/** Reddit [FRESH] posts for a month, top by upvotes, per subreddit; null when none passed. */
export function redditFor(month: string): RedditSource[] | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const doc = load<{ sources?: RedditSource[] }>(`reddit/${month}.json`);
  const sources = (doc?.sources ?? []).filter((x) => x.rows?.length);
  return sources.length ? sources : null;
}

export interface YouTubeRow { rank: number; song: string; artist: string; title: string; videoId: string; published: string; views: number }
export interface YouTubeSource { id: string; label: string; genre: string; channel: string; rows: YouTubeRow[] }
export interface YouTubeMonth { month: string; viewsAsOf: string; sources: YouTubeSource[] }

/**
 * YouTube API Developer Policies: data from the API may be shown at most 30 days after it was fetched. The crawl
 * (data/scripts/youtube_channels.py --refresh) re-fetches well inside that; a month whose counts are older is not
 * shown at all, so a stopped refresh job hides the section instead of serving stale API data.
 */
export const YOUTUBE_MAX_AGE_DAYS = 30;

/** The month's uploads per channel, ranked by today's views; null when there are none or they are past the policy age. */
export function freshYouTube(doc: unknown, today: string): YouTubeMonth | null {
  const d = doc as Partial<YouTubeMonth> | null;
  if (!d || typeof d.viewsAsOf !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.viewsAsOf) || !Array.isArray(d.sources)) return null;
  const age = (ms(today) - ms(d.viewsAsOf)) / DAY;
  if (!(age >= 0 && age <= YOUTUBE_MAX_AGE_DAYS)) return null;
  const sources = d.sources.filter((x) => Array.isArray(x?.rows) && x.rows.length > 0);
  return sources.length ? { month: String(d.month ?? ""), viewsAsOf: d.viewsAsOf, sources } : null;
}

export function youtubeFor(month: string, today = new Date().toISOString().slice(0, 10)): YouTubeMonth | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  return freshYouTube(load(`youtube/${month}.json`), today);
}

/** The #1 list's own last week (it can run a week past the top-10 data). */
export function numberOnesThrough(): string {
  return load<FlightData>("flight.json")?.through ?? "1958-08-04";
}
