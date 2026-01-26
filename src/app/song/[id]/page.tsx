"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SongData } from "@/types";
import SongHeader from "@/components/SongHeader";
import SpotifyCard from "@/components/SpotifyCard";
import YouTubeCard from "@/components/YouTubeCard";
import BillboardCard from "@/components/BillboardCard";
import GeniusCard from "@/components/GeniusCard";
import SearchBar from "@/components/SearchBar";

// Dynamic import with SSR disabled to avoid recharts hydration issues
const TimelineChart = dynamic(() => import("@/components/TimelineChart"), {
  ssr: false,
  loading: () => (
    <div className="bg-gray-900/50 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 h-80 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
    </div>
  ),
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SongPage({ params }: PageProps) {
  const { id } = use(params);
  const [song, setSong] = useState<SongData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSong = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/song/${id}`);

        if (!res.ok) {
          if (res.status === 404) {
            setError("Song not found");
          } else {
            setError("Failed to load song data");
          }
          return;
        }

        const data = await res.json();
        setSong(data);
      } catch (err) {
        console.error("Error fetching song:", err);
        setError("Failed to load song data");
      } finally {
        setLoading(false);
      }
    };

    fetchSong();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading song data...</p>
        </div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error || "Song not found"}</p>
          <Link
            href="/"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="flex-1 flex justify-center">
              <SearchBar />
            </div>
            <div className="w-16 hidden sm:block" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Song Header */}
        <section className="mb-6 sm:mb-8 md:mb-12">
          <SongHeader song={song} />
        </section>

        {/* Timeline Chart */}
        {song.timeline && song.timeline.length > 0 && (
          <section className="mb-6 sm:mb-8 md:mb-12">
            <TimelineChart data={song.timeline} />
          </section>
        )}

        {/* Platform Cards Grid */}
        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">
            Platform Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
            {song.spotify && <SpotifyCard data={song.spotify} />}
            {song.youtube && <YouTubeCard data={song.youtube} />}
            {song.billboard && <BillboardCard data={song.billboard} />}
            {song.genius && <GeniusCard data={song.genius} />}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500 text-sm">
            Music Time Machine - Track any song across the music ecosystem
          </p>
        </div>
      </footer>
    </div>
  );
}
