"use client";

import { useState, useEffect } from "react";
import { SongData } from "@/types";

/**
 * Fetches song detail + catalog data for the song page.
 *
 * Encapsulates the parallel fetch, loading/error states, and cleanup
 * so the page component stays a pure render function.
 *
 * @param id - URL-safe song identifier (slug or Spotify ID)
 * @returns `{ song, catalog, loading, error }` — `song` and `catalog`
 *          are `null`/empty until loading completes.
 */
export function useSongData(id: string) {
  const [song, setSong] = useState<SongData | null>(null);
  const [catalog, setCatalog] = useState<SongData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchSong() {
      setLoading(true);
      setError(null);

      try {
        const [songRes, catalogRes] = await Promise.all([
          fetch(`/api/song/${id}`, { signal: controller.signal }),
          fetch("/api/catalog", { signal: controller.signal }),
        ]);

        if (!songRes.ok) {
          setError(
            songRes.status === 404
              ? "Song not found"
              : "Failed to load song data",
          );
          return;
        }

        setSong(await songRes.json());

        if (catalogRes.ok) {
          setCatalog(await catalogRes.json());
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error fetching song:", err);
        setError("Failed to load song data");
      } finally {
        setLoading(false);
      }
    }

    fetchSong();

    return () => controller.abort();
  }, [id]);

  return { song, catalog, loading, error };
}
