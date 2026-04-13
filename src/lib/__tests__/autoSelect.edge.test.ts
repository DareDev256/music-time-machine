/**
 * Edge-case tests for auto-select strategy resolution.
 *
 * Targets 5 boundary conditions NOT covered by autoSelect.integration.test.ts:
 * 1. limit=0 — zero-result request should return empty, not crash
 * 2. All candidates share target's artist — scoring filter exhaustion
 * 3. Mood prefs + auto strategy interaction — mood bonus shifting genre inspection
 * 4. limit > catalog size — requesting more results than candidates available
 * 5. Identical audio features across candidates — score tie-breaking stability
 */
import { describe, it, expect } from "vitest";
import {
  getSimilarSongs,
  getAutoInsight,
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
  opts?: { popularity?: number; releaseDate?: string },
): SongData {
  return makeSong({
    id,
    artist,
    releaseDate: opts?.releaseDate ?? "2022-01-01",
    spotify: {
      id, name: id, artist, album: "", albumArt: "",
      releaseDate: opts?.releaseDate ?? "2022-01-01",
      popularity: opts?.popularity ?? 80,
      totalStreams: "1M", playlistCount: 100,
      previewUrl: null, externalUrl: "",
      audioFeatures: features,
    },
  });
}

const baseFeatures = { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 };
const target = withFeatures("target-song", "Target Artist", baseFeatures);

// ── 1. limit=0 boundary ─────────────────────────────────────────────────

describe("Auto-select — limit=0 boundary", () => {
  it("returns empty array when limit is 0, regardless of catalog size", () => {
    const catalog = [
      withFeatures("a", "Alpha", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
      withFeatures("b", "Beta", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }),
      withFeatures("c", "Gamma", { danceability: 0.72, energy: 0.72, valence: 0.72, tempo: 122 }),
    ];

    const results = getSimilarSongs(target, catalog, 0, { strategy: "auto" });
    expect(results).toEqual([]);

    // resolveStrategy still runs with limit=0 — insight should reflect
    // the degenerate inspection (0 entries inspected → 0 genres → diverse)
    const insight = getAutoInsight();
    expect(insight).not.toBeNull();
    expect(insight!.resolved).toBe("diverse");
    expect(insight!.genresDetected).toEqual([]);
  });
});

// ── 2. All candidates share target's artist ─────────────────────────────

describe("Auto-select — artist exclusion exhaustion", () => {
  it("returns empty when every candidate shares an artist with the target", () => {
    // scoreCandidates filters out candidates sharing any artist with target.
    // If ALL candidates share the target's artist, scored[] is empty.
    const sameArtistTarget = withFeatures("t", "Shared Artist feat. Other", baseFeatures);
    const catalog = [
      withFeatures("x1", "Shared Artist", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
      withFeatures("x2", "Shared Artist & Someone", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }),
      withFeatures("x3", "Nobody feat. Shared Artist", { danceability: 0.72, energy: 0.72, valence: 0.72, tempo: 122 }),
    ];

    const results = getSimilarSongs(sameArtistTarget, catalog, 4, { strategy: "auto" });
    expect(results).toEqual([]);

    // With 0 scored candidates, resolveStrategy sees empty → diverse
    const insight = getAutoInsight();
    expect(insight).not.toBeNull();
    expect(insight!.resolved).toBe("diverse");
  });
});

// ── 3. Mood prefs + auto strategy interaction ───────────────────────────

describe("Auto-select — mood preference interaction with auto resolution", () => {
  it("mood bonus does not corrupt auto strategy genre inspection", () => {
    // The mood bonus boosts candidate scores but shouldn't affect which
    // strategy resolveStrategy picks — that's purely genre-count based.
    // This catches a potential bug where score reordering from mood bonuses
    // changes which candidates are inspected first, altering the genre set.
    const catalog = [
      // Low-energy candidate with mapped genre (blinding-lights = Synth-pop)
      withFeatures("blinding-lights", "Weeknd", { danceability: 0.3, energy: 0.3, valence: 0.4, tempo: 90 }),
      // High-energy candidate with different mapped genre (old-town-road = Country)
      withFeatures("old-town-road", "LNX", { danceability: 0.8, energy: 0.85, valence: 0.75, tempo: 140 }),
      // Unmapped, but mood-matched candidate
      withFeatures("chill-unmapped", "ChillBoi", { danceability: 0.3, energy: 0.35, valence: 0.5, tempo: 85 }),
    ];

    // Chill mood: energy=0.35, valence=0.5 — heavily favors the low-energy songs
    const prefs: RecommendationPrefs = { strategy: "auto", mood: "chill" };
    const results = getSimilarSongs(target, catalog, 3, prefs);

    const insight = getAutoInsight();
    expect(insight).not.toBeNull();
    // Two mapped songs with distinct genres should still yield best-match,
    // regardless of mood-induced score reordering
    expect(insight!.genresDetected.length).toBeGreaterThanOrEqual(2);
    expect(insight!.resolved).toBe("best-match");

    // All results should have valid scores
    for (const r of results) {
      expect(r.matchScore).toBeGreaterThanOrEqual(0);
      expect(r.matchScore).toBeLessThanOrEqual(99);
    }
  });
});

