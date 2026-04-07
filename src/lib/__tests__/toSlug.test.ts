import { describe, it, expect } from "vitest";
import { toSlug } from "../toSlug";

describe("toSlug", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(toSlug("The Weeknd")).toBe("the-weeknd");
  });

  it("strips special characters", () => {
    expect(toSlug("Guns N' Roses")).toBe("guns-n-roses");
  });

  it("collapses consecutive non-alphanumeric chars into single hyphen", () => {
    expect(toSlug("AC/DC — Live")).toBe("ac-dc-live");
  });

  it("handles already-lowercase input", () => {
    expect(toSlug("drake")).toBe("drake");
  });

  it("handles numeric content", () => {
    expect(toSlug("Maroon 5")).toBe("maroon-5");
  });

  it("handles empty string", () => {
    expect(toSlug("")).toBe("");
  });

  // ── Bug fix: leading/trailing hyphens ──────────────────────────────

  it("strips leading hyphens from special-char prefix", () => {
    expect(toSlug("!!!Rock")).toBe("rock");
  });

  it("strips trailing hyphens from special-char suffix", () => {
    expect(toSlug("Rock!!!")).toBe("rock");
  });

  it("strips both leading and trailing hyphens", () => {
    expect(toSlug("  !!!Rock!!!  ")).toBe("rock");
  });

  it("returns empty string for all-special-character input", () => {
    expect(toSlug("$$$%%%")).toBe("");
  });

  it("handles whitespace-only input", () => {
    expect(toSlug("   ")).toBe("");
  });

  // ── Unicode diacritics ─────────────────────────────────────────────

  it("normalizes accented characters to ASCII", () => {
    expect(toSlug("Beyoncé")).toBe("beyonce");
  });

  it("normalizes multiple diacritics", () => {
    expect(toSlug("Motörhead")).toBe("motorhead");
  });

  it("handles mixed unicode and special chars", () => {
    expect(toSlug("Sigur Rós — (  )")).toBe("sigur-ros");
  });
});
