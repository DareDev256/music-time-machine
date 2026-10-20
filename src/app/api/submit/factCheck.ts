// Server-side fact-check for a submission: at most one call each to the own index, MusicBrainz and
// iTunes. Each source yields at most one date (its earliest credible one); a source that fails,
// times out or finds nothing simply contributes nothing, and the verdict says "unverified" if all do.

import { indexRow, normTitle, primaryArtist } from "@/lib/era/data";
import { earliestOf, isDate, type KnownDate } from "@/lib/era/verdict";

const UA = "MusicTimeMachine/2.0 (dev@jamesdare.com)";
const TIMEOUT_MS = 5000;
const MAX_RESPONSE_CHARS = 2_000_000;
const ORIGINS = new Set(["https://musicbrainz.org", "https://itunes.apple.com"]);
/** Not the artist: karaoke, tribute and sound-alike releases (they often carry earlier or later dates). */
const NOT_THE_ARTIST = /karaoke|tribute|made famous by|in the style of|originally performed by|as made famous/i;

/** GET JSON from an allowed origin with a timeout; null on any failure. */
async function getJson(url: URL): Promise<unknown> {
  if (!ORIGINS.has(url.origin)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > MAX_RESPONSE_CHARS) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Every credited name in an artist string, normalised: "Chief Keef & Riff Raff" → ["chiefkeef", "riffraff"]. */
export function artistKeys(credit: string): string[] {
  return credit
    .split(/\s+(?:featuring|feat\.?|ft\.?|with|x|&|and)\s+|\s*,\s*/i)
    .map((s) => normTitle(s))
    .filter(Boolean);
}

function artistMatches(claimed: string[], credited: string[]): boolean {
  return credited.some((c) => claimed.includes(c));
}

/** "2012-05-17" stays a day; MusicBrainz "2012" stays year-only. */
function withGranularity(base: string, date: string): string {
  return date.length === 4 ? `${base}, year only` : date.length === 7 ? `${base}, month only` : base;
}

/** Lucene-escape a term for a quoted MusicBrainz query. */
function lucene(s: string): string {
  return s.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, "\\$1");
}

export function fromIndex(song: string, artist: string): KnownDate | null {
  const row = indexRow(song, artist);
  if (!row || !isDate(row.d)) return null;
  const date = row.g === "year" ? row.d.slice(0, 4) : row.g === "month" ? row.d.slice(0, 7) : row.d.slice(0, 10);
  return { source: "index", date, label: row.ds };
}

interface MbRecording { title?: string; "first-release-date"?: string; "artist-credit"?: { name?: string; artist?: { name?: string } }[] }

export async function fromMusicBrainz(song: string, artist: string): Promise<KnownDate | null> {
  const title = normTitle(song), claimed = artistKeys(artist);
  if (!title || !claimed.length) return null;
  const url = new URL("https://musicbrainz.org/ws/2/recording");
  url.searchParams.set("query", `recording:"${lucene(song)}" AND artist:"${lucene(primaryArtist(artist))}"`);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "25");
  const body = (await getJson(url)) as { recordings?: MbRecording[] } | null;
  const hits: KnownDate[] = [];
  for (const r of body?.recordings ?? []) {
    const date = r["first-release-date"] ?? "";
    if (!isDate(date) || normTitle(r.title ?? "") !== title) continue;
    const credited = (r["artist-credit"] ?? []).flatMap((c) => [c.name, c.artist?.name]).filter((n): n is string => !!n).flatMap(artistKeys);
    if (!artistMatches(claimed, credited)) continue;
    hits.push({ source: "musicbrainz", date, label: withGranularity("first release (MusicBrainz)", date) });
  }
  return earliestOf(hits);
}

interface ItunesResult { trackName?: string; artistName?: string; collectionName?: string; releaseDate?: string }

export async function fromItunes(song: string, artist: string): Promise<KnownDate | null> {
  const title = normTitle(song), claimed = artistKeys(artist);
  if (!title || !claimed.length) return null;
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "10");
  url.searchParams.set("term", `${song} ${primaryArtist(artist)}`);
  const body = (await getJson(url)) as { results?: ItunesResult[] } | null;
  const hits: KnownDate[] = [];
  for (const r of body?.results ?? []) {
    const date = (r.releaseDate ?? "").slice(0, 10);
    if (!isDate(date) || normTitle(r.trackName ?? "") !== title) continue;
    if (NOT_THE_ARTIST.test(`${r.artistName ?? ""} ${r.collectionName ?? ""} ${r.trackName ?? ""}`)) continue;
    if (!artistMatches(claimed, artistKeys(r.artistName ?? ""))) continue;
    hits.push({ source: "itunes", date, label: "release date on Apple Music" });
  }
  return earliestOf(hits);
}

/** All three sources, in parallel; each contributes at most one dated row. */
export async function gatherEvidence(song: string, artist: string): Promise<KnownDate[]> {
  let own: KnownDate | null = null;
  try {
    own = fromIndex(song, artist);
  } catch {
    own = null;
  }
  const [mb, it] = await Promise.allSettled([fromMusicBrainz(song, artist), fromItunes(song, artist)]);
  return [own, mb.status === "fulfilled" ? mb.value : null, it.status === "fulfilled" ? it.value : null].filter((k): k is KnownDate => !!k);
}
