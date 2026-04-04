"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Sparkles, Music, ArrowRight, GitCompareArrows } from "lucide-react";
import SafeImage from "@/components/SafeImage";
import SearchBar from "@/components/SearchBar";
import DateSearch from "@/components/DateSearch";
import FilterBar from "@/components/FilterBar";
import RecentlyViewed from "@/components/RecentlyViewed";
import DiscoverPick from "@/components/DiscoverPick";
import GenreConstellation from "@/components/GenreConstellation";
import TasteProfile from "@/components/TasteProfile";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { SearchResult } from "@/types";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function getEra(releaseDate: string): string {
  if (!releaseDate || releaseDate === "Unknown") return "Unknown";
  const year = parseInt(releaseDate.split("-")[0], 10);
  if (isNaN(year)) return "Unknown";
  return year < 2020 ? "2010s" : "2020s";
}

export default function Home() {
  const [trending, setTrending] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [activeEra, setActiveEra] = useState<string | null>(null);
  const { songs: recentSongs } = useRecentlyViewed();

  const genres = useMemo(
    () => [...new Set(trending.map((s) => s.genre).filter(Boolean))].sort() as string[],
    [trending]
  );

  const filtered = useMemo(() => {
    let results = trending;
    if (activeGenre) results = results.filter((s) => s.genre === activeGenre);
    if (activeEra) results = results.filter((s) => getEra(s.releaseDate) === activeEra);
    return results;
  }, [trending, activeGenre, activeEra]);

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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16 sm:pb-24">
          {/* Headline */}
          <motion.div
            className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 px-2"
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-4 sm:mb-6 leading-tight tracking-tight">
              Track Any Song Across the{" "}
              <span className="text-accent">Music Ecosystem</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-foreground-secondary max-w-xl mx-auto">
              Search any song and see its complete performance timeline across
              Spotify, YouTube, Billboard, and more.
            </p>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            className="flex justify-center mb-10 sm:mb-14"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <SearchBar />
          </motion.div>

          {/* Feature Pills */}
          <motion.div
            className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-10 sm:mb-14 px-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            {[
              { icon: "🎧", label: "Spotify Streams" },
              { icon: "📺", label: "YouTube Views" },
              { icon: "📊", label: "Billboard Charts" },
              { icon: "📝", label: "Genius Lyrics" },
            ].map((feature) => (
              <div
                key={feature.label}
                className="flex items-center gap-2 bg-background-secondary border border-border rounded-full px-3 sm:px-4 py-1.5 sm:py-2"
              >
                <span className="text-sm sm:text-base">{feature.icon}</span>
                <span className="text-foreground-secondary text-xs sm:text-sm">{feature.label}</span>
              </div>
            ))}
          </motion.div>

          {/* Action Row — Compare + Pick for Me */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10 max-w-lg mx-auto">
            <Link
              href="/compare"
              className="flex items-center gap-2 bg-background-secondary hover:bg-card-hover border border-border rounded-full px-5 py-2.5 transition-colors group"
            >
              <GitCompareArrows className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-foreground">Compare Two Songs</span>
              <ArrowRight className="w-3.5 h-3.5 text-foreground-secondary group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <span className="text-xs text-foreground-secondary hidden sm:block">or</span>
            <DiscoverPick />
          </div>

          {/* Time Machine - Birthday Search */}
          <div className="max-w-md mx-auto">
            <DateSearch />
          </div>
        </div>
      </div>

      {/* Recently Viewed */}
      <RecentlyViewed songs={recentSongs} />

      {/* Taste Profile — personalized listening DNA */}
      <TasteProfile songs={recentSongs} />

      {/* Genre Constellation — audio feature star map */}
      <GenreConstellation />

      {/* Trending Songs Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="flex items-center gap-3 mb-4 sm:mb-5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/10 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Trending Songs</h2>
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          {!loading && (activeGenre || activeEra) && (
            <span className="text-xs text-foreground-secondary bg-background-secondary px-2 py-0.5 rounded-full">
              {filtered.length} of {trending.length}
            </span>
          )}
        </div>

        {!loading && genres.length > 0 && (
          <FilterBar
            genres={genres}
            activeGenre={activeGenre}
            activeEra={activeEra}
            onGenreChange={setActiveGenre}
            onEraChange={setActiveEra}
          />
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-3 sm:p-4 animate-pulse"
              >
                <div className="w-full aspect-square bg-background-secondary rounded-xl mb-3 sm:mb-4" />
                <div className="h-4 sm:h-5 bg-background-secondary rounded mb-2" />
                <div className="h-3 sm:h-4 bg-background-secondary rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {filtered.length > 0 ? (
              <motion.div
                key={`${activeGenre}-${activeEra}`}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
                variants={staggerContainer}
              >
                {filtered.map((song) => (
                  <motion.div key={song.id} variants={cardVariant} layout>
                    <Link
                      href={`/song/${song.id}`}
                      className="group bg-card border border-border rounded-2xl p-3 sm:p-4 hover:shadow-lg hover:border-border/80 transition-all active:scale-[0.98] block"
                    >
                      <div className="relative aspect-square mb-3 sm:mb-4 rounded-xl overflow-hidden bg-background-secondary">
                        <SafeImage
                          src={song.albumArt}
                          alt={song.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <h3 className="text-foreground font-medium text-sm sm:text-base truncate group-hover:text-accent transition-colors">
                        {song.title}
                      </h3>
                      <p className="text-foreground-secondary text-xs sm:text-sm truncate">
                        {song.artist}
                      </p>
                      {song.genre && (
                        <span className="inline-block mt-1.5 text-[10px] text-foreground-secondary bg-background-secondary px-2 py-0.5 rounded-full">
                          {song.genre}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-12"
              >
                <p className="text-foreground-secondary text-sm">
                  No songs match{activeGenre ? ` "${activeGenre}"` : ""}{activeGenre && activeEra ? " in" : ""}{activeEra ? ` the ${activeEra}` : ""}.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* How It Works Section */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl font-bold text-foreground text-center mb-12">
            How It Works
          </h2>
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
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-foreground-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </div>
            <span className="text-foreground font-semibold">Music Time Machine</span>
          </div>
          <p className="text-center text-foreground-secondary text-sm">
            Track any song&apos;s journey across the music ecosystem.
            <br />
            Data sourced from Spotify, YouTube, Billboard, and Genius.
          </p>
        </div>
      </footer>
    </div>
  );
}
