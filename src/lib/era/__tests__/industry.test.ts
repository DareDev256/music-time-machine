// @vitest-environment node
import { describe, it, expect } from "vitest";
import { industryFor } from "../data";
import { industrySentence, industryItems } from "@/components/era/Industry";

// Real public/era/industry.json (RIAA wholesale). Expected numbers come from the pipeline's own report.
describe("industry", () => {
  it("1999: an all-physical year names its formats, not 'Physical 100%'", () => {
    const y = industryFor(1999)!;
    expect(y.top).toBe("physical");
    expect(industrySentence(y)).toBe("CDs were 88% of label revenue and cassettes 7%. Streaming and downloads did not exist yet.");
    expect(industryItems(y).map((i) => i.label)).toContain("CDs");
  });
  it("1985: cassettes led", () => {
    expect(industrySentence(industryFor(1985)!)).toMatch(/^Cassettes were 5\d% of label revenue, vinyl 3\d% and CDs \d+%\./);
  });
  it("2012: the sentence names only what the bar shows", () => {
    const y = industryFor(2012)!;
    expect(industrySentence(y)).toBe("Downloads were 45% of label revenue, physical formats 33% and streaming 17%.");
    const labels = industryItems(y).map((i) => i.label.toLowerCase());
    for (const word of ["downloads", "physical formats", "streaming"]) expect(labels).toContain(word);
  });
  it("2024: streaming leads", () => {
    const line = industrySentence(industryFor(2024)!);
    expect(line).toMatch(/^Streaming was 8\d% of label revenue/);
  });
  it("shares sum to one", () => {
    for (const year of [1975, 1999, 2012, 2024]) {
      const y = industryFor(year)!;
      const sum = Object.values(y.shares).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(0.02);
    }
  });
  it("has no year it was not given", () => {
    expect(industryFor(1960)).toBeNull();
  });
});
