"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Sparkles, Music } from "lucide-react";
import SafeImage from "@/components/SafeImage";
import SearchBar from "@/components/SearchBar";
import DateSearch from "@/components/DateSearch";
import { SearchResult } from "@/types";

export default function Home() {
  const [trending, setTrending] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch("/api/search");
        const data = await res.json();
        setTrending(data.results || []);
      } catch (error) {
        console.error("Failed to fetch trending:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Music className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              Music Time Machine
            </h1>
          </div>

          {/* Headline */}
          <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 px-2">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
              Track Any Song Across the{" "}
              <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
                Music Ecosystem
              </span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 px-4">
              Search any song and see its complete performance timeline across
              Spotify, YouTube, Billboard, and more.
            </p>
          </div>

          {/* Search Bar */}
          <div className="flex justify-center mb-16">
            <SearchBar />
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-12 sm:mb-16 px-2">
            {[
              { icon: "🎧", label: "Spotify Streams" },
              { icon: "📺", label: "YouTube Views" },
              { icon: "📊", label: "Billboard Charts" },
              { icon: "📝", label: "Genius Lyrics" },
            ].map((feature) => (
              <div
                key={feature.label}
                className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-full px-3 sm:px-4 py-1.5 sm:py-2"
              >
                <span className="text-sm sm:text-base">{feature.icon}</span>
                <span className="text-gray-300 text-xs sm:text-sm">{feature.label}</span>
              </div>
            ))}
          </div>

          {/* Time Machine - Birthday Search */}
          <div className="max-w-md mx-auto">
            <DateSearch />
          </div>
        </div>
      </div>

      {/* Trending Songs Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg sm:rounded-xl flex items-center justify-center">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white">Trending Songs</h3>
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-800/50 border border-gray-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 animate-pulse"
              >
                <div className="w-full aspect-square bg-gray-700 rounded-lg sm:rounded-xl mb-3 sm:mb-4" />
                <div className="h-4 sm:h-5 bg-gray-700 rounded mb-2" />
                <div className="h-3 sm:h-4 bg-gray-700 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {trending.map((song) => (
              <Link
                key={song.id}
                href={`/song/${song.id}`}
                className="group bg-gray-800/50 border border-gray-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:bg-gray-800 hover:border-purple-500/50 transition-all active:scale-[0.98]"
              >
                <div className="relative aspect-square mb-3 sm:mb-4 rounded-lg sm:rounded-xl overflow-hidden bg-gray-800">
                  <SafeImage
                    src={song.albumArt}
                    alt={song.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h4 className="text-white font-medium text-sm sm:text-base truncate group-hover:text-purple-400 transition-colors">
                  {song.title}
                </h4>
                <p className="text-gray-400 text-xs sm:text-sm truncate">{song.artist}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* How It Works Section */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h3 className="text-2xl font-bold text-white text-center mb-12">
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Search Any Song",
                description:
                  "Type in any song name or artist to find what you're looking for.",
              },
              {
                step: "2",
                title: "View the Timeline",
                description:
                  "See how the song performed over time across all major platforms.",
              },
              {
                step: "3",
                title: "Explore the Data",
                description:
                  "Dive deep into platform-specific metrics, charts, and cultural context.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="text-center"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                  {item.step}
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">
                  {item.title}
                </h4>
                <p className="text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold">Music Time Machine</span>
          </div>
          <p className="text-center text-gray-500 text-sm">
            Track any song&apos;s journey across the music ecosystem.
            <br />
            Data sourced from Spotify, YouTube, Billboard, and Genius.
          </p>
        </div>
      </footer>
    </div>
  );
}
