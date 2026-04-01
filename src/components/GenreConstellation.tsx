"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Stars } from "lucide-react";
import { mockSongs, songGenres } from "@/lib/mockData";

/** Intentional palette — no default Tailwind colors. */
const GENRE_COLORS: Record<string, string> = {
  Pop: "#FC3C44", "R&B": "#A855F7", "Alt/Indie": "#06B6D4", Funk: "#F59E0B",
  Country: "#84CC16", "Disco/Dance": "#EC4899", "K-Pop": "#3B82F6", "Hip-Hop": "#F97316",
};

const QUADRANTS = [
  { x: 18, y: 16, label: "Chill · Reflective", anchor: "start" as const },
  { x: 82, y: 16, label: "Upbeat · Euphoric", anchor: "end" as const },
  { x: 18, y: 92, label: "Intense · Moody", anchor: "start" as const },
  { x: 82, y: 92, label: "High Energy · Dark", anchor: "end" as const },
];

interface StarData {
  id: string; title: string; artist: string; genre: string;
  x: number; y: number; r: number; color: string;
}

export default function GenreConstellation() {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

  const stars = useMemo<StarData[]>(() => {
    const pad = 8, range = 84; // 8% padding each side
    return Object.entries(mockSongs)
      .filter(([, s]) => s.spotify?.audioFeatures)
      .map(([id, s]) => {
        const af = s.spotify!.audioFeatures!;
        const genre = songGenres[id] || "Pop";
        return {
          id, title: s.title, artist: s.artist, genre,
          x: pad + af.energy * range,
          y: pad + (1 - af.valence) * range,
          r: 3 + af.danceability * 5,
          color: GENRE_COLORS[genre] || "#FC3C44",
        };
      });
  }, []);

  const genres = useMemo(() => [...new Set(stars.map((s) => s.genre))].sort(), [stars]);
  const hoveredStar = stars.find((s) => s.id === hovered);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/10 rounded-xl flex items-center justify-center">
          <Stars className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Genre Constellation</h2>
      </div>
      <p className="text-sm text-foreground-secondary mb-5 max-w-lg">
        Every song mapped by energy and mood. Click a star to explore.
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4" role="list" aria-label="Genre legend">
        {genres.map((g) => (
          <div key={g} className="flex items-center gap-1.5" role="listitem">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GENRE_COLORS[g] }} />
            <span className="text-xs text-foreground-secondary">{g}</span>
          </div>
        ))}
      </div>

      {/* Star map */}
      <div className="relative bg-card border border-border rounded-2xl overflow-hidden" style={{ aspectRatio: "2 / 1" }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="w-full h-full"
          role="img" aria-label="Interactive scatter plot of songs by energy and mood">
          {/* Grid crosshair */}
          <line x1="50" y1="4" x2="50" y2="96" stroke="var(--border)" strokeWidth="0.15" strokeDasharray="1 1" />
          <line x1="4" y1="50" x2="96" y2="50" stroke="var(--border)" strokeWidth="0.15" strokeDasharray="1 1" />
          {/* Axis labels */}
          <text x="50" y="3" textAnchor="middle" className="fill-foreground-secondary" fontSize="2.2">↑ Happy</text>
          <text x="50" y="99" textAnchor="middle" className="fill-foreground-secondary" fontSize="2.2">↓ Melancholic</text>
          <text x="3" y="51" textAnchor="start" className="fill-foreground-secondary" fontSize="2.2">← Calm</text>
          <text x="97" y="51" textAnchor="end" className="fill-foreground-secondary" fontSize="2.2">Intense →</text>
          {/* Quadrant hints */}
          {QUADRANTS.map((q) => (
            <text key={q.label} x={q.x} y={q.y} textAnchor={q.anchor}
              className="fill-foreground-secondary" fontSize="1.8" opacity={0.35}>{q.label}</text>
          ))}
          {/* Stars */}
          {stars.map((s, i) => {
            const active = hovered === s.id;
            return (
              <motion.g key={s.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: hovered && !active ? 0.35 : 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.04, duration: 0.5, type: "spring", stiffness: 200, damping: 15 }}
                style={{ cursor: "pointer", transformOrigin: `${s.x}px ${s.y}px` }}
                onMouseEnter={() => setHovered(s.id)} onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(s.id)} onBlur={() => setHovered(null)}
                onClick={() => router.push(`/song/${s.id}`)}
                role="button" tabIndex={0} aria-label={`${s.title} by ${s.artist} (${s.genre})`}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/song/${s.id}`)}>
                {active && <circle cx={s.x} cy={s.y} r={s.r * 2.5} fill={s.color} opacity={0.12} />}
                <circle cx={s.x} cy={s.y} r={active ? s.r * 1.4 : s.r} fill={s.color}
                  opacity={active ? 1 : 0.85} style={{ transition: "all 0.15s ease-out" }} />
                <circle cx={s.x} cy={s.y} r={s.r * 0.35} fill="white" opacity={active ? 0.9 : 0.5} />
              </motion.g>
            );
          })}
        </svg>

        {/* Floating tooltip */}
        {hoveredStar && (
          <motion.div
            className="absolute pointer-events-none px-3 py-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg"
            style={{
              left: `${hoveredStar.x}%`, top: `${hoveredStar.y}%`,
              transform: `translate(${hoveredStar.x > 65 ? "-105%" : "5%"}, -120%)`,
            }}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }}>
            <p className="text-xs font-semibold text-foreground whitespace-nowrap">{hoveredStar.title}</p>
            <p className="text-[10px] text-foreground-secondary whitespace-nowrap">{hoveredStar.artist}</p>
            <span className="inline-block mt-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${hoveredStar.color}20`, color: hoveredStar.color }}>
              {hoveredStar.genre}
            </span>
          </motion.div>
        )}
      </div>

      <p className="text-[11px] text-foreground-secondary mt-3 text-center">
        Position reflects audio features — energy (horizontal) × mood (vertical). Size shows danceability.
      </p>
    </div>
  );
}
