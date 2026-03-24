import { describe, it, expect } from "vitest";
import {
  matchTextColor,
  matchRingColor,
  diversityTextColor,
  diversityBgColor,
  circleArcOffset,
  genreChipColor,
  reasonTagColor,
} from "../score-colors";

// ── Match score color tiers ──────────────────────────────────────────────────

describe("matchTextColor", () => {
  it("returns emerald for scores ≥ 80", () => {
    expect(matchTextColor(80)).toBe("text-emerald-400");
    expect(matchTextColor(100)).toBe("text-emerald-400");
  });

  it("returns sky for scores 60-79", () => {
    expect(matchTextColor(60)).toBe("text-sky-400");
    expect(matchTextColor(79)).toBe("text-sky-400");
  });

  it("returns amber for scores 40-59", () => {
    expect(matchTextColor(40)).toBe("text-amber-400");
    expect(matchTextColor(59)).toBe("text-amber-400");
  });

  it("returns muted foreground for scores below 40", () => {
    expect(matchTextColor(0)).toBe("text-foreground-secondary");
    expect(matchTextColor(39)).toBe("text-foreground-secondary");
  });

  it("handles exact boundary values without off-by-one", () => {
    // 79 should NOT be emerald — regression guard for >= vs >
    expect(matchTextColor(79)).not.toBe("text-emerald-400");
    expect(matchTextColor(80)).toBe("text-emerald-400");
  });
});

describe("matchRingColor", () => {
  it("maps to the same tier as matchTextColor", () => {
    expect(matchRingColor(85)).toBe("ring-emerald-400/30");
    expect(matchRingColor(50)).toBe("ring-amber-400/30");
    expect(matchRingColor(10)).toBe("ring-border");
  });
});

// ── Diversity score tiers (shifted thresholds) ──────────────────────────────

describe("diversityTextColor", () => {
  it("uses lower thresholds than match tiers (75 not 80)", () => {
    expect(diversityTextColor(75)).toBe("text-emerald-400");
    expect(diversityTextColor(74)).toBe("text-sky-400");
  });

  it("maps amber at 20-44 range (lower than match tier's 40-59)", () => {
    expect(diversityTextColor(20)).toBe("text-amber-400");
    expect(diversityTextColor(44)).toBe("text-amber-400");
    expect(diversityTextColor(19)).toBe("text-foreground-secondary");
  });
});

describe("diversityBgColor", () => {
  it("returns bg + border compound classes", () => {
    const result = diversityBgColor(80);
    expect(result).toContain("bg-emerald");
    expect(result).toContain("border-emerald");
  });

  it("falls back to foreground classes for low scores", () => {
    expect(diversityBgColor(0)).toContain("bg-foreground/5");
  });
});

// ── SVG arc math ─────────────────────────────────────────────────────────────

describe("circleArcOffset", () => {
  const circumference = 2 * Math.PI * 16;

  it("returns full circumference at score 0 (empty ring)", () => {
    expect(Number(circleArcOffset(0))).toBeCloseTo(circumference);
  });

  it("returns 0 at score 100 (full ring)", () => {
    expect(Number(circleArcOffset(100))).toBeCloseTo(0);
  });

  it("returns half circumference at score 50", () => {
    expect(Number(circleArcOffset(50))).toBeCloseTo(circumference / 2);
  });

  it("returns a string (SVG strokeDashoffset expects string)", () => {
    expect(typeof circleArcOffset(42)).toBe("string");
  });
});

// ── Genre chip colors ────────────────────────────────────────────────────────

describe("genreChipColor", () => {
  it("maps known genres to unique palettes", () => {
    const pop = genreChipColor("Pop");
    const rnb = genreChipColor("R&B");
    expect(pop).not.toBe(rnb);
    expect(pop).toContain("pink");
    expect(rnb).toContain("purple");
  });

  it("returns a fallback for unknown genres", () => {
    const fallback = genreChipColor("Vaporwave");
    expect(fallback).toContain("bg-foreground/10");
  });

  it("is case-sensitive (genre map uses exact keys)", () => {
    expect(genreChipColor("pop")).toContain("bg-foreground/10");
  });
});

// ── Reason tag colors ────────────────────────────────────────────────────────

describe("reasonTagColor", () => {
  it("returns purple for 'Unique genre'", () => {
    expect(reasonTagColor("Unique genre")).toContain("purple");
  });

  it("returns teal for 'Different era'", () => {
    expect(reasonTagColor("Different era")).toContain("teal");
  });

  it("returns generic dark overlay for any other reason", () => {
    expect(reasonTagColor("Similar vibe")).toBe("bg-black/70 text-white");
    expect(reasonTagColor("")).toBe("bg-black/70 text-white");
  });
});
