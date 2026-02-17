"use client";

import { Calendar, TrendingUp, Music, ExternalLink } from "lucide-react";
import { SongData } from "@/types";
import SafeImage from "@/components/SafeImage";
import Link from "next/link";
import { safeHref } from "@/lib/safeHref";

interface SongHeaderProps {
  song: SongData;
}

export default function SongHeader({ song }: SongHeaderProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const artistSlug = song.artist.toLowerCase().replace(/[^a-z0-9]+/g, "-");

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

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-center md:justify-start sm:gap-4">
          {song.billboard && (
            <div className="bg-background-secondary border border-border rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 sm:py-3">
              <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2 text-yellow-400 mb-0.5 sm:mb-1">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-xs uppercase tracking-wider hidden sm:inline">Peak</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-foreground text-center sm:text-left">
                #{song.billboard.peakPosition}
              </p>
            </div>
          )}

          {song.spotify && (
            <div className="bg-background-secondary border border-border rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 sm:py-3">
              <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2 text-green-400 mb-0.5 sm:mb-1">
                <span className="text-[10px] sm:text-xs uppercase tracking-wider">Streams</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-foreground text-center sm:text-left">
                {song.spotify.totalStreams}
              </p>
            </div>
          )}

          {song.youtube && (
            <div className="bg-background-secondary border border-border rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 sm:py-3">
              <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2 text-red-400 mb-0.5 sm:mb-1">
                <span className="text-[10px] sm:text-xs uppercase tracking-wider">Views</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-foreground text-center sm:text-left">
                {song.youtube.viewCount}
              </p>
            </div>
          )}
        </div>

        {/* External Links */}
        <div className="flex flex-wrap justify-center md:justify-start gap-2 sm:gap-3 mt-4 sm:mt-6">
          {song.spotify?.externalUrl && safeHref(song.spotify.externalUrl) !== "#" && (
            <a
              href={safeHref(song.spotify.externalUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 sm:gap-2 bg-green-600 hover:bg-green-500 active:scale-95 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all"
            >
              <span>Spotify</span>
              <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </a>
          )}
          {song.youtube?.externalUrl && safeHref(song.youtube.externalUrl) !== "#" && (
            <a
              href={safeHref(song.youtube.externalUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 sm:gap-2 bg-red-600 hover:bg-red-500 active:scale-95 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all"
            >
              <span>YouTube</span>
              <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </a>
          )}
          {song.genius?.lyricsUrl && safeHref(song.genius.lyricsUrl) !== "#" && (
            <a
              href={safeHref(song.genius.lyricsUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 sm:gap-2 bg-yellow-600 hover:bg-yellow-500 active:scale-95 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all"
            >
              <span>Lyrics</span>
              <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
