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

  it("does not evict when updating an existing key at capacity", () => {
    const smallCache = new TTLCache(3);
    smallCache.set("a", 1, 60000);
    smallCache.set("b", 2, 60000);
    smallCache.set("c", 3, 60000);
    // Update "c" (not the oldest) — must NOT evict "a"
    smallCache.set("c", 30, 60000);

    expect(smallCache.get("a")).toBe(1);
    expect(smallCache.get("b")).toBe(2);
    expect(smallCache.get("c")).toBe(30);
    expect(smallCache.size).toBe(3);
  });

  it("does not evict when updating the oldest key at capacity", () => {
    const smallCache = new TTLCache(3);
    smallCache.set("a", 1, 60000);
    smallCache.set("b", 2, 60000);
    smallCache.set("c", 3, 60000);
    // Update "a" (the oldest) — should NOT evict "b"
    smallCache.set("a", 10, 60000);

    expect(smallCache.get("a")).toBe(10);
    expect(smallCache.get("b")).toBe(2);
    expect(smallCache.get("c")).toBe(3);
    expect(smallCache.size).toBe(3);
  });

  it("still evicts oldest when inserting a genuinely new key at capacity", () => {
    const smallCache = new TTLCache(3);
    smallCache.set("a", 1, 60000);
    smallCache.set("b", 2, 60000);
    smallCache.set("c", 3, 60000);
    smallCache.set("d", 4, 60000); // new key → evict "a"

    expect(smallCache.get("a")).toBeNull();
    expect(smallCache.get("d")).toBe(4);
    expect(smallCache.size).toBe(3);
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
