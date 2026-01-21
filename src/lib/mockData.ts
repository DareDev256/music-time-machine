import { SongData, SearchResult, TimelineDataPoint } from "@/types";

// Generate timeline data for a song
function generateTimeline(
  releaseDate: string,
  peakMonth: number = 3
): TimelineDataPoint[] {
  const timeline: TimelineDataPoint[] = [];
  const start = new Date(releaseDate);
  const now = new Date();

  // Generate monthly data points
  let currentDate = new Date(start);
  let month = 0;

  while (currentDate <= now && month < 48) {
    // Max 4 years of data
    // Spotify streams curve (exponential growth then plateau)
    const spotifyGrowth = Math.min(
      100,
      Math.floor(
        20 +
          80 * (1 - Math.exp(-month / peakMonth)) +
          Math.random() * 10 -
          month * 0.5
      )
    );

    // YouTube views curve (similar pattern)
    const youtubeGrowth = Math.min(
      100,
      Math.floor(
        15 +
          85 * (1 - Math.exp(-month / (peakMonth + 1))) +
          Math.random() * 8 -
          month * 0.3
      )
    );

    // Billboard position (inverse - lower is better, peaks then drops)
    let billboardPos = null;
    if (month >= 1 && month <= 20) {
      const peak = 100 - 90 * Math.exp(-Math.pow(month - peakMonth, 2) / 10);
      billboardPos = Math.max(1, Math.floor(peak + Math.random() * 10));
    }

    timeline.push({
      date: currentDate.toISOString().split("T")[0],
      spotify: Math.max(0, spotifyGrowth),
      youtube: Math.max(0, youtubeGrowth),
      billboard: billboardPos ? 101 - billboardPos : undefined, // Invert for graph (higher = better)
    });

    currentDate.setMonth(currentDate.getMonth() + 1);
    month++;
  }

  return timeline;
}

