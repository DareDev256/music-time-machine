import { describe, it, expect } from "vitest";
import { TTLCache } from "../cache";

describe("TTLCache.delete normalization", () => {
  it("deletes entries set with equivalent unicode keys", () => {
    const cache = new TTLCache(10);
    // e-acute as single codepoint vs combining sequence
    cache.set("caf\u00E9", "value", 60_000);
    cache.delete("cafe\u0301"); // combining form — must normalize to match
    expect(cache.has("caf\u00E9")).toBe(false);
  });

  it("deletes entries containing zero-width chars in the key", () => {
    const cache = new TTLCache(10);
    cache.set("key", "value", 60_000);
    cache.delete("key\u200B"); // zero-width space stripped by normalizeKey
    expect(cache.has("key")).toBe(false);
  });
});

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
