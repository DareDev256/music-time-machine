/**
 * Integration tests for the diversity filter pipeline.
 *
 * These tests verify that getSimilarSongs() and getDiversityMeta() compose
 * correctly end-to-end — specifically targeting the NaN-guard and artist
 * pre-seed fixes that were shipped without integration coverage.
 */
import { describe, it, expect } from "vitest";
import { getSimilarSongs, getDiversityMeta, safeYear } from "../recommendations";
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
  releaseDate = "2022-01-01",
): SongData {
  return makeSong({
    id,
    artist,
    releaseDate,
    spotify: {
      id, name: id, artist, album: "", albumArt: "",
      releaseDate, popularity: 80, totalStreams: "1M",
      playlistCount: 100, previewUrl: null, externalUrl: "",
      audioFeatures: features,
    },
  });
}

// ── Pipeline: NaN era contamination guards ─────────────────────────────

describe("Pipeline — NaN era contamination", () => {
  it("produces no NaN eras when pipeline processes mixed valid/invalid dates", () => {
    const target = withFeatures("t", "Target", { danceability: 0.6, energy: 0.6, valence: 0.6, tempo: 120 }, "2020-05-01");
    const catalog = [
      withFeatures("a", "Alpha", { danceability: 0.61, energy: 0.61, valence: 0.61, tempo: 121 }, "2019-03-15"),
      withFeatures("b", "Beta", { danceability: 0.59, energy: 0.59, valence: 0.59, tempo: 119 }, undefined as unknown as string),
      withFeatures("c", "Gamma", { danceability: 0.62, energy: 0.62, valence: 0.62, tempo: 122 }, "not-a-date"),
      withFeatures("d", "Delta", { danceability: 0.58, energy: 0.58, valence: 0.58, tempo: 118 }, "2015-01-01"),
    ];

    const similar = getSimilarSongs(target, catalog);
    const diversity = getDiversityMeta(target, similar);

    // Core assertion: no NaN pollution anywhere in the pipeline output
    expect(diversity.eras.every((e) => !e.includes("NaN"))).toBe(true);
    expect(Number.isNaN(diversity.score)).toBe(false);
    expect(diversity.score).toBeGreaterThanOrEqual(0);
    expect(diversity.score).toBeLessThanOrEqual(100);
  });

  it("calculates correct era spread when only target has a valid date", () => {
    const target = withFeatures("t", "Target", { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 100 }, "2023-01-01");
    const catalog = [
      withFeatures("a", "Alpha", { danceability: 0.51, energy: 0.51, valence: 0.51, tempo: 101 }, ""),
      withFeatures("b", "Beta", { danceability: 0.49, energy: 0.49, valence: 0.49, tempo: 99 }, undefined as unknown as string),
    ];

    const similar = getSimilarSongs(target, catalog);
    const diversity = getDiversityMeta(target, similar);

    // Only the target's era should be present — no NaN, no extra decades
    expect(diversity.eras).toEqual(["2020s"]);
  });

  it("handles whitespace-only release dates without NaN leakage", () => {
    const target = withFeatures("t", "Target", { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 }, "2022-01-01");
    const catalog = [
      withFeatures("a", "Alpha", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }, "   "),
      withFeatures("b", "Beta", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }, "2022-06-01"),
    ];

    const similar = getSimilarSongs(target, catalog);
    const diversity = getDiversityMeta(target, similar);

    expect(diversity.eras.every((e) => !e.includes("NaN"))).toBe(true);
    expect(diversity.score).toBeGreaterThanOrEqual(0);
  });

  it("skips era bonus safely when candidate dates are garbage", () => {
    const target = withFeatures("t", "Target", { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 }, "2022-01-01");
    const goodDate = withFeatures("g", "Good", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }, "2022-06-01");
    const badDate = withFeatures("b", "Bad", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }, "garbage");

    // Both have identical features — the one with a valid same-era date should rank higher
    const results = getSimilarSongs(target, [badDate, goodDate]);
    expect(results[0].song.id).toBe("g");
    expect(results[0].matchScore).toBeGreaterThan(results[1].matchScore);
  });
});

