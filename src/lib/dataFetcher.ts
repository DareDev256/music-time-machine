import { SongData, SearchResult, TimelineDataPoint, ComparisonData, ArtistData } from "@/types";
import { getSpotifyTrack, searchSpotifyTracks, getSpotifyArtist, isSpotifyConfigured } from "./spotify";
import { getYouTubeVideoBySearch, isYouTubeConfigured } from "./youtube";
import { getGeniusSongBySearch, getGeniusSong, searchGeniusSongs, isGeniusConfigured } from "./genius";
import { getSongById as getMockSong, searchSongs as searchMockSongs, getTrendingSongs as getMockTrending, getArtistDataBySlug, mockSongs } from "./mockData";
import { searchCache, SEARCH_TTL, songCache, SONG_TTL } from "./cache";
import { buildInsights } from "./comparison";

// Re-export parseMetric from its new home for backwards compatibility.
// Consumers that imported parseMetric from dataFetcher continue to work.
export { parseMetric } from "./comparison";

// --- Reusable helpers ---

/** Merge API results with mock results, deduplicating by title and capping at `limit`. */
function mergeWithMock(apiResults: SearchResult[], mockResults: SearchResult[], limit: number = 10): SearchResult[] {
  const mockTitles = new Set(mockResults.map((r) => r.title.toLowerCase()));
  const unique = apiResults.filter((r) => !mockTitles.has(r.title.toLowerCase()));
  return [...mockResults, ...unique].slice(0, limit);
}

const USE_MOCK_DATA = process.env.USE_MOCK_DATA === "true";

export async function searchSongs(query: string): Promise<SearchResult[]> {
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = searchCache.get<SearchResult[]>(cacheKey);
  if (cached) return cached;

  const mockResults = searchMockSongs(query);

  if (USE_MOCK_DATA) {
    searchCache.set(cacheKey, mockResults, SEARCH_TTL);
    return mockResults;
  }

  if (isSpotifyConfigured()) {
    try {
      const spotifyResults = await searchSpotifyTracks(query, 10);
      const results: SearchResult[] = spotifyResults.map((track) => ({
        id: `spotify:${track.id}`,
        title: track.name,
        artist: track.artist,
        albumArt: track.albumArt,
        releaseDate: track.releaseDate,
        spotifyUrl: `https://open.spotify.com/track/${track.id}`,
      }));

      const combined = mergeWithMock(results, mockResults);
      searchCache.set(cacheKey, combined, SEARCH_TTL);
      return combined;
    } catch (error) {
      console.error("Spotify search error:", error);
    }
  }

  if (isGeniusConfigured()) {
    try {
      const geniusResults = await searchGeniusSongs(query, 10);
      const results: SearchResult[] = geniusResults.map((song) => ({
        id: `genius:${song.id}`,
        title: song.title,
        artist: song.artist,
        albumArt: song.albumArt,
        releaseDate: song.releaseDate || new Date().toISOString(),
      }));

      const combined = mergeWithMock(results, mockResults);
      searchCache.set(cacheKey, combined, SEARCH_TTL);
      return combined;
    } catch (error) {
      console.error("Genius search error:", error);
    }
  }

  searchCache.set(cacheKey, mockResults, SEARCH_TTL);
  return mockResults;
}

export async function getTrendingSongs(): Promise<SearchResult[]> {
  return getMockTrending();
}

export async function getSongData(id: string): Promise<SongData | null> {
  const cacheKey = `song:${id}`;
  const cached = songCache.get<SongData>(cacheKey);
  if (cached) return cached;

  const result = await resolveSongData(id);
  if (result) songCache.set(cacheKey, result, SONG_TTL);
  return result;
}

/** Resolve song data through the appropriate source (mock → API prefix → enrichment → fallback). */
async function resolveSongData(id: string): Promise<SongData | null> {
  const mockSong = getMockSong(id);

  if (USE_MOCK_DATA) return mockSong;

  if (id.startsWith("spotify:")) {
    return fetchRealSongData(id.replace("spotify:", ""));
  }

  if (id.startsWith("genius:")) {
    const geniusId = parseInt(id.replace("genius:", ""), 10);
    if (Number.isNaN(geniusId) || geniusId <= 0) return null;
    return fetchGeniusSongData(geniusId);
  }

  if (mockSong) return enrichMockSong(mockSong);
  if (isSpotifyConfigured()) return fetchRealSongData(id);
  return null;
}

