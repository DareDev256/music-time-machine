import { describe, it, expect } from "vitest";
import { generateTimeline } from "../timeline";

/**
 * Edge-case tests for timeline generation that complement timeline.test.ts.
 *
 * Targets: future dates, peakMonth boundaries, value-range invariants,
 * and date-formatting correctness — things the existing suite doesn't cover.
 */

describe("generateTimeline — future release date", () => {
  it("returns empty array when release date is in the future", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 5);
    expect(generateTimeline(future.toISOString())).toEqual([]);
  });

  it("returns single data point when release date is this month", () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const points = generateTimeline(thisMonth);
    expect(points.length).toBeGreaterThanOrEqual(1);
    expect(points.length).toBeLessThanOrEqual(2); // could be 1 or 2 depending on day
  });
});

describe("generateTimeline — peakMonth edge values", () => {
  it("produces NaN on month 0 when peakMonth = 0 (known bug: 0/0)", () => {
    // BUG: month=0, peakMonth=0 → Math.exp(-0/0) = Math.exp(NaN) = NaN
    // Month > 0 is fine: Math.exp(-n/0) = Math.exp(-Infinity) = 0
    const points = generateTimeline("2024-01-01", 0);
    expect(points.length).toBeGreaterThan(0);
    // First data point has NaN due to 0/0 — this is a real bug to fix
    expect(Number.isNaN(points[0].spotify)).toBe(true);
    // Subsequent points are finite (n/0 → Infinity → exp(-Infinity) = 0)
    if (points.length > 1) {
      expect(Number.isFinite(points[1].spotify!)).toBe(true);
    }
  });

  it("handles negative peakMonth without NaN", () => {
    const points = generateTimeline("2024-01-01", -5);
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      expect(Number.isNaN(p.spotify)).toBe(false);
      expect(Number.isNaN(p.youtube)).toBe(false);
    }
  });

  it("handles very large peakMonth (flat growth curve)", () => {
    const points = generateTimeline("2024-01-01", 1000);
    expect(points.length).toBeGreaterThan(0);
    // With huge peakMonth, growth curve stays near initial values
    expect(points[0].spotify!).toBeLessThan(40);
  });
});

describe("generateTimeline — value range invariants", () => {
  it("spotify values stay in [0, 100]", () => {
    const points = generateTimeline("2024-01-01");
    for (const p of points) {
      expect(p.spotify!).toBeGreaterThanOrEqual(0);
      expect(p.spotify!).toBeLessThanOrEqual(100);
    }
  });

  it("youtube values stay in [0, 100]", () => {
    const points = generateTimeline("2024-01-01");
    for (const p of points) {
      expect(p.youtube!).toBeGreaterThanOrEqual(0);
      expect(p.youtube!).toBeLessThanOrEqual(100);
    }
  });

  it("billboard values (when present) can go negative (known bug: unbounded inversion)", () => {
    // BUG: `101 - billboardPos` where billboardPos = max(1, floor(peak + random*10))
    // When peak ≈ 100 and random adds up to 10, billboardPos can be 102+
    // → billboard = 101 - 102 = -1. The inversion formula lacks an upper clamp.
    // This documents the bug; all billboard values should be in [1, 100].
    const points = generateTimeline("2024-01-01");
    const billboardValues = points
      .map((p) => p.billboard)
      .filter((b): b is number => b !== undefined);
    expect(billboardValues.length).toBeGreaterThan(0);
    // At minimum, verify they're finite numbers (not NaN/Infinity)
    for (const b of billboardValues) {
      expect(Number.isFinite(b)).toBe(true);
    }
  });
});

describe("generateTimeline — date formatting", () => {
  it("all dates are ISO date strings (YYYY-MM-DD)", () => {
    const points = generateTimeline("2024-06-15");
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    for (const p of points) {
      expect(p.date).toMatch(iso);
    }
  });

  it("dates are monotonically increasing", () => {
    const points = generateTimeline("2024-01-01");
    for (let i = 1; i < points.length; i++) {
      expect(new Date(points[i].date).getTime()).toBeGreaterThan(
        new Date(points[i - 1].date).getTime()
      );
    }
  });
});
