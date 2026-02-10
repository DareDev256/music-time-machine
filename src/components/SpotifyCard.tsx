"use client";

import { SpotifyData } from "@/types";
import PlatformCard, { StatRow } from "./PlatformCard";

interface SpotifyCardProps {
  data: SpotifyData;
}

// Simple Spotify icon
const SpotifyIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export default function SpotifyCard({ data }: SpotifyCardProps) {
  return (
    <PlatformCard
      title="Spotify"
      icon={<SpotifyIcon />}
      color="#1DB954"
      externalUrl={data.externalUrl}
    >
      <StatRow label="Total Streams" value={data.totalStreams} />
      <StatRow label="Popularity Score" value={`${data.popularity}/100`} />
      <StatRow
        label="Playlist Features"
        value={data.playlistCount.toLocaleString()}
      />
      <StatRow label="Album" value={data.album} />

      {/* Audio Features */}
      {data.audioFeatures && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-foreground-secondary uppercase tracking-wider mb-3">
            Audio Features
          </p>
          <div className="grid grid-cols-2 gap-3">
            <AudioFeature
              label="Danceability"
              value={data.audioFeatures.danceability}
            />
            <AudioFeature label="Energy" value={data.audioFeatures.energy} />
            <AudioFeature label="Valence" value={data.audioFeatures.valence} />
            <AudioFeature
              label="Tempo"
              value={data.audioFeatures.tempo}
              isBpm
            />
          </div>
        </div>
      )}
    </PlatformCard>
  );
}

interface AudioFeatureProps {
  label: string;
  value: number;
  isBpm?: boolean;
}

function AudioFeature({ label, value, isBpm }: AudioFeatureProps) {
  const percentage = isBpm ? 0 : value * 100;

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-foreground-secondary">{label}</span>
        <span className="text-foreground">
          {isBpm ? `${Math.round(value)} BPM` : `${Math.round(percentage)}%`}
        </span>
      </div>
      {!isBpm && (
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
