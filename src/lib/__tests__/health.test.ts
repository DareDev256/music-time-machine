import { describe, it, expect } from "vitest";
import { TTLCache } from "../cache";

describe("TTLCache.getStats", () => {
  it("returns zero utilization on empty cache", () => {
    const cache = new TTLCache(100);
    const stats = cache.getStats();
    expect(stats).toEqual({ size: 0, maxSize: 100, utilization: 0 });
  });

  it("reports correct utilization after inserts", () => {
    const cache = new TTLCache(4);
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);
    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.maxSize).toBe(4);
    expect(stats.utilization).toBe(0.5);
  });

  it("shows 1.0 utilization when full", () => {
    const cache = new TTLCache(2);
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);
    expect(cache.getStats().utilization).toBe(1);
  });

  it("handles maxSize of 0 without division error", () => {
    const cache = new TTLCache(0);
    expect(cache.getStats().utilization).toBe(0);
  });
});
