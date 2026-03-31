import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── localStorage mock ──────────────────────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const key in store) delete store[key];
  }),
  get length() {
    return Object.keys(store).length;
  },
  key: vi.fn(() => null),
};

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Must import AFTER localStorage is defined so initCache() reads it
const { useRecentlyViewed } = await import("../useRecentlyViewed");

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Snapshot stability ─────────────────────────────────────────────────────

describe("useRecentlyViewed — snapshot stability", () => {
  it("returns the same reference on consecutive renders when data hasn't changed", () => {
    const { result, rerender } = renderHook(() => useRecentlyViewed());

    const first = result.current.songs;
    rerender();
    const second = result.current.songs;

    // React's useSyncExternalStore requires Object.is stability
    expect(first).toBe(second);
  });

  it("returns a new reference after recording a song", () => {
    const { result } = renderHook(() => useRecentlyViewed());

    const before = result.current.songs;

    act(() => {
      result.current.record({
        id: "test-1",
        title: "Test Song",
        artist: "Test Artist",
        albumArt: "",
      });
    });

    const after = result.current.songs;

    expect(before).not.toBe(after);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe("test-1");
  });

  it("maintains FIFO order with max 8 entries", () => {
    const { result } = renderHook(() => useRecentlyViewed());

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.record({
          id: `song-${i}`,
          title: `Song ${i}`,
          artist: "Artist",
          albumArt: "",
        });
      }
    });

    const songs = result.current.songs;
    expect(songs).toHaveLength(8);
    // Most recent should be first
    expect(songs[0].id).toBe("song-9");
    // Oldest surviving should be last
    expect(songs[7].id).toBe("song-2");
  });

  it("deduplicates by moving re-viewed songs to front", () => {
    const { result } = renderHook(() => useRecentlyViewed());

    act(() => {
      result.current.record({ id: "a", title: "A", artist: "X", albumArt: "" });
      result.current.record({ id: "b", title: "B", artist: "X", albumArt: "" });
      result.current.record({ id: "a", title: "A", artist: "X", albumArt: "" });
    });

    const songs = result.current.songs;
    expect(songs).toHaveLength(2);
    expect(songs[0].id).toBe("a");
    expect(songs[1].id).toBe("b");
  });

  it("degrades gracefully when localStorage throws", () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });

    const { result } = renderHook(() => useRecentlyViewed());

    // Should not throw
    act(() => {
      result.current.record({
        id: "fail",
        title: "Fail",
        artist: "X",
        albumArt: "",
      });
    });

    // Hook still works, data just wasn't persisted
    expect(result.current.songs).toBeDefined();
  });
});
