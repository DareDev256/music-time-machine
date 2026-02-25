import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSongData } from "../useSongData";

const mockSong = {
  id: "bohemian-rhapsody",
  title: "Bohemian Rhapsody",
  artist: "Queen",
  albumArt: "https://example.com/album.jpg",
  releaseDate: "1975-10-31",
  spotify: null,
  youtube: null,
  billboard: null,
  genius: null,
  timeline: [],
};

const mockCatalog = [mockSong];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useSongData", () => {
  it("returns loading state initially", () => {
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    const { result } = renderHook(() => useSongData("bohemian-rhapsody"));

    expect(result.current.loading).toBe(true);
    expect(result.current.song).toBeNull();
    expect(result.current.catalog).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("fetches song and catalog in parallel", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/song/"))
        return Promise.resolve(
          new Response(JSON.stringify(mockSong), { status: 200 }),
        );
      if (url.includes("/api/catalog"))
        return Promise.resolve(
          new Response(JSON.stringify(mockCatalog), { status: 200 }),
        );
      return Promise.resolve(new Response("", { status: 404 }));
    });

    const { result } = renderHook(() => useSongData("bohemian-rhapsody"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.song).toEqual(mockSong);
    expect(result.current.catalog).toEqual(mockCatalog);
    expect(result.current.error).toBeNull();
  });

  it("sets error when song returns 404", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/song/"))
        return Promise.resolve(new Response("", { status: 404 }));
      return Promise.resolve(
        new Response(JSON.stringify([]), { status: 200 }),
      );
    });

    const { result } = renderHook(() => useSongData("nonexistent"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Song not found");
    expect(result.current.song).toBeNull();
  });

  it("sets generic error on non-404 failure", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/song/"))
        return Promise.resolve(new Response("", { status: 500 }));
      return Promise.resolve(
        new Response(JSON.stringify([]), { status: 200 }),
      );
    });

    const { result } = renderHook(() => useSongData("broken"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Failed to load song data");
  });

  it("handles fetch network error gracefully", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("Network error"));

    const { result } = renderHook(() => useSongData("offline-song"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Failed to load song data");
    expect(result.current.song).toBeNull();
  });

  it("still returns song when catalog fails", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/song/"))
        return Promise.resolve(
          new Response(JSON.stringify(mockSong), { status: 200 }),
        );
      return Promise.resolve(new Response("", { status: 500 }));
    });

    const { result } = renderHook(() => useSongData("bohemian-rhapsody"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.song).toEqual(mockSong);
    expect(result.current.catalog).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("aborts in-flight requests on unmount", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");

    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise(() => {}),
    );

    const { unmount } = renderHook(() => useSongData("will-unmount"));

    unmount();

    expect(abortSpy).toHaveBeenCalled();
  });
});
