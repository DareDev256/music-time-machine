import { describe, it, expect } from "vitest";
import { getSimilarSongs } from "../recommendations";
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
      audioFeatures: { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 120 },
    },
    youtube: null, billboard: null, genius: null, timeline: [],
    ...overrides,
  };
}

describe("getSimilarSongs — RecommendationPrefs", () => {
  const target = makeSong({
    id: "target", artist: "Target Solo",
    spotify: {
      id: "target", name: "target", artist: "Target Solo",
      album: "", albumArt: "", releaseDate: "2022-01-01",
      popularity: 80, totalStreams: "1M", playlistCount: 100,
      previewUrl: null, externalUrl: "",
      audioFeatures: { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 120 },
    },
  });

  it("boosts candidates matching preferred genre", () => {
    // "blinding-lights" maps to "R&B" in songGenres, "shape-of-you" maps to "Pop"
    const catalog = [
      makeSong({ id: "blinding-lights", artist: "The Weeknd" }),
      makeSong({ id: "shape-of-you", artist: "Ed Sheeran" }),
    ];
    const withPref = getSimilarSongs(target, catalog, 2, { genres: ["R&B"] });
    expect(withPref[0].song.id).toBe("blinding-lights");
    expect(withPref[0].matchScore).toBeGreaterThan(
      getSimilarSongs(target, catalog, 2)[0].matchScore - 1 // genre bonus should lift score
    );
  });

  it("boosts candidates within preferred era range", () => {
    const old = makeSong({ id: "old", artist: "Retro", releaseDate: "2000-06-01" });
    const recent = makeSong({ id: "recent", artist: "Modern", releaseDate: "2023-06-01" });
    const results = getSimilarSongs(target, [old, recent], 2, { eraRange: [2020, 2025] });
    expect(results[0].song.id).toBe("recent");
  });

  it("boosts candidates matching mood preset — upbeat", () => {
    // Both candidates are equidistant from target (symmetric offset in energy/valence)
    // so the mood bonus (+10) is the only tiebreaker
    const upbeat = makeSong({
      id: "up", artist: "Happy",
      spotify: {
        id: "up", name: "up", artist: "Happy",
        album: "", albumArt: "", releaseDate: "2022-01-01",
        popularity: 80, totalStreams: "1M", playlistCount: 100,
        previewUrl: null, externalUrl: "",
        audioFeatures: { danceability: 0.5, energy: 0.8, valence: 0.8, tempo: 120 },
      },
    });
    const sad = makeSong({
      id: "down", artist: "Sad",
      spotify: {
        id: "down", name: "down", artist: "Sad",
        album: "", albumArt: "", releaseDate: "2022-01-01",
        popularity: 80, totalStreams: "1M", playlistCount: 100,
        previewUrl: null, externalUrl: "",
        audioFeatures: { danceability: 0.5, energy: 0.2, valence: 0.2, tempo: 120 },
      },
    });
    const results = getSimilarSongs(target, [sad, upbeat], 2, { mood: "upbeat" });
    expect(results[0].song.id).toBe("up");
  });

  it("ignores invalid mood preset gracefully", () => {
    const catalog = [makeSong({ id: "a", artist: "Solo" })];
    // Cast to bypass TS — simulates runtime junk from localStorage
    const results = getSimilarSongs(target, catalog, 2, { mood: "nonexistent" as never });
    expect(results).toHaveLength(1);
  });

  it("stacks multiple preference bonuses", () => {
    // Both candidates equidistant from target — triple bonus (+32) flips ranking
    const perfect = makeSong({
      id: "blinding-lights", artist: "The Weeknd", releaseDate: "2020-06-01",
      spotify: {
        id: "blinding-lights", name: "blinding-lights", artist: "The Weeknd",
        album: "", albumArt: "", releaseDate: "2020-06-01",
        popularity: 80, totalStreams: "1M", playlistCount: 100,
        previewUrl: null, externalUrl: "",
        audioFeatures: { danceability: 0.5, energy: 0.8, valence: 0.8, tempo: 120 },
      },
    });
    const plain = makeSong({
      id: "plain", artist: "Nobody", releaseDate: "2000-01-01",
      spotify: {
        id: "plain", name: "plain", artist: "Nobody",
        album: "", albumArt: "", releaseDate: "2000-01-01",
        popularity: 80, totalStreams: "1M", playlistCount: 100,
        previewUrl: null, externalUrl: "",
        audioFeatures: { danceability: 0.5, energy: 0.2, valence: 0.2, tempo: 120 },
      },
    });
    const results = getSimilarSongs(target, [plain, perfect], 2, {
      genres: ["R&B"], eraRange: [2019, 2024], mood: "upbeat",
    });
    expect(results[0].song.id).toBe("blinding-lights");
  });

  it("works correctly with empty prefs object", () => {
    const catalog = [makeSong({ id: "a", artist: "Solo" })];
    const results = getSimilarSongs(target, catalog, 2, {});
    expect(results).toHaveLength(1);
  });
});
