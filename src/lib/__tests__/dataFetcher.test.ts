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

import { searchSongs, getSongData } from "../dataFetcher";

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
  });
});