// ── Pipeline: Artist pre-seeding ───────────────────────────────────────

describe("Pipeline — artist pre-seed into diversity meta", () => {
  it("pre-seeded exclusions produce genuinely diverse artist recommendations", () => {
    const target = withFeatures("t", "Bruno Mars", { danceability: 0.8, energy: 0.8, valence: 0.8, tempo: 130 });
    const catalog = [
      withFeatures("collab1", "Lady Gaga & Bruno Mars", { danceability: 0.81, energy: 0.81, valence: 0.81, tempo: 131 }),
      withFeatures("collab2", "ROSÉ & Bruno Mars", { danceability: 0.79, energy: 0.79, valence: 0.79, tempo: 129 }),
      withFeatures("solo", "Bruno Mars", { danceability: 0.82, energy: 0.82, valence: 0.82, tempo: 132 }),
      withFeatures("diff1", "Adele", { danceability: 0.75, energy: 0.75, valence: 0.75, tempo: 125 }),
      withFeatures("diff2", "Drake", { danceability: 0.76, energy: 0.76, valence: 0.76, tempo: 126 }),
      withFeatures("diff3", "Rihanna", { danceability: 0.77, energy: 0.77, valence: 0.77, tempo: 127 }),
      withFeatures("diff4", "The Weeknd", { danceability: 0.74, energy: 0.74, valence: 0.74, tempo: 124 }),
    ];

    const similar = getSimilarSongs(target, catalog);
    const diversity = getDiversityMeta(target, similar);

    // No Bruno Mars songs should appear — pre-seed blocks solo + collabs
    const allArtists = similar.map((s) => s.song.artist.toLowerCase());
    expect(allArtists.every((a) => !a.includes("bruno mars"))).toBe(true);

    // Should have 4 unique artists from the different pool
    expect(similar).toHaveLength(4);
    expect(new Set(allArtists).size).toBe(4);

    // Diversity meta should reflect the genuinely different artists
    expect(diversity.score).toBeGreaterThanOrEqual(0);
    expect(diversity.label).not.toBe("No data");
  });

  it("collaboration target pre-seeds ALL credited artists", () => {
    const target = withFeatures("t", "DJ Khaled ft. Drake, Lil Wayne & Rick Ross",
      { danceability: 0.6, energy: 0.6, valence: 0.6, tempo: 100 });
    const catalog = [
      withFeatures("drake", "Drake", { danceability: 0.61, energy: 0.61, valence: 0.61, tempo: 101 }),
      withFeatures("wayne", "Lil Wayne", { danceability: 0.59, energy: 0.59, valence: 0.59, tempo: 99 }),
      withFeatures("ross", "Rick Ross", { danceability: 0.62, energy: 0.62, valence: 0.62, tempo: 102 }),
      withFeatures("khaled", "DJ Khaled", { danceability: 0.58, energy: 0.58, valence: 0.58, tempo: 98 }),
      withFeatures("clean1", "Kendrick Lamar", { danceability: 0.55, energy: 0.55, valence: 0.55, tempo: 95 }),
      withFeatures("clean2", "J. Cole", { danceability: 0.56, energy: 0.56, valence: 0.56, tempo: 96 }),
    ];

    const similar = getSimilarSongs(target, catalog);

    // ALL four credited artists should be pre-seeded and excluded
    const resultArtists = similar.map((s) => s.song.artist.toLowerCase());
    expect(resultArtists).not.toContain("drake");
    expect(resultArtists).not.toContain("lil wayne");
    expect(resultArtists).not.toContain("rick ross");
    expect(resultArtists).not.toContain("dj khaled");

    // Only the clean artists should appear
    expect(similar).toHaveLength(2);
    expect(resultArtists).toContain("kendrick lamar");
    expect(resultArtists).toContain("j. cole");
  });
});

