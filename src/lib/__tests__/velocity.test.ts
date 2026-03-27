import { describe, it, expect, vi, afterEach } from "vitest";
import { calculateVelocity, TIER_META, VelocityTier } from "../velocity";
import { SongData } from "@/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_SONG: SongData = {
  id: "test",
  title: "Test Song",
  artist: "Test Artist",
  albumArt: "https://example.com/art.jpg",
  releaseDate: "2020-01-01",
  spotify: null,
  youtube: null,
  billboard: null,
  genius: null,
  timeline: [],
};

function songWith(overrides: Partial<SongData>): SongData {
  return { ...BASE_SONG, ...overrides };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── calculateVelocity ─────────────────────────────────────────────────────────

describe("calculateVelocity", () => {
  // ── Day calculation ───────────────────────────────────────────────

  it("calculates days since release from releaseDate", () => {
    // Pin Date.now so the test is deterministic
    const now = new Date("2025-01-01T00:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const song = songWith({ releaseDate: "2024-01-01" });
    const result = calculateVelocity(song);

    // 366 days (2024 is a leap year)
    expect(result.daysSinceRelease).toBe(366);
  });

  it("floors to at least 1 day for same-day releases", () => {
    const now = new Date("2025-06-15T12:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const song = songWith({ releaseDate: "2025-06-15" });
    const result = calculateVelocity(song);

    expect(result.daysSinceRelease).toBeGreaterThanOrEqual(1);
  });

  it("falls back to 365 days for invalid releaseDate", () => {
    const song = songWith({ releaseDate: "not-a-date" });
    const result = calculateVelocity(song);

    expect(result.daysSinceRelease).toBe(365);
  });

  it("falls back to 365 days for empty releaseDate", () => {
    const song = songWith({ releaseDate: "" });
    const result = calculateVelocity(song);

    expect(result.daysSinceRelease).toBe(365);
  });

  // ── Null platform handling ────────────────────────────────────────

  it("returns zero velocity when all platforms are null", () => {
    const result = calculateVelocity(BASE_SONG);

    expect(result.dailyStreams).toBe(0);
    expect(result.dailyViews).toBe(0);
    expect(result.combinedDaily).toBe(0);
    expect(result.weeksOnChart).toBe(0);
  });

  it("handles missing spotify gracefully", () => {
    const song = songWith({
      spotify: null,
      youtube: {
        videoId: "y1", title: "T", thumbnail: "", publishedAt: "",
        viewCount: "1B", likeCount: "1M", commentCount: "100K",
        channelTitle: "V", externalUrl: "",
      },
    });
    const result = calculateVelocity(song);

    expect(result.dailyStreams).toBe(0);
    expect(result.dailyViews).toBeGreaterThan(0);
  });

  it("handles missing youtube gracefully", () => {
    const song = songWith({
      youtube: null,
      spotify: {
        id: "s1", name: "T", artist: "A", album: "B", albumArt: "",
        releaseDate: "2020-01-01", popularity: 80, totalStreams: "1B",
        playlistCount: 5000, previewUrl: null, externalUrl: "",
      },
    });
    const result = calculateVelocity(song);

    expect(result.dailyViews).toBe(0);
    expect(result.dailyStreams).toBeGreaterThan(0);
  });

  // ── Daily rate arithmetic ─────────────────────────────────────────

  it("computes correct daily streams: total / days", () => {
    const now = new Date("2025-01-01T00:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const song = songWith({
      releaseDate: "2024-01-01", // 366 days (leap year)
      spotify: {
        id: "s1", name: "T", artist: "A", album: "B", albumArt: "",
        releaseDate: "2024-01-01", popularity: 50, totalStreams: "366M",
        playlistCount: 1000, previewUrl: null, externalUrl: "",
      },
    });
    const result = calculateVelocity(song);

    // 366,000,000 / 366 = 1,000,000
    expect(result.dailyStreams).toBe(1_000_000);
  });

  it("combinedDaily equals dailyStreams + dailyViews", () => {
    const now = new Date("2025-01-01T00:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const song = songWith({
      releaseDate: "2024-01-01",
      spotify: {
        id: "s1", name: "T", artist: "A", album: "B", albumArt: "",
        releaseDate: "2024-01-01", popularity: 50, totalStreams: "366M",
        playlistCount: 1000, previewUrl: null, externalUrl: "",
      },
      youtube: {
        videoId: "y1", title: "T", thumbnail: "", publishedAt: "",
        viewCount: "732M", likeCount: "1M", commentCount: "100K",
        channelTitle: "V", externalUrl: "",
      },
    });
    const result = calculateVelocity(song);

    expect(result.combinedDaily).toBe(result.dailyStreams + result.dailyViews);
  });

  // ── Billboard passthrough ─────────────────────────────────────────

  it("passes billboard weeksOnChart through directly", () => {
    const song = songWith({
      billboard: {
        peakPosition: 3, peakDate: "2020-03-01", weeksOnChart: 42,
        entryPosition: 15, entryDate: "2020-01-01", chartHistory: [],
      },
    });
    const result = calculateVelocity(song);

    expect(result.weeksOnChart).toBe(42);
  });

  it("defaults weeksOnChart to 0 when billboard is null", () => {
    const result = calculateVelocity(BASE_SONG);
    expect(result.weeksOnChart).toBe(0);
  });

  // ── Tier classification ───────────────────────────────────────────

  it("classifies 2M+ combined daily as viral", () => {
    const now = new Date("2024-01-02T00:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    // 1 day old song with 3M total = 3M/day
    const song = songWith({
      releaseDate: "2024-01-01",
      spotify: {
        id: "s1", name: "T", artist: "A", album: "B", albumArt: "",
        releaseDate: "2024-01-01", popularity: 99, totalStreams: "3M",
        playlistCount: 50000, previewUrl: null, externalUrl: "",
      },
    });
    const result = calculateVelocity(song);

    expect(result.tier).toBe("viral");
  });

  it("classifies 500K–2M combined daily as hot", () => {
    const now = new Date("2024-01-02T00:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const song = songWith({
      releaseDate: "2024-01-01",
      spotify: {
        id: "s1", name: "T", artist: "A", album: "B", albumArt: "",
        releaseDate: "2024-01-01", popularity: 80, totalStreams: "800K",
        playlistCount: 10000, previewUrl: null, externalUrl: "",
      },
    });
    const result = calculateVelocity(song);

    expect(result.tier).toBe("hot");
  });

  it("classifies 100K–500K combined daily as steady", () => {
    const now = new Date("2024-01-02T00:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const song = songWith({
      releaseDate: "2024-01-01",
      spotify: {
        id: "s1", name: "T", artist: "A", album: "B", albumArt: "",
        releaseDate: "2024-01-01", popularity: 60, totalStreams: "200K",
        playlistCount: 2000, previewUrl: null, externalUrl: "",
      },
    });
    const result = calculateVelocity(song);

    expect(result.tier).toBe("steady");
  });

  it("classifies < 100K combined daily as catalogue", () => {
    const result = calculateVelocity(BASE_SONG);
    expect(result.tier).toBe("catalogue");
  });

  // ── Tier boundary precision ───────────────────────────────────────

  it("exactly 2M combined daily is viral (not hot)", () => {
    const now = new Date("2024-01-02T00:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const song = songWith({
      releaseDate: "2024-01-01",
      spotify: {
        id: "s1", name: "T", artist: "A", album: "B", albumArt: "",
        releaseDate: "2024-01-01", popularity: 50, totalStreams: "2M",
        playlistCount: 1000, previewUrl: null, externalUrl: "",
      },
    });
    const result = calculateVelocity(song);

    expect(result.tier).toBe("viral");
  });
});

// ── TIER_META ─────────────────────────────────────────────────────────────────

describe("TIER_META", () => {
  it("has metadata for all four tiers", () => {
    const tiers: VelocityTier[] = ["viral", "hot", "steady", "catalogue"];
    for (const tier of tiers) {
      expect(TIER_META[tier]).toBeDefined();
      expect(TIER_META[tier].label).toBeTruthy();
      expect(TIER_META[tier].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(TIER_META[tier].glow).toMatch(/^rgba\(/);
    }
  });

  it("label matches capitalized tier name", () => {
    expect(TIER_META.viral.label).toBe("Viral");
    expect(TIER_META.hot.label).toBe("Hot");
    expect(TIER_META.steady.label).toBe("Steady");
    expect(TIER_META.catalogue.label).toBe("Catalogue");
  });
});
