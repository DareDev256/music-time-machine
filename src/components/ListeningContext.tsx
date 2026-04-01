"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Headphones } from "lucide-react";

interface AudioFeatures {
  danceability: number;
  energy: number;
  valence: number;
  tempo: number;
}

interface ContextTag {
  label: string;
  icon: string;
  category: string;
}

/** Map audio features to a time-of-day recommendation. */
function pickTimeOfDay(f: AudioFeatures): ContextTag {
  const { energy, valence } = f;
  if (energy < 0.35 && valence < 0.4)
    return { label: "Late Night", icon: "🌙", category: "Time" };
  if (energy < 0.5 && valence >= 0.4)
    return { label: "Golden Hour", icon: "🌅", category: "Time" };
  if (energy >= 0.7)
    return { label: "Midday Peak", icon: "☀️", category: "Time" };
  return { label: "Early Morning", icon: "🌤", category: "Time" };
}

/** Map audio features to an activity recommendation. */
function pickActivity(f: AudioFeatures): ContextTag {
  const { danceability, energy, valence, tempo } = f;
  if (energy >= 0.75 && tempo >= 120)
    return { label: "Workout", icon: "🏋️", category: "Activity" };
  if (danceability >= 0.7 && energy >= 0.6)
    return { label: "Dance Floor", icon: "🪩", category: "Activity" };
  if (energy >= 0.5 && valence >= 0.5 && tempo >= 100)
    return { label: "Road Trip", icon: "🚗", category: "Activity" };
  if (energy < 0.4 && valence < 0.45)
    return { label: "Reflection", icon: "📝", category: "Activity" };
  if (energy < 0.5 && danceability < 0.5)
    return { label: "Deep Focus", icon: "🎯", category: "Activity" };
  return { label: "Chill Session", icon: "☁️", category: "Activity" };
}

/** Map audio features to a setting recommendation. */
function pickSetting(f: AudioFeatures): ContextTag {
  const { energy, valence, danceability } = f;
  if (energy >= 0.75 && danceability >= 0.7)
    return { label: "Festival Crowd", icon: "🎪", category: "Setting" };
  if (energy >= 0.55 && valence >= 0.55)
    return { label: "House Party", icon: "🏠", category: "Setting" };
  if (energy < 0.4 && valence < 0.4)
    return { label: "Solo Headphones", icon: "🎧", category: "Setting" };
  if (valence >= 0.5 && energy < 0.55)
    return { label: "Coffee Shop", icon: "☕", category: "Setting" };
  return { label: "Sunset Balcony", icon: "🌇", category: "Setting" };
}

/** Map audio features to a season/weather recommendation. */
function pickSeason(f: AudioFeatures): ContextTag {
  const { energy, valence } = f;
  if (valence >= 0.65 && energy >= 0.6)
    return { label: "Summer Heat", icon: "🔥", category: "Season" };
  if (valence >= 0.5 && energy < 0.6)
    return { label: "Spring Bloom", icon: "🌸", category: "Season" };
  if (valence < 0.4 && energy >= 0.5)
    return { label: "Autumn Storm", icon: "🍂", category: "Season" };
  if (valence < 0.4 && energy < 0.5)
    return { label: "Winter Night", icon: "❄️", category: "Season" };
  return { label: "Rainy Day", icon: "🌧", category: "Season" };
}

/** Build a one-line vibe sentence from the tags. */
function buildVibeLine(tags: ContextTag[]): string {
  const time = tags.find((t) => t.category === "Time")!;
  const activity = tags.find((t) => t.category === "Activity")!;
  const setting = tags.find((t) => t.category === "Setting")!;
  return `Best for ${activity.label.toLowerCase()} during ${time.label.toLowerCase()}, ${setting.label.toLowerCase()}.`;
}

const TAG_EASE = [0.16, 1, 0.3, 1] as const;

export default function ListeningContext({
  audioFeatures,
}: {
  audioFeatures: AudioFeatures;
}) {
  const { tags, vibeLine } = useMemo(() => {
    const t = [
      pickTimeOfDay(audioFeatures),
      pickActivity(audioFeatures),
      pickSetting(audioFeatures),
      pickSeason(audioFeatures),
    ];
    return { tags: t, vibeLine: buildVibeLine(t) };
  }, [audioFeatures]);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Headphones className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          When to Listen
        </h3>
      </div>

      {/* Vibe sentence */}
      <motion.p
        className="text-foreground-secondary text-sm mb-5 leading-relaxed"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        aria-live="polite"
      >
        {vibeLine}
      </motion.p>

      {/* Context tags grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
        role="list"
        aria-label="Recommended listening context"
      >
        {tags.map((tag, i) => (
          <motion.div
            key={tag.category}
            role="listitem"
            className="group relative flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background-secondary/50 px-3 py-3 transition-colors hover:border-accent/30 hover:bg-background-secondary"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.35,
              delay: 0.15 + i * 0.08,
              ease: TAG_EASE,
            }}
          >
            <span
              className="text-xl leading-none select-none"
              aria-hidden="true"
            >
              {tag.icon}
            </span>
            <span className="text-xs font-medium text-foreground text-center leading-tight">
              {tag.label}
            </span>
            <span className="text-[10px] text-foreground-secondary uppercase tracking-wider">
              {tag.category}
            </span>
          </motion.div>
        ))}
      </div>

      <p className="text-[11px] text-foreground-secondary mt-4 text-center sm:text-left">
        Context derived from danceability, energy, mood, and tempo analysis.
      </p>
    </div>
  );
}
