import { describe, it, expect } from "vitest";
import { parseMetric, buildInsights, COMPARISON_METRICS } from "../comparison";
import type { SongData } from "@/types";

describe("comparison", () => {
  describe("parseMetric", () => {
    it("parses billions suffix", () => {
      expect(parseMetric("4.2B")).toBe(4_200_000_000);
    });

    it("parses millions suffix", () => {
      expect(parseMetric("320M")).toBe(320_000_000);
    });

    it("parses thousands suffix", () => {
      expect(parseMetric("45K")).toBe(45_000);
    });

    it("parses plain numbers without suffix", () => {
      expect(parseMetric("100")).toBe(100);
    });

    it("returns 0 for non-numeric input", () => {
      expect(parseMetric("N/A")).toBe(0);
      expect(parseMetric("")).toBe(0);
      expect(parseMetric("abc")).toBe(0);
    });

    it("handles NaN before suffix check (NaN propagation fix)", () => {
      expect(parseMetric("N/AB")).toBe(0);
    });
  });

  describe("COMPARISON_METRICS", () => {
    it("contains exactly 6 metric definitions", () => {
      expect(COMPARISON_METRICS).toHaveLength(6);
    });

    it("only Billboard Peak uses lowerWins", () => {
      const lowerWinsMetrics = COMPARISON_METRICS.filter((m) => m.lowerWins);
      expect(lowerWinsMetrics).toHaveLength(1);
      expect(lowerWinsMetrics[0].metric).toBe("Billboard Peak");
    });
  });

  describe("buildInsights", () => {
    const makeSong = (overrides: Partial<SongData>): SongData => ({
      id: "test",
      title: "Test",
      artist: "Test",
      albumArt: "",
      releaseDate: "2024-01-01",
      spotify: null,
      youtube: null,
      billboard: null,
      genius: null,
      timeline: [],
      ...overrides,
    });

    it("skips metrics when platform data is missing", () => {
      const song1 = makeSong({});
      const song2 = makeSong({});
      const insights = buildInsights(song1, song2);
      expect(insights).toHaveLength(0);
    });

    it("returns tie when values are equal", () => {
      const spotifyData = {
        id: "1", name: "Test", artist: "Test", album: "Test",
        albumArt: "", releaseDate: "2024-01-01", popularity: 80,
        totalStreams: "1B", playlistCount: 100, previewUrl: null,
        externalUrl: "", audioFeatures: { danceability: 0.5, energy: 0.5, valence: 0.5, tempo: 120 },
      };
      const song1 = makeSong({ spotify: { ...spotifyData } });
      const song2 = makeSong({ spotify: { ...spotifyData } });
      const insights = buildInsights(song1, song2);
      const spotifyInsights = insights.filter((i) => i.metric.includes("Spotify") || i.metric.includes("Popularity"));
      expect(spotifyInsights.every((i) => i.winner === "tie")).toBe(true);
    });

    it("applies lowerWins for Billboard Peak", () => {
      const billboard1 = { peakPosition: 1, peakDate: "2024-01-01", weeksOnChart: 20, entryPosition: 10, entryDate: "2024-01-01", chartHistory: [] };
      const billboard2 = { peakPosition: 5, peakDate: "2024-01-01", weeksOnChart: 15, entryPosition: 20, entryDate: "2024-01-01", chartHistory: [] };
      const song1 = makeSong({ billboard: billboard1 });
      const song2 = makeSong({ billboard: billboard2 });
      const insights = buildInsights(song1, song2);
      const peakInsight = insights.find((i) => i.metric === "Billboard Peak");
      expect(peakInsight).toBeDefined();
      expect(peakInsight!.winner).toBe("song1"); // #1 < #5, lower wins
    });

    it("song2 wins when it has better metrics", () => {
      const spotify1 = {
        id: "1", name: "A", artist: "A", album: "A",
        albumArt: "", releaseDate: "2024-01-01", popularity: 60,
        totalStreams: "500M", playlistCount: 50, previewUrl: null, externalUrl: "",
      };
      const spotify2 = {
        id: "2", name: "B", artist: "B", album: "B",
        albumArt: "", releaseDate: "2024-01-01", popularity: 90,
        totalStreams: "2B", playlistCount: 100, previewUrl: null, externalUrl: "",
      };
      const song1 = makeSong({ spotify: spotify1 });
      const song2 = makeSong({ spotify: spotify2 });
      const insights = buildInsights(song1, song2);
      const streamsInsight = insights.find((i) => i.metric === "Spotify Streams");
      expect(streamsInsight!.winner).toBe("song2");
    });
  });
});
