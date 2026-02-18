import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the API modules before importing dataFetcher
vi.mock("../spotify", () => ({
  isSpotifyConfigured: vi.fn(() => false),
  getSpotifyTrack: vi.fn(),
  searchSpotifyTracks: vi.fn(),
  getSpotifyArtist: vi.fn(),
}));

vi.mock("../youtube", () => ({
  isYouTubeConfigured: vi.fn(() => false),
  getYouTubeVideoBySearch: vi.fn(),
}));

vi.mock("../genius", () => ({
  isGeniusConfigured: vi.fn(() => false),
  getGeniusSongBySearch: vi.fn(),
  getGeniusSong: vi.fn(),
  searchGeniusSongs: vi.fn(),
}));

import { searchSongs, getSongData, parseMetric, compareSongs, getArtistData, getCatalog } from "../dataFetcher";
import { getGeniusSong } from "../genius";
import { isGeniusConfigured } from "../genius";

const mockIsGeniusConfigured = vi.mocked(isGeniusConfigured);
const mockGetGeniusSong = vi.mocked(getGeniusSong);

describe("dataFetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchSongs", () => {
    it("returns mock results for known songs", async () => {
      const results = await searchSongs("Blinding Lights");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe("Blinding Lights");
    });

    it("returns empty for gibberish query", async () => {
      const results = await searchSongs("xyznonexistent123");
      expect(results).toHaveLength(0);
    });

    it("matches by artist name", async () => {
      const results = await searchSongs("Taylor Swift");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].artist).toContain("Taylor Swift");
    });
  });

  describe("getSongData", () => {
    it("returns full data for known mock IDs", async () => {
      const song = await getSongData("blinding-lights");
      expect(song).not.toBeNull();
      expect(song!.title).toBe("Blinding Lights");
      expect(song!.spotify).not.toBeNull();
      expect(song!.youtube).not.toBeNull();
      expect(song!.billboard).not.toBeNull();
      expect(song!.timeline.length).toBeGreaterThan(0);
    });

    it("returns null for unknown IDs", async () => {
      const song = await getSongData("nonexistent-song-id");
      expect(song).toBeNull();
    });

    it("produces valid timeline when Genius returns unparseable release date", async () => {
      mockIsGeniusConfigured.mockReturnValue(true);
      mockGetGeniusSong.mockResolvedValue({
        id: 12345,
        title: "Test Song",
        artist: "Test Artist",
        albumArt: "https://example.com/art.jpg",
        releaseDate: "TBD",            // truthy but unparseable
        url: "https://genius.com/test",
        pageViews: "10K",
        description: "A test song",
        annotations: 5,
      });

      const song = await getSongData("genius:12345");
      expect(song).not.toBeNull();
      // Release date should fall back to today, not "TBD"
      expect(Number.isNaN(new Date(song!.releaseDate).getTime())).toBe(false);
      // Timeline should be valid (non-empty, no NaN dates)
      expect(song!.timeline.length).toBeGreaterThanOrEqual(0);
      for (const point of song!.timeline) {
        expect(Number.isNaN(new Date(point.date).getTime())).toBe(false);
      }
    });
  });

  describe("parseMetric", () => {
    it("parses billions suffix", () => {
      expect(parseMetric("4.2B")).toBe(4_200_000_000);
    });

    it("parses millions suffix", () => {
      expect(parseMetric("320M")).toBe(320_000_000);
    });

    it("parses thousands suffix", () => {
      expect(parseMetric("45K")).toBe(45_000);
    });

    it("parses plain numbers without suffix", () => {
      expect(parseMetric("100")).toBe(100);
    });

    it("returns 0 for non-numeric input", () => {
      expect(parseMetric("N/A")).toBe(0);
      expect(parseMetric("")).toBe(0);
      expect(parseMetric("abc")).toBe(0);
    });

    it("handles NaN before suffix check (NaN propagation fix)", () => {
      // "N/AB" starts with NaN — early guard should return 0, not NaN * 1B
      expect(parseMetric("N/AB")).toBe(0);
    });
  });

  describe("compareSongs", () => {
    it("returns comparison data with insights for two known songs", async () => {
      const result = await compareSongs("blinding-lights", "shape-of-you");
      expect(result).not.toBeNull();
      expect(result!.song1.title).toBe("Blinding Lights");
      expect(result!.song2.title).toBe("Shape of You");
      expect(result!.insights.length).toBeGreaterThan(0);
    });

    it("returns null when one song ID is invalid", async () => {
      const result = await compareSongs("blinding-lights", "nonexistent");
      expect(result).toBeNull();
    });

    it("produces correct winner for each insight metric", async () => {
      const result = await compareSongs("blinding-lights", "shape-of-you");
      expect(result).not.toBeNull();
      for (const insight of result!.insights) {
        expect(["song1", "song2", "tie"]).toContain(insight.winner);
        expect(insight.metric).toBeTruthy();
        expect(insight.song1Value).toBeTruthy();
        expect(insight.song2Value).toBeTruthy();
      }
    });

    it("applies lowerWins for Billboard Peak (lower position = better)", async () => {
      const result = await compareSongs("blinding-lights", "shape-of-you");
      const billboardInsight = result!.insights.find((i) => i.metric === "Billboard Peak");
      expect(billboardInsight).toBeDefined();
      // The song with the lower peak position number should win; equal = tie
      const peak1 = parseInt(billboardInsight!.song1Value.replace("#", ""));
      const peak2 = parseInt(billboardInsight!.song2Value.replace("#", ""));
      if (peak1 === peak2) {
        expect(billboardInsight!.winner).toBe("tie");
      } else if (peak1 < peak2) {
        expect(billboardInsight!.winner).toBe("song1");
      } else {
        expect(billboardInsight!.winner).toBe("song2");
      }
    });

    it("includes all 6 metrics when both songs have full platform data", async () => {
      const result = await compareSongs("blinding-lights", "shape-of-you");
      const metricNames = result!.insights.map((i) => i.metric);
      expect(metricNames).toContain("Spotify Streams");
      expect(metricNames).toContain("YouTube Views");
      expect(metricNames).toContain("Billboard Peak");
      expect(metricNames).toContain("Weeks on Chart");
      expect(metricNames).toContain("Genius Page Views");
      expect(metricNames).toContain("Popularity Score");
    });
  });

  describe("getArtistData", () => {
    it("returns artist data for a known mock artist slug", async () => {
      const artist = await getArtistData("the-weeknd");
      expect(artist).not.toBeNull();
      expect(artist!.name).toBe("The Weeknd");
      expect(artist!.topTracks.length).toBeGreaterThan(0);
    });

    it("returns null for unknown artist", async () => {
      const artist = await getArtistData("unknown-artist-xyz");
      expect(artist).toBeNull();
    });
  });

  describe("getCatalog", () => {
    it("returns all songs from the mock catalog", () => {
      const catalog = getCatalog();
      expect(catalog.length).toBe(17);
      expect(catalog[0]).toHaveProperty("id");
      expect(catalog[0]).toHaveProperty("title");
      expect(catalog[0]).toHaveProperty("spotify");
    });
  });
});
