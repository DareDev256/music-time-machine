"use client";

import { FileText, ExternalLink } from "lucide-react";
import { GeniusData } from "@/types";
import PlatformCard, { StatRow } from "./PlatformCard";
import { safeHref } from "@/lib/safeHref";

interface GeniusCardProps {
  data: GeniusData;
}

// Simple Genius icon
const GeniusIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.804 0c-1.156 0-2.235.55-2.914 1.51L0 15.017l3.473 4.215 6.73-8.17c.65-.79 1.672-1.241 2.738-1.241h.003c1.064 0 2.084.451 2.733 1.24l6.85 8.318L24 14.87 14.28 1.51C13.6.55 12.52 0 11.363 0z" />
  </svg>
);

export default function GeniusCard({ data }: GeniusCardProps) {
  return (
    <PlatformCard
      title="Genius"
      icon={<GeniusIcon />}
      color="#FFDB33"
      externalUrl={data.lyricsUrl}
    >
      {/* Song Description */}
      <div className="bg-background-secondary rounded-xl p-4 mb-4">
        <p className="text-foreground-secondary text-sm leading-relaxed">
          {data.description}
        </p>
      </div>

      <StatRow
        label="Page Views"
        value={data.pageViews}
      />
      <StatRow
        label="Annotations"
        value={data.annotationCount}
      />

      {/* View Lyrics Button */}
      <a
        href={safeHref(data.lyricsUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center gap-2 w-full bg-amber-100 dark:bg-amber-900/20 hover:bg-amber-200 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 py-3 rounded-xl transition-colors"
      >
        <FileText className="w-4 h-4" />
        <span className="font-medium">View Full Lyrics</span>
        <ExternalLink className="w-4 h-4" />
      </a>
    </PlatformCard>
  );
}
