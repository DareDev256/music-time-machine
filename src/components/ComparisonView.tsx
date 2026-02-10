"use client";

import { ComparisonData } from "@/types";
import SafeImage from "./SafeImage";

interface ComparisonViewProps {
  data: ComparisonData;
}

export default function ComparisonView({ data }: ComparisonViewProps) {
  const { song1, song2, insights } = data;

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
              <div
                className={`text-center py-2 rounded-lg ${
                  insight.winner === "song1"
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : "bg-background-secondary"
                }`}
              >
                <p className={`text-lg sm:text-xl font-bold ${
                  insight.winner === "song1" ? "text-green-600 dark:text-green-400" : "text-foreground"
                }`}>
                  {insight.song1Value}
                </p>
                {insight.winner === "song1" && (
                  <p className="text-green-600 dark:text-green-400 text-xs mt-0.5">Winner</p>
                )}
              </div>
              <div
                className={`text-center py-2 rounded-lg ${
                  insight.winner === "song2"
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : "bg-background-secondary"
                }`}
              >
                <p className={`text-lg sm:text-xl font-bold ${
                  insight.winner === "song2" ? "text-green-600 dark:text-green-400" : "text-foreground"
                }`}>
                  {insight.song2Value}
                </p>
                {insight.winner === "song2" && (
                  <p className="text-green-600 dark:text-green-400 text-xs mt-0.5">Winner</p>
                )}
              </div>
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
              <p className="text-3xl font-bold text-foreground">
                {insights.filter((i) => i.winner === "song1").length}
              </p>
              <p className="text-foreground-secondary text-xs truncate max-w-[100px]">{song1.title}</p>
            </div>
            <span className="text-foreground-secondary text-xl">-</span>
            <div>
              <p className="text-3xl font-bold text-foreground">
                {insights.filter((i) => i.winner === "song2").length}
              </p>
              <p className="text-foreground-secondary text-xs truncate max-w-[100px]">{song2.title}</p>
            </div>
          </div>
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
