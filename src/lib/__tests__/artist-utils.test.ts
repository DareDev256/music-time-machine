import { describe, it, expect } from "vitest";
import { splitArtists, primaryArtist } from "../artist-utils";

describe("splitArtists", () => {
  it("returns a single artist unchanged", () => {
    expect(splitArtists("Adele")).toEqual(["adele"]);
  });

  it("splits on 'ft.'", () => {
    expect(splitArtists("Drake ft. Rihanna")).toEqual(["drake", "rihanna"]);
  });

  it("splits on 'feat.'", () => {
    expect(splitArtists("Kendrick Lamar feat. SZA")).toEqual(["kendrick lamar", "sza"]);
  });

  it("splits on 'feat' without period", () => {
    expect(splitArtists("Post Malone feat Swae Lee")).toEqual(["post malone", "swae lee"]);
  });

  it("splits on 'with'", () => {
    expect(splitArtists("Lady Gaga with Bradley Cooper")).toEqual(["lady gaga", "bradley cooper"]);
  });

  it("splits on commas", () => {
    expect(splitArtists("Migos, Drake, Lil Wayne")).toEqual(["migos", "drake", "lil wayne"]);
  });

  it("splits '&' when both sides are real names (≥2 chars)", () => {
    expect(splitArtists("Simon & Garfunkel")).toEqual(["simon", "garfunkel"]);
  });

  it("preserves 'R&B' as one token (short segment around &)", () => {
    // "R" is only 1 char — should NOT split
    expect(splitArtists("R&B")).toEqual(["r&b"]);
  });

  it("handles combined separators", () => {
    expect(splitArtists("DJ Khaled ft. Drake, Lil Wayne & Rick Ross")).toEqual([
      "dj khaled", "drake", "lil wayne", "rick ross",
    ]);
  });

  it("trims whitespace and normalizes to lowercase", () => {
    expect(splitArtists("  The Weeknd  ")).toEqual(["the weeknd"]);
  });

  it("returns empty array for non-string input", () => {
    // Runtime safety — TypeScript won't catch this at call sites from API data
    expect(splitArtists(undefined as unknown as string)).toEqual([]);
    expect(splitArtists(null as unknown as string)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(splitArtists("")).toEqual([]);
  });
});

describe("primaryArtist", () => {
  it("returns the first-billed artist", () => {
    expect(primaryArtist("Drake ft. Rihanna")).toBe("drake");
  });

  it("falls back to trimmed lowercase for solo artists", () => {
    expect(primaryArtist("  Beyoncé  ")).toBe("beyoncé");
  });

  it("returns empty string for non-string input", () => {
    expect(primaryArtist(null as unknown as string)).toBe("");
  });
});
