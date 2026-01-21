"use client";

import { ReactNode } from "react";
import { ExternalLink } from "lucide-react";

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
    <div className="bg-gray-900/50 border border-gray-700 rounded-2xl p-6 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <span style={{ color }}>{icon}</span>
          </div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">{children}</div>
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
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="text-right">
        <span className="text-white font-medium">{value}</span>
        {subValue && (
          <span className="text-gray-500 text-xs block">{subValue}</span>
        )}
      </div>
    </div>
  );
}
