import { SongData, SearchResult, TimelineDataPoint, ArtistData } from "@/types";

// Generate timeline data for a song
function generateTimeline(
  releaseDate: string,
  peakMonth: number = 3
): TimelineDataPoint[] {
  const timeline: TimelineDataPoint[] = [];
  const start = new Date(releaseDate);
  const now = new Date();

  // Generate monthly data points
  const currentDate = new Date(start);
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
  "flowers": {
    id: "flowers",
    title: "Flowers",
    artist: "Miley Cyrus",
    albumArt: "https://i.scdn.co/image/ab67616d0000b2738a2ce263b8f1b9f0e4dc7e8a",
    releaseDate: "2023-01-13",
    spotify: {
      id: "0yLdNVWF3Srea0uzk55zFn",
      name: "Flowers",
      artist: "Miley Cyrus",
      album: "Endless Summer Vacation",
      albumArt: "https://i.scdn.co/image/ab67616d0000b2738a2ce263b8f1b9f0e4dc7e8a",
      releaseDate: "2023-01-13",
      popularity: 90,
      totalStreams: "2.5B",
      playlistCount: 71234,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/0yLdNVWF3Srea0uzk55zFn",
      audioFeatures: {
        danceability: 0.707,
        energy: 0.681,
        valence: 0.643,
        tempo: 118,
      },
    },
    youtube: {
      videoId: "G7KNmW9a75Y",
      title: "Miley Cyrus - Flowers (Official Video)",
      thumbnail: "https://i.ytimg.com/vi/G7KNmW9a75Y/maxresdefault.jpg",
      publishedAt: "2023-01-12",
      viewCount: "1.3B",
      likeCount: "11M",
      commentCount: "412K",
      channelTitle: "Miley Cyrus",
      externalUrl: "https://youtube.com/watch?v=G7KNmW9a75Y",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2023-01-28",
      weeksOnChart: 52,
      entryPosition: 1,
      entryDate: "2023-01-28",
      chartHistory: [
        { date: "2023-01-28", position: 1 },
        { date: "2023-02-01", position: 1 },
        { date: "2023-03-01", position: 1 },
        { date: "2023-04-01", position: 2 },
        { date: "2023-05-01", position: 4 },
      ],
    },
    genius: {
      id: 8567890,
      title: "Flowers",
      artist: "Miley Cyrus",
      albumArt: "https://i.scdn.co/image/ab67616d0000b2738a2ce263b8f1b9f0e4dc7e8a",
      pageViews: "15.2M",
      annotationCount: 54,
      lyricsUrl: "https://genius.com/Miley-cyrus-flowers-lyrics",
      description: "A self-empowerment anthem about self-love after heartbreak, reportedly inspired by her divorce.",
      releaseDate: "2023-01-13",
    },
    timeline: generateTimeline("2023-01-13", 2),
  },
  "vampire": {
    id: "vampire",
    title: "vampire",
    artist: "Olivia Rodrigo",
    albumArt: "https://i.scdn.co/image/ab67616d0000b273e85259a1cae29a8d91f2093d",
    releaseDate: "2023-06-30",
    spotify: {
      id: "1kuGVB7EU95pJObxwvfwKS",
      name: "vampire",
      artist: "Olivia Rodrigo",
      album: "GUTS",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273e85259a1cae29a8d91f2093d",
      releaseDate: "2023-06-30",
      popularity: 87,
      totalStreams: "1.4B",
      playlistCount: 58234,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/1kuGVB7EU95pJObxwvfwKS",
      audioFeatures: {
        danceability: 0.512,
        energy: 0.534,
        valence: 0.312,
        tempo: 138,
      },
    },
    youtube: {
      videoId: "RlPNh_PBZb4",
      title: "Olivia Rodrigo - vampire (Official Video)",
      thumbnail: "https://i.ytimg.com/vi/RlPNh_PBZb4/maxresdefault.jpg",
      publishedAt: "2023-06-30",
      viewCount: "312M",
      likeCount: "4.2M",
      commentCount: "156K",
      channelTitle: "Olivia Rodrigo",
      externalUrl: "https://youtube.com/watch?v=RlPNh_PBZb4",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2023-07-15",
      weeksOnChart: 38,
      entryPosition: 1,
      entryDate: "2023-07-15",
      chartHistory: [
        { date: "2023-07-15", position: 1 },
        { date: "2023-08-01", position: 2 },
        { date: "2023-09-01", position: 5 },
        { date: "2023-10-01", position: 8 },
      ],
    },
    genius: {
      id: 8901234,
      title: "vampire",
      artist: "Olivia Rodrigo",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273e85259a1cae29a8d91f2093d",
      pageViews: "8.7M",
      annotationCount: 48,
      lyricsUrl: "https://genius.com/Olivia-rodrigo-vampire-lyrics",
      description: "A dramatic rock ballad about a parasitic older lover who took advantage of her youth and fame.",
      releaseDate: "2023-06-30",
    },
    timeline: generateTimeline("2023-06-30", 2),
  },
  "cruel-summer": {
    id: "cruel-summer",
    title: "Cruel Summer",
    artist: "Taylor Swift",
    albumArt: "https://i.scdn.co/image/ab67616d0000b273e787cffec20aa2a396a61647",
    releaseDate: "2019-08-23",
    spotify: {
      id: "1BxfuPKGuaTgP7aM0Bbdwr",
      name: "Cruel Summer",
      artist: "Taylor Swift",
      album: "Lover",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273e787cffec20aa2a396a61647",
      releaseDate: "2019-08-23",
      popularity: 92,
      totalStreams: "2.1B",
      playlistCount: 82345,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/1BxfuPKGuaTgP7aM0Bbdwr",
      audioFeatures: {
        danceability: 0.552,
        energy: 0.702,
        valence: 0.564,
        tempo: 170,
      },
    },
    youtube: {
      videoId: "ic8j13piAhQ",
      title: "Taylor Swift - Cruel Summer (Official Video)",
      thumbnail: "https://i.ytimg.com/vi/ic8j13piAhQ/maxresdefault.jpg",
      publishedAt: "2023-06-21",
      viewCount: "187M",
      likeCount: "3.1M",
      commentCount: "98K",
      channelTitle: "Taylor Swift",
      externalUrl: "https://youtube.com/watch?v=ic8j13piAhQ",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2023-10-28",
      weeksOnChart: 82,
      entryPosition: 72,
      entryDate: "2019-09-07",
      chartHistory: [
        { date: "2019-09-07", position: 72 },
        { date: "2023-06-01", position: 5 },
        { date: "2023-08-01", position: 3 },
        { date: "2023-10-28", position: 1 },
        { date: "2023-11-01", position: 2 },
      ],
    },
    genius: {
      id: 4891234,
      title: "Cruel Summer",
      artist: "Taylor Swift",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273e787cffec20aa2a396a61647",
      pageViews: "12.1M",
      annotationCount: 62,
      lyricsUrl: "https://genius.com/Taylor-swift-cruel-summer-lyrics",
      description: "A synth-pop track about a secret summer romance that became her first #1 four years after release.",
      releaseDate: "2019-08-23",
    },
    timeline: generateTimeline("2019-08-23", 48),
  },
  "espresso": {
    id: "espresso",
    title: "Espresso",
    artist: "Sabrina Carpenter",
    albumArt: "https://i.scdn.co/image/ab67616d0000b2736bb3db22a10b5a79db491c99",
    releaseDate: "2024-04-12",
    spotify: {
      id: "2qSkIjg1o9h3YT9RAgYN75",
      name: "Espresso",
      artist: "Sabrina Carpenter",
      album: "Short n' Sweet",
      albumArt: "https://i.scdn.co/image/ab67616d0000b2736bb3db22a10b5a79db491c99",
      releaseDate: "2024-04-12",
      popularity: 94,
      totalStreams: "1.8B",
      playlistCount: 92345,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/2qSkIjg1o9h3YT9RAgYN75",
      audioFeatures: {
        danceability: 0.701,
        energy: 0.756,
        valence: 0.812,
        tempo: 104,
      },
    },
    youtube: {
      videoId: "eVli-tstM5E",
      title: "Sabrina Carpenter - Espresso (Official Video)",
      thumbnail: "https://i.ytimg.com/vi/eVli-tstM5E/maxresdefault.jpg",
      publishedAt: "2024-04-11",
      viewCount: "456M",
      likeCount: "5.8M",
      commentCount: "187K",
      channelTitle: "Sabrina Carpenter",
      externalUrl: "https://youtube.com/watch?v=eVli-tstM5E",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2024-07-20",
      weeksOnChart: 42,
      entryPosition: 7,
      entryDate: "2024-04-27",
      chartHistory: [
        { date: "2024-04-27", position: 7 },
        { date: "2024-05-01", position: 4 },
        { date: "2024-06-01", position: 3 },
        { date: "2024-07-20", position: 1 },
        { date: "2024-08-01", position: 2 },
      ],
    },
    genius: {
      id: 9234567,
      title: "Espresso",
      artist: "Sabrina Carpenter",
      albumArt: "https://i.scdn.co/image/ab67616d0000b2736bb3db22a10b5a79db491c99",
      pageViews: "9.4M",
      annotationCount: 38,
      lyricsUrl: "https://genius.com/Sabrina-carpenter-espresso-lyrics",
      description: "A flirty, confident pop track that became the viral song of summer 2024.",
      releaseDate: "2024-04-12",
    },
    timeline: generateTimeline("2024-04-12", 3),
  },
  "texas-hold-em": {
    id: "texas-hold-em",
    title: "TEXAS HOLD 'EM",
    artist: "Beyoncé",
    albumArt: "https://i.scdn.co/image/ab67616d0000b273c578a7ed9d0f0dc2eb8ce0fc",
    releaseDate: "2024-02-11",
    spotify: {
      id: "7wLShogStyDeQ8xJnFctKN",
      name: "TEXAS HOLD 'EM",
      artist: "Beyoncé",
      album: "COWBOY CARTER",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273c578a7ed9d0f0dc2eb8ce0fc",
      releaseDate: "2024-02-11",
      popularity: 89,
      totalStreams: "892M",
      playlistCount: 67234,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/7wLShogStyDeQ8xJnFctKN",
      audioFeatures: {
        danceability: 0.623,
        energy: 0.712,
        valence: 0.734,
        tempo: 124,
      },
    },
    youtube: {
      videoId: "4gzHJKe_6J4",
      title: "Beyoncé - TEXAS HOLD 'EM (Official Video)",
      thumbnail: "https://i.ytimg.com/vi/4gzHJKe_6J4/maxresdefault.jpg",
      publishedAt: "2024-02-11",
      viewCount: "234M",
      likeCount: "3.4M",
      commentCount: "123K",
      channelTitle: "Beyoncé",
      externalUrl: "https://youtube.com/watch?v=4gzHJKe_6J4",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2024-02-24",
      weeksOnChart: 32,
      entryPosition: 1,
      entryDate: "2024-02-24",
      chartHistory: [
        { date: "2024-02-24", position: 1 },
        { date: "2024-03-01", position: 1 },
        { date: "2024-04-01", position: 3 },
        { date: "2024-05-01", position: 8 },
      ],
    },
    genius: {
      id: 9345678,
      title: "TEXAS HOLD 'EM",
      artist: "Beyoncé",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273c578a7ed9d0f0dc2eb8ce0fc",
      pageViews: "7.8M",
      annotationCount: 42,
      lyricsUrl: "https://genius.com/Beyonce-texas-hold-em-lyrics",
      description: "Beyoncé's country-influenced single that broke genre barriers and topped both Hot 100 and Hot Country charts.",
      releaseDate: "2024-02-11",
    },
    timeline: generateTimeline("2024-02-11", 2),
  },
  "die-with-a-smile": {
    id: "die-with-a-smile",
    title: "Die With A Smile",
    artist: "Lady Gaga & Bruno Mars",
    albumArt: "https://i.scdn.co/image/ab67616d0000b27353d1c4350df54a0e69a5cdb1",
    releaseDate: "2024-08-16",
    spotify: {
      id: "2plbrEY59IikOBgBGLjaoe",
      name: "Die With A Smile",
      artist: "Lady Gaga & Bruno Mars",
      album: "Die With A Smile",
      albumArt: "https://i.scdn.co/image/ab67616d0000b27353d1c4350df54a0e69a5cdb1",
      releaseDate: "2024-08-16",
      popularity: 96,
      totalStreams: "1.2B",
      playlistCount: 84567,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe",
      audioFeatures: {
        danceability: 0.534,
        energy: 0.423,
        valence: 0.312,
        tempo: 158,
      },
    },
    youtube: {
      videoId: "kPa7bsKwL-c",
      title: "Lady Gaga, Bruno Mars - Die With A Smile (Official Music Video)",
      thumbnail: "https://i.ytimg.com/vi/kPa7bsKwL-c/maxresdefault.jpg",
      publishedAt: "2024-08-15",
      viewCount: "567M",
      likeCount: "7.2M",
      commentCount: "234K",
      channelTitle: "Lady Gaga",
      externalUrl: "https://youtube.com/watch?v=kPa7bsKwL-c",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2024-10-19",
      weeksOnChart: 22,
      entryPosition: 3,
      entryDate: "2024-08-31",
      chartHistory: [
        { date: "2024-08-31", position: 3 },
        { date: "2024-09-01", position: 2 },
        { date: "2024-10-01", position: 2 },
        { date: "2024-10-19", position: 1 },
        { date: "2024-11-01", position: 1 },
      ],
    },
    genius: {
      id: 9456789,
      title: "Die With A Smile",
      artist: "Lady Gaga & Bruno Mars",
      albumArt: "https://i.scdn.co/image/ab67616d0000b27353d1c4350df54a0e69a5cdb1",
      pageViews: "6.2M",
      annotationCount: 35,
      lyricsUrl: "https://genius.com/Lady-gaga-and-bruno-mars-die-with-a-smile-lyrics",
      description: "A power ballad duet about enduring love until the very end, blending country and pop influences.",
      releaseDate: "2024-08-16",
    },
    timeline: generateTimeline("2024-08-16", 2),
  },
  "apt": {
    id: "apt",
    title: "APT.",
    artist: "ROSÉ & Bruno Mars",
    albumArt: "https://i.scdn.co/image/ab67616d0000b273a9b8e97ff7af4d4534b6e3a6",
    releaseDate: "2024-10-18",
    spotify: {
      id: "5vNRhkKd0yEAg8suGBpjeY",
      name: "APT.",
      artist: "ROSÉ & Bruno Mars",
      album: "APT.",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273a9b8e97ff7af4d4534b6e3a6",
      releaseDate: "2024-10-18",
      popularity: 95,
      totalStreams: "1.1B",
      playlistCount: 78234,
      previewUrl: null,
      externalUrl: "https://open.spotify.com/track/5vNRhkKd0yEAg8suGBpjeY",
      audioFeatures: {
        danceability: 0.723,
        energy: 0.812,
        valence: 0.823,
        tempo: 149,
      },
    },
    youtube: {
      videoId: "ekr2nIex040",
      title: "ROSÉ & Bruno Mars - APT. (Official Music Video)",
      thumbnail: "https://i.ytimg.com/vi/ekr2nIex040/maxresdefault.jpg",
      publishedAt: "2024-10-17",
      viewCount: "412M",
      likeCount: "9.1M",
      commentCount: "312K",
      channelTitle: "ROSÉ",
      externalUrl: "https://youtube.com/watch?v=ekr2nIex040",
    },
    billboard: {
      peakPosition: 1,
      peakDate: "2024-11-23",
      weeksOnChart: 12,
      entryPosition: 8,
      entryDate: "2024-11-02",
      chartHistory: [
        { date: "2024-11-02", position: 8 },
        { date: "2024-11-09", position: 3 },
        { date: "2024-11-16", position: 2 },
        { date: "2024-11-23", position: 1 },
      ],
    },
    genius: {
      id: 9567890,
      title: "APT.",
      artist: "ROSÉ & Bruno Mars",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273a9b8e97ff7af4d4534b6e3a6",
      pageViews: "5.1M",
      annotationCount: 28,
      lyricsUrl: "https://genius.com/Rose-and-bruno-mars-apt-lyrics",
      description: "A high-energy collaboration based on a Korean drinking game, mixing K-pop sensibilities with Bruno's funk.",
      releaseDate: "2024-10-18",
    },
    timeline: generateTimeline("2024-10-18", 1),
  },
};

