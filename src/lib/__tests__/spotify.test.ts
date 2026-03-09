import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("../safeFetch", () => ({
  safeFetch: vi.fn(),
}));
vi.mock("../rateLimit", () => ({
  checkSpotifyLimit: vi.fn(() => true),
}));

import { safeFetch } from "../safeFetch";
import { checkSpotifyLimit } from "../rateLimit";

// Must re-import fresh per test to reset token cache
async function loadModule() {
  vi.resetModules();
  vi.mock("../safeFetch", () => ({ safeFetch: vi.fn() }));
  vi.mock("../rateLimit", () => ({ checkSpotifyLimit: vi.fn(() => true) }));
  return import("../spotify");
}

function mockResponse(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) };
}

const TOKEN_RESPONSE = { access_token: "tok_abc", expires_in: 3600 };

const TRACK = {
  id: "t1",
  name: "Blinding Lights",
  artists: [{ name: "The Weeknd" }],
  album: { name: "After Hours", images: [{ url: "https://img/1.jpg" }], release_date: "2020-03-20" },
  popularity: 90,
  preview_url: "https://preview/1",
  external_urls: { spotify: "https://open.spotify.com/track/t1" },
};

describe("spotify integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SPOTIFY_CLIENT_ID = "test_id";
    process.env.SPOTIFY_CLIENT_SECRET = "test_secret";
    (checkSpotifyLimit as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  describe("searchSpotifyTrack", () => {
    it("returns mapped track when API returns results", async () => {
      const mockFetch = safeFetch as ReturnType<typeof vi.fn>;
      mockFetch
        .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
        .mockResolvedValueOnce(mockResponse({ tracks: { items: [TRACK] } }));

      const { searchSpotifyTrack } = await import("../spotify");
      const result = await searchSpotifyTrack("blinding lights weeknd");

      expect(result).toEqual({
        id: "t1",
        name: "Blinding Lights",
        artist: "The Weeknd",
        albumArt: "https://img/1.jpg",
      });
    });

    it("returns null when no tracks match", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch
        .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
        .mockResolvedValueOnce(mockResponse({ tracks: { items: [] } }));

      const result = await mod.searchSpotifyTrack("nonexistent");
      expect(result).toBeNull();
    });

    it("returns null on API error instead of throwing", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse(null, false));

      const result = await mod.searchSpotifyTrack("test");
      expect(result).toBeNull();
    });
  });

  describe("getSpotifyTrack", () => {
    it("merges track data with audio features", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      const features = { danceability: 0.5, energy: 0.7, valence: 0.3, tempo: 171.005 };

      // Promise.all fires two concurrent spotifyFetch — each needs its own token
      mockFetch
        .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
        .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
        .mockResolvedValueOnce(mockResponse(TRACK))
        .mockResolvedValueOnce(mockResponse(features));

      const result = await mod.getSpotifyTrack("t1");
      expect(result).not.toBeNull();
      expect(result!.audioFeatures).toEqual({
        danceability: 0.5,
        energy: 0.7,
        valence: 0.3,
        tempo: 171, // should be rounded
      });
      expect(result!.artist).toBe("The Weeknd");
      expect(result!.album).toBe("After Hours");
    });

    it("returns track without audioFeatures when features endpoint fails", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      // Two token fetches (concurrent Promise.all), then track ok, features fails
      mockFetch
        .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
        .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
        .mockResolvedValueOnce(mockResponse(TRACK))
        .mockResolvedValueOnce(mockResponse(null, false));

      const result = await mod.getSpotifyTrack("t1");
      expect(result).not.toBeNull();
      expect(result!.audioFeatures).toBeUndefined();
    });
  });

  describe("getSpotifyArtist", () => {
    it("detects 22-char alphanumeric strings as Spotify IDs", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      const artistData = {
        id: "1Xyo4u8uXC1ZmMpatF05PJ",
        name: "The Weeknd",
        images: [{ url: "https://img/artist.jpg" }],
        genres: ["canadian pop", "r&b"],
        followers: { total: 85000000 },
      };

      mockFetch
        .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
        .mockResolvedValueOnce(mockResponse(artistData)) // direct fetch by ID
        .mockResolvedValueOnce(mockResponse({ tracks: [] }))
        .mockResolvedValueOnce(mockResponse({ items: [] }));

      const result = await mod.getSpotifyArtist("1Xyo4u8uXC1ZmMpatF05PJ");
      // Should have called /artists/{id} directly, not /search
      const fetchCalls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
      expect(fetchCalls[1]).toContain("/artists/1Xyo4u8uXC1ZmMpatF05PJ");
      expect(fetchCalls[1]).not.toContain("/search");
      expect(result!.name).toBe("The Weeknd");
      expect(result!.genres).toEqual(["canadian pop", "r&b"]);
    });

    it("searches by name when input is not a Spotify ID", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      const artistData = {
        id: "abc123",
        name: "Drake",
        images: [],
        genres: [],
        followers: { total: 0 },
      };

      mockFetch
        .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
        .mockResolvedValueOnce(mockResponse({ artists: { items: [artistData] } }))
        .mockResolvedValueOnce(mockResponse({ tracks: [] }))
        .mockResolvedValueOnce(mockResponse({ items: [] }));

      const result = await mod.getSpotifyArtist("Drake");
      const fetchCalls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
      expect(fetchCalls[1]).toContain("/search");
      expect(result!.name).toBe("Drake");
    });
  });

  describe("rate limiting", () => {
    it("throws when rate limit is exceeded", async () => {
      const mod = await loadModule();
      const { checkSpotifyLimit: mockLimit } = await import("../rateLimit");
      (mockLimit as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE));

      // searchSpotifyTrack catches errors and returns null
      const result = await mod.searchSpotifyTrack("test");
      expect(result).toBeNull();
    });
  });

  describe("isSpotifyConfigured", () => {
    it("returns true when both env vars are set", async () => {
      const mod = await loadModule();
      process.env.SPOTIFY_CLIENT_ID = "id";
      process.env.SPOTIFY_CLIENT_SECRET = "secret";
      expect(mod.isSpotifyConfigured()).toBe(true);
    });

    it("returns false when credentials are missing", async () => {
      const mod = await loadModule();
      delete process.env.SPOTIFY_CLIENT_ID;
      expect(mod.isSpotifyConfigured()).toBe(false);
    });
  });
});
