"use client";

import { useState } from "react";
import { Calendar, Sparkles, Music, Baby } from "lucide-react";
import SafeImage from "@/components/SafeImage";
import { HOT100_FIRST_ISSUE } from "@/lib/hot100";
import type { NumberOneResponse, NumberOneCard } from "@/app/api/number-one/route";

function fmt(iso: string, opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

function youtubeSearch(card: NumberOneCard) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${card.artist} ${card.song}`)}`;
}

function Card({ card }: { card: NumberOneCard }) {
  return (
    <a
      href={youtubeSearch(card)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 group"
    >
      <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
        {card.art ? (
          <SafeImage src={card.art.url} alt={card.song} fill className="object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Music className="w-6 h-6 text-foreground-secondary" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-1 left-1 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded">#1</div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-foreground font-medium truncate group-hover:text-accent transition-colors">{card.song}</h4>
        <p className="text-foreground-secondary text-sm truncate">{card.artist}</p>
        <p className="text-foreground-secondary text-xs mt-1">
          {card.weeksAtOne} {card.weeksAtOne === 1 ? "week" : "weeks"} at #1 · from {fmt(card.runStart, { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </a>
  );
}

export default function DateSearch() {
  const [selectedDate, setSelectedDate] = useState("");
  const [result, setResult] = useState<NumberOneResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const handleSearch = async () => {
    if (!selectedDate) return;
    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/number-one?date=${encodeURIComponent(selectedDate)}`);
      const body = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(typeof body?.error === "string" ? body.error : "Something went wrong");
      } else {
        setResult(body as NumberOneResponse);
      }
    } catch {
      setResult(null);
      setError("Could not reach the chart. Try again.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="bg-background-secondary border border-border rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Time Machine</h3>
          <p className="text-sm text-foreground-secondary">What was #1 on your birthday? Any date since 1958.</p>
        </div>
      </div>

      <form
        className="flex gap-3 mb-4"
        onSubmit={(e) => { e.preventDefault(); void handleSearch(); }}
      >
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={today}
          min={HOT100_FIRST_ISSUE}
          aria-label="Pick a date"
          className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!selectedDate || isSearching}
          className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all flex items-center gap-2"
        >
          {isSearching ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <><Sparkles className="w-4 h-4" /><span className="hidden sm:inline">Search</span></>
          )}
        </button>
      </form>

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

      {result && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm text-foreground-secondary mb-3">
              <Music className="w-4 h-4" />
              <span>Billboard #1 on {fmt(result.date)}</span>
            </div>
            <Card card={result.birthday} />
          </div>

          {result.conceived && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-foreground-secondary mb-3">
                <Baby className="w-4 h-4" />
                <span>
                  What you were conceived to · {fmt(result.conceived.from, { month: "short", day: "numeric" })}–{fmt(result.conceived.to, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div className="space-y-3">
                {result.conceived.entries.map((c) => <Card key={c.runStart} card={c} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
