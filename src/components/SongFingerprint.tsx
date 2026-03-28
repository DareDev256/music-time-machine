"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Fingerprint } from "lucide-react";

interface Props {
  audioFeatures: {
    danceability: number;
    energy: number;
    valence: number;
    tempo: number;
  };
  title: string;
}

/** Deterministic seed from a string (djb2 hash). */
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

/** Lerp between two hex colours. t ∈ [0,1]. */
function lerpColor(a: string, b: string, t: number): string {
  const p = (c: string, i: number) => parseInt(c.slice(i, i + 2), 16);
  const r = Math.round(p(a, 1) + (p(b, 1) - p(a, 1)) * t);
  const g = Math.round(p(a, 3) + (p(b, 3) - p(a, 3)) * t);
  const bl = Math.round(p(a, 5) + (p(b, 5) - p(a, 5)) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

// Colour poles: moody (low valence) → warm (high valence)
const COOL = "#6366F1"; // indigo
const WARM = "#F97316"; // orange
const MID  = "#EC4899"; // pink

const SIZE = 200;
const CX = SIZE / 2;
const CY = SIZE / 2;

export default function SongFingerprint({ audioFeatures, title }: Props) {
  const { danceability, energy, valence, tempo } = audioFeatures;

  const { outerPath, innerPath, dots, primaryColor, secondaryColor } = useMemo(() => {
    const seed = hashStr(title);
    // Colour derived from valence (emotional warmth)
    const primary = valence < 0.5
      ? lerpColor(COOL, MID, valence * 2)
      : lerpColor(MID, WARM, (valence - 0.5) * 2);
    const secondary = lerpColor(primary, COOL, 0.45);

    // Outer ring: energy-driven waveform
    const segments = Math.round(24 + danceability * 40); // 24–64 segments
    const baseR = 70;
    const ampMax = 12 + energy * 18; // 12–30px amplitude

    const outerPts: string[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
      // Pseudo-random per-segment variation seeded from title
      const noise = ((seed * (i + 1) * 2654435761) >>> 0) / 4294967296;
      const amp = ampMax * (0.4 + noise * 0.6) * (0.7 + energy * 0.3);
      const r = baseR + amp;
      outerPts.push(`${CX + r * Math.cos(angle)},${CY + r * Math.sin(angle)}`);
    }

    // Inner ring: tempo-driven pattern
    const innerSegments = Math.round(12 + (tempo / 200) * 20); // 12–32
    const innerR = 32;
    const innerAmp = 6 + energy * 8;
    const innerPts: string[] = [];
    for (let i = 0; i < innerSegments; i++) {
      const angle = (i / innerSegments) * Math.PI * 2 - Math.PI / 2;
      const noise = ((seed * (i + 7) * 2246822519) >>> 0) / 4294967296;
      const r = innerR + innerAmp * (0.3 + noise * 0.7);
      innerPts.push(`${CX + r * Math.cos(angle)},${CY + r * Math.sin(angle)}`);
    }

    // Accent dots: danceability determines count + spread
    const dotCount = Math.round(3 + danceability * 6); // 3–9 dots
    const dotPts = Array.from({ length: dotCount }, (_, i) => {
      const angle = (i / dotCount) * Math.PI * 2 - Math.PI / 2;
      const noise = ((seed * (i + 13) * 3266489917) >>> 0) / 4294967296;
      const r = 50 + noise * 34;
      return {
        cx: CX + r * Math.cos(angle),
        cy: CY + r * Math.sin(angle),
        r: 1.5 + noise * 2,
      };
    });

    return {
      outerPath: `M${outerPts.join("L")}Z`,
      innerPath: `M${innerPts.join("L")}Z`,
      dots: dotPts,
      primaryColor: primary,
      secondaryColor: secondary,
    };
  }, [danceability, energy, valence, tempo, title]);

  const moodLabel = valence >= 0.7 ? "Euphoric" : valence >= 0.5 ? "Uplifting"
    : valence >= 0.3 ? "Reflective" : "Melancholic";

  const energyLabel = energy >= 0.7 ? "High-octane" : energy >= 0.4 ? "Moderate" : "Ambient";

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Fingerprint className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Song Fingerprint
        </h3>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
        {/* SVG Fingerprint */}
        <div
          className="relative shrink-0"
          role="img"
          aria-label={`Unique audio fingerprint for ${title}. Mood: ${moodLabel}, energy: ${energyLabel}`}
        >
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="fp-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={primaryColor} stopOpacity={0.15} />
                <stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
              </radialGradient>
            </defs>

            {/* Background glow */}
            <circle cx={CX} cy={CY} r={92} fill="url(#fp-glow)" />

            {/* Outer waveform ring */}
            <motion.path
              d={outerPath}
              fill="none"
              stroke={primaryColor}
              strokeWidth={1.5}
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.8 }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Inner tempo ring */}
            <motion.path
              d={innerPath}
              fill={secondaryColor}
              fillOpacity={0.08}
              stroke={secondaryColor}
              strokeWidth={1}
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Accent dots */}
            {dots.map((d, i) => (
              <motion.circle
                key={i}
                cx={d.cx}
                cy={d.cy}
                r={d.r}
                fill={primaryColor}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 0.5, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.8 + i * 0.06 }}
              />
            ))}

            {/* Centre pulse */}
            <motion.circle
              cx={CX}
              cy={CY}
              r={4}
              fill={primaryColor}
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            />
          </svg>
        </div>

        {/* Feature legend */}
        <div className="flex-1 w-full space-y-3" role="list" aria-label="Audio feature breakdown">
          {[
            { label: "Mood", value: moodLabel, raw: valence, color: primaryColor },
            { label: "Energy", value: energyLabel, raw: energy, color: "#FC3C44" },
            { label: "Danceability", value: `${Math.round(danceability * 100)}%`, raw: danceability, color: "#34D399" },
            { label: "Tempo", value: `${Math.round(audioFeatures.tempo)} BPM`, raw: Math.min(tempo / 200, 1), color: "#A78BFA" },
          ].map(({ label, value, raw, color }) => (
            <div key={label} role="listitem">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-foreground-secondary">{label}</span>
                <span className="text-xs font-mono text-foreground tabular-nums">{value}</span>
              </div>
              <div className="h-1 bg-background-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${raw * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-foreground-secondary mt-4 text-center sm:text-left">
        Each song&apos;s fingerprint is unique — shaped by its danceability, energy, mood, and tempo.
      </p>
    </div>
  );
}
