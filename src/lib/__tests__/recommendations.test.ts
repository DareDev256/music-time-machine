import { describe, it, expect } from "vitest";
import { getSimilarSongs, getDiversityMeta, primaryArtist, splitArtists, safeYear, getAutoInsight } from "../recommendations";
import { SongData } from "@/types";

// Minimal factory — only fields the algorithm actually reads
function makeSong(overrides: Partial<SongData> & { id: string }): SongData {
  return {
    title: overrides.id,
    artist: "Test Artist",
    albumArt: "",
    releaseDate: "2022-01-01",
    spotify: {
      id: overrides.id,
      name: overrides.id,
      artist: "Test Artist",
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

describe("getSimilarSongs", () => {
  const target = makeSong({ id: "target" });

  it("returns empty array when target has no audio features", () => {
    const noFeatures = makeSong({ id: "target", spotify: null });
    const catalog = [makeSong({ id: "a" }), makeSong({ id: "b" })];
    expect(getSimilarSongs(noFeatures, catalog)).toEqual([]);
  });

  it("excludes the target song from results", () => {
    const catalog = [target, makeSong({ id: "other" })];
    const results = getSimilarSongs(target, catalog);
    expect(results.every((r) => r.song.id !== "target")).toBe(true);
  });

  it("skips candidates without audio features", () => {
    const noFeatures = makeSong({ id: "silent", spotify: null });
    const catalog = [noFeatures, makeSong({ id: "valid", artist: "Other Artist" })];
    const results = getSimilarSongs(target, catalog);
    expect(results).toHaveLength(1);
    expect(results[0].song.id).toBe("valid");
  });

  it("ranks sonically identical songs highest", () => {
    const twin = makeSong({ id: "twin", artist: "Alpha" });
    const different = makeSong({
      id: "different",
      artist: "Beta",
      spotify: {
        ...makeSong({ id: "x" }).spotify!,
        audioFeatures: { danceability: 0.1, energy: 0.1, valence: 0.1, tempo: 60 },
      },
    });
    const results = getSimilarSongs(target, [different, twin]);
    expect(results[0].song.id).toBe("twin");
  });

  it("excludes same-artist songs via diversity pre-seeding", () => {
    const sameArtist = makeSong({
      id: "same-artist",
      artist: "Test Artist",
      spotify: {
        ...makeSong({ id: "x" }).spotify!,
        audioFeatures: { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 100 },
      },
    });
    const stranger = makeSong({
      id: "stranger",
      artist: "Completely Different",
      spotify: {
        ...makeSong({ id: "x" }).spotify!,
        audioFeatures: { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 100 },
      },
    });
    const results = getSimilarSongs(target, [stranger, sameArtist]);
    // Same-artist songs are now excluded by the diversity pre-seed
    expect(results).toHaveLength(1);
    expect(results[0].song.id).toBe("stranger");
  });

  it("applies same-era bonus for songs within 2 years", () => {
    const sameEra = makeSong({ id: "era-match", artist: "X", releaseDate: "2023-06-01" });
    const distant = makeSong({ id: "old", artist: "Y", releaseDate: "2010-01-01" });
    // Both have identical audio features to target — era bonus is the tiebreaker
    const results = getSimilarSongs(target, [distant, sameEra]);
    expect(results[0].song.id).toBe("era-match");
  });

  it("respects the limit parameter", () => {
    const catalog = Array.from({ length: 10 }, (_, i) =>
      makeSong({ id: `song-${i}`, artist: `Artist ${i}` })
    );
    expect(getSimilarSongs(target, catalog, 2)).toHaveLength(2);
    expect(getSimilarSongs(target, catalog, 6)).toHaveLength(6);
  });

  it("defaults to limit of 4", () => {
    const catalog = Array.from({ length: 10 }, (_, i) =>
      makeSong({ id: `song-${i}`, artist: `Artist ${i}` })
    );
    expect(getSimilarSongs(target, catalog)).toHaveLength(4);
  });

  it("returns 'Nearly identical vibe' for very close distances", () => {
    // Tiny offset — distance will be < 0.15
    const nearTwin = makeSong({
      id: "near-twin",
      artist: "Other Person",
      releaseDate: "2010-01-01",
      spotify: {
        ...makeSong({ id: "x" }).spotify!,
        audioFeatures: { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 },
      },
    });
    const results = getSimilarSongs(target, [nearTwin]);
    expect(results[0].reason).toBe("Nearly identical vibe");
  });

  it("returns 'High energy match' when both songs are high energy", () => {
    // Both target and candidate must have energy > 0.7, distance > 0.15 (not "Nearly identical"),
    // different artist names with no shared first word (not "Same artist")
    const energyTarget = makeSong({
      id: "t",
      artist: "Zara Larsson",
      releaseDate: "2010-01-01",
      spotify: {
        ...makeSong({ id: "x" }).spotify!,
        audioFeatures: { danceability: 0.5, energy: 0.75, valence: 0.5, tempo: 140 },
      },
    });
    const highEnergy = makeSong({
      id: "high-e",
      artist: "Calvin Harris",
      releaseDate: "2010-01-01",
      spotify: {
        ...makeSong({ id: "x" }).spotify!,
        audioFeatures: { danceability: 0.3, energy: 0.85, valence: 0.3, tempo: 80 },
      },
    });
    const results = getSimilarSongs(energyTarget, [highEnergy]);
    expect(results[0].reason).toBe("High energy match");
  });

  it("includes a matchScore between 0 and 99 for each result", () => {
    const catalog = [
      makeSong({ id: "a", artist: "Alpha" }),
      makeSong({ id: "b", artist: "Beta" }),
    ];
    const results = getSimilarSongs(target, catalog);
    for (const r of results) {
      expect(r.matchScore).toBeGreaterThanOrEqual(0);
      expect(r.matchScore).toBeLessThanOrEqual(99);
      expect(Number.isInteger(r.matchScore)).toBe(true);
    }
  });

  it("assigns higher matchScore to sonically closer songs", () => {
    const close = makeSong({
      id: "close",
      artist: "Artist A",
      spotify: {
        ...makeSong({ id: "x" }).spotify!,
        audioFeatures: { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 },
      },
    });
    const far = makeSong({
      id: "far",
      artist: "Artist B",
      releaseDate: "2010-01-01",
      spotify: {
        ...makeSong({ id: "x" }).spotify!,
        audioFeatures: { danceability: 0.1, energy: 0.1, valence: 0.1, tempo: 60 },
      },
    });
    const results = getSimilarSongs(target, [far, close]);
    expect(results[0].matchScore).toBeGreaterThan(results[1].matchScore);
  });

  it("handles empty catalog gracefully", () => {
    expect(getSimilarSongs(target, [])).toEqual([]);
  });

  it("handles catalog where all songs lack audio features", () => {
    const catalog = [
      makeSong({ id: "a", spotify: null }),
      makeSong({ id: "b", spotify: null }),
    ];
    expect(getSimilarSongs(target, catalog)).toEqual([]);
  });

  it("enforces artist diversity — at most one song per artist", () => {
    const catalog = [
      makeSong({ id: "a1", artist: "Dua Lipa" }),
      makeSong({ id: "a2", artist: "Dua Lipa" }),
      makeSong({ id: "b1", artist: "Adele" }),
    ];
    const results = getSimilarSongs(target, catalog, 4);
    const artists = results.map((r) => r.song.artist);
    // Should contain only one Dua Lipa song, not both
    expect(artists.filter((a) => a === "Dua Lipa")).toHaveLength(1);
    expect(artists).toContain("Adele");
  });

  it("skips duplicate artists to fill the limit with diverse picks", () => {
    // 3 songs by Same, 3 by unique artists — limit 3 should pick 1 Same + 2 unique
    const catalog = [
      makeSong({ id: "s1", artist: "Same" }),
      makeSong({ id: "s2", artist: "Same" }),
      makeSong({ id: "s3", artist: "Same" }),
      makeSong({ id: "u1", artist: "Unique One" }),
      makeSong({ id: "u2", artist: "Unique Two" }),
    ];
    const results = getSimilarSongs(target, catalog, 3);
    const artists = results.map((r) => r.song.artist);
    expect(new Set(artists).size).toBe(3); // all unique
  });

  it("excludes 'ft.' featured artists via diversity pre-seeding", () => {
    const base = makeSong({ id: "base", artist: "Mark Ronson" });
    const feat = makeSong({ id: "feat", artist: "Mark Ronson ft. Bruno Mars" });
    const catalog = [feat, makeSong({ id: "other", artist: "Other" })];
    const results = getSimilarSongs(base, catalog, 4);
    // "Mark Ronson ft. Bruno Mars" shares artist with target — excluded by diversity pre-seed
    expect(results.every((r) => r.song.id !== "feat")).toBe(true);
    expect(results.find((r) => r.song.id === "other")).toBeTruthy();
  });

  it("excludes '&' collaborations sharing target artist via diversity pre-seeding", () => {
    const base = makeSong({ id: "base", artist: "Bruno Mars" });
    const collab = makeSong({ id: "collab", artist: "Lady Gaga & Bruno Mars" });
    const catalog = [collab, makeSong({ id: "other", artist: "Other" })];
    const results = getSimilarSongs(base, catalog, 4);
    // "Lady Gaga & Bruno Mars" shares Bruno Mars with target — excluded
    expect(results.every((r) => r.song.id !== "collab")).toBe(true);
    expect(results.find((r) => r.song.id === "other")).toBeTruthy();
  });

  it("deduplicates '&' collaborations sharing an artist in diversity filter", () => {
    const catalog = [
      makeSong({ id: "lg", artist: "Lady Gaga & Bruno Mars" }),
      makeSong({ id: "rose", artist: "ROSÉ & Bruno Mars" }),
      makeSong({ id: "solo", artist: "Adele" }),
    ];
    const results = getSimilarSongs(target, catalog, 4);
    // Only one Bruno Mars collab should appear — the higher-scored one
    const brunoSongs = results.filter(
      (r) => r.song.artist.toLowerCase().includes("bruno mars")
    );
    expect(brunoSongs).toHaveLength(1);
    expect(results.find((r) => r.song.artist === "Adele")).toBeTruthy();
  });

  it("pre-seeds diversity filter with target artists — no same-artist results", () => {
    // Target is "Test Artist" — no song by "Test Artist" should appear in results
    const catalog = [
      makeSong({ id: "ta1", artist: "Test Artist" }),
      makeSong({ id: "ta2", artist: "Test Artist" }),
      makeSong({ id: "other", artist: "Different Person" }),
    ];
    const results = getSimilarSongs(target, catalog, 4);
    expect(results.every((r) => r.song.artist !== "Test Artist")).toBe(true);
    expect(results.find((r) => r.song.id === "other")).toBeTruthy();
  });

  it("pre-seeds diversity with collab artists — target feat. artist excluded", () => {
    // Target features Bruno Mars — no other Bruno Mars song should appear
    const collabTarget = makeSong({ id: "target-collab", artist: "Lady Gaga & Bruno Mars" });
    const catalog = [
      makeSong({ id: "bruno-solo", artist: "Bruno Mars" }),
      makeSong({ id: "gaga-solo", artist: "Lady Gaga" }),
      makeSong({ id: "adele", artist: "Adele" }),
      makeSong({ id: "drake", artist: "Drake" }),
    ];
    const results = getSimilarSongs(collabTarget, catalog, 4);
    // Neither Bruno Mars nor Lady Gaga solo songs should appear
    expect(results.every((r) => r.song.artist !== "Bruno Mars")).toBe(true);
    expect(results.every((r) => r.song.artist !== "Lady Gaga")).toBe(true);
    expect(results.find((r) => r.song.id === "adele")).toBeTruthy();
    expect(results.find((r) => r.song.id === "drake")).toBeTruthy();
  });
});

describe("splitArtists", () => {
  it("splits on 'ft.'", () => {
    expect(splitArtists("Mark Ronson ft. Bruno Mars")).toEqual(["mark ronson", "bruno mars"]);
  });

  it("splits on 'feat.'", () => {
    expect(splitArtists("Lil Nas X feat. Billy Ray Cyrus")).toEqual(["lil nas x", "billy ray cyrus"]);
  });

  it("splits on '&'", () => {
    expect(splitArtists("Lady Gaga & Bruno Mars")).toEqual(["lady gaga", "bruno mars"]);
  });

  it("splits on ','", () => {
    expect(splitArtists("Drake, Future")).toEqual(["drake", "future"]);
  });

  it("splits on 'with'", () => {
    expect(splitArtists("David Guetta with Sia")).toEqual(["david guetta", "sia"]);
  });

  it("does NOT split on 'and' (preserves artist names like 'Tones and I')", () => {
    expect(splitArtists("Tones and I")).toEqual(["tones and i"]);
  });

  it("handles multiple separators in one string", () => {
    expect(splitArtists("DJ Khaled ft. Drake, Lil Wayne & Rick Ross")).toEqual([
      "dj khaled", "drake", "lil wayne", "rick ross",
    ]);
  });

  it("returns single-element array for solo artist", () => {
    expect(splitArtists("Taylor Swift")).toEqual(["taylor swift"]);
  });

  it("splits on '&' without surrounding spaces", () => {
    expect(splitArtists("Gaga&Mars")).toEqual(["gaga", "mars"]);
    expect(splitArtists("Gaga& Mars")).toEqual(["gaga", "mars"]);
    expect(splitArtists("Gaga &Mars")).toEqual(["gaga", "mars"]);
  });

  it("does NOT split 'R&B' or other short-token '&' patterns", () => {
    expect(splitArtists("R&B")).toEqual(["r&b"]);
    expect(splitArtists("A&B")).toEqual(["a&b"]);
  });
});

describe("getDiversityMeta", () => {
  const target = makeSong({ id: "target", releaseDate: "2022-06-01" });

  it("returns zero score and 'No data' for empty picks", () => {
    const result = getDiversityMeta(target, []);
    expect(result.score).toBe(0);
    expect(result.label).toBe("No data");
    expect(result.genres).toEqual([]);
    expect(result.eras).toEqual([]);
  });

  it("detects genres from songGenres map using song IDs", () => {
    // Use real mock song IDs that exist in the songGenres map
    const picks = [
      { song: makeSong({ id: "blinding-lights" }) },
      { song: makeSong({ id: "shape-of-you" }) },
      { song: makeSong({ id: "old-town-road" }) },
    ];
    const result = getDiversityMeta(target, picks);
    expect(result.genres).toContain("R&B");
    expect(result.genres).toContain("Pop");
    expect(result.genres).toContain("Country");
    expect(result.genres).toHaveLength(3);
  });

  it("includes target era in era calculation", () => {
    const picks = [
      { song: makeSong({ id: "a", releaseDate: "2022-03-01" }) },
    ];
    const result = getDiversityMeta(target, picks);
    // Target is 2022, pick is 2022 — only one era "2020s"
    expect(result.eras).toEqual(["2020s"]);
  });

  it("detects multiple eras when picks span decades", () => {
    const picks = [
      { song: makeSong({ id: "a", releaseDate: "2015-01-01" }) },
      { song: makeSong({ id: "b", releaseDate: "2023-01-01" }) },
    ];
    const result = getDiversityMeta(target, picks);
    expect(result.eras).toContain("2010s");
    expect(result.eras).toContain("2020s");
  });

  it("scores higher for more genre diversity", () => {
    const narrow = [
      { song: makeSong({ id: "shape-of-you" }) },   // Pop
      { song: makeSong({ id: "as-it-was" }) },       // Pop
    ];
    const wide = [
      { song: makeSong({ id: "blinding-lights" }) }, // R&B
      { song: makeSong({ id: "old-town-road" }) },   // Country
    ];
    const narrowScore = getDiversityMeta(target, narrow).score;
    const wideScore = getDiversityMeta(target, wide).score;
    expect(wideScore).toBeGreaterThan(narrowScore);
  });

  it("returns 'Wide mix' for 4 genres spanning 2 decades", () => {
    // 4 genres across 2 eras (target 2010s + picks in 2010s/2020s)
    // Genre: 4/4 × 60 = 60, Era: min(1, 1/2) × 40 = 20, total = 80
    const targetFor2010s = makeSong({ id: "target-old", releaseDate: "2015-06-01" });
    const picks = [
      { song: makeSong({ id: "blinding-lights", releaseDate: "2019-11-29" }) }, // R&B, 2010s
      { song: makeSong({ id: "old-town-road", releaseDate: "2019-04-05" }) },   // Country, 2010s
      { song: makeSong({ id: "levitating", releaseDate: "2020-03-27" }) },      // Disco/Dance, 2020s
      { song: makeSong({ id: "vampire", releaseDate: "2023-06-30" }) },         // Alt/Indie, 2020s
    ];
    const result = getDiversityMeta(targetFor2010s, picks);
    expect(result.label).toBe("Wide mix");
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it("returns 'Similar vibe' for 2 genres in same era", () => {
    // 2 genres / 4 picks × 60 = 30, all same era = 0, total = 30
    const targetFor2020s = makeSong({ id: "target-new", releaseDate: "2022-06-01" });
    const picks = [
      { song: makeSong({ id: "blinding-lights", releaseDate: "2020-01-01" }) }, // R&B, 2020s
      { song: makeSong({ id: "shape-of-you", releaseDate: "2020-01-01" }) },    // Pop, 2020s
      { song: makeSong({ id: "as-it-was", releaseDate: "2022-01-01" }) },       // Pop, 2020s
      { song: makeSong({ id: "flowers", releaseDate: "2023-01-01" }) },         // Pop, 2020s
    ];
    const result = getDiversityMeta(targetFor2020s, picks);
    expect(result.label).toBe("Similar vibe");
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThan(45);
  });

  it("sorts genres alphabetically", () => {
    const picks = [
      { song: makeSong({ id: "uptown-funk" }) },     // Funk
      { song: makeSong({ id: "blinding-lights" }) },  // R&B
      { song: makeSong({ id: "shape-of-you" }) },     // Pop
    ];
    const result = getDiversityMeta(target, picks);
    expect(result.genres).toEqual([...result.genres].sort());
  });
});

describe("primaryArtist", () => {
  it("extracts artist before 'ft.'", () => {
    expect(primaryArtist("Mark Ronson ft. Bruno Mars")).toBe("mark ronson");
  });

  it("extracts artist before 'feat.'", () => {
    expect(primaryArtist("Lil Nas X feat. Billy Ray Cyrus")).toBe("lil nas x");
  });

  it("extracts artist before '&'", () => {
    expect(primaryArtist("Lady Gaga & Bruno Mars")).toBe("lady gaga");
  });

  it("returns full name when no feature credit", () => {
    expect(primaryArtist("Taylor Swift")).toBe("taylor swift");
  });

  it("is case-insensitive", () => {
    expect(primaryArtist("THE WEEKND")).toBe("the weeknd");
  });
});

describe("safeYear", () => {
  it("extracts year from valid date string", () => {
    expect(safeYear("2022-06-15")).toBe(2022);
    expect(safeYear("1999-06-15")).toBe(1999);
  });

  it("returns null for undefined", () => {
    expect(safeYear(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(safeYear(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(safeYear("")).toBeNull();
  });

  it("returns null for unparseable date", () => {
    expect(safeYear("not-a-date")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(safeYear("   ")).toBeNull();
  });

  it("handles year-only string without crashing", () => {
    // "2022" is valid per Date.parse — should return 2022, not NaN
    const result = safeYear("2022");
    expect(result).toBe(2022);
    expect(Number.isNaN(result)).toBe(false);
  });

  it("returns null for common placeholder strings from APIs", () => {
    expect(safeYear("TBD")).toBeNull();
    expect(safeYear("Unknown")).toBeNull();
    expect(safeYear("N/A")).toBeNull();
  });
});

describe("getDiversityMeta — invalid date handling", () => {
  const target = makeSong({ id: "target", releaseDate: "2022-06-01" });

  it("excludes NaN eras when picks have missing releaseDate", () => {
    const picks = [
      { song: makeSong({ id: "a", releaseDate: undefined as unknown as string }) },
      { song: makeSong({ id: "b", releaseDate: "2015-01-01" }) },
    ];
    const result = getDiversityMeta(target, picks);
    // Should NOT contain "NaNs" — only real decades
    expect(result.eras.every((e) => !e.includes("NaN"))).toBe(true);
    expect(result.eras).toContain("2020s");
    expect(result.eras).toContain("2010s");
  });

  it("handles target with invalid releaseDate gracefully", () => {
    const badTarget = makeSong({ id: "bad", releaseDate: "" });
    const picks = [
      { song: makeSong({ id: "a", releaseDate: "2020-06-15" }) },
    ];
    const result = getDiversityMeta(badTarget, picks);
    expect(result.eras).toEqual(["2020s"]);
    expect(result.eras.every((e) => !e.includes("NaN"))).toBe(true);
  });

  it("returns empty eras when all dates are invalid", () => {
    const badTarget = makeSong({ id: "bad", releaseDate: "" });
    const picks = [
      { song: makeSong({ id: "a", releaseDate: undefined as unknown as string }) },
    ];
    const result = getDiversityMeta(badTarget, picks);
    expect(result.eras).toEqual([]);
  });

  it("never produces a negative diversity score from invalid dates", () => {
    const badTarget = makeSong({ id: "bad", releaseDate: "TBD" });
    const picks = [
      { song: makeSong({ id: "a", releaseDate: "not-a-date" }) },
      { song: makeSong({ id: "b", releaseDate: "" }) },
    ];
    const result = getDiversityMeta(badTarget, picks);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.eras).toEqual([]);
  });

  it("scores correctly when target date is invalid but picks have valid eras", () => {
    const badTarget = makeSong({ id: "bad", releaseDate: "" });
    const picks = [
      { song: makeSong({ id: "blinding-lights", releaseDate: "2019-11-29" }) },
      { song: makeSong({ id: "shape-of-you", releaseDate: "2017-01-06" }) },
    ];
    const result = getDiversityMeta(badTarget, picks);
    // Both picks are 2010s — eraRatio should reflect actual era spread, not be negative
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.eras).toContain("2010s");
    expect(result.eras.every((e) => !e.includes("NaN"))).toBe(true);
  });
});

// ── Auto selection strategy ──────────────────────────────────────────────

describe("getSimilarSongs — auto strategy", () => {
  function withFeatures(
    id: string, artist: string,
    features: { danceability: number; energy: number; valence: number; tempo: number },
    releaseDate = "2022-01-01",
  ): SongData {
    return makeSong({
      id, artist, releaseDate,
      spotify: {
        id, name: id, artist, album: "", albumArt: "",
        releaseDate, popularity: 80, totalStreams: "1M",
        playlistCount: 100, previewUrl: null, externalUrl: "",
        audioFeatures: features,
      },
    });
  }

  it("auto strategy falls back to best-match when top candidates are already diverse", () => {
    const target = withFeatures("t", "Target",
      { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 });
    // Use mock IDs that map to distinct genres in songGenres
    const catalog = [
      withFeatures("blinding-lights", "The Weeknd", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
      withFeatures("old-town-road", "Lil Nas X", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }),
      withFeatures("levitating", "Dua Lipa", { danceability: 0.72, energy: 0.72, valence: 0.72, tempo: 122 }),
    ];
    const autoResults = getSimilarSongs(target, catalog, 3, { strategy: "auto" });
    const bestResults = getSimilarSongs(target, catalog, 3, { strategy: "best-match" });
    // Already diverse catalog → auto should produce same order as best-match
    expect(autoResults.map((r) => r.song.id)).toEqual(bestResults.map((r) => r.song.id));
  });

  it("auto strategy switches to diverse when top candidates are genre-homogeneous", () => {
    const target = withFeatures("t", "Target",
      { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 });
    // All candidates use IDs with no genre mapping (homogeneous from songGenres perspective)
    const catalog = [
      withFeatures("x1", "Alpha", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
      withFeatures("x2", "Beta", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }),
      withFeatures("x3", "Gamma", { danceability: 0.72, energy: 0.72, valence: 0.72, tempo: 122 }),
      withFeatures("blinding-lights", "Delta", { danceability: 0.6, energy: 0.6, valence: 0.6, tempo: 110 }, "2015-01-01"),
    ];
    const autoResults = getSimilarSongs(target, catalog, 4, { strategy: "auto" });
    // Auto should detect genre homogeneity and switch to diverse mode
    expect(autoResults).toHaveLength(4);
    // All results should be valid
    for (const pick of autoResults) {
      expect(pick.matchScore).toBeGreaterThanOrEqual(0);
      expect(pick.matchScore).toBeLessThanOrEqual(99);
    }
  });

  it("auto is the default when no strategy is specified", () => {
    const target = withFeatures("t", "Target",
      { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 });
    const catalog = [
      withFeatures("a", "Alpha", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
    ];
    // No prefs at all
    const noPrefs = getSimilarSongs(target, catalog);
    // Empty prefs
    const emptyPrefs = getSimilarSongs(target, catalog, 4, {});
    expect(noPrefs).toHaveLength(1);
    expect(emptyPrefs).toHaveLength(1);
  });
});

// ── Diverse selection strategy ───────────────────────────────────────────

describe("getSimilarSongs — diverse strategy", () => {
  function withFeatures(
    id: string, artist: string,
    features: { danceability: number; energy: number; valence: number; tempo: number },
    releaseDate = "2022-01-01",
  ): SongData {
    return makeSong({
      id, artist, releaseDate,
      spotify: {
        id, name: id, artist, album: "", albumArt: "",
        releaseDate, popularity: 80, totalStreams: "1M",
        playlistCount: 100, previewUrl: null, externalUrl: "",
        audioFeatures: features,
      },
    });
  }

  it("diverse strategy prefers unseen genres over higher-scoring same-genre", () => {
    // Target: moderate features. Catalog has songs from different mock IDs
    // that map to different genres in songGenres. The diverse picker should
    // prefer a lower-scored song from an unseen genre over a higher-scored
    // one from a genre it already picked.
    const target = withFeatures("t", "Target",
      { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 });

    // Two very close candidates (same genre would be picked by best-match)
    // and one slightly farther candidate from a different artist
    const close1 = withFeatures("c1", "Alpha",
      { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 });
    const close2 = withFeatures("c2", "Beta",
      { danceability: 0.705, energy: 0.705, valence: 0.705, tempo: 120.5 });
    const farther = withFeatures("c3", "Gamma",
      { danceability: 0.6, energy: 0.6, valence: 0.6, tempo: 110 }, "2015-01-01");

    const bestMatch = getSimilarSongs(target, [close1, close2, farther], 3, { strategy: "best-match" });
    const diverse = getSimilarSongs(target, [close1, close2, farther], 3, { strategy: "diverse" });

    // Both strategies should return all 3 (different artists)
    expect(bestMatch).toHaveLength(3);
    expect(diverse).toHaveLength(3);
    // Diverse strategy should still include all candidates
    expect(diverse.map((r) => r.song.id).sort()).toEqual(["c1", "c2", "c3"].sort());
  });

  it("diverse strategy still respects artist deduplication", () => {
    const target = withFeatures("t", "Target",
      { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 });
    const catalog = [
      withFeatures("a1", "Alpha", { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 }),
      withFeatures("a2", "Alpha", { danceability: 0.72, energy: 0.72, valence: 0.72, tempo: 122 }),
      withFeatures("b1", "Beta", { danceability: 0.69, energy: 0.69, valence: 0.69, tempo: 119 }),
    ];

    const results = getSimilarSongs(target, catalog, 4, { strategy: "diverse" });
    const artists = results.map((r) => r.song.artist);
    // Only one Alpha should appear
    expect(artists.filter((a) => a === "Alpha")).toHaveLength(1);
  });

  it("diverse strategy uses popularity as tiebreaker between equal candidates", () => {
    const target = withFeatures("t", "Target",
      { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 });
    // Two candidates with identical features but different popularity
    const popular = makeSong({
      id: "pop-high", artist: "Famous",
      releaseDate: "2022-01-01",
      spotify: {
        id: "pop-high", name: "pop-high", artist: "Famous",
        album: "", albumArt: "", releaseDate: "2022-01-01",
        popularity: 95, totalStreams: "1M", playlistCount: 100,
        previewUrl: null, externalUrl: "",
        audioFeatures: { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 },
      },
    });
    const obscure = makeSong({
      id: "pop-low", artist: "Unknown",
      releaseDate: "2022-01-01",
      spotify: {
        id: "pop-low", name: "pop-low", artist: "Unknown",
        album: "", albumArt: "", releaseDate: "2022-01-01",
        popularity: 5, totalStreams: "1K", playlistCount: 1,
        previewUrl: null, externalUrl: "",
        audioFeatures: { danceability: 0.71, energy: 0.71, valence: 0.71, tempo: 121 },
      },
    });
    const results = getSimilarSongs(target, [obscure, popular], 2, { strategy: "diverse" });
    // Popular song should rank first due to popularity tiebreaker
    expect(results[0].song.id).toBe("pop-high");
  });

  it("getAutoInsight returns resolved strategy and detected genres", () => {
    // getAutoInsight imported at top level
    const target = withFeatures("t", "Target",
      { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 });
    const catalog = Array.from({ length: 6 }, (_, i) =>
      withFeatures(`s${i}`, `Artist ${i}`,
        { danceability: 0.65 + i * 0.02, energy: 0.65 + i * 0.02, valence: 0.65 + i * 0.02, tempo: 115 + i * 3 },
        `${2018 + i}-01-01`));

    // Auto should resolve to one of the two strategies and expose insight
    getSimilarSongs(target, catalog, 4, { strategy: "auto" });
    const insight = getAutoInsight();
    expect(insight).not.toBeNull();
    expect(["best-match", "diverse"]).toContain(insight?.resolved);
    expect(Array.isArray(insight?.genresDetected)).toBe(true);
  });

  it("getAutoInsight returns null when strategy is not auto", () => {
    // getAutoInsight imported at top level
    const target = withFeatures("t", "Target",
      { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 100 });
    const catalog = [
      withFeatures("s1", "A1", { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 100 }),
    ];
    getSimilarSongs(target, catalog, 4, { strategy: "best-match" });
    expect(getAutoInsight()).toBeNull();
  });

  it("diverse strategy returns valid matchScores in 0-99 range", () => {
    const target = withFeatures("t", "Target",
      { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 100 });
    const catalog = Array.from({ length: 10 }, (_, i) =>
      withFeatures(`s${i}`, `Artist ${i}`,
        { danceability: 0.3 + i * 0.05, energy: 0.3 + i * 0.05, valence: 0.3 + i * 0.05, tempo: 80 + i * 8 },
        `${2015 + i}-06-01`));

    const results = getSimilarSongs(target, catalog, 4, { strategy: "diverse" });
    for (const pick of results) {
      expect(pick.matchScore).toBeGreaterThanOrEqual(0);
      expect(pick.matchScore).toBeLessThanOrEqual(99);
      expect(Number.isInteger(pick.matchScore)).toBe(true);
    }
  });
});
