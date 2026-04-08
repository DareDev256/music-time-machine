"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { mockSongs, songGenres } from "@/lib/mockData";

/** Intentional palette — matches GenreConstellation & TasteProfile. */
const GENRE_COLORS: Record<string, string> = {
  Pop: "#FC3C44", "R&B": "#A855F7", "Alt/Indie": "#06B6D4", Funk: "#F59E0B",
  Country: "#84CC16", "Disco/Dance": "#EC4899", "K-Pop": "#3B82F6", "Hip-Hop": "#F97316",
};

/** Parse human-readable metric strings ("4.2B", "770M", "12K") to numbers. */
function parseMetric(val: string): number {
  const num = parseFloat(val);
  if (val.includes("B")) return num * 1e9;
  if (val.includes("M")) return num * 1e6;
  if (val.includes("K")) return num * 1e3;
  return num;
}

interface TimelineSong {
  id: string; title: string; artist: string;
  releaseDate: Date; year: number; genre: string; color: string;
  peakPosition: number; streams: number; weeksOnChart: number;
}

export default function MusicTimeline() {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

  const songs = useMemo<TimelineSong[]>(() =>
    Object.entries(mockSongs)
      .filter(([, s]) => s.releaseDate && s.billboard)
      .map(([id, s]) => ({
        id, title: s.title, artist: s.artist,
        releaseDate: new Date(s.releaseDate),
        year: new Date(s.releaseDate).getFullYear(),
        genre: songGenres[id] || "Pop",
        color: GENRE_COLORS[songGenres[id]] || "#FC3C44",
        peakPosition: s.billboard!.peakPosition,
        streams: s.spotify?.totalStreams ? parseMetric(s.spotify.totalStreams) : 0,
        weeksOnChart: s.billboard!.weeksOnChart,
      }))
      .sort((a, b) => a.releaseDate.getTime() - b.releaseDate.getTime()),
  []);

  /* ---------- SVG layout ---------- */
  const W = 900, H = 300;
  const PAD = { top: 36, right: 36, bottom: 44, left: 48 };
  const minYear = 2017, maxYear = 2025;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const xScale = (d: Date) => {
    const frac = d.getFullYear() + d.getMonth() / 12;
    return PAD.left + ((frac - minYear) / (maxYear - minYear)) * (W - PAD.left - PAD.right);
  };
  const yScale = (peak: number) => {
    const clamped = Math.min(peak, 50);
    return PAD.top + ((clamped - 1) / 49) * (H - PAD.top - PAD.bottom);
  };
  const maxStreams = Math.max(...songs.map((s) => s.streams));
  const rScale = (streams: number) => 5 + (streams / maxStreams) * 13;

  const hoveredSong = songs.find((s) => s.id === hovered);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/10 rounded-xl flex items-center justify-center">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Music Timeline</h2>
      </div>
      <p className="text-sm text-foreground-secondary mb-5 max-w-md">
        Every hit plotted by release date and chart peak. Bigger circles mean more streams.
      </p>

      {/* Chart container — horizontally scrollable on small screens */}
      <div className="relative bg-background-secondary border border-border rounded-2xl p-3 sm:p-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[620px]"
          role="img"
          aria-label="Timeline chart mapping songs by release date and Billboard peak position"
        >
          {/* Year grid */}
          {years.map((yr) => {
            const x = xScale(new Date(`${yr}-01-01`));
            return (
              <g key={yr}>
                <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 4" />
                <text x={x} y={H - PAD.bottom + 18} textAnchor="middle" fill="var(--foreground-secondary)" fontSize="11">{yr}</text>
              </g>
            );
          })}

          {/* Position grid */}
          {[1, 10, 25, 50].map((pos) => {
            const y = yScale(pos);
            return (
              <g key={pos}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeWidth="0.3" />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="var(--foreground-secondary)" fontSize="10">#{pos}</text>
              </g>
            );
          })}

          {/* Y-axis label */}
          <text x={14} y={H / 2} textAnchor="middle" fill="var(--foreground-secondary)" fontSize="9" transform={`rotate(-90,14,${H / 2})`}>
            Peak Position
          </text>

          {/* Song dots */}
          {songs.map((song) => {
            const cx = xScale(song.releaseDate);
            const cy = yScale(song.peakPosition);
            const r = rScale(song.streams);
            const active = hovered === song.id;
            return (
              <g
                key={song.id}
                onMouseEnter={() => setHovered(song.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => router.push(`/song/${song.id}`)}
                style={{ cursor: "pointer" }}
                role="button"
                tabIndex={0}
                aria-label={`${song.title} by ${song.artist} — peaked #${song.peakPosition}, ${song.year}`}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/song/${song.id}`)}
              >
                {active && <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke={song.color} strokeWidth="2" opacity="0.35" />}
                <circle
                  cx={cx} cy={cy}
                  r={active ? r + 2 : r}
                  fill={song.color}
                  opacity={hovered && !active ? 0.2 : 0.85}
                  style={{ transition: "opacity 0.2s ease-out" }}
                />
                {song.peakPosition === 1 && !active && (
                  <text x={cx} y={cy - r - 5} textAnchor="middle" fill={song.color} fontSize="9" fontWeight="600">#1</text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip — fixed position avoids layout jank */}
        {hoveredSong && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-card border border-border rounded-xl p-3 shadow-lg w-48 pointer-events-none z-10"
          >
            <p className="text-sm font-semibold text-foreground truncate">{hoveredSong.title}</p>
            <p className="text-xs text-foreground-secondary truncate">{hoveredSong.artist}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hoveredSong.color }} />
              <span className="text-xs text-foreground-secondary">{hoveredSong.genre}</span>
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-foreground-secondary">
              <p>Peak: <span className="text-foreground font-medium">#{hoveredSong.peakPosition}</span></p>
              <p>Chart weeks: <span className="text-foreground font-medium">{hoveredSong.weeksOnChart}</span></p>
              <p>Released: <span className="text-foreground font-medium">{hoveredSong.year}</span></p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Genre legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4" role="list" aria-label="Genre color legend">
        {Object.entries(GENRE_COLORS).map(([genre, color]) => (
          <div key={genre} className="flex items-center gap-1.5" role="listitem">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-foreground-secondary">{genre}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
