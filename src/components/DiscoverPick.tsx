"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Disc3, Sparkles } from "lucide-react";
import SafeImage from "@/components/SafeImage";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { pickNextSong, type PickResult } from "@/lib/pickNextSong";
import { mockSongs } from "@/lib/mockData";

type Phase = "idle" | "spinning" | "reveal";

export default function DiscoverPick() {
  const router = useRouter();
  const { songs: recentSongs } = useRecentlyViewed();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pick, setPick] = useState<PickResult | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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

    // Guard: if the engine returns an empty ID (empty catalog), don't start
    // the animation chain — it would navigate to a broken /song/ route
    if (!result.id) return;

    setPick(result);
    setPhase("spinning"); // triggers the useEffect timer chain
  }, [phase, recentSongs]);

  const song = pick ? mockSongs[pick.id] : null;

  return (
    <div className="flex justify-center">
      <motion.button
        onClick={handlePick}
        disabled={phase !== "idle"}
        className="group relative overflow-hidden bg-card border border-border rounded-2xl px-5 py-3.5 sm:px-6 sm:py-4 transition-all hover:border-accent/40 hover:shadow-[0_0_20px_rgba(252,60,68,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default w-full max-w-sm"
        whileHover={phase === "idle" ? { scale: 1.01 } : undefined}
        whileTap={phase === "idle" ? { scale: 0.98 } : undefined}
        aria-label="Pick a random song to explore"
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
              <div className="text-left">
                <span className="text-sm font-semibold text-foreground block leading-tight">
                  Pick for Me
                </span>
                <span className="text-xs text-foreground-secondary leading-tight">
                  {recentSongs.length > 0
                    ? "Based on your listening"
                    : "Discover something new"}
                </span>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-accent/50 ml-auto" />
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
