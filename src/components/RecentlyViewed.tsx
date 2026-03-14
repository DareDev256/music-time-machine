"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import SafeImage from "@/components/SafeImage";
import type { RecentSong } from "@/hooks/useRecentlyViewed";

interface RecentlyViewedProps {
  songs: RecentSong[];
}

export default function RecentlyViewed({ songs }: RecentlyViewedProps) {
  if (songs.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 sm:pb-10">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 bg-foreground/8 rounded-lg flex items-center justify-center">
          <Clock className="w-3.5 h-3.5 text-foreground-secondary" />
        </div>
        <h2 className="text-sm font-medium text-foreground-secondary tracking-wide uppercase">
          Recently Viewed
        </h2>
      </div>

      <div
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        role="list"
        aria-label="Recently viewed songs"
      >
        {songs.map((song, i) => (
          <motion.div
            key={song.id}
            role="listitem"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className="flex-shrink-0"
          >
            <Link
              href={`/song/${song.id}`}
              className="group flex items-center gap-3 bg-card/60 border border-border/60 rounded-xl px-3 py-2.5 hover:bg-card hover:border-border transition-all w-56"
            >
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-background-secondary flex-shrink-0">
                <SafeImage
                  src={song.albumArt}
                  alt={song.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors">
                  {song.title}
                </p>
                <p className="text-xs text-foreground-secondary truncate">
                  {song.artist}
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
