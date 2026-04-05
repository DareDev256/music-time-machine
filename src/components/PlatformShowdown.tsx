"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Swords, Music, Video, Trophy } from "lucide-react";
import { SongData } from "@/types";
import { formatCompact } from "@/lib/formatNumber";

/* ── helpers ─────────────────────────────────────────────────────────── */

/** Parse a formatted number string like "2,400,000,000" into a raw number. */
function parse(v: string | undefined | null): number {
  if (!v) return 0;
  return parseInt(v.replace(/,/g, ""), 10) || 0;
}

interface Metric {
  label: string;
  spotify: number;
  youtube: number;
}

interface ShowdownResult {
  metrics: Metric[];
  spotifyWins: number;
  youtubeWins: number;
  verdict: string;
  verdictEmoji: string;
  dominance: number; // 0 = all YouTube, 50 = even, 100 = all Spotify
}

function analyzeShowdown(song: SongData): ShowdownResult | null {
  if (!song.spotify || !song.youtube) return null;

  const streams = parse(song.spotify.totalStreams);
  const views = parse(song.youtube.viewCount);
  if (streams === 0 && views === 0) return null;

  const likes = parse(song.youtube.likeCount);
  const comments = parse(song.youtube.commentCount);
  const playlists = song.spotify.playlistCount;
  const popularity = song.spotify.popularity;

  // Normalize metrics to comparable scales for win counting
  const metrics: Metric[] = [
    { label: "Reach", spotify: streams, youtube: views },
    { label: "Engagement", spotify: playlists * 1000, youtube: likes },
    { label: "Discussion", spotify: popularity * 10000, youtube: comments },
  ];

  let spotifyWins = 0;
  let youtubeWins = 0;
  for (const m of metrics) {
    if (m.spotify > m.youtube) spotifyWins++;
    else if (m.youtube > m.spotify) youtubeWins++;
  }

  // Dominance is based on raw reach ratio
  const total = streams + views;
  const dominance = total > 0 ? (streams / total) * 100 : 50;

  let verdict: string;
  let verdictEmoji: string;
  if (Math.abs(dominance - 50) < 10) {
    verdict = "Balanced Presence";
    verdictEmoji = "⚖️";
  } else if (dominance > 50) {
    verdict = dominance > 75 ? "Spotify Stronghold" : "Spotify Leaning";
    verdictEmoji = dominance > 75 ? "🟢" : "🟩";
  } else {
    verdict = dominance < 25 ? "YouTube Fortress" : "YouTube Leaning";
    verdictEmoji = dominance < 25 ? "🔴" : "🟥";
  }

  return { metrics, spotifyWins, youtubeWins, verdict, verdictEmoji, dominance };
}

/* ── sub-components ──────────────────────────────────────────────────── */

const SPOTIFY_GREEN = "#1DB954";
const YOUTUBE_RED = "#FF0033";

function BattleBar({ spotify, youtube, delay }: { spotify: number; youtube: number; delay: number }) {
  const total = spotify + youtube;
  if (total === 0) return null;
  const pct = (spotify / total) * 100;

  return (
    <div className="h-2 rounded-full bg-background-secondary overflow-hidden flex" role="meter" aria-label="Platform split">
      <motion.div
        className="h-full"
        style={{ backgroundColor: SPOTIFY_GREEN }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
      <motion.div
        className="h-full"
        style={{ backgroundColor: YOUTUBE_RED }}
        initial={{ width: 0 }}
        animate={{ width: `${100 - pct}%` }}
        transition={{ duration: 0.9, delay: delay + 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
  );
}

function MetricRow({ metric, index }: { metric: Metric; index: number }) {
  const spotifyWins = metric.spotify >= metric.youtube;
  const delay = 0.2 + index * 0.12;

  return (
    <motion.div
      className="space-y-1.5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium" style={{ color: spotifyWins ? SPOTIFY_GREEN : "var(--foreground-secondary)" }}>
          {formatCompact(metric.spotify)}
        </span>
        <span className="text-foreground-secondary font-medium tracking-wide uppercase text-[10px]">
          {metric.label}
        </span>
        <span className="font-medium" style={{ color: !spotifyWins ? YOUTUBE_RED : "var(--foreground-secondary)" }}>
          {formatCompact(metric.youtube)}
        </span>
      </div>
      <BattleBar spotify={metric.spotify} youtube={metric.youtube} delay={delay + 0.1} />
    </motion.div>
  );
}

/* ── main component ──────────────────────────────────────────────────── */

export default function PlatformShowdown({ song }: { song: SongData }) {
  const result = useMemo(() => analyzeShowdown(song), [song]);
  if (!result) return null;

  const { metrics, spotifyWins, youtubeWins, verdict, verdictEmoji, dominance } = result;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-background-secondary">
            <Swords className="w-4 h-4 text-accent" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            Platform Showdown
          </h2>
        </div>
        <motion.span
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-background-secondary text-foreground-secondary"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          {verdictEmoji} {verdict}
        </motion.span>
      </div>

      {/* Platform labels */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5" style={{ color: SPOTIFY_GREEN }} />
          <span className="text-xs font-semibold" style={{ color: SPOTIFY_GREEN }}>Spotify</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold" style={{ color: YOUTUBE_RED }}>YouTube</span>
          <Video className="w-3.5 h-3.5" style={{ color: YOUTUBE_RED }} />
        </div>
      </div>

      {/* Metric rows */}
      <div className="space-y-3 sm:space-y-4">
        {metrics.map((m, i) => (
          <MetricRow key={m.label} metric={m} index={i} />
        ))}
      </div>

      {/* Scoreboard */}
      <motion.div
        className="mt-5 flex items-center justify-center gap-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.7 }}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-2xl font-bold tabular-nums" style={{ color: SPOTIFY_GREEN }}>
            {spotifyWins}
          </span>
          <span className="text-[10px] text-foreground-secondary uppercase tracking-wider">wins</span>
        </div>
        <Trophy className="w-5 h-5 text-foreground-secondary/40" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-2xl font-bold tabular-nums" style={{ color: YOUTUBE_RED }}>
            {youtubeWins}
          </span>
          <span className="text-[10px] text-foreground-secondary uppercase tracking-wider">wins</span>
        </div>
      </motion.div>

      {/* Dominance meter */}
      <motion.div
        className="mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
      >
        <div className="relative h-1 rounded-full bg-background-secondary overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: SPOTIFY_GREEN }}
            initial={{ width: "50%" }}
            animate={{ width: `${dominance}%` }}
            transition={{ duration: 1.2, delay: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-foreground-secondary">Audio-first</span>
          <span className="text-[10px] text-foreground-secondary">Video-first</span>
        </div>
      </motion.div>
    </div>
  );
}
