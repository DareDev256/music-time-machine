import { describe, expect, it } from "vitest";
import { layoutLabels, type LayoutView, type Placed } from "../labels";

const view: LayoutView = {
  w: 390,
  h: 844,
  margin: 16,
  top: 150,
  bottom: 560,
  avoid: { x0: 140, y0: 300, x1: 250, y1: 410 },
  gap: 10,
};

const overlaps = (a: Placed, b: Placed) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("layoutLabels", () => {
  // eight anchors on a ring round the cover, two of them nearly on top of each other
  const anchors = [
    { x: 195 + 150, y: 355 },
    { x: 195 + 106, y: 355 - 106 },
    { x: 195, y: 355 - 150 },
    { x: 195 - 106, y: 355 - 106 },
    { x: 195 - 150, y: 355 },
    { x: 195 - 106, y: 355 + 106 },
    { x: 195 + 100, y: 355 + 110 },
    { x: 195 + 104, y: 355 + 112 },
  ];
  const boxes = anchors.map(() => ({ w: 118, h: 34 }));
  const placed = layoutLabels(anchors, boxes, view);

  it("keeps every label inside the viewport band", () => {
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(view.margin);
      expect(p.x + p.w).toBeLessThanOrEqual(view.w - view.margin);
      expect(p.y).toBeGreaterThanOrEqual(view.top);
      expect(p.y + p.h).toBeLessThanOrEqual(view.bottom);
    }
  });

  it("never stacks two labels on top of each other", () => {
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j])).toBe(false);
  });

  it("never covers the destination cover", () => {
    const cover = { x: view.avoid.x0, y: view.avoid.y0, w: view.avoid.x1 - view.avoid.x0, h: view.avoid.y1 - view.avoid.y0 } as Placed;
    for (const p of placed) expect(overlaps(p, cover)).toBe(false);
  });

  it("puts each label on its anchor's side and leads its line from the anchor", () => {
    placed.forEach((p, i) => {
      expect(p.side).toBe(anchors[i].x < 195 ? "left" : "right");
      expect(p.from).toEqual(anchors[i]);
      // the leader ends on the label's edge
      const onEdge = p.to.x === p.x || p.to.x === p.x + p.w || p.to.y === p.y || p.to.y === p.y + p.h;
      expect(onEdge).toBe(true);
    });
  });
});

describe("layoutLabels on a phone with anchors near the edge", () => {
  // the 390 px landing for 2012-04-28: several branch points sit within ~60 px of the left edge
  const anchors = [
    { x: 150, y: 210 },
    { x: 101, y: 245 },
    { x: 122, y: 278 },
    { x: 130, y: 300 },
    { x: 51, y: 337 },
    { x: 112, y: 433 },
    { x: 213, y: 276 },
    { x: 270, y: 478 },
  ];
  const boxes = anchors.map(() => ({ w: 107, h: 31 }));
  const v = { ...view, avoid: { x0: 139, y0: 312, x1: 247, y1: 420 } };
  const placed = layoutLabels(anchors, boxes, v);
  it("never puts a label over its own anchor dot", () => {
    for (const p of placed) {
      const a = p.from;
      expect(a.x > p.x && a.x < p.x + p.w && a.y > p.y && a.y < p.y + p.h).toBe(false);
    }
  });
  it("never stacks two labels on a phone either", () => {
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const p = placed[i];
        const q = placed[j];
        expect(p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h).toBe(false);
      }
  });
  it("still keeps every label on screen", () => {
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(v.margin);
      expect(p.x + p.w).toBeLessThanOrEqual(v.w - v.margin);
    }
  });
});
