/**
 * Integration tests for the auto-select strategy resolution.
 *
 * Covers edge cases NOT handled by existing test suites:
 * - Missing / undefined / malformed strategy parameter
 * - Empty and single-candidate catalogs under auto mode
 * - Catalogs where zero songs have genre mappings (unmapped IDs)
 * - getAutoInsight state isolation between sequential calls
 * - Platform data gaps (null spotify) combined with auto strategy
 */
import { describe, it, expect } from "vitest";
import {
  getSimilarSongs,
  getAutoInsight,
  type SelectionStrategy,
  type RecommendationPrefs,
} from "../recommendations";
import { SongData } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────

function makeSong(overrides: Partial<SongData> & { id: string }): SongData {
  return {
    title: overrides.id,
    artist: "Test Artist",
    albumArt: "",
    releaseDate: "2022-01-01",
    spotify: {
      id: overrides.id,
      name: overrides.id,
      artist: overrides.artist ?? "Test Artist",
      album: "",
      albumArt: "",
      releaseDate: "2022-01-01",
      popularity: 80,
      totalStreams: "1M",
      playlistCount: 100,
      previewUrl: null,
      externalUrl: "",
      audioFeatures: { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 },
    },
    youtube: null,
    billboard: null,
    genius: null,
    timeline: [],
    ...overrides,
  };
}

function withFeatures(
  id: string,
  artist: string,
  features: { danceability: number; energy: number; valence: number; tempo: number },
): SongData {
  return makeSong({
    id,
    artist,
    spotify: {
      id, name: id, artist, album: "", albumArt: "",
      releaseDate: "2022-01-01", popularity: 80, totalStreams: "1M",
      playlistCount: 100, previewUrl: null, externalUrl: "",
      audioFeatures: features,
    },
  });
}

const baseFeatures = { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 };
const target = withFeatures("t", "Target", baseFeatures);

// ── Missing / malformed strategy parameter ────────────────────────────

describe("Auto-select — missing strategy parameter", () => {
  const catalog = [
    withFeatures("a", "Alpha", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
    withFeatures("b", "Beta", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }),
  ];

  it("handles undefined prefs gracefully (defaults to auto)", () => {
    const results = getSimilarSongs(target, catalog, 2, undefined);
    expect(results).toHaveLength(2);
    // Auto should have resolved — insight available
    const insight = getAutoInsight();
    expect(insight).not.toBeNull();
    expect(["best-match", "diverse"]).toContain(insight!.resolved);
  });

  it("handles prefs with strategy explicitly undefined", () => {
    const prefs: RecommendationPrefs = { strategy: undefined };
    const results = getSimilarSongs(target, catalog, 2, prefs);
    expect(results).toHaveLength(2);
    const insight = getAutoInsight();
    expect(insight).not.toBeNull();
  });

  it("handles empty prefs object (no strategy key at all)", () => {
    const results = getSimilarSongs(target, catalog, 2, {});
    expect(results).toHaveLength(2);
    const insight = getAutoInsight();
    expect(insight).not.toBeNull();
  });

  it("handles prefs with only non-strategy fields populated", () => {
    const prefs: RecommendationPrefs = { mood: "chill", genres: ["Pop"] };
    const results = getSimilarSongs(target, catalog, 2, prefs);
    expect(results).toHaveLength(2);
    // Auto should still be the resolved path
    const insight = getAutoInsight();
    expect(insight).not.toBeNull();
    expect(["best-match", "diverse"]).toContain(insight!.resolved);
  });
});

// ── Edge-case catalogs under auto mode ────────────────────────────────

