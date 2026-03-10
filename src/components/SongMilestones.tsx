"use client";

import { motion } from "framer-motion";
import { Calendar, Trophy, Play, TrendingUp, BookOpen, Music } from "lucide-react";
import { SongData } from "@/types";
import { formatDate } from "@/lib/formatDate";

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

interface Milestone {
  date: string;
  label: string;
  detail: string;
  icon: React.ReactNode;
  color: string;
  accentBg: string;
}

/** Extract milestones from cross-platform song data */
function extractMilestones(song: SongData): Milestone[] {
  const milestones: Milestone[] = [];

  // 1. Release date — always present
  milestones.push({
    date: song.releaseDate,
    label: "Released",
    detail: song.spotify?.album ? `on ${song.spotify.album}` : "Single release",
    icon: <Music className="w-3.5 h-3.5" />,
    color: "text-accent",
    accentBg: "bg-accent/15 border-accent/25",
  });

  // 2. YouTube music video published
  if (song.youtube?.publishedAt) {
    const pubDate = song.youtube.publishedAt.split("T")[0];
    if (pubDate !== song.releaseDate) {
      milestones.push({
        date: pubDate,
        label: "Music video dropped",
        detail: `on ${song.youtube.channelTitle}`,
        icon: <Play className="w-3.5 h-3.5" />,
        color: "text-red-400",
        accentBg: "bg-red-400/15 border-red-400/25",
      });
    }
  }

  // 3. Billboard chart entry
  if (song.billboard?.entryDate) {
    milestones.push({
      date: song.billboard.entryDate,
      label: `Entered Hot 100 at #${song.billboard.entryPosition}`,
      detail: `${song.billboard.weeksOnChart} weeks total on chart`,
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      color: "text-amber-400",
      accentBg: "bg-amber-400/15 border-amber-400/25",
    });
  }

  // 4. Billboard peak
  if (song.billboard?.peakDate && song.billboard.peakDate !== song.billboard.entryDate) {
    const peakLabel = song.billboard.peakPosition === 1
      ? "Hit #1 on Billboard Hot 100"
      : `Peaked at #${song.billboard.peakPosition} on Hot 100`;
    milestones.push({
      date: song.billboard.peakDate,
      label: peakLabel,
      detail: song.billboard.peakPosition === 1
        ? "The summit — biggest chart moment"
        : `Highest chart position achieved`,
      icon: <Trophy className="w-3.5 h-3.5" />,
      color: "text-amber-300",
      accentBg: "bg-amber-300/15 border-amber-300/25",
    });
  }

  // 5. Genius annotations milestone
  if (song.genius && song.genius.annotationCount >= 20) {
    milestones.push({
      date: (() => {
        if (!song.genius.releaseDate) return song.releaseDate;
        const parsed = new Date(song.genius.releaseDate);
        return Number.isNaN(parsed.getTime()) ? song.releaseDate : parsed.toISOString().split("T")[0];
      })(),
      label: `${song.genius.annotationCount} community annotations`,
      detail: `${song.genius.pageViews} page views on Genius`,
      icon: <BookOpen className="w-3.5 h-3.5" />,
      color: "text-sky-400",
      accentBg: "bg-sky-400/15 border-sky-400/25",
    });
  }

  // Sort chronologically
  milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return milestones;
}

export default function SongMilestones({ song }: { song: SongData }) {
  const milestones = extractMilestones(song);

  // Need at least 2 milestones for a timeline to be meaningful
  if (milestones.length < 2) return null;

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 sm:mb-6 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-accent" />
        Song Journey
      </h2>

      <div className="relative" role="list" aria-label="Song milestone timeline">
        {/* Vertical line */}
        <div
          className="absolute left-[15px] sm:left-[19px] top-2 bottom-2 w-px bg-border"
          aria-hidden="true"
        />

        <div className="space-y-4 sm:space-y-5">
          {milestones.map((m, i) => (
            <motion.div
              key={`${m.date}-${m.label}`}
              className="relative flex gap-3 sm:gap-4 items-start"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              role="listitem"
            >
              {/* Timeline node */}
              <div
                className={`relative z-10 w-[31px] h-[31px] sm:w-[39px] sm:h-[39px] rounded-full border flex items-center justify-center shrink-0 ${m.accentBg} ${m.color}`}
                aria-hidden="true"
              >
                {m.icon}
              </div>

              {/* Content */}
              <div className="pt-0.5 sm:pt-1.5 min-w-0 flex-1">
                <time className="text-[10px] sm:text-[11px] uppercase tracking-wider text-foreground-secondary font-medium">
                  {formatDate(m.date, SHORT_DATE)}
                </time>
                <p className="text-sm sm:text-base font-medium text-foreground leading-snug mt-0.5">
                  {m.label}
                </p>
                <p className="text-xs sm:text-sm text-foreground-secondary mt-0.5 leading-relaxed">
                  {m.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
