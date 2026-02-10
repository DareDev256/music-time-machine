"use client";

import { ArtistData } from "@/types";
import SafeImage from "./SafeImage";

interface ArtistHeaderProps {
  artist: ArtistData;
}

export default function ArtistHeader({ artist }: ArtistHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
      {/* Artist Image */}
      <div className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full overflow-hidden flex-shrink-0 shadow-2xl bg-background-secondary">
        <SafeImage
          src={artist.image}
          alt={artist.name}
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Artist Info */}
      <div className="flex-1 text-center md:text-left">
        <p className="text-foreground-secondary text-sm uppercase tracking-wider mb-1">Artist</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-3">
          {artist.name}
        </h1>

        {/* Genres */}
        {artist.genres.length > 0 && (
          <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
            {artist.genres.slice(0, 4).map((genre) => (
              <span
                key={genre}
                className="bg-background-secondary border border-border rounded-full px-3 py-1 text-foreground-secondary text-xs"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap justify-center md:justify-start gap-6">
          <div>
            <p className="text-foreground text-xl sm:text-2xl font-bold">{artist.monthlyListeners}</p>
            <p className="text-foreground-secondary text-xs">Monthly Listeners</p>
          </div>
          <div>
            <p className="text-foreground text-xl sm:text-2xl font-bold">{artist.totalStreams}</p>
            <p className="text-foreground-secondary text-xs">Total Streams</p>
          </div>
          <div>
            <p className="text-foreground text-xl sm:text-2xl font-bold">{artist.albums.length}</p>
            <p className="text-foreground-secondary text-xs">Albums</p>
          </div>
        </div>
      </div>
    </div>
  );
}
