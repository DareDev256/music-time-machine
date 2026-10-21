// YouTube search JSON → DatedSong[] for the resolver's last lookup (spec §12, "A"). Pure: /api/youtube owns the key.
// For a song that never reached a store or a chart, the day it reached YouTube is the release: Toronto, drill,
// SoundCloud rap, grime. "Artist - Title (Official Video)" is the house format of the channels that broke them.
// Measured 2026-10-20 ("casper dopeboy", "pressa novacane"): re-uploads, reactions, 432 Hz edits, "- Topic"
// catalogue channels and "Song - Artist" reversals all come back. Junk is dropped here; a reversed or mis-split
// title simply fails to fit the typed text in the resolver, which decides.

import type { DatedSong } from "./types";
import { versionOf } from "./normalize";

const NAMED: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

/** The API returns HTML-escaped titles ("I Don&#39;t Like", "Murda Beatz &amp; Pressa"). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return NAMED[e.toLowerCase()] ?? whole;
  });
}

/** Not the song: reactions, reviews, beats, edits, compilations, streams. Tested on the full title, before any trimming. */
const JUNK =
  /\b(?:reacts?|reaction|review|breakdown|interview|podcast|trailer|behind the scenes|type beat|instrumental|karaoke|nightcore|8d|\d{3}\s?hz|bass boosted|tutorial|how to|lesson|full album|full mixtape|full tape|live ?stream|compilation|playlist|top \d+|best of|cypher|freestyle friday|performs?|performing)\b/i;
/** A bracket that decorates the upload rather than naming the song. */
const DECOR =
  /\s*[([][^)\]]*\b(?:official|video|audio|visuali[sz]er|lyrics?|music video|prod|produced|dir|directed|shot|filmed|wshh|exclusive|premiere|hd|hq|4k|explicit|clean|dirty|mv|m\/v)\b[^)\]]*[)\]]/gi;
const PIPE_TAIL = /\s+[|｜•].*$/; // "| Shot by @DGainz", "| Link Up TV"
const BY_TAIL = /\s+(?:shot|dir\.?|directed|filmed|edited|prod\.?|produced)\s+by\b.*$/i;
const FEAT = /\s+(?:f\.|ft\.?|feat\.?|featuring)\s+/i;
const CHANNEL_NOISE = /\s*(?:-\s*topic|vevo|official|tv|music|channel)\s*$/i;

const clean = (s: string) =>
  s.replace(DECOR, "").replace(PIPE_TAIL, "").replace(BY_TAIL, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();

/** "Chief Keef f. Lil Reese" → "Chief Keef feat. Lil Reese": one spelling the artist parser reads as a feature. */
const featured = (s: string) => s.replace(FEAT, " feat. ").trim();

/** "ChiefKeefVEVO" → "ChiefKeef", "Pressa - Topic" → "Pressa". */
export function channelArtist(channel: string): string {
  let c = channel.trim();
  for (let i = 0; i < 3 && CHANNEL_NOISE.test(c); i++) c = c.replace(CHANNEL_NOISE, "").trim();
  return c;
}

/**
 * Song and artist from a video title. Formats, most common first: "Artist - Song (Official Video)",
 * 'Artist "Song" Feat. X (WSHH Exclusive)', "Artist - Song - Album", then a bare title credited to the channel.
 * Returns null for junk. The feature on either side moves to the artist: "Song ft. X" is X's verse, not the title.
 */
export function parseVideoTitle(rawTitle: string, rawChannel: string): { song: string; artist: string } | null {
  const title = decodeEntities(rawTitle).trim();
  if (!title || JUNK.test(title)) return null;

  let artist = "";
  let song = "";
  // Decorations go first: "(WSHH Exclusive - Official Music Video)" holds a dash that is not the artist split.
  const bare = title.replace(DECOR, " ").replace(/\s+/g, " ").trim();
  const quoted = /^(.+?)\s*["“”]([^"“”]{1,120}?)["“”]\s*(.*)$/.exec(bare);
  const parts = bare.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    artist = parts[0];
    song = parts[1];
    // "Song - Remix" is the version; "Song - Some Album" is where the upload came from.
    const tail = parts.slice(2).join(" - ");
    if (tail && versionOf(`x - ${tail}`)) song = `${song} (${tail})`;
  } else if (quoted && quoted[1].length >= 2) {
    artist = quoted[1];
    song = quoted[2];
    const after = clean(quoted[3]);
    const feat = FEAT.exec(` ${after}`);
    if (feat) artist = `${artist} feat. ${after.slice(feat.index + feat[0].length - 1).trim()}`;
  } else {
    const credit = channelArtist(decodeEntities(rawChannel));
    if (!credit) return null;
    song = title;
    artist = credit;
  }

  song = clean(song).replace(/^["“”']+|["“”']+$/g, "").trim();
  artist = clean(artist);
  // "Dope Boy ft. Fresh" → artist "… feat. Fresh"; "Novacane (Feat. Pressa)" likewise.
  const inSong = /\s*[([]?\s*(?:f\.|ft\.?|feat\.?|featuring)\s+([^)\]]+)[)\]]?\s*$/i.exec(song);
  if (inSong && inSong.index > 0) {
    song = song.slice(0, inSong.index).trim();
    artist = `${artist} feat. ${inSong[1].trim()}`;
  }
  artist = featured(artist);
  if (!song || !artist || song.length > 120 || artist.length > 120) return null;
  return { song, artist };
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * search.list JSON → rows, the official upload first (it gives the song its video link; the date is the earliest
 * credible upload either way, chosen by the resolver's merge). "- Topic" channels are dropped: they are store
 * catalogue mirrors whose upload date is the mirror's, not the song's (measured: Pressa - Topic "Novacane", 2025).
 */
export function mapYouTubeSearch(json: unknown): DatedSong[] {
  const items = (json as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const rows: Array<{ row: DatedSong; official: boolean; i: number }> = [];
  items.forEach((x: unknown, i) => {
    const it = x as { id?: { videoId?: unknown }; snippet?: Record<string, unknown> } | null;
    const id = it?.id?.videoId;
    const sn = it?.snippet;
    if (typeof id !== "string" || !VIDEO_ID.test(id) || !sn) return;
    const title = typeof sn.title === "string" ? sn.title : "";
    const channel = typeof sn.channelTitle === "string" ? sn.channelTitle : "";
    const published = typeof sn.publishedAt === "string" ? sn.publishedAt.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(published)) return;
    if (/\s-\s*topic$/i.test(channel)) return;
    if (sn.liveBroadcastContent && sn.liveBroadcastContent !== "none") return;
    const parsed = parseVideoTitle(title, channel);
    if (!parsed) return;
    const row: DatedSong = {
      song: parsed.song, artist: parsed.artist, date: published, granularity: "day",
      dateSource: "uploaded to YouTube", where: ["youtube"], onDsp: null, youtubeId: id,
    };
    const version = versionOf(parsed.song);
    if (version) row.version = version;
    const official = /\bofficial\b/i.test(decodeEntities(title)) || /vevo$/i.test(channel);
    rows.push({ row, official, i });
  });
  return rows.sort((a, b) => Number(b.official) - Number(a.official) || a.i - b.i).map((r) => r.row);
}
