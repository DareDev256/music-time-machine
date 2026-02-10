"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ArtistData } from "@/types";
import ArtistHeader from "@/components/ArtistHeader";
import SafeImage from "@/components/SafeImage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ArtistPage({ params }: PageProps) {
  const { id } = use(params);
  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArtist = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/artist/${id}`);

        if (!res.ok) {
          setError(res.status === 404 ? "Artist not found" : "Failed to load artist data");
          return;
        }

        const data = await res.json();
        setArtist(data);
      } catch {
        setError("Failed to load artist data");
      } finally {
        setLoading(false);
      }
    };

    fetchArtist();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
          <p className="text-foreground-secondary">Loading artist data...</p>
        </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-accent text-xl mb-4">{error || "Artist not found"}</p>
          <Link href="/" className="text-foreground-secondary hover:text-foreground transition-colors">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-14 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Artist Header */}
        <motion.section
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <ArtistHeader artist={artist} />
        </motion.section>

        {/* Top Tracks */}
        {artist.topTracks.length > 0 && (
          <motion.section
            className="mb-12"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <h2 className="text-xl font-semibold text-foreground mb-6">Top Tracks</h2>
            <div className="space-y-2">
              {artist.topTracks.map((track, i) => (
                <Link
                  key={track.id}
                  href={`/song/${track.id}`}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-background-secondary transition-colors group"
                >
                  <span className="text-foreground-secondary text-sm w-6 text-center">{i + 1}</span>
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-background-secondary">
                    <SafeImage
                      src={track.albumArt}
                      alt={track.title}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium text-sm truncate group-hover:text-accent transition-colors">
                      {track.title}
                    </p>
                  </div>
                  <span className="text-foreground-secondary text-sm">{track.streams}</span>
                </Link>
              ))}
            </div>
          </motion.section>
        )}

        {/* Discography */}
        {artist.albums.length > 0 && (
          <motion.section
            className="mb-12"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <h2 className="text-xl font-semibold text-foreground mb-6">Discography</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {artist.albums.map((album) => (
                <div key={album.name} className="group">
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-background-secondary shadow-md">
                    <SafeImage
                      src={album.albumArt}
                      alt={album.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <p className="text-foreground font-medium text-sm truncate">{album.name}</p>
                  <p className="text-foreground-secondary text-xs">{album.year}</p>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Career Timeline */}
        {artist.careerTimeline.length > 0 && (
          <motion.section
            className="mb-12"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
          >
            <h2 className="text-xl font-semibold text-foreground mb-6">Career Timeline</h2>
            <div className="space-y-4">
              {artist.careerTimeline.map((event, i) => (
                <div key={i} className="flex items-start gap-4">
                  <span className="text-accent font-bold text-sm w-12 flex-shrink-0 pt-0.5">
                    {event.year}
                  </span>
                  <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                  <p className="text-foreground text-sm">{event.event}</p>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-foreground-secondary text-sm">
            Music Time Machine - Track any song across the music ecosystem
          </p>
        </div>
      </footer>
    </div>
  );
}