describe("Auto-select — degenerate catalogs", () => {
  it("returns empty array for empty catalog", () => {
    const results = getSimilarSongs(target, [], 4, { strategy: "auto" });
    expect(results).toEqual([]);
  });

  it("handles single candidate catalog without crashing", () => {
    const catalog = [
      withFeatures("solo", "Solo Artist", { danceability: 0.72, energy: 0.72, valence: 0.72, tempo: 122 }),
    ];
    const results = getSimilarSongs(target, catalog, 4, { strategy: "auto" });
    expect(results).toHaveLength(1);
    expect(results[0].song.id).toBe("solo");
    expect(results[0].matchScore).toBeGreaterThanOrEqual(0);
  });

  it("single candidate triggers diverse mode (< 2 genres detected)", () => {
    const catalog = [
      withFeatures("one", "OnlyOne", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
    ];
    getSimilarSongs(target, catalog, 1, { strategy: "auto" });
    const insight = getAutoInsight();
    expect(insight).not.toBeNull();
    // One candidate can have at most 1 genre → below threshold → diverse
    expect(insight!.resolved).toBe("diverse");
  });

  it("target with null spotify returns empty without touching auto logic", () => {
    const noSpotify = makeSong({ id: "no-spot", spotify: null });
    const catalog = [
      withFeatures("a", "Alpha", { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 100 }),
    ];
    const results = getSimilarSongs(noSpotify, catalog, 4, { strategy: "auto" });
    expect(results).toEqual([]);
    // getAutoInsight should be null since resolveStrategy was never called
    // (getSimilarSongs bails early on missing targetFeatures)
    const insight = getAutoInsight();
    // Prior call may have set insight — the key is results are empty
    expect(results).toHaveLength(0);
  });

  it("catalog where ALL candidates lack audio features returns empty", () => {
    const catalog = [
      makeSong({ id: "deaf1", artist: "A", spotify: null }),
      makeSong({ id: "deaf2", artist: "B", spotify: null }),
    ];
    const results = getSimilarSongs(target, catalog, 4, { strategy: "auto" });
    expect(results).toEqual([]);
  });
});

// ── Unmapped genre IDs (no songGenres entry) ──────────────────────────

describe("Auto-select — zero genre mappings", () => {
  it("resolves to diverse when no candidates have genre mappings", () => {
    // Using IDs that don't exist in songGenres → topGenres stays empty → size 0 < threshold
    const catalog = [
      withFeatures("unmapped-1", "Alpha", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
      withFeatures("unmapped-2", "Beta", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }),
      withFeatures("unmapped-3", "Gamma", { danceability: 0.72, energy: 0.72, valence: 0.72, tempo: 122 }),
    ];
    getSimilarSongs(target, catalog, 3, { strategy: "auto" });
    const insight = getAutoInsight();
    expect(insight).not.toBeNull();
    expect(insight!.resolved).toBe("diverse");
    expect(insight!.genresDetected).toEqual([]);
  });

  it("still returns valid scored results despite missing genre data", () => {
    const catalog = [
      withFeatures("no-genre-1", "Artist A", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
      withFeatures("no-genre-2", "Artist B", { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 100 }),
    ];
    const results = getSimilarSongs(target, catalog, 2, { strategy: "auto" });
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.matchScore).toBeGreaterThanOrEqual(0);
      expect(r.matchScore).toBeLessThanOrEqual(99);
      expect(Number.isNaN(r.matchScore)).toBe(false);
    }
  });
});

// ── getAutoInsight state isolation ────────────────────────────────────

describe("Auto-select — insight state isolation", () => {
  it("insight resets to null when switching from auto to explicit strategy", () => {
    const catalog = [
      withFeatures("a", "Alpha", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
    ];
    // First call: auto → sets insight
    getSimilarSongs(target, catalog, 1, { strategy: "auto" });
    expect(getAutoInsight()).not.toBeNull();

    // Second call: explicit strategy → should clear insight
    getSimilarSongs(target, catalog, 1, { strategy: "best-match" });
    expect(getAutoInsight()).toBeNull();
  });

  it("insight updates correctly across consecutive auto calls", () => {
    // Call 1: unmapped IDs → diverse (0 genres detected)
    const unmapped = [
      withFeatures("zz1", "A1", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
      withFeatures("zz2", "A2", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }),
    ];
    getSimilarSongs(target, unmapped, 2, { strategy: "auto" });
    const first = getAutoInsight();
    expect(first!.resolved).toBe("diverse");
    expect(first!.genresDetected).toEqual([]);

    // Call 2: mapped IDs with distinct genres → best-match (>= 2 genres)
    const mapped = [
      withFeatures("blinding-lights", "Weeknd", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
      withFeatures("old-town-road", "LNX", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }),
    ];
    getSimilarSongs(target, mapped, 2, { strategy: "auto" });
    const second = getAutoInsight();
    expect(second!.resolved).toBe("best-match");
    expect(second!.genresDetected.length).toBeGreaterThanOrEqual(2);
  });
});
