import { describe, it, expect } from "vitest";
import { generateTimeline } from "../timeline";

describe("generateTimeline", () => {
  it("returns empty array for unparseable date", () => {
    expect(generateTimeline("not-a-date")).toEqual([]);
    expect(generateTimeline("TBD")).toEqual([]);
    expect(generateTimeline("")).toEqual([]);
  });

  it("generates data points with expected shape", () => {
    const points = generateTimeline("2024-06-01");
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      expect(p).toHaveProperty("date");
      expect(p).toHaveProperty("spotify");
      expect(p).toHaveProperty("youtube");
      expect(typeof p.spotify).toBe("number");
      expect(typeof p.youtube).toBe("number");
      expect(p.spotify).toBeGreaterThanOrEqual(0);
      expect(p.youtube).toBeGreaterThanOrEqual(0);
    }
  });

  it("caps at 48 months maximum", () => {
    // A release date far in the past should cap at 48 data points
    const points = generateTimeline("2015-01-01");
    expect(points.length).toBeLessThanOrEqual(48);
  });

  it("starts timeline from release date", () => {
    const points = generateTimeline("2024-01-15");
    expect(points[0].date).toBe("2024-01-15");
  });

  it("only includes billboard positions for months 1–20", () => {
    const points = generateTimeline("2024-01-01");
    if (points.length > 0) {
      // Month 0 should not have billboard
      expect(points[0].billboard).toBeUndefined();
    }
    // Months beyond 20 should also lack billboard
    for (const p of points.slice(21)) {
      expect(p.billboard).toBeUndefined();
    }
  });

  it("uses custom peakMonth parameter", () => {
    const earlyPeak = generateTimeline("2024-01-01", 1);
    const latePeak = generateTimeline("2024-01-01", 10);
    // Both should produce valid timelines
    expect(earlyPeak.length).toBeGreaterThan(0);
    expect(latePeak.length).toBeGreaterThan(0);
  });
});
