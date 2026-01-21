"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TimelineDataPoint } from "@/types";

interface TimelineChartProps {
  data: TimelineDataPoint[];
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  };

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-4 shadow-xl">
      <p className="text-white font-medium mb-2">{formatDate(label || "")}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-400">{entry.name}:</span>
          <span className="text-white font-medium">
            {entry.dataKey === "billboard"
              ? `#${101 - entry.value}`
              : `${entry.value}%`}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function TimelineChart({ data }: TimelineChartProps) {
  const formatXAxis = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "2-digit",
      month: "short",
    });
  };

  // Only show every nth label to prevent crowding
  const tickInterval = Math.ceil(data.length / 8);

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-2xl p-6">
      <h2 className="text-xl font-semibold text-white mb-6">
        Performance Timeline
      </h2>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              stroke="#6B7280"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              interval={tickInterval}
            />
            <YAxis
              stroke="#6B7280"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              formatter={(value) => (
                <span className="text-gray-300 text-sm">{value}</span>
              )}
            />
            <Line
              type="monotone"
              dataKey="spotify"
              name="Spotify Popularity"
              stroke="#1DB954"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: "#1DB954" }}
            />
            <Line
              type="monotone"
              dataKey="youtube"
              name="YouTube Engagement"
              stroke="#FF0000"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: "#FF0000" }}
            />
            <Line
              type="monotone"
              dataKey="billboard"
              name="Billboard Position"
              stroke="#FBBF24"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: "#FBBF24" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-gray-500 text-xs mt-4 text-center">
        * Billboard position shown as inverted scale (higher = better chart position)
      </p>
    </div>
  );
}