// Mock database of popular songs
export const mockSongs: Record<string, SongData> = {
  "blinding-lights": {
    id: "blinding-lights",
    title: "Blinding Lights",
    artist: "The Weeknd",
    albumArt:
      "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
    releaseDate: "2019-11-29",
    spotify: {
      id: "0VjIjW4GlUZAMYd2vXMi3b",
      name: "Blinding Lights",
      artist: "The Weeknd",
      album: "After Hours",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
      releaseDate: "2019-11-29",
      popularity: 89,
      totalStreams: "4.2B",
      playlistCount: 89432,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
      audioFeatures: {
        danceability: 0.514,
        energy: 0.73,
        valence: 0.334,
        tempo: 171,
      },
    },
    youtube: {
      videoId: "4NRXx6U8ABQ",
      title: "The Weeknd - Blinding Lights (Official Video)",
      thumbnail: "https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg",
      publishedAt: "2020-01-22",
      viewCount: "1.8B",
      likeCount: "18M",
      commentCount: "892K",
      channelTitle: "The Weeknd",
      externalUrl: "https://youtube.com/watch?v=4NRXx6U8ABQ",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2020-04-04",
      weeksOnChart: 90,
      entryPosition: 11,
      entryDate: "2020-01-11",
      chartHistory: [
        { date: "2020-01-11", position: 11 },
        { date: "2020-02-01", position: 8 },
        { date: "2020-03-01", position: 4 },
        { date: "2020-04-04", position: 1 },
        { date: "2020-05-01", position: 1 },
        { date: "2020-06-01", position: 2 },
        { date: "2020-07-01", position: 3 },
        { date: "2020-08-01", position: 5 },
      ],
    },
    genius: {
      id: 5025057,
      title: "Blinding Lights",
      artist: "The Weeknd",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
      pageViews: "12.4M",
      annotationCount: 45,
      lyricsUrl: "https://genius.com/The-weeknd-blinding-lights-lyrics",
      description:
        "An 80s-inspired synth-pop anthem about longing for a past love while driving through the city at night.",
      releaseDate: "2019-11-29",
    },
    timeline: generateTimeline("2019-11-29", 5),
  },
  "bad-guy": {
    id: "bad-guy",
    title: "bad guy",
    artist: "Billie Eilish",
    albumArt:
      "https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce",
    releaseDate: "2019-03-29",
    spotify: {
      id: "2Fxmhks0bxGSBdJ92vM42m",
      name: "bad guy",
      artist: "Billie Eilish",
      album: "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce",
      releaseDate: "2019-03-29",
      popularity: 85,
      totalStreams: "2.8B",
      playlistCount: 72156,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/2Fxmhks0bxGSBdJ92vM42m",
      audioFeatures: {
        danceability: 0.701,
        energy: 0.425,
        valence: 0.562,
        tempo: 135,
      },
    },
    youtube: {
      videoId: "DyDfgMOUjCI",
      title: "Billie Eilish - bad guy (Official Music Video)",
      thumbnail: "https://i.ytimg.com/vi/DyDfgMOUjCI/maxresdefault.jpg",
      publishedAt: "2019-03-29",
      viewCount: "1.6B",
      likeCount: "15M",
      commentCount: "654K",
      channelTitle: "Billie Eilish",
      externalUrl: "https://youtube.com/watch?v=DyDfgMOUjCI",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2019-08-24",
      weeksOnChart: 67,
      entryPosition: 7,
      entryDate: "2019-04-13",
      chartHistory: [
        { date: "2019-04-13", position: 7 },
        { date: "2019-05-01", position: 4 },
        { date: "2019-06-01", position: 2 },
        { date: "2019-08-24", position: 1 },
        { date: "2019-09-01", position: 3 },
        { date: "2019-10-01", position: 8 },
      ],
    },
    genius: {
      id: 4561969,
      title: "bad guy",
      artist: "Billie Eilish",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce",
      pageViews: "9.8M",
      annotationCount: 38,
      lyricsUrl: "https://genius.com/Billie-eilish-bad-guy-lyrics",
      description:
        "A playful, bass-heavy track where Billie flips the script on relationship dynamics.",
      releaseDate: "2019-03-29",
    },
    timeline: generateTimeline("2019-03-29", 4),
  },
  "shape-of-you": {
    id: "shape-of-you",
    title: "Shape of You",
    artist: "Ed Sheeran",
    albumArt:
      "https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96",
    releaseDate: "2017-01-06",
    spotify: {
      id: "7qiZfU4dY1lWllzX7mPBI3",
      name: "Shape of You",
      artist: "Ed Sheeran",
      album: "÷ (Divide)",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96",
      releaseDate: "2017-01-06",
      popularity: 84,
      totalStreams: "3.9B",
      playlistCount: 95234,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3",
      audioFeatures: {
        danceability: 0.825,
        energy: 0.652,
        valence: 0.931,
        tempo: 96,
      },
    },
    youtube: {
      videoId: "JGwWNGJdvx8",
      title: "Ed Sheeran - Shape of You (Official Music Video)",
      thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/maxresdefault.jpg",
      publishedAt: "2017-01-30",
      viewCount: "6.2B",
      likeCount: "29M",
      commentCount: "1.2M",
      channelTitle: "Ed Sheeran",
      externalUrl: "https://youtube.com/watch?v=JGwWNGJdvx8",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2017-01-28",
      weeksOnChart: 59,
      entryPosition: 1,
      entryDate: "2017-01-28",
      chartHistory: [
        { date: "2017-01-28", position: 1 },
        { date: "2017-02-01", position: 1 },
        { date: "2017-03-01", position: 1 },
        { date: "2017-04-01", position: 1 },
        { date: "2017-05-01", position: 2 },
        { date: "2017-06-01", position: 4 },
      ],
    },
    genius: {
      id: 2952839,
      title: "Shape of You",
      artist: "Ed Sheeran",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96",
      pageViews: "15.2M",
      annotationCount: 52,
      lyricsUrl: "https://genius.com/Ed-sheeran-shape-of-you-lyrics",
      description:
        "A dancehall-influenced pop hit about physical attraction and club romance.",
      releaseDate: "2017-01-06",
    },
    timeline: generateTimeline("2017-01-06", 2),
  },
  "as-it-was": {
    id: "as-it-was",
    title: "As It Was",
    artist: "Harry Styles",
    albumArt:
      "https://i.scdn.co/image/ab67616d0000b2732e8ed79e177ff6011076f5f0",
    releaseDate: "2022-04-01",
    spotify: {
      id: "4Dvkj6JhhA12EX05fT7y2e",
      name: "As It Was",
      artist: "Harry Styles",
      album: "Harry's House",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b2732e8ed79e177ff6011076f5f0",
      releaseDate: "2022-04-01",
      popularity: 91,
      totalStreams: "2.9B",
      playlistCount: 68923,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/4Dvkj6JhhA12EX05fT7y2e",
      audioFeatures: {
        danceability: 0.52,
        energy: 0.731,
        valence: 0.662,
        tempo: 174,
      },
    },
    youtube: {
      videoId: "H5v3kku4y6Q",
      title: "Harry Styles - As It Was (Official Video)",
      thumbnail: "https://i.ytimg.com/vi/H5v3kku4y6Q/maxresdefault.jpg",
      publishedAt: "2022-04-01",
      viewCount: "890M",
      likeCount: "8.2M",
      commentCount: "312K",
      channelTitle: "Harry Styles",
      externalUrl: "https://youtube.com/watch?v=H5v3kku4y6Q",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2022-04-16",
      weeksOnChart: 52,
      entryPosition: 1,
      entryDate: "2022-04-16",
      chartHistory: [
        { date: "2022-04-16", position: 1 },
        { date: "2022-05-01", position: 1 },
        { date: "2022-06-01", position: 1 },
        { date: "2022-07-01", position: 2 },
        { date: "2022-08-01", position: 3 },
        { date: "2022-09-01", position: 5 },
      ],
    },
    genius: {
      id: 7678432,
      title: "As It Was",
      artist: "Harry Styles",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b2732e8ed79e177ff6011076f5f0",
      pageViews: "6.7M",
      annotationCount: 34,
      lyricsUrl: "https://genius.com/Harry-styles-as-it-was-lyrics",
      description:
        "A synth-pop track reflecting on change, nostalgia, and longing for simpler times.",
      releaseDate: "2022-04-01",
    },
    timeline: generateTimeline("2022-04-01", 3),
  },
  "anti-hero": {
    id: "anti-hero",
    title: "Anti-Hero",
    artist: "Taylor Swift",
    albumArt:
      "https://i.scdn.co/image/ab67616d0000b273bb54dde68cd23e2a268ae0f5",
    releaseDate: "2022-10-21",
    spotify: {
      id: "0V3wPSX9ygBnCm8psDIegu",
      name: "Anti-Hero",
      artist: "Taylor Swift",
      album: "Midnights",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273bb54dde68cd23e2a268ae0f5",
      releaseDate: "2022-10-21",
      popularity: 88,
      totalStreams: "1.8B",
      playlistCount: 54321,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/0V3wPSX9ygBnCm8psDIegu",
      audioFeatures: {
        danceability: 0.637,
        energy: 0.534,
        valence: 0.533,
        tempo: 97,
      },
    },
    youtube: {
      videoId: "b1kbLwvqugk",
      title: "Taylor Swift - Anti-Hero (Official Music Video)",
      thumbnail: "https://i.ytimg.com/vi/b1kbLwvqugk/maxresdefault.jpg",
      publishedAt: "2022-10-21",
      viewCount: "456M",
      likeCount: "5.4M",
      commentCount: "198K",
      channelTitle: "Taylor Swift",
      externalUrl: "https://youtube.com/watch?v=b1kbLwvqugk",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2022-10-29",
      weeksOnChart: 38,
      entryPosition: 1,
      entryDate: "2022-10-29",
      chartHistory: [
        { date: "2022-10-29", position: 1 },
        { date: "2022-11-01", position: 1 },
        { date: "2022-12-01", position: 1 },
        { date: "2023-01-01", position: 2 },
        { date: "2023-02-01", position: 4 },
        { date: "2023-03-01", position: 8 },
      ],
    },
    genius: {
      id: 8234567,
      title: "Anti-Hero",
      artist: "Taylor Swift",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273bb54dde68cd23e2a268ae0f5",
      pageViews: "8.9M",
      annotationCount: 67,
      lyricsUrl: "https://genius.com/Taylor-swift-anti-hero-lyrics",
      description:
        "A deeply personal track where Taylor confronts her insecurities and self-destructive tendencies.",
      releaseDate: "2022-10-21",
    },
    timeline: generateTimeline("2022-10-21", 2),
  },
};

// Search function
export function searchSongs(query: string): SearchResult[] {
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const [id, song] of Object.entries(mockSongs)) {
    if (
      song.title.toLowerCase().includes(lowerQuery) ||
      song.artist.toLowerCase().includes(lowerQuery)
    ) {
      results.push({
        id,
        title: song.title,
        artist: song.artist,
        albumArt: song.albumArt,
        releaseDate: song.releaseDate,
        spotifyUrl: song.spotify?.externalUrl || "",
      });
    }
  }

  return results;
}

// Get song by ID
export function getSongById(id: string): SongData | null {
  return mockSongs[id] || null;
}

// Get all songs for trending display
export function getTrendingSongs(): SearchResult[] {
  return Object.entries(mockSongs)
    .slice(0, 5)
    .map(([id, song]) => ({
      id,
      title: song.title,
      artist: song.artist,
      albumArt: song.albumArt,
      releaseDate: song.releaseDate,
      spotifyUrl: song.spotify?.externalUrl || "",
    }));
}
