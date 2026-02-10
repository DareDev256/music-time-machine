import { describe, it, expect, vi, beforeEach } from "vitest";
import { TTLCache } from "../cache";

describe("TTLCache", () => {
  let cache: TTLCache;

  beforeEach(() => {
    cache = new TTLCache(10);
  });

  it("stores and retrieves values", () => {
    cache.set("key1", "value1", 60000);
    expect(cache.get("key1")).toBe("value1");
  });

  it("returns null for missing keys", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("expires entries after TTL", () => {
    vi.useFakeTimers();
    cache.set("key1", "value1", 1000);
    expect(cache.get("key1")).toBe("value1");

    vi.advanceTimersByTime(1001);
    expect(cache.get("key1")).toBeNull();

    vi.useRealTimers();
  });

  it("respects max size by evicting oldest", () => {
    const smallCache = new TTLCache(3);
    smallCache.set("a", 1, 60000);
    smallCache.set("b", 2, 60000);
    smallCache.set("c", 3, 60000);
    smallCache.set("d", 4, 60000); // should evict "a"

    expect(smallCache.get("a")).toBeNull();
    expect(smallCache.get("d")).toBe(4);
  });

  it("reports correct size", () => {
    cache.set("a", 1, 60000);
    cache.set("b", 2, 60000);
    expect(cache.size).toBe(2);
  });

  it("deletes specific keys", () => {
    cache.set("key1", "value1", 60000);
    cache.delete("key1");
    expect(cache.get("key1")).toBeNull();
  });

  it("clears all entries", () => {
    cache.set("a", 1, 60000);
    cache.set("b", 2, 60000);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
