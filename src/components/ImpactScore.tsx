"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { SongData } from "@/types";
import { calculateImpactScore } from "@/lib/impactScore";

const RING_SIZE = 140;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PLATFORM_META = [
  { key: "spotify" as const, label: "Spotify", max: 30, color: "#1DB954" },
  { key: "youtube" as const, label: "YouTube", max: 25, color: "#FF4444" },
  { key: "billboard" as const, label: "Billboard", max: 30, color: "#FFB800" },
  { key: "genius" as const, label: "Genius", max: 15, color: "#FFFF64" },
];

/** Counts from 0 to target with ease-out cubic timing */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1200;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{display}</>;
}

export default function ImpactScore({ song }: { song: SongData }) {
  const score = calculateImpactScore(song);
  const offset = CIRCUMFERENCE - (score.total / 100) * CIRCUMFERENCE;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Impact Score
        </h3>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
        {/* Animated SVG ring */}
        <div
          className="relative shrink-0"
          role="img"
          aria-label={`Impact score: ${score.total} out of 100, tier: ${score.tier}`}
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            className="-rotate-90"
            aria-hidden="true"
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={STROKE_WIDTH}
            />
            <motion.circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={score.tierColor}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-3xl font-bold tabular-nums font-mono"
              style={{ color: score.tierColor }}
            >
              <AnimatedNumber value={score.total} />
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-widest mt-0.5"
              style={{ color: score.tierColor }}
            >
              {score.tier}
            </span>
          </div>
        </div>

        {/* Platform contribution bars */}
        <div className="flex-1 w-full space-y-2.5" role="list" aria-label="Platform score breakdown">
          {PLATFORM_META.map(({ key, label, max, color }) => {
            const value = score[key];
            const pct = max > 0 ? (value / max) * 100 : 0;
            return (
              <div key={key} role="listitem">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground-secondary">{label}</span>
                  <span className="text-xs font-mono text-foreground-secondary tabular-nums">
                    {value}/{max}
                  </span>
                </div>
                <div className="h-1.5 bg-background-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
