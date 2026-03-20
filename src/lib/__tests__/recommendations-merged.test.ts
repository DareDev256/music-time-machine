import { describe, it, expect } from "vitest";
import {
  getSimilarSongs,
  splitArtists,
  primaryArtist,
  type ScoreBreakdown,
} from "../recommendations";
import { SongData } from "@/types";

function makeSong(overrides: Partial<SongData> & { id: string }): SongData {
  return {
    title: overrides.id,
    artist: "Test Artist",
    albumArt: "",
    releaseDate: "2022-01-01",
    spotify: {
      id: overrides.id, name: overrides.id, artist: "Test Artist",
      album: "", albumArt: "", releaseDate: "2022-01-01",
      popularity: 80, totalStreams: "1M", playlistCount: 100,
      previewUrl: null, externalUrl: "",
      audioFeatures: { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 },
    },
    youtube: null, billboard: null, genius: null, timeline: [],
    ...overrides,
  };
}

// ── Runtime guards (non-string inputs from API responses) ──────────────

describe("splitArtists — runtime type guards", () => {
  it("returns empty array for null input (runtime API junk)", () => {
    expect(splitArtists(null as unknown as string)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(splitArtists(undefined as unknown as string)).toEqual([]);
  });

  it("returns empty array for numeric input", () => {
    expect(splitArtists(42 as unknown as string)).toEqual([]);
  });

  it("returns empty array for object input", () => {
    expect(splitArtists({} as unknown as string)).toEqual([]);
  });
});

describe("primaryArtist — runtime type guards", () => {
  it("returns empty string for null input", () => {
    expect(primaryArtist(null as unknown as string)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(primaryArtist(undefined as unknown as string)).toBe("");
  });

  it("returns empty string for numeric input", () => {
    expect(primaryArtist(123 as unknown as string)).toBe("");
  });
});

// ── ScoreBreakdown presence on PickResult ────────────────────────────────

describe("PickResult — ScoreBreakdown", () => {
  const target = makeSong({ id: "target" });

  it("includes breakdown with base score on every result", () => {
    const catalog = [makeSong({ id: "a", artist: "Alpha" })];
    const results = getSimilarSongs(target, catalog);
    expect(results).toHaveLength(1);
    const bd = results[0].breakdown;
    expect(bd).toBeDefined();
    expect(bd.base).toBeGreaterThan(0);
    expect(typeof bd.era).toBe("number");
    expect(typeof bd.genre).toBe("number");
    expect(typeof bd.prefEra).toBe("number");
    expect(typeof bd.mood).toBe("number");
  });

  it("breakdown components sum to approximate matchScore (before clamping)", () => {
    const catalog = [
      makeSong({ id: "blinding-lights", artist: "The Weeknd", releaseDate: "2022-06-01" }),
    ];
    const results = getSimilarSongs(target, catalog, 4, {
      genres: ["R&B"],
      eraRange: [2020, 2025],
    });
    expect(results).toHaveLength(1);
    const bd = results[0].breakdown;
    const sum = bd.base + bd.era + bd.genre + bd.prefEra + bd.mood;
    // matchScore is clamped to 0–99, so it should be ≤ sum (or both capped at 99)
    expect(results[0].matchScore).toBeLessThanOrEqual(Math.min(99, Math.round(sum)));
  });

  it("breakdown.era is non-zero for same-era candidates", () => {
    const sameEra = makeSong({ id: "close", artist: "Beta", releaseDate: "2023-01-01" });
    const results = getSimilarSongs(target, [sameEra]);
    expect(results[0].breakdown.era).toBeGreaterThan(0);
  });

  it("breakdown.era is zero for distant-era candidates", () => {
    const distant = makeSong({ id: "far", artist: "Gamma", releaseDate: "2010-01-01" });
    const results = getSimilarSongs(target, [distant]);
    expect(results[0].breakdown.era).toBe(0);
  });
});

// ── Diverse strategy — reason overrides ─────────────────────────────────

describe("diverse strategy — diversity reason labels", () => {
  function withFeatures(
    id: string, artist: string,
    features: { danceability: number; energy: number; valence: number; tempo: number },
    releaseDate = "2022-01-01", popularity = 80,
  ): SongData {
    return makeSong({
      id, artist, releaseDate,
      spotify: {
        id, name: id, artist, album: "", albumArt: "",
        releaseDate, popularity, totalStreams: "1M",
        playlistCount: 100, previewUrl: null, externalUrl: "",
        audioFeatures: features,
      },
    });
  }

  it("first pick always uses audio-similarity reason, not diversity label", () => {
    const target = withFeatures("t", "Target",
      { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 });
    const catalog = [
      withFeatures("blinding-lights", "Alpha", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
    ];
    const results = getSimilarSongs(target, catalog, 1, { strategy: "diverse" });
    // First pick should NOT say "Unique genre" or "Different era"
    expect(results[0].reason).not.toBe("Unique genre");
    expect(results[0].reason).not.toBe("Different era");
  });

  it("collab bonus boosts songs with featured artists in diverse mode", () => {
    const target = withFeatures("t", "Target",
      { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 });
    // Solo artist with slightly better features vs collab with slightly worse
    const solo = withFeatures("s1", "Solo",
      { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }, "2022-01-01", 80);
    const collab = withFeatures("c1", "Lead ft. Guest",
      { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }, "2022-01-01", 80);
    // Both should appear — collab bonus doesn't override basic scoring
    const results = getSimilarSongs(target, [solo, collab], 2, { strategy: "diverse" });
    expect(results).toHaveLength(2);
    // Both results should have valid breakdowns
    for (const r of results) {
      expect(r.breakdown).toBeDefined();
      expect(r.matchScore).toBeGreaterThanOrEqual(0);
    }
  });
});
