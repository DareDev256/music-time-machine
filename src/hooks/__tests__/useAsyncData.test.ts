import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAsyncData } from "../useAsyncData";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useAsyncData", () => {
  // ── State transitions ─────────────────────────────────────────────

  it("starts in loading state on mount (idle → loading)", () => {
    const fetcher = vi.fn(() => new Promise<string>(() => {})); // never resolves

    const { result } = renderHook(() => useAsyncData(fetcher, []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("transitions to success with data on resolve", async () => {
    const payload = { songs: ["a", "b"], count: 2 };
    const fetcher = vi.fn(() => Promise.resolve(payload));

    const { result } = renderHook(() => useAsyncData(fetcher, []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(payload);
    expect(result.current.error).toBeNull();
  });

  it("transitions to error state on rejection", async () => {
    const fetcher = vi.fn(() =>
      Promise.reject(new Error("API rate limit exceeded")),
    );

    const { result } = renderHook(() => useAsyncData(fetcher, []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("API rate limit exceeded");
    expect(result.current.data).toBeNull();
  });

  it("falls back to generic message when error has no message", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("")));

    const { result } = renderHook(() => useAsyncData(fetcher, []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("An error occurred");
  });

  it("handles non-Error rejection values", async () => {
    const fetcher = vi.fn(() => Promise.reject("string rejection"));

    const { result } = renderHook(() => useAsyncData(fetcher, []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // String coerced: (err as Error).message is undefined → fallback
    expect(result.current.error).toBe("An error occurred");
  });

  // ── AbortController behaviour ─────────────────────────────────────

  it("passes AbortSignal to the fetcher", () => {
    const fetcher = vi.fn(() => new Promise<null>(() => {}));

    renderHook(() => useAsyncData(fetcher, []));

    expect(fetcher).toHaveBeenCalledTimes(1);
    const signal = fetcher.mock.calls[0][0];
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts in-flight request on unmount", () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    const fetcher = vi.fn(() => new Promise<string>(() => {}));

    const { unmount } = renderHook(() => useAsyncData(fetcher, []));
    unmount();

    expect(abortSpy).toHaveBeenCalledTimes(1);
  });

  it("swallows AbortError without updating state", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    const fetcher = vi.fn(() => Promise.reject(abortError));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useAsyncData(fetcher, []));

    // Give the microtask queue time to flush
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Still loading because AbortError is swallowed — no ERROR dispatch
    expect(result.current.error).toBeNull();
    // Should NOT log AbortErrors
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("ignores success dispatch after signal is aborted", async () => {
    // Simulate: fetch starts, gets aborted, then resolves (race condition)
    let resolveOuter: (v: string) => void;
    const fetcher = vi.fn(
      (signal: AbortSignal) =>
        new Promise<string>((resolve) => {
          resolveOuter = resolve;
          // Listen for abort to still resolve (simulating network race)
          signal.addEventListener("abort", () => resolve("stale data"));
        }),
    );

    const { result, unmount } = renderHook(() => useAsyncData(fetcher, []));

    // Unmount triggers abort, which resolves the promise with "stale data"
    unmount();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Data should remain null — aborted signal guards the SUCCESS dispatch
    expect(result.current.data).toBeNull();
  });

  // ── Dependency-driven re-fetch ────────────────────────────────────

  it("re-fetches when dependencies change", async () => {
    let callCount = 0;
    const fetcher = vi.fn((signal: AbortSignal) => {
      callCount++;
      return Promise.resolve(`result-${callCount}`);
    });

    const { result, rerender } = renderHook(
      ({ id }) => useAsyncData(fetcher, [id]),
      { initialProps: { id: "first" } },
    );

    await waitFor(() => expect(result.current.data).toBe("result-1"));

    rerender({ id: "second" });

    await waitFor(() => expect(result.current.data).toBe("result-2"));

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("aborts previous request when deps change", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    const fetcher = vi.fn(() => new Promise<string>(() => {})); // never resolves

    const { rerender } = renderHook(
      ({ id }) => useAsyncData(fetcher, [id]),
      { initialProps: { id: "a" } },
    );

    rerender({ id: "b" });

    // First request should be aborted when deps change
    expect(abortSpy).toHaveBeenCalledTimes(1);
  });

  // ── Error logging ────────────────────────────────────────────────

  it("logs non-abort errors to console.error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("timeout");
    const fetcher = vi.fn(() => Promise.reject(error));

    const { result } = renderHook(() => useAsyncData(fetcher, []));

    await waitFor(() => expect(result.current.error).toBe("timeout"));

    expect(consoleSpy).toHaveBeenCalledWith(
      "useAsyncData fetch error:",
      error,
    );
  });

  // ── Type safety through public API ────────────────────────────────

  it("returns typed data matching the generic parameter", async () => {
    type Album = { title: string; year: number };
    const album: Album = { title: "A Night at the Opera", year: 1975 };
    const fetcher = vi.fn(() => Promise.resolve(album));

    const { result } = renderHook(() => useAsyncData<Album>(fetcher, []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // TypeScript compile check — accessing .title wouldn't work if typing is wrong
    expect(result.current.data?.title).toBe("A Night at the Opera");
    expect(result.current.data?.year).toBe(1975);
  });
});
