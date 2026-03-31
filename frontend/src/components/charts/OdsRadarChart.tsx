import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { OdsSummary } from "../../types/api";

interface OdsRadarChartProps {
  ods: OdsSummary[];
  isLoading: boolean;
}

export function OdsRadarChart({ ods, isLoading }: OdsRadarChartProps) {
  if (isLoading) {
    return <div className="h-80 w-full rounded-lg bg-gray-200 animate-pulse" />;
  }

  const data = ods.map((o) => ({
    subject: o.shortName,
    score: o.score ?? 0,
    fullMark: 100,
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-600 mb-2">
        Radar dos 17 ODS
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} outerRadius={110}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 10, fill: "#6b7280" }}
          />
          <Radar
            dataKey="score"
            stroke="#2563eb"
            fill="#2563eb"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
