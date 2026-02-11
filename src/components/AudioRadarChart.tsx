"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface AudioRadarChartProps {
  audioFeatures: {
    danceability: number;
    energy: number;
    valence: number;
    tempo: number;
  };
}

interface RadarDataPoint {
  feature: string;
  value: number;
  fullMark: 100;
}

interface TooltipPayloadItem {
  value: number;
  payload: RadarDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

const FEATURE_LABELS: Record<string, { label: string; description: string }> = {
  Danceability: { label: "Danceability", description: "How suitable for dancing" },
  Energy: { label: "Energy", description: "Intensity and activity" },
  Happiness: { label: "Happiness", description: "Musical positiveness (valence)" },
  Tempo: { label: "Tempo", description: "Relative speed of the beat" },
};

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const point = payload[0];
  const meta = FEATURE_LABELS[point.payload.feature];

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-foreground font-medium text-sm">{meta?.label ?? point.payload.feature}</p>
      <p className="text-foreground-secondary text-xs">{meta?.description}</p>
      <p className="text-accent font-semibold text-sm mt-1">{point.value}%</p>
    </div>
  );
};

export default function AudioRadarChart({ audioFeatures }: AudioRadarChartProps) {
  // Normalize tempo to 0–100 scale (typical BPM range: 60–200)
  const normalizedTempo = Math.min(100, Math.max(0, Math.round(((audioFeatures.tempo - 60) / 140) * 100)));

  const data: RadarDataPoint[] = [
    { feature: "Danceability", value: Math.round(audioFeatures.danceability * 100), fullMark: 100 },
    { feature: "Energy", value: Math.round(audioFeatures.energy * 100), fullMark: 100 },
    { feature: "Happiness", value: Math.round(audioFeatures.valence * 100), fullMark: 100 },
    { feature: "Tempo", value: normalizedTempo, fullMark: 100 },
  ];

  // Determine the "vibe" based on dominant feature
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const vibe = getVibe(sorted[0].feature, sorted[0].value);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Audio DNA
        </h3>
        <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent font-medium">
          {vibe}
        </span>
      </div>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="var(--color-border)" />
            <PolarAngleAxis
              dataKey="feature"
              tick={{ fill: "var(--color-foreground-secondary)", fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="Audio Features"
              dataKey="value"
              stroke="#FC3C44"
              fill="#FC3C44"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {/* Mini legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
        {data.map((d) => (
          <div key={d.feature} className="flex items-center justify-between text-xs">
            <span className="text-foreground-secondary">{d.feature}</span>
            <span className="text-foreground font-medium">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getVibe(dominantFeature: string, value: number): string {
  if (value < 30) return "Mellow";
  switch (dominantFeature) {
    case "Danceability": return "Groovy";
    case "Energy": return "High Energy";
    case "Happiness": return "Feel-Good";
    case "Tempo": return "Fast-Paced";
    default: return "Balanced";
  }
}
