"use client";

import { motion } from "framer-motion";
import { Headphones, Eye, Trophy, BookOpen } from "lucide-react";
import { SongData } from "@/types";

interface QuickStatsProps {
  song: SongData;
}

interface StatItem {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

/**
 * Abbreviates a comma-formatted number string to a compact form.
 * e.g. "2,400,000,000" → "2.4B", "15,000,000" → "15M", "800,000" → "800K"
 */
function abbreviateCount(formatted: string): string {
  const raw = parseInt(formatted.replace(/,/g, ""), 10);
  if (isNaN(raw)) return formatted;
  if (raw >= 1_000_000_000) return `${(raw / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (raw >= 1_000_000) return `${(raw / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (raw >= 1_000) return `${(raw / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return formatted;
}

/** Formats Billboard peak position as a readable rank string */
function formatPeak(position: number): string {
  return `#${position}`;
}

export default function QuickStats({ song }: QuickStatsProps) {
  const stats: StatItem[] = [];

  if (song.spotify) {
    stats.push({
      label: "Streams",
      value: abbreviateCount(song.spotify.totalStreams),
      icon: <Headphones className="w-4 h-4" />,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
    });
  }

  if (song.youtube) {
    stats.push({
      label: "Views",
      value: abbreviateCount(song.youtube.viewCount),
      icon: <Eye className="w-4 h-4" />,
      color: "text-red-400",
      bgColor: "bg-red-400/10",
    });
  }

  if (song.billboard) {
    stats.push({
      label: "Peak",
      value: formatPeak(song.billboard.peakPosition),
      icon: <Trophy className="w-4 h-4" />,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
    });
  }

  if (song.billboard) {
    stats.push({
      label: "Weeks on Chart",
      value: `${song.billboard.weeksOnChart}`,
      icon: <Trophy className="w-4 h-4" />,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
    });
  }

  if (song.genius) {
    stats.push({
      label: "Page Views",
      value: abbreviateCount(song.genius.pageViews),
      icon: <BookOpen className="w-4 h-4" />,
      color: "text-sky-400",
      bgColor: "bg-sky-400/10",
    });
  }

  if (stats.length === 0) return null;

  return (
    <div
      className="grid gap-2 sm:gap-3"
      style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 5)}, minmax(0, 1fr))` }}
      role="list"
      aria-label="Quick performance stats"
    >
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          className="bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-col items-center text-center gap-1.5 hover:border-border/80 transition-colors"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06 }}
          role="listitem"
        >
          <div className={`w-8 h-8 rounded-lg ${stat.bgColor} flex items-center justify-center ${stat.color}`}>
            {stat.icon}
          </div>
          <span className="text-lg sm:text-xl font-bold text-foreground leading-tight" title={stat.value}>
            {stat.value}
          </span>
          <span className="text-[11px] sm:text-xs text-foreground-secondary uppercase tracking-wide">
            {stat.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
