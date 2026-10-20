import { describe, expect, it } from "vitest";
import { assignSlots, BEHIND, Lru, POOL_SIZE, SlotTable, slotOf, windowStart } from "../pool";

const PATH_1965 = 3_100; // weeks from 2026 back to March 1965

describe("assignSlots", () => {
  it("never asks for more than the pool on a 3,100-week flight", () => {
    for (let cam = 0; cam <= PATH_1965; cam += 0.37) {
      const weeks = assignSlots(cam, PATH_1965, POOL_SIZE);
      expect(weeks.length).toBeLessThanOrEqual(POOL_SIZE);
      expect(weeks.length).toBe(POOL_SIZE);
    }
  });
  it("covers the camera week and the weeks just behind it", () => {
    for (const cam of [0, 1, 37.5, 1500, PATH_1965 - 1]) {
      const weeks = assignSlots(cam, PATH_1965, POOL_SIZE);
      expect(weeks).toContain(Math.floor(cam));
      if (cam >= BEHIND && cam < PATH_1965 - POOL_SIZE) expect(weeks[0]).toBe(Math.floor(cam) - BEHIND);
    }
  });
  it("maps every window onto distinct slots", () => {
    for (let cam = 0; cam <= PATH_1965; cam += 13) {
      const slots = assignSlots(cam, PATH_1965, POOL_SIZE).map((w) => slotOf(w, POOL_SIZE));
      expect(new Set(slots).size).toBe(slots.length);
    }
  });
  it("stays inside the path at both ends", () => {
    expect(windowStart(-5, PATH_1965, POOL_SIZE)).toBe(0);
    const tail = assignSlots(PATH_1965 + 50, PATH_1965, POOL_SIZE);
    expect(tail[tail.length - 1]).toBe(PATH_1965 - 1);
  });
  it("handles a path shorter than the pool", () => {
    expect(assignSlots(3, 40, POOL_SIZE)).toEqual(Array.from({ length: 40 }, (_, i) => i));
  });
});

describe("SlotTable", () => {
  it("flies 3,100 weeks with 120 meshes and rewrites each week once", () => {
    const table = new SlotTable(POOL_SIZE);
    const used = new Set<number>();
    let rewrites = 0;
    for (let cam = 0; cam <= PATH_1965; cam += 22.4) {
      const start = windowStart(cam, PATH_1965, POOL_SIZE);
      rewrites += table.sync(start, POOL_SIZE, (slot) => used.add(slot));
      // no slot holds a week outside the window after a sync
      expect(table.stale(start, POOL_SIZE)).toEqual([]);
    }
    expect(used.size).toBeLessThanOrEqual(POOL_SIZE);
    // every week materialised once, never twice
    expect(rewrites).toBe(PATH_1965);
  });
  it("rewrites only the weeks crossed when the camera creeps forward", () => {
    const table = new SlotTable(POOL_SIZE);
    table.sync(windowStart(100, PATH_1965, POOL_SIZE), POOL_SIZE, () => {});
    const n = table.sync(windowStart(103, PATH_1965, POOL_SIZE), POOL_SIZE, () => {});
    expect(n).toBe(3);
  });
  it("invalidate forces a full rewrite (layout change)", () => {
    const table = new SlotTable(POOL_SIZE);
    table.sync(0, POOL_SIZE, () => {});
    table.invalidate();
    expect(table.sync(0, POOL_SIZE, () => {})).toBe(POOL_SIZE);
  });
});

describe("Lru", () => {
  it("evicts the least recently used entry and never one in use this frame", () => {
    const evicted: number[] = [];
    const lru = new Lru<string>(3, (k) => evicted.push(k));
    lru.set(1, "a", 1);
    lru.set(2, "b", 2);
    lru.set(3, "c", 3);
    lru.touch(1, 4);
    lru.set(4, "d", 4); // 2 is oldest
    expect(evicted).toEqual([2]);
    expect(lru.has(1)).toBe(true);
  });
  it("runs over capacity rather than evicting what is on screen", () => {
    const evicted: number[] = [];
    const lru = new Lru<string>(2, (k) => evicted.push(k));
    lru.set(1, "a", 9);
    lru.set(2, "b", 9);
    lru.set(3, "c", 9);
    expect(evicted).toEqual([]);
    expect(lru.size).toBe(3);
    lru.evict(10);
    expect(lru.size).toBe(2);
  });
  it("disposes everything on clear", () => {
    const evicted: number[] = [];
    const lru = new Lru<string>(4, (k) => evicted.push(k));
    lru.set(1, "a", 1);
    lru.set(2, "b", 1);
    lru.clear();
    expect(evicted.sort()).toEqual([1, 2]);
    expect(lru.size).toBe(0);
  });
});
