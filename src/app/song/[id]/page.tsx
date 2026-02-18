"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, GitCompareArrows, Share2 } from "lucide-react";
import { SongData } from "@/types";
import SongHeader from "@/components/SongHeader";
import QuickStats from "@/components/QuickStats";
import SpotifyCard from "@/components/SpotifyCard";
import YouTubeCard from "@/components/YouTubeCard";
import BillboardCard from "@/components/BillboardCard";
import GeniusCard from "@/components/GeniusCard";
import AudioPlayer from "@/components/AudioPlayer";
import ShareCard from "@/components/ShareCard";
import SimilarSongs from "@/components/SimilarSongs";
import SongMilestones from "@/components/SongMilestones";
import SearchBar from "@/components/SearchBar";
import { PageLoadingState, PageErrorState } from "@/components/PageStates";

const AudioRadarChart = dynamic(() => import("@/components/AudioRadarChart"), {
  ssr: false,
  loading: () => (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 h-64 flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-accent animate-spin" />
    </div>
  ),
});

const TimelineChart = dynamic(() => import("@/components/TimelineChart"), {
  ssr: false,
  loading: () => (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 h-80 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-accent animate-spin" />
    </div>
  ),
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SongPage({ params }: PageProps) {
  const { id } = use(params);
  const [song, setSong] = useState<SongData | null>(null);
  const [catalog, setCatalog] = useState<SongData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const fetchSong = async () => {
      try {
        setLoading(true);
        const [songRes, catalogRes] = await Promise.all([
          fetch(`/api/song/${id}`),
          fetch("/api/catalog"),
        ]);

        if (!songRes.ok) {
          setError(songRes.status === 404 ? "Song not found" : "Failed to load song data");
          return;
        }

        const data = await songRes.json();
        setSong(data);

        if (catalogRes.ok) {
          setCatalog(await catalogRes.json());
        }
      } catch (err) {
        console.error("Error fetching song:", err);
        setError("Failed to load song data");
      } finally {
        setLoading(false);
      }
    };

    fetchSong();
  }, [id]);

  if (loading) return <PageLoadingState message="Loading song data..." />;
  if (error || !song) return <PageErrorState message={error || "Song not found"} />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-14 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">Back</span>
            </Link>
            <div className="flex-1 flex justify-center">
              <SearchBar />
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/compare?song1=${id}`}
                className="flex items-center gap-1.5 text-foreground-secondary hover:text-foreground transition-colors text-sm px-3 py-1.5 rounded-full hover:bg-background-secondary"
              >
                <GitCompareArrows className="w-4 h-4" />
                <span className="hidden sm:inline">Compare</span>
              </Link>
              <button
                onClick={() => setShowShare(true)}
                className="flex items-center gap-1.5 text-foreground-secondary hover:text-foreground transition-colors text-sm px-3 py-1.5 rounded-full hover:bg-background-secondary"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Song Header */}
        <motion.section
          className="mb-6 sm:mb-8 md:mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <SongHeader song={song} />
        </motion.section>

        {/* Quick Stats Bar */}
        <motion.section
          className="mb-6 sm:mb-8 md:mb-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <QuickStats song={song} />
        </motion.section>

        {/* Timeline Chart */}
        {song.timeline && song.timeline.length > 0 && (
          <motion.section
            className="mb-6 sm:mb-8 md:mb-12"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <TimelineChart data={song.timeline} />
          </motion.section>
        )}

        {/* Audio DNA Radar */}
        {song.spotify?.audioFeatures && (
          <motion.section
            className="mb-6 sm:mb-8 md:mb-12"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <AudioRadarChart audioFeatures={song.spotify.audioFeatures} />
          </motion.section>
        )}

        {/* Song Journey Milestones */}
        <motion.section
          className="mb-6 sm:mb-8 md:mb-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
        >
          <SongMilestones song={song} />
        </motion.section>

        {/* Platform Cards Grid */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 sm:mb-6">
            Platform Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
            {song.spotify && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}>
                <SpotifyCard data={song.spotify} />
              </motion.div>
            )}
            {song.youtube && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.38 }}>
                <YouTubeCard data={song.youtube} />
              </motion.div>
            )}
            {song.billboard && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.46 }}>
                <BillboardCard data={song.billboard} />
              </motion.div>
            )}
            {song.genius && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.54 }}>
                <GeniusCard data={song.genius} />
              </motion.div>
            )}
          </div>
        </motion.section>

        {/* Similar Songs */}
        {catalog.length > 0 && (
          <motion.section
            className="mt-6 sm:mt-8 md:mt-12"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <SimilarSongs song={song} catalog={catalog} />
          </motion.section>
        )}
      </main>

      {/* Audio Preview Player */}
      {song.spotify?.previewUrl && (
        <AudioPlayer
          previewUrl={song.spotify.previewUrl}
          title={song.title}
          artist={song.artist}
          albumArt={song.albumArt}
          spotifyUrl={song.spotify.externalUrl}
        />
      )}

      {/* Share Modal */}
      {showShare && (
        <ShareCard
          song={song}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-foreground-secondary text-sm">
            Music Time Machine - Track any song across the music ecosystem
          </p>
        </div>
      </footer>
    </div>
  );
}
