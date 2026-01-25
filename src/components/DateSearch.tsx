"use client";

import { useState } from "react";
import { Calendar, Sparkles, Music, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface ChartEntry {
  position: number;
  title: string;
  artist: string;
  albumArt: string;
  id: string;
  weeksAtOne?: number;
}

// Historical #1 songs data (simplified for demo - would be API in production)
const historicalNumber1s: Record<string, ChartEntry> = {
  // 2024
  "2024-01": { position: 1, title: "Lovin On Me", artist: "Jack Harlow", albumArt: "https://i.scdn.co/image/ab67616d0000b273b0da4a08a3c2c8b8c0d1d2d3", id: "lovin-on-me", weeksAtOne: 4 },
  "2024-02": { position: 1, title: "Texas Hold 'Em", artist: "Beyoncé", albumArt: "https://i.scdn.co/image/ab67616d0000b273c1d2e3f4a5b6c7d8e9f0a1b2", id: "texas-hold-em", weeksAtOne: 2 },
  "2024-03": { position: 1, title: "Espresso", artist: "Sabrina Carpenter", albumArt: "https://i.scdn.co/image/ab67616d0000b273d1e2f3a4b5c6d7e8f9a0b1c2", id: "espresso", weeksAtOne: 1 },
  // 2023
  "2023-01": { position: 1, title: "Flowers", artist: "Miley Cyrus", albumArt: "https://i.scdn.co/image/ab67616d0000b273e1f2a3b4c5d6e7f8a9b0c1d2", id: "flowers", weeksAtOne: 8 },
  "2023-04": { position: 1, title: "Last Night", artist: "Morgan Wallen", albumArt: "https://i.scdn.co/image/ab67616d0000b273f1a2b3c4d5e6f7a8b9c0d1e2", id: "last-night", weeksAtOne: 16 },
  "2023-07": { position: 1, title: "Vampire", artist: "Olivia Rodrigo", albumArt: "https://i.scdn.co/image/ab67616d0000b273a1b2c3d4e5f6a7b8c9d0e1f2", id: "vampire", weeksAtOne: 2 },
  "2023-10": { position: 1, title: "Paint The Town Red", artist: "Doja Cat", albumArt: "https://i.scdn.co/image/ab67616d0000b273b1c2d3e4f5a6b7c8d9e0f1a2", id: "paint-the-town-red", weeksAtOne: 2 },
  // 2022
  "2022-01": { position: 1, title: "Easy On Me", artist: "Adele", albumArt: "https://i.scdn.co/image/ab67616d0000b273c1d2e3f4a5b6c7d8e9f0a1b2", id: "easy-on-me", weeksAtOne: 5 },
  "2022-04": { position: 1, title: "As It Was", artist: "Harry Styles", albumArt: "https://i.scdn.co/image/ab67616d0000b2732e8ed79e177ff6011076f5f0", id: "as-it-was", weeksAtOne: 15 },
  "2022-10": { position: 1, title: "Anti-Hero", artist: "Taylor Swift", albumArt: "https://i.scdn.co/image/ab67616d0000b273bb54dde68cd23e2a268ae0f5", id: "anti-hero", weeksAtOne: 8 },
  // 2021
  "2021-01": { position: 1, title: "drivers license", artist: "Olivia Rodrigo", albumArt: "https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a", id: "drivers-license", weeksAtOne: 8 },
  "2021-05": { position: 1, title: "Butter", artist: "BTS", albumArt: "https://i.scdn.co/image/ab67616d0000b273d1e2f3a4b5c6d7e8f9a0b1c2", id: "butter", weeksAtOne: 10 },
  "2021-09": { position: 1, title: "Stay", artist: "The Kid LAROI & Justin Bieber", albumArt: "https://i.scdn.co/image/ab67616d0000b273e1f2a3b4c5d6e7f8a9b0c1d2", id: "stay", weeksAtOne: 7 },
  // 2020
  "2020-01": { position: 1, title: "The Box", artist: "Roddy Ricch", albumArt: "https://i.scdn.co/image/ab67616d0000b273f1a2b3c4d5e6f7a8b9c0d1e2", id: "the-box", weeksAtOne: 11 },
  "2020-04": { position: 1, title: "Blinding Lights", artist: "The Weeknd", albumArt: "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36", id: "blinding-lights", weeksAtOne: 4 },
  "2020-06": { position: 1, title: "Rockstar", artist: "DaBaby ft. Roddy Ricch", albumArt: "https://i.scdn.co/image/ab67616d0000b273a1b2c3d4e5f6a7b8c9d0e1f2", id: "rockstar-dababy", weeksAtOne: 7 },
  "2020-08": { position: 1, title: "WAP", artist: "Cardi B ft. Megan Thee Stallion", albumArt: "https://i.scdn.co/image/ab67616d0000b273b1c2d3e4f5a6b7c8d9e0f1a2", id: "wap", weeksAtOne: 4 },
  "2020-12": { position: 1, title: "All I Want for Christmas Is You", artist: "Mariah Carey", albumArt: "https://i.scdn.co/image/ab67616d0000b273c1d2e3f4a5b6c7d8e9f0a1b2", id: "all-i-want-christmas", weeksAtOne: 4 },
  // 2019
  "2019-04": { position: 1, title: "Old Town Road", artist: "Lil Nas X ft. Billy Ray Cyrus", albumArt: "https://i.scdn.co/image/ab67616d0000b273fe297c2100c4e9027e2cd97e", id: "old-town-road", weeksAtOne: 19 },
  "2019-08": { position: 1, title: "bad guy", artist: "Billie Eilish", albumArt: "https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce", id: "bad-guy", weeksAtOne: 1 },
  "2019-11": { position: 1, title: "Someone You Loved", artist: "Lewis Capaldi", albumArt: "https://i.scdn.co/image/ab67616d0000b273d1e2f3a4b5c6d7e8f9a0b1c2", id: "someone-you-loved", weeksAtOne: 3 },
};

function getChartForDate(date: Date): ChartEntry | null {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return historicalNumber1s[key] || null;
}

function findClosestChart(date: Date): { entry: ChartEntry; monthKey: string } | null {
  const targetTime = date.getTime();
  let closest: { entry: ChartEntry; monthKey: string; diff: number } | null = null;

  for (const [monthKey, entry] of Object.entries(historicalNumber1s)) {
    const [year, month] = monthKey.split("-").map(Number);
    const entryDate = new Date(year, month - 1, 15);
    const diff = Math.abs(entryDate.getTime() - targetTime);

    if (!closest || diff < closest.diff) {
      closest = { entry, monthKey, diff };
    }
  }

  return closest ? { entry: closest.entry, monthKey: closest.monthKey } : null;
}

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
    <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Time Machine</h3>
          <p className="text-sm text-gray-400">What was #1 on your birthday?</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          min="2019-01-01"
          className="flex-1 bg-gray-900/80 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
        />
        <button
          onClick={handleSearch}
          disabled={!selectedDate || isSearching}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all flex items-center gap-2"
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
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
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
            <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <Image
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
              <h4 className="text-white font-medium truncate group-hover:text-purple-400 transition-colors">
                {result.entry.title}
              </h4>
              <p className="text-gray-400 text-sm truncate">{result.entry.artist}</p>
              {result.entry.weeksAtOne && (
                <p className="text-gray-500 text-xs mt-1">
                  {result.entry.weeksAtOne} weeks at #1
                </p>
              )}
            </div>

            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-purple-400 transition-colors" />
          </Link>
        </div>
      )}
    </div>
  );
}
