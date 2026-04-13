import { describe, it, expect, vi, beforeEach } from "vitest";
import { TTLCache } from "../cache";

/**
 * Tests for cache-poisoning defenses (normalizeKey) and untested public API
 * surface: getStats(), has() expiry behavior, and unicode normalization attacks.
 *
 * These complement cache.test.ts which covers basic CRUD and TTL eviction.
 */

describe("TTLCache — key normalization (cache-poisoning defense)", () => {
  let cache: TTLCache;

  beforeEach(() => {
    cache = new TTLCache(50);
  });

  it("treats NFC and NFD forms of the same string as one key", () => {
    // "Beyoncé" in NFC (single codepoint) vs NFD (e + combining accent)
    const nfc = "Beyonc\u00E9";           // é as single char
    const nfd = "Beyonce\u0301";           // e + combining acute accent
    cache.set(nfc, "first", 60_000);
    cache.set(nfd, "second", 60_000);

    expect(cache.size).toBe(1);
    expect(cache.get(nfc)).toBe("second");
  });

  it("ignores zero-width characters injected into keys", () => {
    cache.set("drake", "original", 60_000);
    // Attacker tries zero-width space to create a parallel entry
    cache.set("dra\u200Bke", "poisoned", 60_000);

    expect(cache.size).toBe(1);
    expect(cache.get("drake")).toBe("poisoned");
  });

  it("strips BOM (\\uFEFF) from keys", () => {
    cache.set("\uFEFFquery", "with-bom", 60_000);
    expect(cache.get("query")).toBe("with-bom");
    expect(cache.size).toBe(1);
  });

  it("strips control characters (\\x00-\\x1F) from keys", () => {
    cache.set("hello\x00world", "null-byte", 60_000);
    expect(cache.get("helloworld")).toBe("null-byte");
  });

  it("strips RTL/LTR override characters from keys", () => {
    cache.set("test\u200Fvalue", "rtl-injected", 60_000);
    expect(cache.get("testvalue")).toBe("rtl-injected");
    expect(cache.size).toBe(1);
  });
});

describe("TTLCache — has() expiry behavior", () => {
  it("returns false for expired entries (has triggers expiry check)", () => {
    vi.useFakeTimers();
    const cache = new TTLCache(10);
    cache.set("key", "val", 500);

    expect(cache.has("key")).toBe(true);
    vi.advanceTimersByTime(501);
    expect(cache.has("key")).toBe(false);

    vi.useRealTimers();
  });

  it("evicts expired entry from internal map on has() check", () => {
    vi.useFakeTimers();
    const cache = new TTLCache(10);
    cache.set("ephemeral", "data", 100);
    expect(cache.size).toBe(1);

    vi.advanceTimersByTime(101);
    cache.has("ephemeral"); // should trigger cleanup
    expect(cache.size).toBe(0);

    vi.useRealTimers();
  });
});

describe("TTLCache — getStats()", () => {
  it("reports correct stats for empty cache", () => {
    const cache = new TTLCache(100);
    expect(cache.getStats()).toEqual({ size: 0, maxSize: 100, utilization: 0 });
  });

  it("calculates utilization as ratio of size/maxSize", () => {
    const cache = new TTLCache(4);
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);

    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.maxSize).toBe(4);
    expect(stats.utilization).toBe(0.5);
  });

  it("reports 1.0 utilization at full capacity", () => {
    const cache = new TTLCache(2);
    cache.set("x", 1, 60_000);
    cache.set("y", 2, 60_000);

    expect(cache.getStats().utilization).toBe(1);
  });

  it("handles maxSize of 0 without division error", () => {
    const cache = new TTLCache(0);
    expect(cache.getStats().utilization).toBe(0);
  });
});
