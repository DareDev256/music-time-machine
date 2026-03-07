"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Sparkles, Shuffle, Zap, Layers, Wand2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SongData } from "@/types";
import SafeImage from "@/components/SafeImage";
import { getSimilarSongs, getDiversityMeta } from "@/lib/recommendations";
import type { RecommendationPrefs, SelectionStrategy } from "@/lib/recommendations";
import PlaylistConfigurator from "@/components/PlaylistConfigurator";

interface SimilarSongsProps {
  song: SongData;
  catalog: SongData[];
}

/** Returns a Tailwind text color class based on match strength */
function matchColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-sky-400";
  if (score >= 40) return "text-amber-400";
  return "text-foreground-secondary";
}

/** Returns a Tailwind ring/border color class based on match strength */
function matchRingColor(score: number): string {
  if (score >= 80) return "ring-emerald-400/30";
  if (score >= 60) return "ring-sky-400/30";
  if (score >= 40) return "ring-amber-400/30";
  return "ring-border";
}

/** SVG arc path for circular progress indicator */
function circleArc(score: number): string {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return `${offset}`;
}

/** Tailwind bg class for genre chip — each genre gets a unique muted color */
function genreChipColor(genre: string): string {
  const map: Record<string, string> = {
    "Pop": "bg-pink-500/15 text-pink-300 border-pink-500/20",
    "R&B": "bg-purple-500/15 text-purple-300 border-purple-500/20",
    "Country": "bg-amber-500/15 text-amber-300 border-amber-500/20",
    "K-Pop": "bg-rose-500/15 text-rose-300 border-rose-500/20",
    "Alt/Indie": "bg-teal-500/15 text-teal-300 border-teal-500/20",
    "Disco/Dance": "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
    "Funk": "bg-orange-500/15 text-orange-300 border-orange-500/20",
  };
  return map[genre] ?? "bg-foreground/10 text-foreground-secondary border-foreground/10";
}

/** Color for the diversity score indicator */
function diversityColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 45) return "text-sky-400";
  if (score >= 20) return "text-amber-400";
  return "text-foreground-secondary";
}

function diversityBgColor(score: number): string {
  if (score >= 75) return "bg-emerald-400/10 border-emerald-400/20";
  if (score >= 45) return "bg-sky-400/10 border-sky-400/20";
  if (score >= 20) return "bg-amber-400/10 border-amber-400/20";
  return "bg-foreground/5 border-foreground/10";
}

const STRATEGIES: { id: SelectionStrategy; label: string; icon: typeof Zap; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Wand2, desc: "Smart pick — adapts based on your catalog" },
  { id: "best-match", label: "Best match", icon: Zap, desc: "Highest similarity scores" },
  { id: "diverse", label: "Diverse", icon: Layers, desc: "Maximize genre & era spread" },
];

export default function SimilarSongs({ song, catalog }: SimilarSongsProps) {
  const [prefs, setPrefs] = useState<RecommendationPrefs>({});
  const handlePrefsChange = useCallback((p: RecommendationPrefs) => setPrefs(p), []);
  const [strategy, setStrategy] = useState<SelectionStrategy>("auto");

  const effectivePrefs = useMemo(
    () => ({ ...prefs, strategy }),
    [prefs, strategy],
  );

  const similar = useMemo(
    () => getSimilarSongs(song, catalog, 4, effectivePrefs),
    [song, catalog, effectivePrefs],
  );

  const diversity = useMemo(
    () => getDiversityMeta(song, similar),
    [song, similar],
  );

  if (similar.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 sm:mb-6 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-accent" />
        Similar Songs
      </h2>

      {/* Strategy toggle */}
      <div className="flex items-center gap-1.5 mb-3" role="radiogroup" aria-label="Selection strategy">
        {STRATEGIES.map(({ id, label, icon: Icon, desc }) => {
          const active = strategy === id;
          return (
            <button
              key={id}
              onClick={() => setStrategy(id)}
              role="radio"
              aria-checked={active}
              title={desc}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                active
                  ? "bg-accent/12 text-accent border-accent/30 shadow-[0_0_8px_rgba(252,60,68,0.08)]"
                  : "bg-transparent text-foreground-secondary border-border hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <PlaylistConfigurator onChange={handlePrefsChange} />

      {/* Diversity indicator bar — keyed on label+score so it re-animates on pref changes */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${diversity.label}-${diversity.score}`}
          className="mb-4 sm:mb-5 flex flex-wrap items-center gap-2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          role="status"
          aria-live="polite"
          aria-label={`Recommendation diversity: ${diversity.label}, score ${diversity.score}`}
        >
          {/* Diversity score badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors duration-300 ${diversityBgColor(diversity.score)}`}
          >
            <Shuffle className={`w-3 h-3 ${diversityColor(diversity.score)}`} aria-hidden="true" />
            <span className={diversityColor(diversity.score)}>{diversity.label}</span>
          </div>

          {/* Genre chips */}
          {diversity.genres.map((genre, i) => (
            <motion.span
              key={genre}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.1 + i * 0.05 }}
              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${genreChipColor(genre)}`}
            >
              {genre}
            </motion.span>
          ))}

          {/* Era tags */}
          {diversity.eras.length > 1 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.2 }}
              className="text-[10px] text-foreground-secondary ml-1"
            >
              · spans {diversity.eras.join(" & ")}
            </motion.span>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {similar.map(({ song: rec, reason, matchScore }, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <Link
              href={`/song/${rec.id}`}
              className={`group block bg-card border border-border rounded-xl p-3 hover:border-accent/50 hover:shadow-lg transition-all ring-1 ${matchRingColor(matchScore)} hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
            >
              <div className="relative mb-3">
                <SafeImage
                  src={rec.albumArt}
                  alt={`${rec.title} album art`}
                  width={200}
                  height={200}
                  className="w-full aspect-square rounded-lg object-cover group-hover:scale-[1.02] transition-transform"
                />
                {/* Match score circular badge — isolate creates a local stacking
                    context so the -z-10 background stays behind the SVG rings
                    instead of falling behind the album art image */}
                <div
                  className="absolute -top-2 -right-2 w-10 h-10 flex items-center justify-center isolate"
                  title={`${matchScore}% match`}
                  aria-label={`${matchScore}% match`}
                  role="img"
                >
                  <svg
                    viewBox="0 0 40 40"
                    className="w-10 h-10 -rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="text-border/50"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeDasharray={`${2 * Math.PI * 16}`}
                      strokeDashoffset={circleArc(matchScore)}
                      strokeLinecap="round"
                      className={matchColor(matchScore)}
                    />
                  </svg>
                  <span
                    className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${matchColor(matchScore)}`}
                    aria-hidden="true"
                  >
                    {matchScore}%
                  </span>
                  {/* Solid background behind the badge for readability */}
                  <div className="absolute inset-0 -z-10 rounded-full bg-card border border-border" />
                </div>
                {/* Reason tag */}
                <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                  {reason}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground truncate">
                {rec.title}
              </p>
              <p className="text-xs text-foreground-secondary truncate">
                {rec.artist}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
