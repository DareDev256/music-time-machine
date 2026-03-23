"use client";

import { useMemo } from "react";
import { ComparisonData } from "@/types";
import SafeImage from "./SafeImage";

type WinnerState = "winner" | "tie" | "neutral";

/** Resolves the visual state for one side of a metric comparison */
function resolveState(winner: string, side: "song1" | "song2"): WinnerState {
  if (winner === "tie") return "tie";
  if (winner === side) return "winner";
  return "neutral";
}

const cellStyles: Record<WinnerState, { bg: string; text: string; label: string | null }> = {
  winner: {
    bg: "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800",
    text: "text-green-600 dark:text-green-400",
    label: "Winner",
  },
  tie: {
    bg: "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800",
    text: "text-amber-600 dark:text-amber-400",
    label: "Tie",
  },
  neutral: {
    bg: "bg-background-secondary",
    text: "text-foreground",
    label: null,
  },
};

/** Single side of a metric comparison row */
function MetricCell({ value, state }: { value: string; state: WinnerState }) {
  const style = cellStyles[state];
  return (
    <div className={`text-center py-2 rounded-lg ${style.bg}`}>
      <p className={`text-lg sm:text-xl font-bold ${style.text}`}>{value}</p>
      {style.label && (
        <p className={`${style.text} text-xs mt-0.5`}>{style.label}</p>
      )}
    </div>
  );
}

interface ComparisonViewProps {
  data: ComparisonData;
}

export default function ComparisonView({ data }: ComparisonViewProps) {
  const { song1, song2, insights } = data;

  /** Pre-compute score counts once instead of filtering per-render */
  const scores = useMemo(() => {
    let s1 = 0, s2 = 0, ties = 0;
    for (const { winner } of insights) {
      if (winner === "song1") s1++;
      else if (winner === "song2") s2++;
      else if (winner === "tie") ties++;
    }
    return { s1, s2, ties };
  }, [insights]);

  return (
    <div className="space-y-6">
      {/* Songs Header */}
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        <SongColumn
          title={song1.title}
          artist={song1.artist}
          albumArt={song1.albumArt}
          id={song1.id}
        />
        <SongColumn
          title={song2.title}
          artist={song2.artist}
          albumArt={song2.albumArt}
          id={song2.id}
        />
      </div>

      {/* VS Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-foreground-secondary font-bold text-sm">VS</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Metric Rows */}
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-xl p-4"
          >
            <p className="text-foreground-secondary text-xs uppercase tracking-wider text-center mb-3">
              {insight.metric}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <MetricCell value={insight.song1Value} state={resolveState(insight.winner, "song1")} />
              <MetricCell value={insight.song2Value} state={resolveState(insight.winner, "song2")} />
            </div>
          </div>
        ))}
      </div>

      {/* Score Summary */}
      {insights.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-foreground-secondary text-sm mb-2">Overall Score</p>
          <div className="flex items-center justify-center gap-8">
            <div>
              <p className="text-3xl font-bold text-foreground">{scores.s1}</p>
              <p className="text-foreground-secondary text-xs truncate max-w-[100px]">{song1.title}</p>
            </div>
            <span className="text-foreground-secondary text-xl">-</span>
            <div>
              <p className="text-3xl font-bold text-foreground">{scores.s2}</p>
              <p className="text-foreground-secondary text-xs truncate max-w-[100px]">{song2.title}</p>
            </div>
          </div>
          {scores.ties > 0 && (
            <p className="text-amber-600 dark:text-amber-400 text-xs mt-3">
              {scores.ties} tied {scores.ties === 1 ? "metric" : "metrics"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SongColumn({
  title,
  artist,
  albumArt,
  id,
}: {
  title: string;
  artist: string;
  albumArt: string;
  id: string;
}) {
  return (
    <a href={`/song/${id}`} className="flex flex-col items-center text-center group">
      <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden mb-3 bg-background-secondary shadow-lg">
        <SafeImage
          src={albumArt}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform"
        />
      </div>
      <h3 className="text-foreground font-semibold text-sm sm:text-base truncate max-w-full group-hover:text-accent transition-colors">
        {title}
      </h3>
      <p className="text-foreground-secondary text-xs sm:text-sm truncate max-w-full">{artist}</p>
    </a>
  );
}
