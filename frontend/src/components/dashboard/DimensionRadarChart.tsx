import { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "../../hooks/useTheme";
import { ODS_DIMENSIONS } from "@/lib/odsDimensions";
import type { OdsSummary } from "../../types/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RadarDataPoint {
  dimension: string;
  description: string;
  score: number;
  meta: number;
  fullMark: number;
}

function buildRadarData(ods: OdsSummary[]): RadarDataPoint[] {
  return ODS_DIMENSIONS.map((dim) => {
    const members = dim.odsNumbers
      .map((n) => ods.find((o) => o.odsNumber === n))
      .filter((o): o is OdsSummary => o !== undefined && o.score !== null);

    const avg =
      members.length > 0
        ? Math.round(members.reduce((acc, o) => acc + (o.score ?? 0), 0) / members.length)
        : 0;

    return {
      dimension: dim.name,
      description: dim.description,
      score: avg,
      meta: 70,
      fullMark: 100,
    };
  });
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

// Recharts does not export precise generic types for custom tooltips
interface TooltipPayloadItem {
  payload: RadarDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function DimensionTooltipContent({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;
  const { dimension, description, score } = payload[0].payload;
  return (
    <div className="bg-card px-3 py-2 rounded-xl shadow-popover border-0 text-xs">
      <p className="font-semibold text-foreground">
        {dimension}
        <span className="font-normal text-muted-foreground ml-1">— {description}</span>
      </p>
      <p className="text-muted-foreground mt-0.5">
        Score médio: <span className="font-bold text-foreground">{score}/100</span>
      </p>
      {score >= 70 ? (
        <p className="text-success mt-0.5">Acima da meta (≥ 70)</p>
      ) : (
        <p className="text-warning mt-0.5">Abaixo da meta (70)</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface DimensionRadarChartProps {
  ods: OdsSummary[];
  isLoading: boolean;
}

export function DimensionRadarChart({ ods, isLoading }: DimensionRadarChartProps) {
  const { resolvedTheme } = useTheme();

  // Theme-aware colors for Recharts (which doesn't support CSS vars natively)
  const chartColors = useMemo(() => {
    const isDark = resolvedTheme === "dark";
    return {
      grid: isDark ? "hsl(215, 28%, 25%)" : "hsl(220, 13%, 91%)",
      tick: isDark ? "hsl(218, 11%, 65%)" : "hsl(220, 9%, 46%)",
      meta: isDark ? "hsl(215, 20%, 45%)" : "hsl(220, 9%, 64%)",
      primary: isDark ? "hsl(217, 91%, 60%)" : "hsl(221, 83%, 53%)",
    };
  }, [resolvedTheme]);

  if (isLoading) {
    return <DimensionRadarChartSkeleton />;
  }

  const data = buildRadarData(ods);

  // All scores are 0 only when no ODS has data — treat as empty state
  const hasAnyData = data.some((d) => d.score > 0);

  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-foreground">Visão por Dimensão</CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Score médio dos ODS em cada dimensão ESG
        </p>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0">
        {!hasAnyData ? (
          <div className="flex items-center justify-center h-[250px]">
            <p className="text-sm text-muted-foreground/60 italic">
              Nenhum dado disponível para exibir o gráfico.
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={data} outerRadius={85}>
                <PolarGrid stroke={chartColors.grid} />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fontSize: 11, fill: chartColors.tick }}
                />
                <Tooltip content={<DimensionTooltipContent />} />

                {/* Reference line at meta = 70 */}
                <Radar
                  name="Meta"
                  dataKey="meta"
                  stroke={chartColors.meta}
                  strokeDasharray="4 4"
                  fill="none"
                  strokeWidth={1}
                />

                {/* Municipality score */}
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke={chartColors.primary}
                  fill={chartColors.primary}
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center gap-4 justify-center mt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-primary" />
                <span className="text-[10px] text-muted-foreground">Score atual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0 border-t border-dashed border-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Meta (70)</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function DimensionRadarChartSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-1 pt-4 px-4">
        <div className="h-4 w-32 rounded bg-muted mb-1" />
        <div className="h-3 w-48 rounded bg-muted" />
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="h-[250px] w-full rounded-lg bg-muted" />
      </CardContent>
    </Card>
  );
}
