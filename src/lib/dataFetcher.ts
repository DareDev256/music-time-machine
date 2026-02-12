import { SongData, SearchResult, TimelineDataPoint, ComparisonData, ArtistData } from "@/types";
import { getSpotifyTrack, searchSpotifyTracks, getSpotifyArtist, isSpotifyConfigured } from "./spotify";
import { getYouTubeVideoBySearch, isYouTubeConfigured } from "./youtube";
import { getGeniusSongBySearch, getGeniusSong, searchGeniusSongs, isGeniusConfigured } from "./genius";
import { getSongById as getMockSong, searchSongs as searchMockSongs, getTrendingSongs as getMockTrending, getArtistDataBySlug } from "./mockData";
import { searchCache, SEARCH_TTL, songCache, SONG_TTL } from "./cache";

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

      const mockIds = new Set(mockResults.map((r) => r.title.toLowerCase()));
      const filtered = results.filter((r) => !mockIds.has(r.title.toLowerCase()));
      const combined = [...mockResults, ...filtered].slice(0, 10);
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

      const mockIds = new Set(mockResults.map((r) => r.title.toLowerCase()));
      const filtered = results.filter((r) => !mockIds.has(r.title.toLowerCase()));
      const combined = [...mockResults, ...filtered].slice(0, 10);
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

  const mockSong = getMockSong(id);

  if (USE_MOCK_DATA) {
    if (mockSong) songCache.set(cacheKey, mockSong, SONG_TTL);
    return mockSong;
  }

  if (id.startsWith("spotify:")) {
    const spotifyId = id.replace("spotify:", "");
    const result = await fetchRealSongData(spotifyId);
    if (result) songCache.set(cacheKey, result, SONG_TTL);
    return result;
  }

  if (id.startsWith("genius:")) {
    const geniusId = parseInt(id.replace("genius:", ""), 10);
    const result = await fetchGeniusSongData(geniusId);
    if (result) songCache.set(cacheKey, result, SONG_TTL);
    return result;
  }

  if (mockSong) {
    const enriched = await enrichMockSong(mockSong);
    songCache.set(cacheKey, enriched, SONG_TTL);
    return enriched;
  }

  if (isSpotifyConfigured()) {
    const result = await fetchRealSongData(id);
    if (result) songCache.set(cacheKey, result, SONG_TTL);
    return result;
  }

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

  const insights: ComparisonData["insights"] = [];

  if (song1.spotify && song2.spotify) {
    const s1 = parseMetric(song1.spotify.totalStreams);
    const s2 = parseMetric(song2.spotify.totalStreams);
    insights.push({
      metric: "Spotify Streams",
      song1Value: song1.spotify.totalStreams,
      song2Value: song2.spotify.totalStreams,
      winner: s1 >= s2 ? "song1" : "song2",
    });
    insights.push({
      metric: "Popularity Score",
      song1Value: `${song1.spotify.popularity}/100`,
      song2Value: `${song2.spotify.popularity}/100`,
      winner: song1.spotify.popularity >= song2.spotify.popularity ? "song1" : "song2",
    });
  }

  if (song1.youtube && song2.youtube) {
    const v1 = parseMetric(song1.youtube.viewCount);
    const v2 = parseMetric(song2.youtube.viewCount);
    insights.push({
      metric: "YouTube Views",
      song1Value: song1.youtube.viewCount,
      song2Value: song2.youtube.viewCount,
      winner: v1 >= v2 ? "song1" : "song2",
    });
  }

  if (song1.billboard && song2.billboard) {
    insights.push({
      metric: "Billboard Peak",
      song1Value: `#${song1.billboard.peakPosition}`,
      song2Value: `#${song2.billboard.peakPosition}`,
      winner: song1.billboard.peakPosition <= song2.billboard.peakPosition ? "song1" : "song2",
    });
    insights.push({
      metric: "Weeks on Chart",
      song1Value: `${song1.billboard.weeksOnChart}`,
      song2Value: `${song2.billboard.weeksOnChart}`,
      winner: song1.billboard.weeksOnChart >= song2.billboard.weeksOnChart ? "song1" : "song2",
    });
  }

  if (song1.genius && song2.genius) {
    const p1 = parseMetric(song1.genius.pageViews);
    const p2 = parseMetric(song2.genius.pageViews);
    insights.push({
      metric: "Genius Page Views",
      song1Value: song1.genius.pageViews,
      song2Value: song2.genius.pageViews,
      winner: p1 >= p2 ? "song1" : "song2",
    });
  }

  return { song1, song2, insights };
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

function parseMetric(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  if (value.endsWith("B")) return num * 1_000_000_000;
  if (value.endsWith("M")) return num * 1_000_000;
  if (value.endsWith("K")) return num * 1_000;
  return num;
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

export function getConfiguredApis(): string[] {
  const apis: string[] = [];
  if (isSpotifyConfigured()) apis.push("spotify");
  if (isYouTubeConfigured()) apis.push("youtube");
  if (isGeniusConfigured()) apis.push("genius");
  return apis;
}
