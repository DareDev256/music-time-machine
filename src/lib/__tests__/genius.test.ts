import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../safeFetch", () => ({
  safeFetch: vi.fn(),
  safeJson: vi.fn((resp: { json: () => Promise<unknown> }) => resp.json()),
}));
vi.mock("../rateLimit", () => ({ checkGeniusLimit: vi.fn(() => true) }));

function mockResponse(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) };
}

async function loadModule() {
  vi.resetModules();
  vi.mock("../safeFetch", () => ({
  safeFetch: vi.fn(),
  safeJson: vi.fn((resp: { json: () => Promise<unknown> }) => resp.json()),
}));
  vi.mock("../rateLimit", () => ({ checkGeniusLimit: vi.fn(() => true) }));
  return import("../genius");
}

const HIT = {
  result: {
    id: 378195,
    title: "Bohemian Rhapsody",
    primary_artist: { name: "Queen" },
    song_art_image_thumbnail_url: "https://img/thumb.jpg",
    release_date_for_display: "October 31, 1975",
  },
};

const SONG = {
  id: 378195,
  title: "Bohemian Rhapsody",
  primary_artist: { name: "Queen" },
  song_art_image_url: "https://img/art.jpg",
  header_image_url: "https://img/header.jpg",
  stats: { pageviews: 12500000 },
  annotation_count: 42,
  url: "https://genius.com/Queen-bohemian-rhapsody-lyrics",
  description: { plain: "A six-minute suite composed of several sections." },
  release_date: "1975-10-31",
  release_date_for_display: "October 31, 1975",
};

describe("genius integration", () => {
  beforeEach(() => {
    process.env.GENIUS_ACCESS_TOKEN = "test_token";
  });

  describe("searchGeniusSong", () => {
    it("returns mapped hit from search results", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { hits: [HIT] } }));

      const result = await mod.searchGeniusSong("bohemian rhapsody queen");
      expect(result).toEqual({ id: 378195, title: "Bohemian Rhapsody", artist: "Queen" });
    });

    it("returns null when no hits found", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { hits: [] } }));

      expect(await mod.searchGeniusSong("nonexistent")).toBeNull();
    });

    it("returns null on API failure instead of throwing", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse(null, false));

      expect(await mod.searchGeniusSong("test")).toBeNull();
    });

    it("defaults artist to 'Unknown' when primary_artist is absent", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      const noArtist = { result: { id: 1, title: "Orphan Track" } };
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { hits: [noArtist] } }));

      const result = await mod.searchGeniusSong("orphan");
      expect(result!.artist).toBe("Unknown");
    });

    it("URL-encodes the search query", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { hits: [] } }));

      await mod.searchGeniusSong("rock & roll");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("rock%20%26%20roll");
      expect(url).not.toContain("rock & roll");
    });
  });

  describe("searchGeniusSongs", () => {
    it("maps multiple hits with albumArt and releaseDate", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { hits: [HIT, HIT] } }));

      const results = await mod.searchGeniusSongs("queen", 5);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 378195,
        title: "Bohemian Rhapsody",
        artist: "Queen",
        albumArt: "https://img/thumb.jpg",
        releaseDate: "October 31, 1975",
      });
    });

    it("respects the limit parameter", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      const threeHits = Array(3).fill(HIT);
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { hits: threeHits } }));

      const results = await mod.searchGeniusSongs("queen", 2);
      expect(results).toHaveLength(2);
    });

    it("returns empty array on error", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockRejectedValueOnce(new Error("network"));

      expect(await mod.searchGeniusSongs("test")).toEqual([]);
    });

    it("defaults missing fields to empty strings", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      const bare = { result: { id: 1, title: "Bare", primary_artist: {} } };
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { hits: [bare] } }));

      const results = await mod.searchGeniusSongs("bare");
      expect(results[0].artist).toBe("Unknown");
      expect(results[0].albumArt).toBe("");
      expect(results[0].releaseDate).toBe("");
    });
  });

  describe("getGeniusSong", () => {
    it("returns full song data with description and stats", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { song: SONG } }));

      const result = await mod.getGeniusSong(378195);
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Bohemian Rhapsody");
      expect(result!.annotationCount).toBe(42);
      expect(result!.lyricsUrl).toBe("https://genius.com/Queen-bohemian-rhapsody-lyrics");
      expect(result!.description).toBe("A six-minute suite composed of several sections.");
      expect(result!.releaseDate).toBe("1975-10-31");
    });

    it("falls back to header_image_url when song_art_image_url is missing", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      const noArt = { ...SONG, song_art_image_url: undefined };
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { song: noArt } }));

      const result = await mod.getGeniusSong(378195);
      expect(result!.albumArt).toBe("https://img/header.jpg");
    });

    it("extracts description_preview when description.plain is missing", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      const noDesc = { ...SONG, description: undefined, description_preview: "A classic rock anthem." };
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { song: noDesc } }));

      const result = await mod.getGeniusSong(378195);
      expect(result!.description).toBe("A classic rock anthem.");
    });

    it("generates fallback description from title and artist", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      const minimal = { ...SONG, description: undefined, description_preview: undefined };
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { song: minimal } }));

      const result = await mod.getGeniusSong(378195);
      expect(result!.description).toBe('"Bohemian Rhapsody" by Queen');
    });

    it("returns null when song not found", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { song: null } }));

      expect(await mod.getGeniusSong(999999)).toBeNull();
    });
  });

  describe("getGeniusSongBySearch", () => {
    it("chains search → detail fetch", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockClear();
      mockFetch
        .mockResolvedValueOnce(mockResponse({ response: { hits: [HIT] } }))
        .mockResolvedValueOnce(mockResponse({ response: { song: SONG } }));

      const result = await mod.getGeniusSongBySearch("Bohemian Rhapsody", "Queen");
      expect(result).not.toBeNull();
      expect(result!.id).toBe(378195);

      // Verify it made a search call then a songs/ call
      const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(urls[0]).toContain("/search");
      expect(urls[1]).toContain("/songs/378195");
    });

    it("returns null when search finds nothing", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { hits: [] } }));

      expect(await mod.getGeniusSongBySearch("Nonexistent", "Nobody")).toBeNull();
    });
  });

  describe("rate limiting", () => {
    it("returns null when rate limit is exceeded", async () => {
      const mod = await loadModule();
      const { checkGeniusLimit } = await import("../rateLimit");
      (checkGeniusLimit as ReturnType<typeof vi.fn>).mockReturnValue(false);

      expect(await mod.searchGeniusSong("test")).toBeNull();
    });
  });

  describe("isGeniusConfigured", () => {
    it("returns true when access token is set", async () => {
      const mod = await loadModule();
      process.env.GENIUS_ACCESS_TOKEN = "tok";
      expect(mod.isGeniusConfigured()).toBe(true);
    });

    it("returns false when access token is missing", async () => {
      const mod = await loadModule();
      delete process.env.GENIUS_ACCESS_TOKEN;
      expect(mod.isGeniusConfigured()).toBe(false);
    });
  });

  describe("auth header", () => {
    it("sends Bearer token in Authorization header", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse({ response: { hits: [] } }));

      await mod.searchGeniusSong("test");
      const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer test_token");
    });
  });

  describe("missing credentials", () => {
    it("returns null when token is not configured", async () => {
      const mod = await loadModule();
      delete process.env.GENIUS_ACCESS_TOKEN;

      expect(await mod.searchGeniusSong("test")).toBeNull();
    });
  });
});
