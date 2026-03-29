"use client";

import { useMemo, useId } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Trophy, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { BillboardData } from "@/types";

// ── Layout constants ────────────────────────────────────────────────────────
const SVG_W = 600;
const SVG_H = 200;
const PAD = { top: 24, right: 20, bottom: 32, left: 36 };
const CHART_W = SVG_W - PAD.left - PAD.right;
const CHART_H = SVG_H - PAD.top - PAD.bottom;

/** Converts chart history into an SVG path + key landmarks. */
function useChartPath(history: BillboardData["chartHistory"]) {
  return useMemo(() => {
    if (history.length < 2) return null;

    const minPos = Math.min(...history.map((h) => h.position));
    const maxPos = Math.max(...history.map((h) => h.position));
    const posRange = Math.max(maxPos - minPos, 1);

    // Map (index, position) → (x, y).  Position 1 = top, higher numbers = bottom.
    const points = history.map((h, i) => ({
      x: PAD.left + (i / (history.length - 1)) * CHART_W,
      // Invert: low position number → high y-value (top of chart)
      y: PAD.top + ((h.position - minPos) / posRange) * CHART_H,
      ...h,
    }));

    // Smooth cubic Bézier — cardinal spline with tension 0.35
    const T = 0.35;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + ((p2.x - p0.x) * T) / 3;
      const cp1y = p1.y + ((p2.y - p0.y) * T) / 3;
      const cp2x = p2.x - ((p3.x - p1.x) * T) / 3;
      const cp2y = p2.y - ((p3.y - p1.y) * T) / 3;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    // Area fill closes the path down to the bottom
    const areaD =
      d +
      ` L ${points[points.length - 1].x} ${PAD.top + CHART_H}` +
      ` L ${points[0].x} ${PAD.top + CHART_H} Z`;

    // Peak point — lowest position number
    const peakIdx = history.reduce(
      (best, h, i) => (h.position < history[best].position ? i : best),
      0
    );

    // Y-axis tick labels (chart positions)
    const ticks = [minPos, Math.round((minPos + maxPos) / 2), maxPos];

    return { d, areaD, points, peakIdx, minPos, maxPos, posRange, ticks };
  }, [history]);
}

/** Formats "2020-04-04" → "Apr '20" */
function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const mon = d.toLocaleString("en-US", { month: "short" });
  const yr = String(d.getFullYear()).slice(2);
  return `${mon} '${yr}`;
}

interface Props {
  billboard: BillboardData;
}

export default function ChartJourney({ billboard }: Props) {
  const chart = useChartPath(billboard.chartHistory);
  const gradId = useId();

  if (!chart || billboard.chartHistory.length < 2) return null;

  const { d, areaD, points, peakIdx, ticks } = chart;
  const peak = billboard.chartHistory[peakIdx];
  const entry = billboard.chartHistory[0];
  const exit = billboard.chartHistory[billboard.chartHistory.length - 1];
  const climbing = exit.position < entry.position;

  // Approximate path length for dash animation
  const pathLen = CHART_W * 1.4;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
      {/* Title row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Chart Journey
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-foreground-secondary">
          <span className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            Peak #{peak.position}
          </span>
          <span>{billboard.weeksOnChart}w on chart</span>
        </div>
      </div>

      {/* SVG chart */}
      <div
        className="w-full overflow-hidden"
        role="img"
        aria-label={`Billboard chart journey: entered at #${entry.position}, peaked at #${peak.position}, ${billboard.weeksOnChart} weeks on chart`}
      >
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis labels — chart positions */}
          {ticks.map((pos) => {
            const y =
              PAD.top +
              ((pos - chart.minPos) / chart.posRange) * CHART_H;
            return (
              <g key={pos}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={PAD.left + CHART_W}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={PAD.left - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-foreground-secondary"
                  fontSize="10"
                  fontFamily="var(--font-mono), monospace"
                >
                  #{pos}
                </text>
              </g>
            );
          })}

          {/* X-axis date labels */}
          {points
            .filter((_, i) => i === 0 || i === points.length - 1 || i === peakIdx)
            .map((p) => (
              <text
                key={p.date}
                x={p.x}
                y={SVG_H - 4}
                textAnchor="middle"
                className="fill-foreground-secondary"
                fontSize="10"
                fontFamily="var(--font-mono), monospace"
              >
                {shortDate(p.date)}
              </text>
            ))}

          {/* Area fill — fades in */}
          <motion.path
            d={areaD}
            fill={`url(#${gradId})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          />

          {/* Animated line */}
          <motion.path
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ strokeDasharray: pathLen, strokeDashoffset: pathLen }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Peak marker */}
          <motion.g
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 1.0, type: "spring", stiffness: 300 }}
            style={{ transformOrigin: `${points[peakIdx].x}px ${points[peakIdx].y}px` }}
          >
            <circle
              cx={points[peakIdx].x}
              cy={points[peakIdx].y}
              r="5"
              fill="var(--accent)"
              stroke="var(--card)"
              strokeWidth="2"
            />
          </motion.g>
        </svg>
      </div>

      {/* Summary stats row */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
        <div className="text-center">
          <p className="text-[11px] text-foreground-secondary uppercase tracking-wide mb-0.5">
            Entry
          </p>
          <p className="text-sm font-semibold text-foreground tabular-nums font-mono">
            #{entry.position}
          </p>
          <p className="text-[10px] text-foreground-secondary">{shortDate(entry.date)}</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] text-amber-400 uppercase tracking-wide mb-0.5">
            Peak
          </p>
          <p className="text-lg font-bold text-foreground tabular-nums font-mono">
            #{peak.position}
          </p>
          <p className="text-[10px] text-foreground-secondary">{shortDate(peak.date)}</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] text-foreground-secondary uppercase tracking-wide mb-0.5">
            Latest
          </p>
          <div className="flex items-center justify-center gap-1">
            <p className="text-sm font-semibold text-foreground tabular-nums font-mono">
              #{exit.position}
            </p>
            {climbing ? (
              <ArrowUpRight className="w-3 h-3 text-emerald-400" />
            ) : (
              <ArrowDownRight className="w-3 h-3 text-foreground-secondary" />
            )}
          </div>
          <p className="text-[10px] text-foreground-secondary">{shortDate(exit.date)}</p>
        </div>
      </div>
    </div>
  );
}
