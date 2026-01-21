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
  "uptown-funk": {
    id: "uptown-funk",
    title: "Uptown Funk",
    artist: "Mark Ronson ft. Bruno Mars",
    albumArt:
      "https://i.scdn.co/image/ab67616d0000b273e419ccba0baa8bd3f3d7abf2",
    releaseDate: "2014-11-10",
    spotify: {
      id: "32OlwWuMpZ6b0aN2RZOeMS",
      name: "Uptown Funk",
      artist: "Mark Ronson ft. Bruno Mars",
      album: "Uptown Special",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273e419ccba0baa8bd3f3d7abf2",
      releaseDate: "2014-11-10",
      popularity: 86,
      totalStreams: "2.4B",
      playlistCount: 82456,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/32OlwWuMpZ6b0aN2RZOeMS",
      audioFeatures: {
        danceability: 0.856,
        energy: 0.609,
        valence: 0.962,
        tempo: 115,
      },
    },
    youtube: {
      videoId: "OPf0YbXqDm0",
      title: "Mark Ronson - Uptown Funk (Official Video) ft. Bruno Mars",
      thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/maxresdefault.jpg",
      publishedAt: "2014-11-19",
      viewCount: "5.0B",
      likeCount: "24M",
      commentCount: "1.1M",
      channelTitle: "Mark Ronson",
      externalUrl: "https://youtube.com/watch?v=OPf0YbXqDm0",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2015-01-17",
      weeksOnChart: 50,
      entryPosition: 13,
      entryDate: "2014-11-29",
      chartHistory: [
        { date: "2014-11-29", position: 13 },
        { date: "2014-12-15", position: 4 },
        { date: "2015-01-17", position: 1 },
        { date: "2015-02-01", position: 1 },
        { date: "2015-03-01", position: 1 },
        { date: "2015-04-01", position: 2 },
      ],
    },
    genius: {
      id: 538398,
      title: "Uptown Funk",
      artist: "Mark Ronson ft. Bruno Mars",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273e419ccba0baa8bd3f3d7abf2",
      pageViews: "11.3M",
      annotationCount: 48,
      lyricsUrl: "https://genius.com/Mark-ronson-uptown-funk-lyrics",
      description:
        "A retro funk anthem that dominated charts worldwide with its infectious groove and Bruno Mars' electrifying vocals.",
      releaseDate: "2014-11-10",
    },
    timeline: generateTimeline("2014-11-10", 3),
  },
  "drivers-license": {
    id: "drivers-license",
    title: "drivers license",
    artist: "Olivia Rodrigo",
    albumArt:
      "https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a",
    releaseDate: "2021-01-08",
    spotify: {
      id: "5wANPM4fQCJwkGd4rN57mH",
      name: "drivers license",
      artist: "Olivia Rodrigo",
      album: "SOUR",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a",
      releaseDate: "2021-01-08",
      popularity: 82,
      totalStreams: "2.1B",
      playlistCount: 61234,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/5wANPM4fQCJwkGd4rN57mH",
      audioFeatures: {
        danceability: 0.585,
        energy: 0.434,
        valence: 0.132,
        tempo: 144,
      },
    },
    youtube: {
      videoId: "ZmDBbnmKpqQ",
      title: "Olivia Rodrigo - drivers license (Official Video)",
      thumbnail: "https://i.ytimg.com/vi/ZmDBbnmKpqQ/maxresdefault.jpg",
      publishedAt: "2021-01-08",
      viewCount: "478M",
      likeCount: "6.8M",
      commentCount: "287K",
      channelTitle: "Olivia Rodrigo",
      externalUrl: "https://youtube.com/watch?v=ZmDBbnmKpqQ",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2021-01-23",
      weeksOnChart: 42,
      entryPosition: 1,
      entryDate: "2021-01-23",
      chartHistory: [
        { date: "2021-01-23", position: 1 },
        { date: "2021-02-01", position: 1 },
        { date: "2021-03-01", position: 1 },
        { date: "2021-04-01", position: 3 },
        { date: "2021-05-01", position: 6 },
        { date: "2021-06-01", position: 12 },
      ],
    },
    genius: {
      id: 6478923,
      title: "drivers license",
      artist: "Olivia Rodrigo",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a",
      pageViews: "14.2M",
      annotationCount: 56,
      lyricsUrl: "https://genius.com/Olivia-rodrigo-drivers-license-lyrics",
      description:
        "A heartbreak ballad that broke streaming records and launched Olivia Rodrigo into superstardom.",
      releaseDate: "2021-01-08",
    },
    timeline: generateTimeline("2021-01-08", 2),
  },
  "dance-monkey": {
    id: "dance-monkey",
    title: "Dance Monkey",
    artist: "Tones and I",
    albumArt:
      "https://i.scdn.co/image/ab67616d0000b2731616e0b9e3cfef03e5b146e4",
    releaseDate: "2019-05-10",
    spotify: {
      id: "1rgnBhdG2JDFTbYkYRZAku",
      name: "Dance Monkey",
      artist: "Tones and I",
      album: "The Kids Are Coming",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b2731616e0b9e3cfef03e5b146e4",
      releaseDate: "2019-05-10",
      popularity: 83,
      totalStreams: "2.8B",
      playlistCount: 78234,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/1rgnBhdG2JDFTbYkYRZAku",
      audioFeatures: {
        danceability: 0.824,
        energy: 0.588,
        valence: 0.54,
        tempo: 98,
      },
    },
    youtube: {
      videoId: "q0hyYWKXF0Q",
      title: "Tones And I - Dance Monkey (Official Video)",
      thumbnail: "https://i.ytimg.com/vi/q0hyYWKXF0Q/maxresdefault.jpg",
      publishedAt: "2019-06-20",
      viewCount: "2.2B",
      likeCount: "14M",
      commentCount: "523K",
      channelTitle: "Tones And I",
      externalUrl: "https://youtube.com/watch?v=q0hyYWKXF0Q",
    },
    billboard: {
      peakPosition: 4,
      peakDate: "2020-02-08",
      weeksOnChart: 38,
      entryPosition: 50,
      entryDate: "2019-11-02",
      chartHistory: [
        { date: "2019-11-02", position: 50 },
        { date: "2019-12-01", position: 22 },
        { date: "2020-01-01", position: 8 },
        { date: "2020-02-08", position: 4 },
        { date: "2020-03-01", position: 6 },
        { date: "2020-04-01", position: 12 },
      ],
    },
    genius: {
      id: 4789234,
      title: "Dance Monkey",
      artist: "Tones and I",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b2731616e0b9e3cfef03e5b146e4",
      pageViews: "7.8M",
      annotationCount: 32,
      lyricsUrl: "https://genius.com/Tones-and-i-dance-monkey-lyrics",
      description:
        "A viral hit about the pressure performers feel to entertain, featuring a distinctive vocal style.",
      releaseDate: "2019-05-10",
    },
    timeline: generateTimeline("2019-05-10", 6),
  },
  "old-town-road": {
    id: "old-town-road",
    title: "Old Town Road",
    artist: "Lil Nas X ft. Billy Ray Cyrus",
    albumArt:
      "https://i.scdn.co/image/ab67616d0000b273fe297c2100c4e9027e2cd97e",
    releaseDate: "2019-04-05",
    spotify: {
      id: "2YpeDb67231RjR0MgVLzsG",
      name: "Old Town Road",
      artist: "Lil Nas X ft. Billy Ray Cyrus",
      album: "7 EP",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273fe297c2100c4e9027e2cd97e",
      releaseDate: "2019-04-05",
      popularity: 81,
      totalStreams: "2.5B",
      playlistCount: 69234,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/2YpeDb67231RjR0MgVLzsG",
      audioFeatures: {
        danceability: 0.746,
        energy: 0.615,
        valence: 0.647,
        tempo: 136,
      },
    },
    youtube: {
      videoId: "w2Ov5jzm3j8",
      title: "Lil Nas X - Old Town Road (Official Video) ft. Billy Ray Cyrus",
      thumbnail: "https://i.ytimg.com/vi/w2Ov5jzm3j8/maxresdefault.jpg",
      publishedAt: "2019-05-17",
      viewCount: "890M",
      likeCount: "9.2M",
      commentCount: "412K",
      channelTitle: "Lil Nas X",
      externalUrl: "https://youtube.com/watch?v=w2Ov5jzm3j8",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2019-04-13",
      weeksOnChart: 45,
      entryPosition: 83,
      entryDate: "2019-03-16",
      chartHistory: [
        { date: "2019-03-16", position: 83 },
        { date: "2019-04-13", position: 1 },
        { date: "2019-05-01", position: 1 },
        { date: "2019-06-01", position: 1 },
        { date: "2019-07-01", position: 1 },
        { date: "2019-08-01", position: 1 },
      ],
    },
    genius: {
      id: 4567891,
      title: "Old Town Road",
      artist: "Lil Nas X ft. Billy Ray Cyrus",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273fe297c2100c4e9027e2cd97e",
      pageViews: "18.5M",
      annotationCount: 61,
      lyricsUrl: "https://genius.com/Lil-nas-x-old-town-road-remix-lyrics",
      description:
        "A genre-bending country trap hit that spent a record 19 weeks at #1 on the Billboard Hot 100.",
      releaseDate: "2019-04-05",
    },
    timeline: generateTimeline("2019-04-05", 2),
  },
  "levitating": {
    id: "levitating",
    title: "Levitating",
    artist: "Dua Lipa",
    albumArt:
      "https://i.scdn.co/image/ab67616d0000b273bd26ede1ae69327010d49946",
    releaseDate: "2020-03-27",
    spotify: {
      id: "463CkQjx2Zk1yXoBuierM9",
      name: "Levitating",
      artist: "Dua Lipa",
      album: "Future Nostalgia",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273bd26ede1ae69327010d49946",
      releaseDate: "2020-03-27",
      popularity: 87,
      totalStreams: "2.1B",
      playlistCount: 72345,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/463CkQjx2Zk1yXoBuierM9",
      audioFeatures: {
        danceability: 0.702,
        energy: 0.825,
        valence: 0.915,
        tempo: 103,
      },
    },
    youtube: {
      videoId: "TUVcZfQe-Kw",
      title: "Dua Lipa - Levitating (Official Music Video)",
      thumbnail: "https://i.ytimg.com/vi/TUVcZfQe-Kw/maxresdefault.jpg",
      publishedAt: "2020-10-01",
      viewCount: "892M",
      likeCount: "7.1M",
      commentCount: "234K",
      channelTitle: "Dua Lipa",
      externalUrl: "https://youtube.com/watch?v=TUVcZfQe-Kw",
    },
    billboard: {
      peakPosition: 2,
      peakDate: "2021-05-22",
      weeksOnChart: 68,
      entryPosition: 86,
      entryDate: "2020-04-11",
      chartHistory: [
        { date: "2020-04-11", position: 86 },
        { date: "2020-08-01", position: 38 },
        { date: "2020-12-01", position: 12 },
        { date: "2021-03-01", position: 5 },
        { date: "2021-05-22", position: 2 },
        { date: "2021-07-01", position: 4 },
      ],
    },
    genius: {
      id: 5234567,
      title: "Levitating",
      artist: "Dua Lipa",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b273bd26ede1ae69327010d49946",
      pageViews: "9.2M",
      annotationCount: 41,
      lyricsUrl: "https://genius.com/Dua-lipa-levitating-lyrics",
      description:
        "A disco-pop banger about the euphoria of new love that became a global phenomenon.",
      releaseDate: "2020-03-27",
    },
    timeline: generateTimeline("2020-03-27", 8),
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
