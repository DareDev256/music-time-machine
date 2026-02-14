import { describe, it, expect } from "vitest";
import { getSimilarSongs, primaryArtist, splitArtists } from "../recommendations";
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
    const catalog = [noFeatures, makeSong({ id: "valid" })];
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

  it("applies same-artist bonus", () => {
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
    // Same artist gets +15 bonus so should rank higher despite identical features to stranger
    expect(results[0].song.id).toBe("same-artist");
    expect(results[0].reason).toBe("Same artist");
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

  it("treats 'ft.' featured artists as same primary artist", () => {
    const base = makeSong({ id: "base", artist: "Mark Ronson" });
    const feat = makeSong({ id: "feat", artist: "Mark Ronson ft. Bruno Mars" });
    const catalog = [feat, makeSong({ id: "other", artist: "Other" })];
    const results = getSimilarSongs(base, catalog, 4);
    const markSong = results.find((r) => r.song.id === "feat");
    expect(markSong?.reason).toBe("Same artist");
  });

  it("treats '&' collaborations as shared artist for same-artist bonus", () => {
    const base = makeSong({ id: "base", artist: "Bruno Mars" });
    const collab = makeSong({ id: "collab", artist: "Lady Gaga & Bruno Mars" });
    const catalog = [collab, makeSong({ id: "other", artist: "Other" })];
    const results = getSimilarSongs(base, catalog, 4);
    const collabSong = results.find((r) => r.song.id === "collab");
    expect(collabSong?.reason).toBe("Same artist");
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
