import { describe, expect, it } from "vitest";
import { canopyFrame, hudZones, labelBox, pickBranches, PHONE_MAX_LABELS, shortLabel, type Rect } from "../labels";

const hit = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe.each([
  { name: "phone 390×844", w: 390, h: 844, narrow: true, labelH: 30 },
  { name: "desktop 1440×900", w: 1440, h: 900, narrow: false, labelH: 38 },
])("canopyFrame on $name", ({ w, h, narrow, labelH }) => {
  for (const n of narrow ? [3, 5, PHONE_MAX_LABELS] : [3, 5, 8]) {
    for (const seed of [0, 754, 3161]) {
      const nr = narrow ? Math.ceil(n / 2) : Math.round(n * 0.55);
      const f = canopyFrame(n - nr, nr, { w, h, narrow }, seed);
      const boxes = [
        ...f.left.map((p) => labelBox(p, "left", f.labelMaxW, labelH, f.labelGap)),
        ...f.right.map((p) => labelBox(p, "right", f.labelMaxW, labelH, f.labelGap)),
      ];
      const cover: Rect = { x0: f.dest.x - f.destW / 2, y0: f.dest.y - f.destW / 2, x1: f.dest.x + f.destW / 2, y1: f.dest.y + f.destW / 2 };
      it(`${n} branches, seed ${seed}: labels on screen, out of the HUD zones, apart, off the cover`, () => {
        for (const b of boxes) {
          expect(b.x0).toBeGreaterThanOrEqual(16);
          expect(b.x1).toBeLessThanOrEqual(w - 16);
          for (const z of f.hud) expect(hit(b, z)).toBe(false);
          expect(hit(b, cover)).toBe(false);
        }
        for (const z of f.hud) expect(hit(cover, z)).toBe(false);
        // desktop: no label reaches into the left 45%, where the page's passing title can grow
        if (!narrow) for (const b of boxes) expect(b.x0).toBeGreaterThanOrEqual(0.45 * w);
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(hit(boxes[i], boxes[j])).toBe(false);
      });
    }
  }
  it("is not a mirrored fan: the two columns differ", () => {
    const f = canopyFrame(4, 4, { w, h, narrow }, 754);
    const mirrored = f.left.every((p, k) => Math.abs(p.y - f.right[k].y) < 2 && Math.abs(f.dest.x - p.x - (f.right[k].x - f.dest.x)) < 2);
    expect(mirrored).toBe(false);
  });
});

describe("hudZones", () => {
  it("matches the console as drawn: phone top 24%, and from 53.5% down (a two-line title starts at ~54%)", () => {
    const z = hudZones(390, 844, true);
    expect(z[0].y1).toBeCloseTo(0.24 * 844);
    expect(z[1].y0).toBeCloseTo(0.535 * 844);
  });
  it("matches the console: desktop top-left, top-right readouts, bottom-left title", () => {
    const z = hudZones(1440, 900, false);
    expect(z).toHaveLength(3);
    expect(z[1].x0).toBeCloseTo(0.7 * 1440);
    expect(z[2].x1).toBeCloseTo(0.45 * 1440);
  });
});

describe("shortLabel", () => {
  it("keeps a short chart label, swaps a long one for the lane name", () => {
    expect(shortLabel("Rap", "Rap", true)).toBe("Rap");
    expect(shortLabel("Alternative Airplay (Modern Rock Tracks)", "Rock / Alt", false)).toBe("Rock / Alt");
    expect(shortLabel("Hot R&B/Hip-Hop Songs", "R&B / Hip-Hop", true)).toBe("R&B / Hip-Hop");
  });
});

describe("pickBranches", () => {
  const lanes = ["rnb", "country", "uk", "dance", "latin", "rock", "rap", "canada"].map((lane) => ({ lane, mine: lane === "canada" }));
  it("keeps the visitor's own lane and the first others, in their order", () => {
    const got = pickBranches(lanes, 6).map((b) => b.lane);
    expect(got).toHaveLength(6);
    expect(got).toContain("canada");
    expect(got).toEqual(["rnb", "country", "uk", "dance", "latin", "canada"]);
  });
  it("leaves a short list alone", () => {
    expect(pickBranches(lanes.slice(0, 3), 6)).toHaveLength(3);
  });
});
