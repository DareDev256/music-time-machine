import { describe, expect, it } from "vitest";
import { canopyFrame, labelBox, shortLabel, type Rect } from "../labels";

const hit = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe.each([
  { name: "phone 390×844", w: 390, h: 844, narrow: true, labelH: 30 },
  { name: "desktop 1440×900", w: 1440, h: 900, narrow: false, labelH: 38 },
])("canopyFrame on $name", ({ w, h, narrow, labelH }) => {
  for (const n of [3, 5, 8]) {
    const nl = Math.ceil(n / 2);
    const f = canopyFrame(nl, n - nl, { w, h, narrow });
    const boxes = [
      ...f.left.map((p) => labelBox(p, "left", f.labelMaxW, labelH, f.labelGap)),
      ...f.right.map((p) => labelBox(p, "right", f.labelMaxW, labelH, f.labelGap)),
    ];
    const cover: Rect = { x0: f.dest.x - f.destW / 2, y0: f.dest.y - f.destW / 2, x1: f.dest.x + f.destW / 2, y1: f.dest.y + f.destW / 2 };

    it(`${n} branches: every label stays on screen`, () => {
      for (const b of boxes) {
        expect(b.x0).toBeGreaterThanOrEqual(16);
        expect(b.x1).toBeLessThanOrEqual(w - 16);
        expect(b.y0).toBeGreaterThanOrEqual(0);
        expect(b.y1).toBeLessThanOrEqual(h);
      }
    });
    it(`${n} branches: no label, node or the cover sits in the DOM HUD`, () => {
      for (const b of [...boxes, cover]) for (const r of f.hud) expect(hit(b, r)).toBe(false);
    });
    it(`${n} branches: labels never overlap each other or the cover`, () => {
      for (let i = 0; i < boxes.length; i++) {
        expect(hit(boxes[i], cover)).toBe(false);
        for (let j = i + 1; j < boxes.length; j++) expect(hit(boxes[i], boxes[j])).toBe(false);
      }
    });
  }
  it("puts the landed cover where the HUD leaves room", () => {
    const f = canopyFrame(4, 4, { w, h, narrow });
    if (narrow) expect(f.dest.y + f.destW / 2).toBeLessThanOrEqual(0.55 * h);
    else expect(f.dest.x - f.destW / 2).toBeGreaterThanOrEqual(0.5 * w);
  });
});

describe("shortLabel", () => {
  it("keeps a short chart label, swaps a long one for the lane name", () => {
    expect(shortLabel("Rap", "Rap", true)).toBe("Rap");
    expect(shortLabel("Alternative Airplay (Modern Rock Tracks)", "Rock / Alt", false)).toBe("Rock / Alt");
    expect(shortLabel("Hot R&B/Hip-Hop Songs", "R&B / Hip-Hop", true)).toBe("R&B / Hip-Hop");
    expect(shortLabel("Hot R&B/Hip-Hop Songs", "R&B / Hip-Hop", false)).toBe("Hot R&B/Hip-Hop Songs");
  });
});
