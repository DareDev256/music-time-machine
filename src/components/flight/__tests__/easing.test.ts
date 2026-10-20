import { describe, expect, it } from "vitest";
import { ease, easeVelocity, flightDuration, warp, yearsBetween } from "../easing";

describe("flightDuration", () => {
  it("scales with distance: 14 years ≈ 4.18 s", () => {
    expect(flightDuration(14)).toBeCloseTo(4.18, 5);
  });
  it("never shorter than 2.6 s", () => {
    expect(flightDuration(0)).toBe(2.6);
    expect(flightDuration(1)).toBe(2.6);
  });
  it("never longer than 7 s", () => {
    expect(flightDuration(68)).toBe(7);
    expect(flightDuration(500)).toBe(7);
  });
  it("treats garbage as zero distance", () => {
    expect(flightDuration(Number.NaN)).toBe(2.6);
  });
});

describe("ease", () => {
  it("starts at 0 and ends at 1", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });
  it("is monotonic over 101 samples", () => {
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const v = ease(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it("covers most of the distance early (fast out, long glide in)", () => {
    expect(ease(0.35)).toBeGreaterThan(0.5);
    expect(ease(0.9)).toBeGreaterThan(0.99);
  });
  it("clamps outside 0..1", () => {
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });
  it("matches its analytic derivative", () => {
    for (const x of [0.1, 0.3, 0.49, 0.51, 0.7, 0.95]) {
      const num = (ease(x + 1e-6) - ease(x - 1e-6)) / 2e-6;
      expect(easeVelocity(x)).toBeCloseTo(num, 3);
    }
  });
});

describe("warp", () => {
  it("is 0..1 and zero once landed", () => {
    for (let i = 0; i <= 100; i++) {
      const w = warp(i / 100, 3565, 7);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
    expect(warp(1, 3565, 7)).toBe(0);
  });
  it("saturates on a long flight and stays low on a short one", () => {
    expect(warp(0.05, 3565, 7)).toBe(1);
    expect(warp(0.05, 20, 2.6)).toBeLessThan(0.1);
  });
  it("is zero for a zero-length flight", () => {
    expect(warp(0.3, 0, 3)).toBe(0);
  });
});

describe("yearsBetween", () => {
  it("measures 2026-09-19 → 2012-04-28 as ~14.4 years", () => {
    expect(yearsBetween("2026-09-19", "2012-04-28")).toBeCloseTo(14.39, 1);
  });
});
