/**
 * Circular progress badge showing a match score percentage.
 *
 * Extracted from SimilarSongs to be reusable wherever match
 * scores need a compact visual indicator (song cards, search
 * results, playlist previews, etc.).
 */

import { matchTextColor, circleArcOffset } from "@/lib/score-colors";

const RADIUS = 16;
const CIRCUMFERENCE = `${2 * Math.PI * RADIUS}`;

interface MatchScoreBadgeProps {
  score: number;
  /** Extra Tailwind classes on the outer wrapper. */
  className?: string;
}

export default function MatchScoreBadge({ score, className = "" }: MatchScoreBadgeProps) {
  const color = matchTextColor(score);

  return (
    <div
      className={`w-10 h-10 flex items-center justify-center isolate ${className}`}
      title={`${score}% match`}
      aria-label={`${score}% match`}
      role="img"
    >
      <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90" aria-hidden="true">
        <circle
          cx="20" cy="20" r={RADIUS}
          fill="none" stroke="currentColor" strokeWidth="2.5"
          className="text-border/50"
        />
        <circle
          cx="20" cy="20" r={RADIUS}
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={circleArcOffset(score)}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${color}`}
        aria-hidden="true"
      >
        {score}%
      </span>
      <div className="absolute inset-0 -z-10 rounded-full bg-card border border-border" />
    </div>
  );
}
