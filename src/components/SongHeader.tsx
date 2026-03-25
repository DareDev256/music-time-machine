"use client";

import { ReactNode } from "react";
import { Calendar, TrendingUp, Music, ExternalLink } from "lucide-react";
import { SongData } from "@/types";
import SafeImage from "@/components/SafeImage";
import Link from "next/link";
import { safeHref } from "@/lib/safeHref";
import { formatDate } from "@/lib/formatDate";
import { toSlug } from "@/lib/toSlug";

/* ------------------------------------------------------------------ */
/*  Sub-components — eliminate duplicated stat / link markup           */
/* ------------------------------------------------------------------ */

interface HeaderStatProps {
  label: string;
  value: string;
  color: string; // Tailwind text-color class, e.g. "text-yellow-400"
  icon?: ReactNode;
}

/** Compact stat chip used in the song header's inline stats row. */
function HeaderStat({ label, value, color, icon }: HeaderStatProps) {
  return (
    <div className="bg-background-secondary border border-border rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 sm:py-3">
      <div className={`flex items-center justify-center sm:justify-start gap-1 sm:gap-2 ${color} mb-0.5 sm:mb-1`}>
        {icon}
        <span className="text-[10px] sm:text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg sm:text-2xl font-bold text-foreground text-center sm:text-left">
        {value}
      </p>
    </div>
  );
}

interface PlatformLinkProps {
  url: string | undefined;
  label: string;
  /** Tailwind bg + hover classes, e.g. "bg-green-600 hover:bg-green-500" */
  colors: string;
}

/** External link pill used for Spotify / YouTube / Genius. */
function PlatformLink({ url, label, colors }: PlatformLinkProps) {
  if (!url || safeHref(url) === "#") return null;
  return (
    <a
      href={safeHref(url)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-1.5 sm:gap-2 ${colors} active:scale-95 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all`}
    >
      <span>{label}</span>
      <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

interface SongHeaderProps {
  song: SongData;
}

export default function SongHeader({ song }: SongHeaderProps) {
  const artistSlug = toSlug(song.artist);

  return (
    <div className="flex flex-col md:flex-row items-center md:items-start gap-4 sm:gap-6 md:gap-8">
      {/* Album Art */}
      <div className="flex-shrink-0">
        <SafeImage
          src={song.albumArt}
          alt={`${song.title} album art`}
          width={288}
          height={288}
          className="w-48 h-48 sm:w-56 sm:h-56 md:w-72 md:h-72 rounded-2xl object-cover shadow-2xl"
          priority
        />
      </div>

      {/* Song Info */}
      <div className="flex-1 text-center md:text-left min-w-0">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-1 sm:mb-2 truncate">
          {song.title}
        </h1>
        <Link
          href={`/artist/${artistSlug}`}
          className="text-lg sm:text-xl md:text-2xl text-foreground-secondary hover:text-accent transition-colors mb-3 sm:mb-4 truncate block"
        >
          {song.artist}
        </Link>

        {/* Meta Info */}
        <div className="flex flex-wrap justify-center md:justify-start gap-2 sm:gap-4 text-xs sm:text-sm text-foreground-secondary mb-4 sm:mb-6">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="truncate max-w-[150px] sm:max-w-none">{song.spotify?.album || "Unknown Album"}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span>{formatDate(song.releaseDate)}</span>
          </div>
        </div>

        {/* Quick Stats — data-driven instead of copy-pasted blocks */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-center md:justify-start sm:gap-4">
          {song.billboard && (
            <HeaderStat
              label="Peak"
              value={`#${song.billboard.peakPosition}`}
              color="text-yellow-400"
              icon={<TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />}
            />
          )}
          {song.spotify && (
            <HeaderStat
              label="Streams"
              value={song.spotify.totalStreams}
              color="text-green-400"
            />
          )}
          {song.youtube && (
            <HeaderStat
              label="Views"
              value={song.youtube.viewCount}
              color="text-red-400"
            />
          )}
        </div>

        {/* External Links — data-driven instead of copy-pasted blocks */}
        <div className="flex flex-wrap justify-center md:justify-start gap-2 sm:gap-3 mt-4 sm:mt-6">
          <PlatformLink url={song.spotify?.externalUrl} label="Spotify" colors="bg-green-600 hover:bg-green-500" />
          <PlatformLink url={song.youtube?.externalUrl} label="YouTube" colors="bg-red-600 hover:bg-red-500" />
          <PlatformLink url={song.genius?.lyricsUrl} label="Lyrics" colors="bg-yellow-600 hover:bg-yellow-500" />
        </div>
      </div>
    </div>
  );
}
