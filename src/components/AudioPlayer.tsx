"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, ExternalLink } from "lucide-react";
import SafeImage from "./SafeImage";

interface AudioPlayerProps {
  previewUrl: string;
  title: string;
  artist: string;
  albumArt: string;
  spotifyUrl?: string;
}

const ALLOWED_AUDIO_ORIGINS = ["https://p.scdn.co"];

function isAllowedAudioUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_AUDIO_ORIGINS.some((origin) => parsed.origin === origin);
  } catch {
    return false;
  }
}

export default function AudioPlayer({
  previewUrl,
  title,
  artist,
  albumArt,
  spotifyUrl,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const safePreviewUrl = isAllowedAudioUrl(previewUrl) ? previewUrl : "";
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * duration;
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <audio ref={audioRef} src={safePreviewUrl} preload="metadata" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Album Art */}
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden flex-shrink-0 bg-background-secondary">
            <SafeImage
              src={albumArt}
              alt={title}
              fill
              className="object-cover"
            />
          </div>

          {/* Song Info */}
          <div className="flex-shrink-0 min-w-0 w-24 sm:w-40">
            <p className="text-foreground font-medium text-sm truncate">{title}</p>
            <p className="text-foreground-secondary text-xs truncate">{artist}</p>
          </div>

          {/* Play Button */}
          <button
            onClick={togglePlay}
            className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 bg-accent hover:bg-accent-hover rounded-full flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 text-white ml-0.5" />
            )}
          </button>

          {/* Progress Bar */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-foreground-secondary text-xs hidden sm:block w-8 text-right">
              {formatTime(currentTime)}
            </span>
            <div
              className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-foreground-secondary text-xs hidden sm:block w-8">
              {formatTime(duration)}
            </span>
          </div>

          {/* Volume & Spotify Link */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Volume2 className="w-4 h-4 text-foreground-secondary hidden sm:block" />
            {spotifyUrl && (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground-secondary hover:text-green-500 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
