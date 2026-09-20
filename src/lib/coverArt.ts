// Cover art for a (song, artist) pair via the iTunes Search API — keyless,
// public, and the one art source that covers 1958 as well as it covers today.
// Results are cached in-process; misses are cached too so a song with no
// art does not re-query on every render.

import { safeFetch, safeJson } from "./safeFetch";
import { TTLCache } from "./cache";

const artCache = new TTLCache(500);
const ART_TTL = 24 * 60 * 60 * 1000;

interface ItunesResult {
  artworkUrl100?: string;
  trackName?: string;
  artistName?: string;
  releaseDate?: string;
  previewUrl?: string;
}

export interface CoverArt {
  url: string;          // 600×600
  previewUrl?: string;  // 30s AAC preview, when Apple has one
}

function cacheKey(song: string, artist: string): string {
  return `${song.toLowerCase()}|${artist.toLowerCase()}`;
}

/** Strip "featuring …" / "with …" so the artist matches iTunes' primary credit. */
export function primaryArtist(artist: string): string {
  return artist.split(/\s+(?:featuring|feat\.?|with|and|&|x)\s+/i)[0].trim();
}

export async function coverArtFor(song: string, artist: string): Promise<CoverArt | null> {
  const key = cacheKey(song, artist);
  // TTLCache returns null for a miss, so a "no art" result is stored as a
  // sentinel with an empty url to keep it from re-querying.
  const hit = artCache.get<CoverArt>(key);
  if (hit) return hit.url ? hit : null;

  const term = encodeURIComponent(`${song} ${primaryArtist(artist)}`);
  let result: CoverArt | null = null;
  try {
    const res = await safeFetch(`https://itunes.apple.com/search?media=music&entity=song&limit=5&term=${term}`);
    if (res.ok) {
      const body = await safeJson<{ results?: ItunesResult[] }>(res);
      const best = (body.results ?? []).find((r) => r.artworkUrl100) ?? null;
      if (best?.artworkUrl100) {
        result = {
          url: best.artworkUrl100.replace(/\/\d+x\d+bb\./, "/600x600bb."),
          previewUrl: best.previewUrl,
        };
      }
    }
  } catch {
    result = null;
  }
  artCache.set(key, result ?? { url: "" }, ART_TTL);
  return result;
}
