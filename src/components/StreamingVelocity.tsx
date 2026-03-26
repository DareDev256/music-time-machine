"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, Disc3, Eye, Calendar } from "lucide-react";
import { SongData } from "@/types";
import { calculateVelocity, TIER_META } from "@/lib/velocity";
import { formatCompact } from "@/lib/formatNumber";

function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1000);
      setDisplay(Math.round((1 - Math.pow(1 - t, 3)) * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span>{formatCompact(display)}</span>;
}

function VelocityMetric({ icon: Icon, label, value, delay }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number; delay: number;
}) {
  return (
    <motion.div
      className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-background-secondary/50 border border-border/50"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Icon className="w-4 h-4 text-foreground-secondary" />
      <span className="text-lg sm:text-xl font-semibold text-foreground tabular-nums tracking-tight">
        <AnimatedCount value={value} />
      </span>
      <span className="text-[11px] sm:text-xs text-foreground-secondary whitespace-nowrap">{label}</span>
    </motion.div>
  );
}

export default function StreamingVelocity({ song }: { song: SongData }) {
  const velocity = useMemo(() => calculateVelocity(song), [song]);
  const tierInfo = TIER_META[velocity.tier];

  // Don't render if there's no meaningful data
  if (velocity.combinedDaily === 0 && velocity.weeksOnChart === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
      {/* Section header with velocity tier badge */}
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-background-secondary">
            <Activity className="w-4 h-4 text-accent" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            Streaming Velocity
          </h2>
        </div>
        <motion.span
          className="text-xs font-medium px-2.5 py-1 rounded-full border"
          style={{
            color: tierInfo.color,
            borderColor: tierInfo.color,
            boxShadow: `0 0 12px ${tierInfo.glow}`,
          }}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          {tierInfo.label}
        </motion.span>
      </div>

      {/* Velocity metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {velocity.dailyStreams > 0 && (
          <VelocityMetric
            icon={Disc3}
            label="Streams / day"
            value={velocity.dailyStreams}
            delay={0.1}
          />
        )}
        {velocity.dailyViews > 0 && (
          <VelocityMetric
            icon={Eye}
            label="Views / day"
            value={velocity.dailyViews}
            delay={0.18}
          />
        )}
        {velocity.weeksOnChart > 0 && (
          <VelocityMetric
            icon={Activity}
            label="Weeks on chart"
            value={velocity.weeksOnChart}
            delay={0.26}
          />
        )}
        <VelocityMetric
          icon={Calendar}
          label="Days since release"
          value={velocity.daysSinceRelease}
          delay={0.34}
        />
      </div>

      {/* Velocity bar — visual proportion of streams vs views */}
      {velocity.dailyStreams > 0 && velocity.dailyViews > 0 && (
        <motion.div
          className="mt-4 sm:mt-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-between text-[11px] text-foreground-secondary mb-1.5">
            <span>Spotify</span>
            <span>YouTube</span>
          </div>
          <div className="h-1.5 rounded-full bg-background-secondary overflow-hidden flex">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: "#1DB954" }}
              initial={{ width: 0 }}
              animate={{
                width: `${(velocity.dailyStreams / velocity.combinedDaily) * 100}%`,
              }}
              transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: "#FF4444" }}
              initial={{ width: 0 }}
              animate={{
                width: `${(velocity.dailyViews / velocity.combinedDaily) * 100}%`,
              }}
              transition={{ duration: 0.8, delay: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
