"use client";

import { useState } from "react";
import { Calendar, Sparkles, Music, ChevronRight } from "lucide-react";
import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { type ChartEntry, getChartForDate, findClosestChart } from "@/lib/timeMachine";

export default function DateSearch() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [result, setResult] = useState<{
    entry: ChartEntry;
    isExact: boolean;
    monthLabel: string;
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = () => {
    if (!selectedDate) return;

    setIsSearching(true);

    setTimeout(() => {
      const date = new Date(selectedDate);
      const exact = getChartForDate(date);

      if (exact) {
        setResult({
          entry: exact,
          isExact: true,
          monthLabel: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        });
      } else {
        const closest = findClosestChart(date);
        if (closest) {
          const [year, month] = closest.monthKey.split("-").map(Number);
          const closestDate = new Date(year, month - 1, 1);
          setResult({
            entry: closest.entry,
            isExact: false,
            monthLabel: closestDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          });
        }
      }

      setIsSearching(false);
    }, 500);
  };

  return (
    <div className="bg-background-secondary border border-border rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Time Machine</h3>
          <p className="text-sm text-foreground-secondary">What was #1 on your birthday?</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          min="2019-01-01"
          className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-accent transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={!selectedDate || isSearching}
          className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all flex items-center gap-2"
        >
          {isSearching ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="bg-card border border-border rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 text-sm text-foreground-secondary mb-3">
            <Music className="w-4 h-4" />
            <span>
              {result.isExact ? (
                <>Billboard #1 in {result.monthLabel}</>
              ) : (
                <>Closest data: {result.monthLabel}</>
              )}
            </span>
          </div>

          <Link
            href={`/song/${result.entry.id}`}
            className="flex items-center gap-4 group"
          >
            <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
              <SafeImage
                src={result.entry.albumArt}
                alt={result.entry.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-1 left-1 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded">
                #1
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-foreground font-medium truncate group-hover:text-accent transition-colors">
                {result.entry.title}
              </h4>
              <p className="text-foreground-secondary text-sm truncate">{result.entry.artist}</p>
              {result.entry.weeksAtOne && (
                <p className="text-foreground-secondary text-xs mt-1">
                  {result.entry.weeksAtOne} weeks at #1
                </p>
              )}
            </div>

            <ChevronRight className="w-5 h-5 text-foreground-secondary group-hover:text-accent transition-colors" />
          </Link>
        </div>
      )}
    </div>
  );
}
