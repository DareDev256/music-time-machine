"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { catalogGenres } from "@/lib/mockData";
import type { RecommendationPrefs } from "@/lib/recommendations";

const STORAGE_KEY = "mtm-rec-prefs";

const MOODS = [
  { id: "upbeat", label: "Upbeat", icon: "☀️" },
  { id: "chill", label: "Chill", icon: "🌊" },
  { id: "melancholy", label: "Melancholy", icon: "🌧" },
  { id: "energetic", label: "Energetic", icon: "⚡" },
] as const;

const ERA_MIN = 2015;
const ERA_MAX = 2025;

function loadPrefs(): RecommendationPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function savePrefs(prefs: RecommendationPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

interface Props {
  onChange: (prefs: RecommendationPrefs) => void;
}

export default function PlaylistConfigurator({ onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<RecommendationPrefs>(loadPrefs);

  const commit = useCallback((next: RecommendationPrefs) => {
    setPrefs(next);
    savePrefs(next);
    onChange(next);
  }, [onChange]);

  // Emit initial prefs on mount
  useEffect(() => { onChange(prefs); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGenre = (g: string) => {
    const current = prefs.genres ?? [];
    const next = current.includes(g) ? current.filter((x) => x !== g) : [...current, g];
    commit({ ...prefs, genres: next.length ? next : undefined });
  };

  const setMood = (m: string) => {
    const next = prefs.mood === m ? undefined : m;
    commit({ ...prefs, mood: next as RecommendationPrefs["mood"] });
  };

  const setEra = (lo: number, hi: number) => {
    commit({ ...prefs, eraRange: [lo, hi] });
  };

  const clearEra = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { eraRange: _unused, ...rest } = prefs;
    commit(rest);
  };

  const reset = () => commit({});

  const activeCount = (prefs.genres?.length ?? 0) + (prefs.mood ? 1 : 0) + (prefs.eraRange ? 1 : 0);

  return (
    <div className="mb-4">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-foreground-secondary hover:text-foreground hover:border-accent/50 transition-all"
        aria-expanded={open}
        aria-controls="playlist-configurator"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Tune recommendations
        {activeCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-bold">
            {activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="playlist-configurator"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-4 rounded-xl border border-border bg-card space-y-4">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Preferences</span>
                <div className="flex items-center gap-2">
                  {activeCount > 0 && (
                    <button onClick={reset} className="text-[10px] text-foreground-secondary hover:text-accent flex items-center gap-1 transition-colors">
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-foreground-secondary hover:text-foreground transition-colors" aria-label="Close configurator">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Genres */}
              <div>
                <label className="text-[10px] font-medium text-foreground-secondary uppercase tracking-wider mb-2 block">Genres</label>
                <div className="flex flex-wrap gap-1.5">
                  {catalogGenres.map((g) => {
                    const active = prefs.genres?.includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                          active
                            ? "bg-accent/15 text-accent border-accent/30"
                            : "bg-transparent text-foreground-secondary border-border hover:border-foreground/30"
                        }`}
                        aria-pressed={active}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mood */}
              <div>
                <label className="text-[10px] font-medium text-foreground-secondary uppercase tracking-wider mb-2 block">Mood</label>
                <div className="flex flex-wrap gap-1.5">
                  {MOODS.map(({ id, label, icon }) => {
                    const active = prefs.mood === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setMood(id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                          active
                            ? "bg-accent/15 text-accent border-accent/30"
                            : "bg-transparent text-foreground-secondary border-border hover:border-foreground/30"
                        }`}
                        aria-pressed={active}
                      >
                        {icon} {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Era range */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-medium text-foreground-secondary uppercase tracking-wider">Era</label>
                  {prefs.eraRange && (
                    <button onClick={clearEra} className="text-[10px] text-foreground-secondary hover:text-accent transition-colors">Clear</button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={prefs.eraRange?.[0] ?? ERA_MIN}
                    onChange={(e) => setEra(Number(e.target.value), prefs.eraRange?.[1] ?? ERA_MAX)}
                    className="bg-background-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent/50"
                    aria-label="Era start year"
                  >
                    {Array.from({ length: ERA_MAX - ERA_MIN + 1 }, (_, i) => ERA_MIN + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <span className="text-foreground-secondary text-xs">to</span>
                  <select
                    value={prefs.eraRange?.[1] ?? ERA_MAX}
                    onChange={(e) => setEra(prefs.eraRange?.[0] ?? ERA_MIN, Number(e.target.value))}
                    className="bg-background-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent/50"
                    aria-label="Era end year"
                  >
                    {Array.from({ length: ERA_MAX - ERA_MIN + 1 }, (_, i) => ERA_MIN + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
