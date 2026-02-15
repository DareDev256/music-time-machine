/**
 * @module types
 * Core data types for Music Time Machine.
 *
 * These interfaces define every data shape flowing through the app — from API
 * responses to component props. Platform data (Spotify, YouTube, Billboard,
 * Genius) is nullable on {@link SongData} because any platform may be
 * unconfigured or unavailable; the UI renders gracefully with partial data.
 *
 * String-typed numeric fields (e.g. `totalStreams`, `viewCount`) use strings
 * because they arrive pre-formatted from APIs or mock data ("1,234,567,890")
 * and are displayed as-is — no arithmetic is performed on them.
 */

// ─── Spotify ────────────────────────────────────────────────────────────────

/** Spotify track data from the Web API (tracks + audio-features endpoints). */
export interface SpotifyData {
  /** Spotify track ID. @example "4cOdK2wGLETKBW3PvgPWqT" */
  id: string;
  /** Track title as listed on Spotify. */
  name: string;
  /** Primary artist name. May include collaborators in "ft." format. */
  artist: string;
  /** Album name the track belongs to. */
  album: string;
  /** Album cover URL from Spotify CDN (`i.scdn.co`). 640×640px. */
  albumArt: string;
  /** ISO date string. @example "2017-01-06" */
  releaseDate: string;
  /** Spotify popularity index. Range: 0–100 (100 = most popular). */
  popularity: number;
  /** Formatted total stream count. @example "2,400,000,000" */
  totalStreams: string;
  /** Number of Spotify playlists featuring this track. */
  playlistCount: number;
  /** 30-second MP3 preview URL, or `null` if unavailable (licensing/region). */
  previewUrl: string | null;
  /** Link to the track on open.spotify.com. */
  externalUrl: string;
  /**
   * Audio analysis features from Spotify's audio-features endpoint.
   * Optional — only present when Spotify API is configured.
   * All values 0–1 except `tempo` which is BPM.
   */
  audioFeatures?: {
    /** How suitable for dancing. 0 = least, 1 = most. */
    danceability: number;
    /** Perceptual intensity/activity. 0 = ambient, 1 = aggressive. */
    energy: number;
    /** Musical positiveness. 0 = sad/angry, 1 = happy/cheerful. */
    valence: number;
    /** Estimated beats per minute. Typically 60–200. */
    tempo: number;
  };
}

// ─── YouTube ────────────────────────────────────────────────────────────────

/** YouTube video data from the Data API v3 (search + videos endpoints). */
export interface YouTubeData {
  /** YouTube video ID. @example "dQw4w9WgXcQ" */
  videoId: string;
  /** Video title as listed on YouTube. */
  title: string;
  /** Thumbnail URL. Typically `maxresdefault` (1280×720) or `hqdefault`. */
  thumbnail: string;
  /** ISO 8601 publish date. @example "2009-10-25T06:57:33Z" */
  publishedAt: string;
  /** Formatted view count. @example "1,500,000,000" */
  viewCount: string;
  /** Formatted like count. @example "15,000,000" */
  likeCount: string;
  /** Formatted comment count. @example "2,300,000" */
  commentCount: string;
  /** Channel that uploaded the video. @example "VEVO" */
  channelTitle: string;
  /** Link to watch on youtube.com. */
  externalUrl: string;
}

// ─── Billboard ──────────────────────────────────────────────────────────────

/** Billboard Hot 100 chart performance data (mock or scraped). */
export interface BillboardData {
  /** Highest chart position reached. 1 = #1 hit. */
  peakPosition: number;
  /** Date the peak position was achieved. @example "2017-01-28" */
  peakDate: string;
  /** Total weeks the song appeared on the Hot 100. */
  weeksOnChart: number;
  /** Chart position on debut week. */
  entryPosition: number;
  /** Date the song first entered the chart. @example "2017-01-14" */
  entryDate: string;
  /** Weekly position history for the timeline chart. Sorted chronologically. */
  chartHistory: {
    /** Week ending date. @example "2017-01-14" */
    date: string;
    /** Chart position that week (1 = #1, lower is better). */
    position: number;
  }[];
}

// ─── Genius ─────────────────────────────────────────────────────────────────

/** Genius song metadata from the Genius API (search + songs endpoints). */
export interface GeniusData {
  /** Genius internal song ID. @example 3038286 */
  id: number;
  /** Song title as listed on Genius. */
  title: string;
  /** Primary artist name on Genius. */
  artist: string;
  /** Album art URL from Genius CDN (`images.genius.com`). */
  albumArt: string;
  /** Formatted page view count on genius.com. @example "5,200,000" */
  pageViews: string;
  /** Number of user-contributed annotations on the lyrics page. */
  annotationCount: number;
  /** URL to the full lyrics page on genius.com (not raw lyrics text). */
  lyricsUrl: string;
  /** Genius editor-written song description / context blurb. */
  description: string;
  /** Release date as shown on Genius. @example "January 6, 2017" */
  releaseDate: string;
}

