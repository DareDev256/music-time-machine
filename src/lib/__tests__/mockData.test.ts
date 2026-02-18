import { describe, it, expect } from "vitest";
import {
  mockSongs,
  searchSongs,
  getSongById,
  getTrendingSongs,
  getArtistDataBySlug,
  songGenres,
  catalogGenres,
} from "../mockData";

describe("mockData", () => {
  describe("mockSongs catalog", () => {
    it("contains 17 curated songs", () => {
      expect(Object.keys(mockSongs)).toHaveLength(17);
    });

    it("every song has required fields populated", () => {
      for (const [id, song] of Object.entries(mockSongs)) {
        expect(song.id, `${id} missing id`).toBe(id);
        expect(song.title, `${id} missing title`).toBeTruthy();
        expect(song.artist, `${id} missing artist`).toBeTruthy();
        expect(song.releaseDate, `${id} missing releaseDate`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(song.timeline.length, `${id} has empty timeline`).toBeGreaterThan(0);
      }
    });

    it("no timeline contains NaN-contaminated data points", () => {
      for (const [id, song] of Object.entries(mockSongs)) {
        for (const point of song.timeline) {
          expect(point.date, `${id} timeline has NaN date`).not.toContain("NaN");
          expect(Number.isNaN(point.spotify), `${id} timeline has NaN spotify`).toBe(false);
          expect(Number.isNaN(point.youtube), `${id} timeline has NaN youtube`).toBe(false);
          if (point.billboard !== undefined) {
            expect(Number.isNaN(point.billboard), `${id} timeline has NaN billboard`).toBe(false);
          }
        }
      }
    });

    it("every song has spotify audio features for recommendations engine", () => {
      for (const [id, song] of Object.entries(mockSongs)) {
        const af = song.spotify?.audioFeatures;
        expect(af, `${id} missing audioFeatures`).toBeDefined();
        expect(af!.danceability).toBeGreaterThanOrEqual(0);
        expect(af!.danceability).toBeLessThanOrEqual(1);
        expect(af!.energy).toBeGreaterThanOrEqual(0);
        expect(af!.energy).toBeLessThanOrEqual(1);
        expect(af!.tempo).toBeGreaterThan(0);
      }
    });
  });

  describe("searchSongs", () => {
    it("finds songs by exact title", () => {
      const results = searchSongs("Blinding Lights");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Blinding Lights");
    });

    it("finds songs by partial title (case-insensitive)", () => {
      const results = searchSongs("blinding");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title.toLowerCase()).toContain("blinding");
    });

    it("finds songs by artist name", () => {
      const results = searchSongs("Ed Sheeran");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].artist).toContain("Ed Sheeran");
    });

    it("returns empty array for no match", () => {
      expect(searchSongs("zzzznonexistent")).toHaveLength(0);
    });

    it("returns SearchResult shape with correct fields", () => {
      const results = searchSongs("Weeknd");
      expect(results[0]).toHaveProperty("id");
      expect(results[0]).toHaveProperty("title");
      expect(results[0]).toHaveProperty("artist");
      expect(results[0]).toHaveProperty("albumArt");
      expect(results[0]).toHaveProperty("releaseDate");
      expect(results[0]).toHaveProperty("spotifyUrl");
    });
  });

  describe("getSongById", () => {
    it("returns song for valid ID", () => {
      const song = getSongById("blinding-lights");
      expect(song).not.toBeNull();
      expect(song!.title).toBe("Blinding Lights");
    });

    it("returns null for invalid ID", () => {
      expect(getSongById("not-a-real-song")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(getSongById("")).toBeNull();
    });
  });

  describe("getTrendingSongs", () => {
    it("returns the full catalog", () => {
      expect(getTrendingSongs()).toHaveLength(Object.keys(mockSongs).length);
    });

    it("returns SearchResult shape with genre", () => {
      const trending = getTrendingSongs();
      for (const song of trending) {
        expect(song).toHaveProperty("id");
        expect(song).toHaveProperty("title");
        expect(song).toHaveProperty("artist");
        expect(song).toHaveProperty("genre");
      }
    });
  });

  describe("songGenres", () => {
    it("has a genre for every song in the catalog", () => {
      for (const id of Object.keys(mockSongs)) {
        expect(songGenres[id]).toBeDefined();
      }
    });

    it("catalogGenres contains only unique sorted values", () => {
      const sorted = [...catalogGenres].sort();
      expect(catalogGenres).toEqual(sorted);
      expect(new Set(catalogGenres).size).toBe(catalogGenres.length);
    });
  });

  describe("getArtistDataBySlug", () => {
    it("returns artist data for known slug", () => {
      const artist = getArtistDataBySlug("the-weeknd");
      expect(artist).not.toBeNull();
      expect(artist!.name).toBe("The Weeknd");
      expect(artist!.slug).toBe("the-weeknd");
    });

    it("populates top tracks from the artist's songs", () => {
      const artist = getArtistDataBySlug("the-weeknd");
      expect(artist!.topTracks.length).toBeGreaterThan(0);
      for (const track of artist!.topTracks) {
        expect(track).toHaveProperty("id");
        expect(track).toHaveProperty("title");
        expect(track).toHaveProperty("streams");
      }
    });

    it("builds career timeline sorted by year", () => {
      const artist = getArtistDataBySlug("the-weeknd");
      const years = artist!.careerTimeline.map((e) => e.year);
      const sorted = [...years].sort();
      expect(years).toEqual(sorted);
    });

    it("returns null for unknown artist", () => {
      expect(getArtistDataBySlug("zzz-unknown")).toBeNull();
    });

    it("deduplicates albums by name", () => {
      const artist = getArtistDataBySlug("the-weeknd");
      if (artist && artist.albums.length > 1) {
        const names = artist.albums.map((a) => a.name);
        expect(new Set(names).size).toBe(names.length);
      }
    });
  });
});
