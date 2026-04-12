"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Disc3 } from "lucide-react";
import SafeImage from "@/components/SafeImage";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { pickNextSong, type PickResult, genreOf } from "@/lib/pickNextSong";
import { mockSongs, catalogGenres } from "@/lib/mockData";

type Phase = "idle" | "spinning" | "reveal";

/**
 * Compute which catalog genres the user has already explored
 * based on their recently viewed songs.
 */
function useExploredGenres(recentSongIds: string[]): Set<string> {
  return useMemo(() => {
    const explored = new Set<string>();
    for (const id of recentSongIds) {
      const genre = genreOf(id);
      if (genre !== "Unknown") explored.add(genre);
    }
    return explored;
  }, [recentSongIds]);
}

export default function DiscoverPick() {
  const router = useRouter();
  const { songs: recentSongs } = useRecentlyViewed();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pick, setPick] = useState<PickResult | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const recentIds = useMemo(() => recentSongs.map((s) => s.id), [recentSongs]);
  const exploredGenres = useExploredGenres(recentIds);

  const totalGenres = catalogGenres.length;
  const exploredCount = exploredGenres.size;
  const allExplored = exploredCount >= totalGenres;

  // Clean up all pending timers on unmount — prevents state updates
  // and ghost navigation after the component is removed from the DOM
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  // Phase-driven timer chain: spinning → reveal → navigate
  // Lives in useEffect so React's cleanup cancels timers on unmount
  useEffect(() => {
    if (phase !== "spinning" || !pick) return;

    const revealTimer = setTimeout(() => setPhase("reveal"), 600);
    const navTimer = setTimeout(() => {
      router.push(`/song/${pick.id}`);
    }, 1400);

    timersRef.current = [revealTimer, navTimer];

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(navTimer);
    };
  }, [phase, pick, router]);

  const handlePick = useCallback(() => {
    if (phase !== "idle") return;

    const result = pickNextSong(recentSongs);

    // Guard: if the engine returns an empty ID (empty catalog) or the picked
    // song no longer exists in the catalog, don't start the animation chain —
    // it would navigate to a broken /song/ route
    if (!result.id || !mockSongs[result.id]) return;

    setPick(result);
    setPhase("spinning"); // triggers the useEffect timer chain
  }, [phase, recentSongs]);

  const song = pick ? mockSongs[pick.id] ?? null : null;

  return (
    <div className="flex justify-center">
      <motion.button
        onClick={handlePick}
        disabled={phase !== "idle"}
        className="group relative overflow-hidden bg-card border border-border rounded-2xl px-5 py-3.5 sm:px-6 sm:py-4 transition-all hover:border-accent/40 hover:shadow-[0_0_20px_rgba(252,60,68,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default w-full max-w-sm"
        whileHover={phase === "idle" ? { scale: 1.01 } : undefined}
        whileTap={phase === "idle" ? { scale: 0.98 } : undefined}
        aria-label={`Pick a random song to explore. ${exploredCount} of ${totalGenres} genres discovered.`}
      >
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              className="flex items-center justify-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                <Disc3 className="w-4.5 h-4.5 text-accent" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground block leading-tight">
                  Pick for Me
                </span>
                <span className="text-xs text-foreground-secondary leading-tight">
                  {recentSongs.length > 0
                    ? "Based on your listening"
                    : "Discover something new"}
                </span>
              </div>

              {/* Genre Discovery Progress — compact dot ring */}
              <GenreProgress
                exploredGenres={exploredGenres}
                allExplored={allExplored}
              />
            </motion.div>
          )}

          {phase === "spinning" && (
            <motion.div
              key="spinning"
              className="flex items-center justify-center gap-3 py-0.5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6, ease: "linear", repeat: Infinity }}
              >
                <Disc3 className="w-5 h-5 text-accent" />
              </motion.div>
              <span className="text-sm text-foreground-secondary">Finding your song…</span>
            </motion.div>
          )}

          {phase === "reveal" && song && pick && (
            <motion.div
              key="reveal"
              className="flex items-center gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-accent/20">
                <SafeImage
                  src={song.albumArt}
                  alt={song.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-foreground truncate">
                  {song.title}
                </p>
                <p className="text-xs text-accent truncate">{pick.reason}</p>
              </div>
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Genre Discovery Progress Ring                                      */
/* ------------------------------------------------------------------ */

/** Dot colors per genre — intentional palette, no generic Tailwind defaults */
const GENRE_COLORS: Record<string, string> = {
  "Alt/Indie": "#8B5CF6",   // violet — moody, alternative
  "Country":   "#D97706",   // amber — warm, earthy
  "Disco/Dance": "#EC4899", // pink — energetic, fun
  "Funk":      "#F59E0B",   // gold — groovy, classic
  "K-Pop":     "#06B6D4",   // cyan — bright, electric
  "Pop":       "#3B82F6",   // blue — mainstream, universal
  "R&B":       "#EF4444",   // red — soulful, passionate
};

const UNEXPLORED_COLOR = "currentColor";

function GenreProgress({
  exploredGenres,
  allExplored,
}: {
  exploredGenres: Set<string>;
  allExplored: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1.5 flex-shrink-0 ml-auto"
      aria-hidden="true"
      title={
        allExplored
          ? "All genres explored!"
          : `${exploredGenres.size}/${catalogGenres.length} genres`
      }
    >
      {/* Dot ring — one per catalog genre */}
      <div className="flex gap-[3px] items-center">
        {catalogGenres.map((genre) => {
          const isExplored = exploredGenres.has(genre);
          return (
            <motion.span
              key={genre}
              className="block rounded-full"
              style={{
                width: 6,
                height: 6,
                backgroundColor: isExplored
                  ? GENRE_COLORS[genre] ?? "#FC3C44"
                  : UNEXPLORED_COLOR,
                opacity: isExplored ? 1 : 0.15,
              }}
              initial={false}
              animate={
                isExplored
                  ? { scale: [1, 1.4, 1], opacity: 1 }
                  : { scale: 1, opacity: 0.15 }
              }
              transition={
                isExplored
                  ? { duration: 0.35, ease: "easeOut" }
                  : { duration: 0.2 }
              }
              title={`${genre}${isExplored ? " ✓" : ""}`}
            />
          );
        })}
      </div>

      {/* Fraction label — only shown after first exploration */}
      {exploredGenres.size > 0 && (
        <motion.span
          className="text-[10px] tabular-nums leading-none"
          style={{
            color: allExplored ? "#FC3C44" : "var(--foreground-secondary)",
            fontWeight: allExplored ? 600 : 400,
          }}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {exploredGenres.size}/{catalogGenres.length}
        </motion.span>
      )}
    </div>
  );
}
