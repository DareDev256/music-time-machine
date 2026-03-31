/**
 * @module useRecentlyViewed
 * Tracks recently viewed songs in localStorage with a capped FIFO queue.
 *
 * Songs are stored as lightweight stubs (id, title, artist, albumArt) to avoid
 * bloating localStorage with full SongData payloads. The hook exposes a `record`
 * function for the song detail page and a reactive `songs` array for display.
 *
 * Hydration uses `useSyncExternalStore` to subscribe to localStorage without
 * triggering the `set-state-in-effect` lint rule.
 */

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "mtm:recently-viewed";
const MAX_ENTRIES = 8;

export interface RecentSong {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  viewedAt: number;
}

/** In-memory listeners notified when localStorage changes from within this tab. */
let listeners: (() => void)[] = [];
function emitChange() {
  cachedSnapshot = readStorage();
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void): () => void {
  listeners = [...listeners, callback];
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

const EMPTY: RecentSong[] = [];

/** Cached snapshot — React's useSyncExternalStore requires referential stability
 *  when the underlying data hasn't changed (Object.is comparison). Returning a
 *  fresh JSON.parse result on every call violates this contract, causing
 *  unnecessary re-renders and React warnings. */
let cachedSnapshot: RecentSong[] = EMPTY;

function readStorage(): RecentSong[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): RecentSong[] {
  return cachedSnapshot;
}

function getServerSnapshot(): RecentSong[] {
  return EMPTY;
}

/** Hydrate the cache on first client load */
function initCache(): void {
  if (typeof localStorage !== "undefined") {
    cachedSnapshot = readStorage();
  }
}
initCache();

function writeToStorage(songs: RecentSong[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  } catch {
    // Storage full or unavailable — degrade silently
  }
  emitChange();
}

export function useRecentlyViewed() {
  const songs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const record = useCallback(
    (song: { id: string; title: string; artist: string; albumArt: string }) => {
      // Read from authoritative localStorage, not the cached snapshot —
      // cache can lag behind if another tab wrote or if tests cleared storage
      const prev = readStorage();
      const filtered = prev.filter((s) => s.id !== song.id);
      const next: RecentSong[] = [
        { ...song, viewedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_ENTRIES);
      writeToStorage(next);
    },
    []
  );

  return { songs, record } as const;
}
