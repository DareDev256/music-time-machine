import { describe, it, expect } from "vitest";
import { formatCompact } from "../formatNumber";

describe("formatCompact", () => {
  it("formats billions with B suffix", () => {
    expect(formatCompact(2_400_000_000)).toBe("2.4B");
    expect(formatCompact(1_000_000_000)).toBe("1.0B");
  });

  it("formats millions with M suffix", () => {
    expect(formatCompact(770_000_000)).toBe("770.0M");
    expect(formatCompact(1_500_000)).toBe("1.5M");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCompact(50_000)).toBe("50.0K");
    expect(formatCompact(1_000)).toBe("1.0K");
  });

  it("returns raw number below 1000", () => {
    expect(formatCompact(999)).toBe("999");
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(42)).toBe("42");
  });

  it("parses numeric strings (YouTube API pattern)", () => {
    expect(formatCompact("1234567")).toBe("1.2M");
    expect(formatCompact("500")).toBe("500");
    expect(formatCompact("2500000000")).toBe("2.5B");
  });

  it("returns N/A for undefined and null", () => {
    expect(formatCompact(undefined)).toBe("N/A");
    expect(formatCompact(null)).toBe("N/A");
  });

  it("returns N/A for empty string", () => {
    expect(formatCompact("")).toBe("N/A");
  });

  it("returns original string for non-numeric strings", () => {
    expect(formatCompact("not-a-number")).toBe("not-a-number");
  });

  it("handles NaN number input", () => {
    expect(formatCompact(NaN)).toBe("N/A");
  });
});
