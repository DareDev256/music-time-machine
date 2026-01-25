import { SongData, SearchResult, TimelineDataPoint } from "@/types";
import { getSpotifyTrack, searchSpotifyTracks, isSpotifyConfigured } from "./spotify";
import { getYouTubeVideoBySearch, isYouTubeConfigured } from "./youtube";
import { getGeniusSongBySearch, isGeniusConfigured } from "./genius";
import { getSongById as getMockSong, searchSongs as searchMockSongs, getTrendingSongs as getMockTrending } from "./mockData";

const USE_MOCK_DATA = process.env.USE_MOCK_DATA === "true";

export async function searchSongs(query: string): Promise<SearchResult[]> {
  // Always check mock data first for exact matches
  const mockResults = searchMockSongs(query);

  if (USE_MOCK_DATA || !isSpotifyConfigured()) {
    return mockResults;
  }

  try {
    // Search Spotify for real results
    const spotifyResults = await searchSpotifyTracks(query, 10);

    // Convert to SearchResult format
    const results: SearchResult[] = spotifyResults.map((track) => ({
      id: `spotify:${track.id}`,
      title: track.name,
      artist: track.artist,
      albumArt: track.albumArt,
      releaseDate: track.releaseDate,
      spotifyUrl: `https://open.spotify.com/track/${track.id}`,
    }));

    // Merge with mock results (mock takes priority for exact matches)
    const mockIds = new Set(mockResults.map((r) => r.title.toLowerCase()));
    const filtered = results.filter(
      (r) => !mockIds.has(r.title.toLowerCase())
    );

    return [...mockResults, ...filtered].slice(0, 10);
  } catch (error) {
    console.error("Search error, falling back to mock:", error);
    return mockResults;
  }
}

export async function getTrendingSongs(): Promise<SearchResult[]> {
  // Trending always uses curated mock data
  return getMockTrending();
}

export async function getSongData(id: string): Promise<SongData | null> {
  // Check if this is a mock song ID
  const mockSong = getMockSong(id);

  if (USE_MOCK_DATA) {
    return mockSong;
  }

  // If it's a Spotify ID, fetch real data
  if (id.startsWith("spotify:")) {
    const spotifyId = id.replace("spotify:", "");
    return fetchRealSongData(spotifyId);
  }

  // For mock song IDs, enrich with real data if APIs are configured
  if (mockSong) {
    return enrichMockSong(mockSong);
  }

  // Try to fetch from Spotify directly
  if (isSpotifyConfigured()) {
    return fetchRealSongData(id);
  }

  return null;
}

async function fetchRealSongData(spotifyId: string): Promise<SongData | null> {
  try {
    const spotify = await getSpotifyTrack(spotifyId);
    if (!spotify) return null;

    // Fetch from other platforms in parallel
    const [youtube, genius] = await Promise.all([
      isYouTubeConfigured()
        ? getYouTubeVideoBySearch(spotify.name, spotify.artist)
        : null,
      isGeniusConfigured()
        ? getGeniusSongBySearch(spotify.name, spotify.artist)
        : null,
    ]);

    // Generate timeline from available data
    const timeline = generateTimeline(spotify.releaseDate);

    return {
      id: `spotify:${spotifyId}`,
      title: spotify.name,
      artist: spotify.artist,
      albumArt: spotify.albumArt,
      releaseDate: spotify.releaseDate,
      spotify,
      youtube,
      billboard: null, // Billboard requires scraping, not implemented
      genius,
      timeline,
    };
  } catch (error) {
    console.error("Error fetching real song data:", error);
    return null;
  }
}

async function enrichMockSong(song: SongData): Promise<SongData> {
  // Start with mock data
  const enriched = { ...song };

  try {
    // Fetch real data from configured APIs in parallel
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

function generateTimeline(releaseDate: string, peakMonth: number = 3): TimelineDataPoint[] {
  const timeline: TimelineDataPoint[] = [];
  const start = new Date(releaseDate);
  const now = new Date();

  let currentDate = new Date(start);
  let month = 0;

  while (currentDate <= now && month < 48) {
    const spotifyGrowth = Math.min(
      100,
      Math.floor(
        20 + 80 * (1 - Math.exp(-month / peakMonth)) + Math.random() * 10 - month * 0.5
      )
    );

    const youtubeGrowth = Math.min(
      100,
      Math.floor(
        15 + 85 * (1 - Math.exp(-month / (peakMonth + 1))) + Math.random() * 8 - month * 0.3
      )
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

export function getConfiguredApis(): string[] {
  const apis: string[] = [];
  if (isSpotifyConfigured()) apis.push("spotify");
  if (isYouTubeConfigured()) apis.push("youtube");
  if (isGeniusConfigured()) apis.push("genius");
  return apis;
}
