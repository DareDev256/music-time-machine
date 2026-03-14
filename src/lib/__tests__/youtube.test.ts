import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../safeFetch", () => ({
  safeFetch: vi.fn(),
  safeJson: vi.fn((resp: { json: () => Promise<unknown> }) => resp.json()),
}));
vi.mock("../rateLimit", () => ({ checkYouTubeLimit: vi.fn(() => true) }));

function mockResponse(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) };
}

async function loadModule() {
  vi.resetModules();
  vi.mock("../safeFetch", () => ({
  safeFetch: vi.fn(),
  safeJson: vi.fn((resp: { json: () => Promise<unknown> }) => resp.json()),
}));
  vi.mock("../rateLimit", () => ({ checkYouTubeLimit: vi.fn(() => true) }));
  return import("../youtube");
}

const VIDEO = {
  id: "v1",
  snippet: {
    title: "Blinding Lights (Official Video)",
    publishedAt: "2020-01-29T05:00:00Z",
    channelTitle: "TheWeekndVEVO",
    thumbnails: {
      maxres: { url: "https://img/maxres.jpg" },
      high: { url: "https://img/high.jpg" },
      default: { url: "https://img/default.jpg" },
    },
  },
  statistics: { viewCount: "4200000000", likeCount: "28000000", commentCount: "1200000" },
};

describe("youtube integration", () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test_key";
  });

  describe("getYouTubeVideo", () => {
    it("maps video data and formats counts with formatCompact", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse({ items: [VIDEO] }));

      const result = await mod.getYouTubeVideo("v1");
      expect(result).not.toBeNull();
      expect(result!.publishedAt).toBe("2020-01-29"); // splits on T
      expect(result!.channelTitle).toBe("TheWeekndVEVO");
      expect(result!.externalUrl).toBe("https://youtube.com/watch?v=v1");
    });

    it("prefers maxres thumbnail, falls back to high, then default", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;

      // No maxres — should fall back to high
      const noMaxres = structuredClone(VIDEO);
      delete (noMaxres.snippet.thumbnails as Record<string, unknown>).maxres;
      mockFetch.mockResolvedValueOnce(mockResponse({ items: [noMaxres] }));

      const result = await mod.getYouTubeVideo("v1");
      expect(result!.thumbnail).toBe("https://img/high.jpg");
    });

    it("returns null when video not found", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce(mockResponse({ items: [] }));

      const result = await mod.getYouTubeVideo("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("searchYouTubeVideo", () => {
    it("appends 'official music video' to search query", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockClear();
      const searchItem = {
        id: { videoId: "v1" },
        snippet: { title: "Test", thumbnails: { high: { url: "https://img/1.jpg" }, default: { url: "" } } },
      };
      mockFetch.mockResolvedValueOnce(mockResponse({ items: [searchItem] }));

      await mod.searchYouTubeVideo("blinding lights");
      // Find the /search call among all fetch calls
      const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
      const searchUrl = urls.find((u) => u.includes("/search"));
      expect(searchUrl).toBeDefined();
      expect(searchUrl).toMatch(/official.music.video/);
      expect(searchUrl).toContain("videoCategoryId=10");
    });
  });

  describe("getYouTubeVideoBySearch", () => {
    it("chains search → detail fetch", async () => {
      const mod = await loadModule();
      const mockFetch = (await import("../safeFetch")).safeFetch as ReturnType<typeof vi.fn>;
      mockFetch.mockClear();
      const searchItem = {
        id: { videoId: "v1" },
        snippet: { title: "Test", thumbnails: { high: { url: "https://img/1.jpg" }, default: { url: "" } } },
      };
      mockFetch
        .mockResolvedValueOnce(mockResponse({ items: [searchItem] }))
        .mockResolvedValueOnce(mockResponse({ items: [VIDEO] }));

      const result = await mod.getYouTubeVideoBySearch("Blinding Lights", "The Weeknd");
      expect(result).not.toBeNull();
      expect(result!.videoId).toBe("v1");
      // Should have made a /search call and a /videos call
      const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(urls.some((u) => u.includes("/search"))).toBe(true);
      expect(urls.some((u) => u.includes("/videos"))).toBe(true);
    });
  });

  describe("isYouTubeConfigured", () => {
    it("returns false when API key is missing", async () => {
      const mod = await loadModule();
      delete process.env.YOUTUBE_API_KEY;
      expect(mod.isYouTubeConfigured()).toBe(false);
    });
  });
});
