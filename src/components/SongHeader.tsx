"use client";

import Image from "next/image";
import { Calendar, TrendingUp, Music, ExternalLink } from "lucide-react";
import { SongData } from "@/types";

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

  return (
    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
      {/* Album Art */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-50 group-hover:opacity-75 transition-opacity" />
        <Image
          src={song.albumArt}
          alt={`${song.title} album art`}
          width={200}
          height={200}
          className="relative w-48 h-48 md:w-56 md:h-56 rounded-xl object-cover shadow-2xl"
          priority
        />
      </div>

      {/* Song Info */}
      <div className="flex-1 text-center md:text-left">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
          {song.title}
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 mb-4">{song.artist}</p>

        {/* Meta Info */}
        <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-gray-400 mb-6">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4" />
            <span>{song.spotify?.album || "Unknown Album"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(song.releaseDate)}</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex flex-wrap justify-center md:justify-start gap-4">
          {song.billboard && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-yellow-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Peak Position</span>
              </div>
              <p className="text-2xl font-bold text-white">
                #{song.billboard.peakPosition}
              </p>
            </div>
          )}

          {song.spotify && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <span className="text-xs uppercase tracking-wider">Total Streams</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {song.spotify.totalStreams}
              </p>
            </div>
          )}

          {song.youtube && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <span className="text-xs uppercase tracking-wider">YouTube Views</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {song.youtube.viewCount}
              </p>
            </div>
          )}
        </div>

        {/* External Links */}
        <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-6">
          {song.spotify?.externalUrl && (
            <a
              href={song.spotify.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
            >
              <span>Open in Spotify</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {song.youtube?.externalUrl && (
            <a
              href={song.youtube.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
            >
              <span>Watch on YouTube</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
