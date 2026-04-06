import { describe, it, expect, vi } from "vitest";
import { extractErrorMessage, apiCatch } from "../apiErrorHandler";

describe("extractErrorMessage", () => {
  it("extracts message from Error instances", () => {
    expect(extractErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("extracts message from Error subclasses", () => {
    expect(extractErrorMessage(new TypeError("bad type"))).toBe("bad type");
  });

  it("returns string errors directly", () => {
    expect(extractErrorMessage("network down")).toBe("network down");
  });

  it("returns fallback for non-Error objects", () => {
    expect(extractErrorMessage({ code: 500 })).toBe("Unknown error");
  });

  it("returns fallback for null", () => {
    expect(extractErrorMessage(null)).toBe("Unknown error");
  });

  it("returns fallback for undefined", () => {
    expect(extractErrorMessage(undefined)).toBe("Unknown error");
  });

  it("returns fallback for numbers", () => {
    expect(extractErrorMessage(42)).toBe("Unknown error");
  });
});

describe("apiCatch", () => {
  it("logs to console.error with context prefix", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    apiCatch("Spotify search", null, new Error("timeout"));
    expect(spy).toHaveBeenCalledWith("Spotify search error:", "timeout");
    spy.mockRestore();
  });

  it("returns the typed fallback (null)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = apiCatch("YouTube fetch", null, new Error("fail"));
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it("returns the typed fallback (empty array)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = apiCatch("Genius search", [] as string[], new Error("fail"));
    expect(result).toEqual([]);
    vi.restoreAllMocks();
  });

  it("handles non-Error thrown values", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    apiCatch("test", null, "raw string");
    expect(spy).toHaveBeenCalledWith("test error:", "raw string");
    spy.mockRestore();
  });
});