// Genre classification for each song in the catalog
export const songGenres: Record<string, string> = {
  "blinding-lights": "R&B",
  "bad-guy": "Alt/Indie",
  "shape-of-you": "Pop",
  "as-it-was": "Pop",
  "anti-hero": "Pop",
  "uptown-funk": "Funk",
  "drivers-license": "Alt/Indie",
  "dance-monkey": "Pop",
  "old-town-road": "Country",
  "levitating": "Disco/Dance",
  "flowers": "Pop",
  "vampire": "Alt/Indie",
  "cruel-summer": "Pop",
  "espresso": "Pop",
  "texas-hold-em": "Country",
  "die-with-a-smile": "R&B",
  "apt": "K-Pop",
};

// All distinct genres in the catalog, sorted
export const catalogGenres: string[] = [
  ...new Set(Object.values(songGenres)),
].sort();

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
        genre: songGenres[id],
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
  return Object.entries(mockSongs).map(([id, song]) => ({
    id,
    title: song.title,
    artist: song.artist,
    albumArt: song.albumArt,
    releaseDate: song.releaseDate,
    spotifyUrl: song.spotify?.externalUrl || "",
    genre: songGenres[id],
  }));
}

// Aggregate artist data from mock songs
export function getArtistDataBySlug(slug: string): ArtistData | null {
  const artistSongs: SongData[] = [];
  let artistName = "";
  let artistImage = "";

  for (const song of Object.values(mockSongs)) {
    const songArtistSlug = song.artist.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (songArtistSlug === slug || songArtistSlug.startsWith(slug)) {
      artistSongs.push(song);
      if (!artistName) {
        artistName = song.artist;
        artistImage = song.albumArt;
      }
    }
  }

  if (artistSongs.length === 0) return null;

  const topTracks = artistSongs.map((s) => ({
    id: s.id,
    title: s.title,
    albumArt: s.albumArt,
    streams: s.spotify?.totalStreams || "N/A",
  }));

  const albumSet = new Map<string, { name: string; year: string; albumArt: string }>();
  for (const s of artistSongs) {
    if (s.spotify?.album && !albumSet.has(s.spotify.album)) {
      albumSet.set(s.spotify.album, {
        name: s.spotify.album,
        year: s.releaseDate.split("-")[0],
        albumArt: s.albumArt,
      });
    }
  }

  return {
    id: slug,
    name: artistName,
    slug,
    image: artistImage,
    genres: ["Pop"],
    monthlyListeners: "50M+",
    totalStreams: "10B+",
    topTracks,
    albums: Array.from(albumSet.values()),
    careerTimeline: artistSongs.map((s) => ({
      year: s.releaseDate.split("-")[0],
      event: `Released "${s.title}"`,
    })).sort((a, b) => a.year.localeCompare(b.year)),
  };
}
