"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { SongData } from "@/types";
import SafeImage from "@/components/SafeImage";
import { getSimilarSongs } from "@/lib/recommendations";

interface SimilarSongsProps {
  song: SongData;
  catalog: SongData[];
}

export default function SimilarSongs({ song, catalog }: SimilarSongsProps) {
  const similar = getSimilarSongs(song, catalog);

  if (similar.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 sm:mb-6 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-accent" />
        Similar Songs
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {similar.map(({ song: rec, reason }, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <Link
              href={`/song/${rec.id}`}
              className="group block bg-card border border-border rounded-xl p-3 hover:border-accent/50 hover:shadow-lg transition-all"
            >
              <div className="relative mb-3">
                <SafeImage
                  src={rec.albumArt}
                  alt={`${rec.title} album art`}
                  width={200}
                  height={200}
                  className="w-full aspect-square rounded-lg object-cover group-hover:scale-[1.02] transition-transform"
                />
                <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                  {reason}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground truncate">
                {rec.title}
              </p>
              <p className="text-xs text-foreground-secondary truncate">
                {rec.artist}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
