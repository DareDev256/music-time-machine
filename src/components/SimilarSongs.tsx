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

/** Returns a Tailwind text color class based on match strength */
function matchColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-sky-400";
  if (score >= 40) return "text-amber-400";
  return "text-foreground-secondary";
}

/** Returns a Tailwind ring/border color class based on match strength */
function matchRingColor(score: number): string {
  if (score >= 80) return "ring-emerald-400/30";
  if (score >= 60) return "ring-sky-400/30";
  if (score >= 40) return "ring-amber-400/30";
  return "ring-border";
}

/** SVG arc path for circular progress indicator */
function circleArc(score: number): string {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return `${offset}`;
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
        {similar.map(({ song: rec, reason, matchScore }, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <Link
              href={`/song/${rec.id}`}
              className={`group block bg-card border border-border rounded-xl p-3 hover:border-accent/50 hover:shadow-lg transition-all ring-1 ${matchRingColor(matchScore)} hover:ring-accent/40`}
            >
              <div className="relative mb-3">
                <SafeImage
                  src={rec.albumArt}
                  alt={`${rec.title} album art`}
                  width={200}
                  height={200}
                  className="w-full aspect-square rounded-lg object-cover group-hover:scale-[1.02] transition-transform"
                />
                {/* Match score circular badge */}
                <div
                  className="absolute -top-2 -right-2 w-10 h-10 flex items-center justify-center"
                  title={`${matchScore}% match`}
                >
                  <svg
                    viewBox="0 0 40 40"
                    className="w-10 h-10 -rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="text-border/50"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeDasharray={`${2 * Math.PI * 16}`}
                      strokeDashoffset={circleArc(matchScore)}
                      strokeLinecap="round"
                      className={matchColor(matchScore)}
                    />
                  </svg>
                  <span
                    className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${matchColor(matchScore)}`}
                  >
                    {matchScore}%
                  </span>
                  {/* Solid background behind the badge for readability */}
                  <div className="absolute inset-0 -z-10 rounded-full bg-card border border-border" />
                </div>
                {/* Reason tag */}
                <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
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
