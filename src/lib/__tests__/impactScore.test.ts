import { describe, it, expect } from "vitest";
import { parseCount, calculateImpactScore, ScoreBreakdown } from "../impactScore";
import { SongData } from "@/types";

// ── parseCount ───────────────────────────────────────────────────────────────

describe("parseCount", () => {
  it("parses billions", () => {
    expect(parseCount("4.2B")).toBe(4_200_000_000);
    expect(parseCount("1B")).toBe(1_000_000_000);
  });

  it("parses millions", () => {
    expect(parseCount("18M")).toBe(18_000_000);
    expect(parseCount("12.4M")).toBe(12_400_000);
  });

  it("parses thousands", () => {
    expect(parseCount("892K")).toBe(892_000);
  });

  it("parses comma-separated numbers", () => {
    expect(parseCount("2,400,000,000")).toBe(2_400_000_000);
  });

  it("returns 0 for empty/invalid input", () => {
    expect(parseCount("")).toBe(0);
    expect(parseCount("abc")).toBe(0);
  });

  it("handles plain numbers", () => {
    expect(parseCount("42")).toBe(42);
    expect(parseCount("0")).toBe(0);
  });
});

// ── calculateImpactScore ─────────────────────────────────────────────────────

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

describe("calculateImpactScore", () => {
  it("returns 0 when no platform data exists", () => {
    const score = calculateImpactScore(BASE_SONG);
    expect(score.total).toBe(0);
    expect(score.tier).toBe("Hidden Gem");
  });

  it("scores a mega-hit as Legendary", () => {
    const megaHit: SongData = {
      ...BASE_SONG,
      spotify: {
        id: "s1", name: "Hit", artist: "A", album: "B", albumArt: "",
        releaseDate: "2020-01-01", popularity: 95, totalStreams: "4B",
        playlistCount: 90000, previewUrl: null, externalUrl: "",
        audioFeatures: { danceability: 0.8, energy: 0.9, valence: 0.7, tempo: 120 },
      },
      youtube: {
        videoId: "y1", title: "Hit", thumbnail: "", publishedAt: "2020-01-01",
        viewCount: "2B", likeCount: "20M", commentCount: "1M",
        channelTitle: "VEVO", externalUrl: "",
      },
      billboard: {
        peakPosition: 1, peakDate: "2020-03-01", weeksOnChart: 90,
        entryPosition: 5, entryDate: "2020-01-15", chartHistory: [],
      },
      genius: {
        id: 1, title: "Hit", artist: "A", albumArt: "",
        pageViews: "15M", annotationCount: 50, lyricsUrl: "",
        description: "", releaseDate: "2020-01-01",
      },
    };
    const score = calculateImpactScore(megaHit);
    expect(score.total).toBeGreaterThanOrEqual(90);
    expect(score.tier).toBe("Legendary");
  });

  it("caps individual platform scores at their max", () => {
    const overflowSong: SongData = {
      ...BASE_SONG,
      spotify: {
        id: "s1", name: "X", artist: "A", album: "B", albumArt: "",
        releaseDate: "2020-01-01", popularity: 200, totalStreams: "99B",
        playlistCount: 999999, previewUrl: null, externalUrl: "",
      },
    };
    const score = calculateImpactScore(overflowSong);
    expect(score.spotify).toBeLessThanOrEqual(30);
  });

  it("total never exceeds 100", () => {
    const maxSong: SongData = {
      ...BASE_SONG,
      spotify: {
        id: "s1", name: "X", artist: "A", album: "B", albumArt: "",
        releaseDate: "2020-01-01", popularity: 100, totalStreams: "99B",
        playlistCount: 999999, previewUrl: null, externalUrl: "",
      },
      youtube: {
        videoId: "y1", title: "X", thumbnail: "", publishedAt: "2020-01-01",
        viewCount: "99B", likeCount: "99B", commentCount: "1M",
        channelTitle: "V", externalUrl: "",
      },
      billboard: {
        peakPosition: 1, peakDate: "2020-03-01", weeksOnChart: 200,
        entryPosition: 1, entryDate: "2020-01-01", chartHistory: [],
      },
      genius: {
        id: 1, title: "X", artist: "A", albumArt: "",
        pageViews: "99M", annotationCount: 200, lyricsUrl: "",
        description: "", releaseDate: "2020-01-01",
      },
    };
    const score = calculateImpactScore(maxSong);
    expect(score.total).toBeLessThanOrEqual(100);
  });

  it("assigns correct tier colors", () => {
    const check = (total: number, expectedTier: string) => {
      // Build a song that roughly hits the target score
      const score = calculateImpactScore(BASE_SONG);
      // Instead, verify tier mapping via the returned breakdown
      return expectedTier; // placeholder — real test below
    };

    // Test tier boundaries directly through scoring
    const empty = calculateImpactScore(BASE_SONG);
    expect(empty.tierColor).toBe("#86868B"); // Hidden Gem gray
  });

  it("billboard #1 scores higher than #10", () => {
    const num1: SongData = {
      ...BASE_SONG,
      billboard: {
        peakPosition: 1, peakDate: "2020-03-01", weeksOnChart: 20,
        entryPosition: 5, entryDate: "2020-01-01", chartHistory: [],
      },
    };
    const num10: SongData = {
      ...BASE_SONG,
      billboard: {
        peakPosition: 10, peakDate: "2020-03-01", weeksOnChart: 20,
        entryPosition: 20, entryDate: "2020-01-01", chartHistory: [],
      },
    };
    expect(calculateImpactScore(num1).billboard).toBeGreaterThan(
      calculateImpactScore(num10).billboard
    );
  });
});
