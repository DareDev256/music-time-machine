// Core song data types

export interface SpotifyData {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  releaseDate: string;
  popularity: number;
  totalStreams: string;
  playlistCount: number;
  previewUrl: string | null;
  externalUrl: string;
  audioFeatures?: {
    danceability: number;
    energy: number;
    valence: number;
    tempo: number;
  };
}

export interface YouTubeData {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
  commentCount: string;
  channelTitle: string;
  externalUrl: string;
}

export interface BillboardData {
  peakPosition: number;
  peakDate: string;
  weeksOnChart: number;
  entryPosition: number;
  entryDate: string;
  chartHistory: {
    date: string;
    position: number;
  }[];
}

export interface GeniusData {
  id: number;
  title: string;
  artist: string;
  albumArt: string;
  pageViews: string;
  annotationCount: number;
  lyricsUrl: string;
  description: string;
  releaseDate: string;
}

export interface TimelineDataPoint {
  date: string;
  spotify?: number;
  youtube?: number;
  billboard?: number;
}

export interface SongData {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  releaseDate: string;
  spotify: SpotifyData | null;
  youtube: YouTubeData | null;
  billboard: BillboardData | null;
  genius: GeniusData | null;
  timeline: TimelineDataPoint[];
}

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  releaseDate: string;
  spotifyUrl?: string;
}
