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
});