// ── Pipeline: End-to-end diversity indicator ───────────────────────────

describe("Pipeline — visual diversity indicator end-to-end", () => {
  it("produces all required fields for the UI diversity badge", () => {
    const target = withFeatures("t", "Target", { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 }, "2022-01-01");
    const catalog = [
      withFeatures("a", "Alpha", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }, "2015-06-01"),
      withFeatures("b", "Beta", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }, "2023-03-01"),
      withFeatures("c", "Gamma", { danceability: 0.72, energy: 0.72, valence: 0.72, tempo: 122 }, "2008-11-15"),
      withFeatures("d", "Delta", { danceability: 0.68, energy: 0.68, valence: 0.68, tempo: 118 }, "2022-07-01"),
    ];

    const similar = getSimilarSongs(target, catalog);
    const diversity = getDiversityMeta(target, similar);

    // UI contract: all fields present and typed correctly
    expect(typeof diversity.score).toBe("number");
    expect(typeof diversity.label).toBe("string");
    expect(Array.isArray(diversity.genres)).toBe(true);
    expect(Array.isArray(diversity.eras)).toBe(true);
    expect(["Wide mix", "Good variety", "Similar vibe", "Narrow focus", "No data"]).toContain(diversity.label);

    // Eras should be sorted and span multiple decades
    expect(diversity.eras).toEqual([...diversity.eras].sort());
    expect(diversity.eras.length).toBeGreaterThan(1);
  });

  it("matchScores are integers in 0-99 range across entire pipeline", () => {
    const target = withFeatures("t", "Target", { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 100 }, "2020-01-01");
    const catalog = Array.from({ length: 20 }, (_, i) =>
      withFeatures(
        `s${i}`, `Artist ${i}`,
        { danceability: 0.1 + (i * 0.04), energy: 0.1 + (i * 0.04), valence: 0.1 + (i * 0.04), tempo: 60 + i * 7 },
        `${2005 + i}-06-15`,
      ),
    );

    const similar = getSimilarSongs(target, catalog, 4);

    for (const pick of similar) {
      expect(Number.isInteger(pick.matchScore)).toBe(true);
      expect(pick.matchScore).toBeGreaterThanOrEqual(0);
      expect(pick.matchScore).toBeLessThanOrEqual(99);
      expect(Number.isNaN(pick.matchScore)).toBe(false);
    }

    // Diversity meta from these picks should also be clean
    const diversity = getDiversityMeta(target, similar);
    expect(Number.isNaN(diversity.score)).toBe(false);
  });

  it("empty recommendation set produces safe diversity meta for UI", () => {
    // Target with no audio features → empty similar → getDiversityMeta gets []
    const target = makeSong({ id: "t", spotify: null });
    const catalog = [makeSong({ id: "a", artist: "Other" })];
    const similar = getSimilarSongs(target, catalog);
    const diversity = getDiversityMeta(target, similar);

    expect(similar).toEqual([]);
    expect(diversity.score).toBe(0);
    expect(diversity.label).toBe("No data");
    expect(diversity.genres).toEqual([]);
    expect(diversity.eras).toEqual([]);
  });

  it("all-same-artist catalog produces empty results with safe diversity", () => {
    const target = withFeatures("t", "Taylor Swift", { danceability: 0.6, energy: 0.6, valence: 0.6, tempo: 110 });
    const catalog = Array.from({ length: 5 }, (_, i) =>
      withFeatures(`ts${i}`, "Taylor Swift", { danceability: 0.6 + i * 0.01, energy: 0.6, valence: 0.6, tempo: 110 }),
    );

    const similar = getSimilarSongs(target, catalog);
    const diversity = getDiversityMeta(target, similar);

    // Pre-seed blocks all Taylor Swift songs → empty results
    expect(similar).toHaveLength(0);
    expect(diversity.score).toBe(0);
    expect(diversity.label).toBe("No data");
  });
});
