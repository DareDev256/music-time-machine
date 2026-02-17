"use client";

import { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { safeHref } from "@/lib/safeHref";

interface PlatformCardProps {
  title: string;
  icon: ReactNode;
  color: string;
  children: ReactNode;
  externalUrl?: string;
}

export default function PlatformCard({
  title,
  icon,
  color,
  children,
  externalUrl,
}: PlatformCardProps) {
  return (
    <div
      className="bg-card border border-border rounded-2xl p-4 sm:p-6 hover:border-border transition-colors"
      style={{ borderTopWidth: "2px", borderTopColor: color }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <span style={{ color }}>{icon}</span>
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>
        </div>
        {externalUrl && safeHref(externalUrl) !== "#" && (
          <a
            href={safeHref(externalUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground-secondary hover:text-foreground active:scale-95 transition-all p-1"
          >
            <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
          </a>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2 sm:space-y-3">{children}</div>
    </div>
  );
}

// Stat row component
interface StatRowProps {
  label: string;
  value: string | number;
  subValue?: string;
}

export function StatRow({ label, value, subValue }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-border last:border-0">
      <span className="text-foreground-secondary text-xs sm:text-sm">{label}</span>
      <div className="text-right">
        <span className="text-foreground font-medium text-sm sm:text-base">{value}</span>
        {subValue && (
          <span className="text-foreground-secondary text-[10px] sm:text-xs block">{subValue}</span>
        )}
      </div>
    </div>
  );
}
