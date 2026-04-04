"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Dna } from "lucide-react";
import { mockSongs } from "@/lib/mockData";
import { genreOf } from "@/lib/genre-utils";
import type { RecentSong } from "@/hooks/useRecentlyViewed";

/** Intentional palette — genre colors match GenreConstellation. */
const GENRE_COLORS: Record<string, string> = {
  Pop: "#FC3C44", "R&B": "#A855F7", "Alt/Indie": "#06B6D4", Funk: "#F59E0B",
  Country: "#84CC16", "Disco/Dance": "#EC4899", "K-Pop": "#3B82F6", "Hip-Hop": "#F97316",
};

interface Archetype { name: string; emoji: string; description: string }

/** Classify the listener based on aggregated audio features. */
function classify(avg: { energy: number; valence: number; danceability: number; tempo: number }): Archetype {
  const { energy, valence, danceability, tempo } = avg;
  if (energy >= 0.7 && danceability >= 0.65) return { name: "The Dynamo", emoji: "⚡", description: "You chase high-energy anthems that move bodies" };
  if (valence >= 0.6 && energy >= 0.5) return { name: "The Optimist", emoji: "☀️", description: "Your picks radiate positivity and good vibes" };
  if (valence < 0.4 && energy < 0.5) return { name: "The Dreamer", emoji: "🌙", description: "You gravitate toward moody, introspective soundscapes" };
  if (danceability >= 0.65 && tempo >= 110) return { name: "The Groover", emoji: "🪩", description: "Rhythm is your compass — you follow the beat" };
  if (energy >= 0.6 && valence < 0.45) return { name: "The Storm Chaser", emoji: "🌊", description: "You love intensity with emotional depth" };
  return { name: "The Explorer", emoji: "🧭", description: "Your taste defies categories — you go where the music takes you" };
}

/** Axes for the diamond radar. */
const AXES = [
  { key: "energy", label: "Energy", angle: -90 },
  { key: "danceability", label: "Groove", angle: 0 },
  { key: "valence", label: "Mood", angle: 90 },
  { key: "tempoNorm", label: "Tempo", angle: 180 },
] as const;

/** Convert polar (angle, radius) to SVG coordinates centered at (cx, cy). */
function polar(deg: number, r: number, cx: number, cy: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

const CX = 80, CY = 80, R = 58;

export default function TasteProfile({ songs }: { songs: RecentSong[] }) {
  const profile = useMemo(() => {
    const features = songs
      .map((s) => mockSongs[s.id]?.spotify?.audioFeatures)
      .filter(Boolean) as { danceability: number; energy: number; valence: number; tempo: number }[];
    if (features.length < 2) return null;
    const n = features.length;
    const sum = features.reduce((a, f) => ({
      danceability: a.danceability + f.danceability, energy: a.energy + f.energy,
      valence: a.valence + f.valence, tempo: a.tempo + f.tempo,
    }), { danceability: 0, energy: 0, valence: 0, tempo: 0 });
    const avg = { danceability: sum.danceability / n, energy: sum.energy / n, valence: sum.valence / n, tempo: sum.tempo / n };
    const tempoNorm = Math.min(avg.tempo / 200, 1);
    const genreCounts: Record<string, number> = {};
    for (const s of songs) {
      const g = genreOf(s.id);
      if (g !== "Unknown") genreCounts[g] = (genreCounts[g] || 0) + 1;
    }
    const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { avg, tempoNorm, archetype: classify(avg), topGenres, count: n };
  }, [songs]);

  if (!profile) return null;
  const { avg, tempoNorm, archetype, topGenres, count } = profile;
  const values: Record<string, number> = { energy: avg.energy, danceability: avg.danceability, valence: avg.valence, tempoNorm };
  const points = AXES.map((a) => polar(a.angle, values[a.key] * R, CX, CY));
  const pathD = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ") + " Z";

  return (
    <motion.section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14"
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      aria-label="Your listening DNA profile"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/10 rounded-xl flex items-center justify-center">
          <Dna className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Your Listening DNA</h2>
        <span className="text-xs text-foreground-secondary bg-background-secondary px-2 py-0.5 rounded-full">
          {count} songs analyzed
        </span>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
        {/* Diamond Radar */}
        <div className="shrink-0" aria-hidden="true">
          <svg width="160" height="160" viewBox="0 0 160 160" role="img">
            {[0.33, 0.66, 1].map((s) => (
              <polygon key={s} points={AXES.map((a) => polar(a.angle, s * R, CX, CY).join(",")).join(" ")}
                fill="none" stroke="var(--border)" strokeWidth="0.6" opacity={0.5} />
            ))}
            {AXES.map((a) => {
              const [ex, ey] = polar(a.angle, R, CX, CY);
              return <line key={a.key} x1={CX} y1={CY} x2={ex} y2={ey} stroke="var(--border)" strokeWidth="0.5" opacity={0.4} />;
            })}
            <motion.path d={pathD} fill="var(--accent)" fillOpacity={0.15} stroke="var(--accent)" strokeWidth="2"
              initial={{ pathLength: 0, fillOpacity: 0 }} animate={{ pathLength: 1, fillOpacity: 0.15 }}
              transition={{ duration: 0.8, ease: "easeOut" }} />
            {points.map(([x, y], i) => (
              <motion.circle key={AXES[i].key} cx={x} cy={y} r="3.5" fill="var(--accent)"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 300 }} />
            ))}
            {AXES.map((a) => {
              const [lx, ly] = polar(a.angle, R + 14, CX, CY);
              return (<text key={a.key} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                className="fill-foreground-secondary text-[9px]">{a.label}</text>);
            })}
          </svg>
        </div>

        {/* Profile info */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
            <span className="text-2xl">{archetype.emoji}</span>
            <h3 className="text-lg sm:text-xl font-bold text-foreground">{archetype.name}</h3>
          </div>
          <p className="text-sm text-foreground-secondary mb-4">{archetype.description}</p>

          {topGenres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start mb-4" role="list" aria-label="Top genres">
              {topGenres.map(([genre, ct]) => (
                <span key={genre} role="listitem" className="text-xs font-medium px-2.5 py-1 rounded-full border border-border"
                  style={{ color: GENRE_COLORS[genre] || "var(--foreground-secondary)" }}>
                  {genre} ({ct})
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-5 gap-y-2">
            {AXES.map((a) => {
              const v = values[a.key];
              return (
                <div key={a.key}>
                  <div className="flex justify-between text-[11px] text-foreground-secondary mb-0.5">
                    <span>{a.label}</span><span>{Math.round(v * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-background-secondary rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: "var(--accent)" }}
                      initial={{ width: 0 }} animate={{ width: `${v * 100}%` }}
                      transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