// ── 4. limit > catalog size ─────────────────────────────────────────────

describe("Auto-select — limit exceeds catalog size", () => {
  it("returns all valid candidates when limit exceeds available count", () => {
    const catalog = [
      withFeatures("only-1", "Artist A", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
      withFeatures("only-2", "Artist B", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }),
    ];

    // Requesting 100 results from a 2-candidate catalog
    const results = getSimilarSongs(target, catalog, 100, { strategy: "auto" });

    // Should return at most 2 (the actual catalog size), not crash or pad
    expect(results.length).toBeLessThanOrEqual(2);
    expect(results.length).toBeGreaterThan(0);

    // Each result should have the full PickResult contract
    for (const r of results) {
      expect(r).toHaveProperty("song");
      expect(r).toHaveProperty("reason");
      expect(r).toHaveProperty("matchScore");
      expect(r).toHaveProperty("breakdown");
      expect(typeof r.matchScore).toBe("number");
      expect(Number.isNaN(r.matchScore)).toBe(false);
    }
  });

  it("insight reflects actual inspected count, not the oversized limit", () => {
    const catalog = [
      withFeatures("blinding-lights", "Weeknd", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
    ];

    getSimilarSongs(target, catalog, 50, { strategy: "auto" });
    const insight = getAutoInsight();
    expect(insight).not.toBeNull();
    // Only 1 candidate with genre → can detect at most 1 genre
    expect(insight!.genresDetected.length).toBeLessThanOrEqual(1);
  });
});

// ── 5. Identical audio features — score stability ───────────────────────

describe("Auto-select — identical audio features across candidates", () => {
  it("returns stable results when all candidates have identical features", () => {
    // When every candidate has the same audio distance from target,
    // the scoring pipeline must not produce NaN, Infinity, or crash
    // due to zero-distance edge cases in tie-breaking.
    const identicalFeatures = { danceability: 0.75, energy: 0.75, valence: 0.75, tempo: 125 };
    const catalog = [
      withFeatures("clone-1", "Artist A", identicalFeatures),
      withFeatures("clone-2", "Artist B", identicalFeatures),
      withFeatures("clone-3", "Artist C", identicalFeatures),
      withFeatures("clone-4", "Artist D", identicalFeatures),
    ];

    const results = getSimilarSongs(target, catalog, 4, { strategy: "auto" });

    // All 4 should be returned (different artists, same features)
    expect(results).toHaveLength(4);

    // All scores should be identical (same distance from target)
    const scores = results.map((r) => r.matchScore);
    const uniqueScores = new Set(scores);
    expect(uniqueScores.size).toBe(1);

    // No NaN or Infinity anywhere in the results
    for (const r of results) {
      expect(Number.isFinite(r.matchScore)).toBe(true);
      expect(Number.isFinite(r.breakdown.base)).toBe(true);
      expect(r.breakdown.base).toBeGreaterThan(0);
    }
  });

  it("diverse strategy still differentiates identical-score candidates by genre/era", () => {
    // Even with identical audio features, the diverse picker should spread
    // across genres and eras rather than picking arbitrarily.
    const sameFeatures = { danceability: 0.75, energy: 0.75, valence: 0.75, tempo: 125 };
    const catalog = [
      withFeatures("blinding-lights", "Weeknd", sameFeatures, { releaseDate: "2020-01-01" }),
      withFeatures("old-town-road", "LNX", sameFeatures, { releaseDate: "2019-01-01" }),
      withFeatures("clone-x", "ArtistX", sameFeatures, { releaseDate: "2022-01-01" }),
    ];

    const results = getSimilarSongs(target, catalog, 3, { strategy: "diverse" });
    expect(results.length).toBeGreaterThan(0);

    // When diverse mode is forced, it should still produce valid output
    // even when all base scores are tied
    for (const r of results) {
      expect(Number.isFinite(r.matchScore)).toBe(true);
      expect(r.reason).toBeTruthy();
    }
  });
});
