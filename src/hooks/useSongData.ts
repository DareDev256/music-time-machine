"use client";

import { SongData } from "@/types";
import { useAsyncData } from "./useAsyncData";

interface SongBundle {
  song: SongData;
  catalog: SongData[];
}

/**
 * Fetches song detail + catalog data for the song page.
 *
 * Delegates to `useAsyncData` so loading/error state is managed by a single
 * `useReducer` — no impossible states, automatic `AbortController` cleanup.
 *
 * @param id - URL-safe song identifier (slug or Spotify ID)
 */
export function useSongData(id: string) {
  const { data, loading, error } = useAsyncData<SongBundle>(
    async (signal) => {
      const [songRes, catalogRes] = await Promise.all([
        fetch(`/api/song/${id}`, { signal }),
        fetch("/api/catalog", { signal }),
      ]);

      if (!songRes.ok) {
        throw new Error(
          songRes.status === 404 ? "Song not found" : "Failed to load song data",
        );
      }

      const song: SongData = await songRes.json();
      const catalog: SongData[] = catalogRes.ok ? await catalogRes.json() : [];

      return { song, catalog };
    },
    [id],
  );

  return {
    song: data?.song ?? null,
    catalog: data?.catalog ?? [],
    loading,
    error,
  };
}