async function fetchRealSongData(spotifyId: string): Promise<SongData | null> {
  try {
    const spotify = await getSpotifyTrack(spotifyId);
    if (!spotify) return null;

    const [youtube, genius] = await Promise.all([
      isYouTubeConfigured() ? getYouTubeVideoBySearch(spotify.name, spotify.artist) : null,
      isGeniusConfigured() ? getGeniusSongBySearch(spotify.name, spotify.artist) : null,
    ]);

    const timeline = generateTimeline(spotify.releaseDate);

    return {
      id: `spotify:${spotifyId}`,
      title: spotify.name,
      artist: spotify.artist,
      albumArt: spotify.albumArt,
      releaseDate: spotify.releaseDate,
      spotify,
      youtube,
      billboard: null,
      genius,
      timeline,
    };
  } catch (error) {
    console.error("Error fetching real song data:", error);
    return null;
  }
}

async function fetchGeniusSongData(geniusId: number): Promise<SongData | null> {
  try {
    const genius = await getGeniusSong(geniusId);
    if (!genius) return null;

    const youtube = isYouTubeConfigured()
      ? await getYouTubeVideoBySearch(genius.title, genius.artist)
      : null;

    const releaseDate = genius.releaseDate || new Date().toISOString().split("T")[0];
    const timeline = generateTimeline(releaseDate);

    return {
      id: `genius:${geniusId}`,
      title: genius.title,
      artist: genius.artist,
      albumArt: genius.albumArt || "",
      releaseDate,
      spotify: null,
      youtube,
      billboard: null,
      genius,
      timeline,
    };
  } catch (error) {
    console.error("Error fetching Genius song data:", error);
    return null;
  }
}

async function enrichMockSong(song: SongData): Promise<SongData> {
  const enriched = { ...song };

  try {
    const promises: Promise<void>[] = [];

    if (isSpotifyConfigured() && song.spotify?.id) {
      promises.push(
        getSpotifyTrack(song.spotify.id).then((data) => {
          if (data) enriched.spotify = data;
        })
      );
    }

    if (isYouTubeConfigured() && song.youtube?.videoId) {
      promises.push(
        getYouTubeVideoBySearch(song.title, song.artist).then((data) => {
          if (data) enriched.youtube = data;
        })
      );
    }

    if (isGeniusConfigured()) {
      promises.push(
        getGeniusSongBySearch(song.title, song.artist).then((data) => {
          if (data) enriched.genius = data;
        })
      );
    }

    await Promise.all(promises);
  } catch (error) {
    console.error("Error enriching song data:", error);
  }

  return enriched;
}

export async function compareSongs(id1: string, id2: string): Promise<ComparisonData | null> {
  const [song1, song2] = await Promise.all([getSongData(id1), getSongData(id2)]);
  if (!song1 || !song2) return null;

  return { song1, song2, insights: buildInsights(song1, song2) };
}

export async function getArtistData(slug: string): Promise<ArtistData | null> {
  const mockArtist = getArtistDataBySlug(slug);
  if (mockArtist) return mockArtist;

  if (isSpotifyConfigured()) {
    try {
      const artist = await getSpotifyArtist(slug);
      if (artist) return artist;
    } catch (error) {
      console.error("Error fetching artist from Spotify:", error);
    }
  }

  return null;
}

function generateTimeline(releaseDate: string, peakMonth: number = 3): TimelineDataPoint[] {
  const timeline: TimelineDataPoint[] = [];
  const start = new Date(releaseDate);
  const now = new Date();

  const currentDate = new Date(start);
  let month = 0;

  while (currentDate <= now && month < 48) {
    const spotifyGrowth = Math.min(
      100,
      Math.floor(20 + 80 * (1 - Math.exp(-month / peakMonth)) + Math.random() * 10 - month * 0.5)
    );
    const youtubeGrowth = Math.min(
      100,
      Math.floor(15 + 85 * (1 - Math.exp(-month / (peakMonth + 1))) + Math.random() * 8 - month * 0.3)
    );

    let billboardPos = null;
    if (month >= 1 && month <= 20) {
      const peak = 100 - 90 * Math.exp(-Math.pow(month - peakMonth, 2) / 10);
      billboardPos = Math.max(1, Math.floor(peak + Math.random() * 10));
    }

    timeline.push({
      date: currentDate.toISOString().split("T")[0],
      spotify: Math.max(0, spotifyGrowth),
      youtube: Math.max(0, youtubeGrowth),
      billboard: billboardPos ? 101 - billboardPos : undefined,
    });

    currentDate.setMonth(currentDate.getMonth() + 1);
    month++;
  }

  return timeline;
}

/** Return all songs in the mock catalog (for recommendations). */
export function getCatalog(): SongData[] {
  return Object.values(mockSongs);
}