// ─── Timeline ───────────────────────────────────────────────────────────────

/**
 * A single data point for the multi-platform performance timeline chart.
 * Each platform value is optional — the chart renders only available series.
 */
export interface TimelineDataPoint {
  /** Month label for the x-axis. @example "Jan 2017" */
  date: string;
  /** Spotify monthly streams (raw number for chart scale). */
  spotify?: number;
  /** YouTube monthly views (raw number for chart scale). */
  youtube?: number;
  /** Billboard chart position (inverted: 1 = top, rendered at chart peak). */
  billboard?: number;
}

// ─── Song (Aggregate) ───────────────────────────────────────────────────────

/**
 * Complete song data aggregated from all platforms.
 * This is the primary data shape returned by `getSongData()` and consumed
 * by the song detail page. Platform blocks are `null` when that platform
 * is unconfigured or returned no data — components handle this gracefully.
 */
export interface SongData {
  /** URL-safe song identifier. Matches mock data keys or Spotify IDs. */
  id: string;
  /** Display title. */
  title: string;
  /** Artist credit line. May include "ft.", "&", "with" for collaborations. */
  artist: string;
  /** Best available album art URL across platforms. */
  albumArt: string;
  /** ISO date string for display and era-matching. @example "2017-01-06" */
  releaseDate: string;
  /** Spotify platform data, or `null` if unavailable. */
  spotify: SpotifyData | null;
  /** YouTube platform data, or `null` if unavailable. */
  youtube: YouTubeData | null;
  /** Billboard chart data, or `null` if unavailable. */
  billboard: BillboardData | null;
  /** Genius lyrics/metadata, or `null` if unavailable. */
  genius: GeniusData | null;
  /** Monthly performance data points for the timeline chart. */
  timeline: TimelineDataPoint[];
}

// ─── Search ─────────────────────────────────────────────────────────────────

/** Search autocomplete result returned by `/api/search`. */
export interface SearchResult {
  /** Song identifier for navigation to `/song/[id]`. */
  id: string;
  /** Song title for display in the dropdown. */
  title: string;
  /** Artist name for display in the dropdown. */
  artist: string;
  /** Album art thumbnail for the search result row. */
  albumArt: string;
  /** Release date for context. @example "2017-01-06" */
  releaseDate: string;
  /** Spotify external URL, if sourced from Spotify search. */
  spotifyUrl?: string;
  /** Genre tag from mock data catalog. @example "Pop" */
  genre?: string;
}

// ─── Comparison ─────────────────────────────────────────────────────────────

/** A single metric comparison between two songs on the compare page. */
export interface ComparisonInsight {
  /** Human-readable metric label. @example "Total Streams" */
  metric: string;
  /** Formatted value for the first song. @example "2,400,000,000" */
  song1Value: string;
  /** Formatted value for the second song. @example "1,100,000,000" */
  song2Value: string;
  /** Which song wins this metric, or "tie" if equal. */
  winner: "song1" | "song2" | "tie";
}

/** Full comparison payload returned by `/api/compare`. */
export interface ComparisonData {
  /** Complete data for the first selected song. */
  song1: SongData;
  /** Complete data for the second selected song. */
  song2: SongData;
  /** Head-to-head metric breakdowns across all platforms. */
  insights: ComparisonInsight[];
}

// ─── Artist ─────────────────────────────────────────────────────────────────

/** Abbreviated album info for the artist discography grid. */
export interface AlbumSummary {
  /** Album title. */
  name: string;
  /** Release year. @example "2022" */
  year: string;
  /** Album cover URL. */
  albumArt: string;
}

/** A milestone in an artist's career timeline. */
export interface CareerEvent {
  /** Year the event occurred. @example "2015" */
  year: string;
  /** Description of the milestone. @example "Released debut album 'Beauty Behind the Madness'" */
  event: string;
}

/**
 * Artist profile data for the `/artist/[id]` page.
 * Aggregated from Spotify artist data and mock catalog.
 */
export interface ArtistData {
  /** Artist identifier (Spotify artist ID or mock slug). */
  id: string;
  /** Artist display name. */
  name: string;
  /** URL-safe slug for routing. @example "the-weeknd" */
  slug: string;
  /** Artist profile image URL. */
  image: string;
  /** Genre tags. @example ["Pop", "R&B", "Synth-pop"] */
  genres: string[];
  /** Formatted monthly listener count. @example "85,000,000" */
  monthlyListeners: string;
  /** Formatted career total streams. @example "35,000,000,000" */
  totalStreams: string;
  /** Top tracks for the "Popular" section (up to 5). */
  topTracks: {
    /** Track ID for navigation. */
    id: string;
    /** Track title. */
    title: string;
    /** Album art thumbnail. */
    albumArt: string;
    /** Formatted stream count. @example "2,400,000,000" */
    streams: string;
  }[];
  /** Full discography for the album grid. */
  albums: AlbumSummary[];
  /** Career milestones for the timeline visualization. */
  careerTimeline: CareerEvent[];
}
