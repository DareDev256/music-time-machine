"use client";

import { TrendingUp } from "lucide-react";
import { BillboardData } from "@/types";
import PlatformCard, { StatRow } from "./PlatformCard";
import { formatDate } from "@/lib/formatDate";

const SHORT_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

interface BillboardCardProps {
  data: BillboardData;
}

export default function BillboardCard({ data }: BillboardCardProps) {

  return (
    <PlatformCard
      title="Billboard Hot 100"
      icon={<TrendingUp className="w-5 h-5" />}
      color="#FBBF24"
    >
      {/* Peak Position Highlight */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl p-4 mb-4 text-center">
        <p className="text-amber-600 dark:text-amber-400 text-xs uppercase tracking-wider mb-1">
          Peak Position
        </p>
        <p className="text-5xl font-bold text-foreground">#{data.peakPosition}</p>
        <p className="text-foreground-secondary text-sm mt-1">{formatDate(data.peakDate, SHORT_DATE)}</p>
      </div>

      <StatRow label="Weeks on Chart" value={data.weeksOnChart} />
      <StatRow
        label="Entry Position"
        value={`#${data.entryPosition}`}
        subValue={formatDate(data.entryDate, SHORT_DATE)}
      />

      {/* Chart History Mini Timeline */}
      {data.chartHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-foreground-secondary uppercase tracking-wider mb-3">
            Chart Movement
          </p>
          <div className="flex items-end gap-1 h-16">
            {data.chartHistory.map((point, index) => {
              const height = ((101 - point.position) / 100) * 100;
              return (
                <div
                  key={index}
                  className="flex-1 bg-amber-400/30 rounded-t relative group cursor-pointer hover:bg-amber-400/50 transition-colors"
                  style={{ height: `${height}%` }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    #{point.position}
                    <br />
                    <span className="text-foreground-secondary">
                      {new Date(point.date).toLocaleDateString("en-US", {
                        month: "short",
                        year: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-foreground-secondary mt-2">
            <span>
              {new Date(data.chartHistory[0]?.date).toLocaleDateString("en-US", {
                month: "short",
                year: "2-digit",
              })}
            </span>
            <span>
              {new Date(
                data.chartHistory[data.chartHistory.length - 1]?.date
              ).toLocaleDateString("en-US", {
                month: "short",
                year: "2-digit",
              })}
            </span>
          </div>
        </div>
      )}
    </PlatformCard>
  );
}
