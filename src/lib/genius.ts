import { GeniusData } from "@/types";

const GENIUS_API_BASE = "https://api.genius.com";

async function geniusFetch(endpoint: string) {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Genius access token not configured");
  }

  const response = await fetch(`${GENIUS_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Genius API error: ${response.status}`);
  }

  return response.json();
}

export async function searchGeniusSong(
  query: string
): Promise<{ id: number; title: string; artist: string } | null> {
  try {
    const data = await geniusFetch(`/search?q=${encodeURIComponent(query)}`);
    const hit = data.response?.hits?.[0]?.result;

    if (!hit) return null;

    return {
      id: hit.id,
      title: hit.title,
      artist: hit.primary_artist?.name || "Unknown",
    };
  } catch (error) {
    console.error("Genius search error:", error);
    return null;
  }
}

export async function getGeniusSong(songId: number): Promise<GeniusData | null> {
  try {
    const data = await geniusFetch(`/songs/${songId}?text_format=plain`);
    const song = data.response?.song;

    if (!song) return null;

    return {
      id: song.id,
      title: song.title,
      artist: song.primary_artist?.name || "Unknown",
      albumArt: song.song_art_image_url || song.header_image_url || "",
      pageViews: formatViews(song.stats?.pageviews),
      annotationCount: song.annotation_count || 0,
      lyricsUrl: song.url,
      description: song.description?.plain || extractDescription(song),
      releaseDate: song.release_date || song.release_date_for_display || "",
    };
  } catch (error) {
    console.error("Genius song fetch error:", error);
    return null;
  }
}

export async function getGeniusSongBySearch(
  songTitle: string,
  artist: string
): Promise<GeniusData | null> {
  try {
    const searchResult = await searchGeniusSong(`${songTitle} ${artist}`);
    if (!searchResult) return null;

    return getGeniusSong(searchResult.id);
  } catch (error) {
    console.error("Genius search error:", error);
    return null;
  }
}

function formatViews(views: number | undefined): string {
  if (!views) return "N/A";

  if (views >= 1_000_000) {
    return (views / 1_000_000).toFixed(1) + "M";
  }
  if (views >= 1_000) {
    return (views / 1_000).toFixed(1) + "K";
  }
  return views.toString();
}

function extractDescription(song: {
  description_preview?: string;
  title?: string;
  primary_artist?: { name?: string };
}): string {
  if (song.description_preview) {
    return song.description_preview;
  }
  return `"${song.title}" by ${song.primary_artist?.name || "Unknown Artist"}`;
}

export function isGeniusConfigured(): boolean {
  return !!process.env.GENIUS_ACCESS_TOKEN;
}
