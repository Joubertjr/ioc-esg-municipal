import { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useTheme } from "../../hooks/useTheme";
import { ODS_DIMENSIONS } from "../../lib/odsDimensions";

export interface ComparisonRadarProps {
  comparison: Array<{
    odsNumber: number;
    municipalityScore: number | null;
    benchmarkAverage: number | null;
    delta: number | null;
    aboveAverage: boolean | null;
  }>;
  municipalityName: string;
}

interface RadarDataPoint {
  dimension: string;
  description: string;
  municipalityScore: number;
  benchmarkAverage: number;
  municipalityScoreRaw: number | null;
  benchmarkAverageRaw: number | null;
  fullMark: number;
}

// Recharts does not export precise types for custom tooltip payload entries.
interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  payload: RadarDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

function ComparisonTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;

  const point = payload[0].payload;
  const delta =
    point.municipalityScoreRaw !== null && point.benchmarkAverageRaw !== null
      ? Math.round((point.municipalityScoreRaw - point.benchmarkAverageRaw) * 10) / 10
      : null;

  return (
    <div className="bg-card px-3 py-2 rounded-xl shadow-popover border-0 text-xs min-w-[180px]">
      <p className="font-semibold text-foreground mb-1.5">
        {point.dimension}
        <span className="font-normal text-muted-foreground ml-1">— {point.description}</span>
      </p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-primary">Município</span>
          <span className="font-bold text-foreground">
            {point.municipalityScoreRaw !== null
              ? `${point.municipalityScoreRaw.toFixed(1)}/100`
              : "sem dados"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Média do grupo</span>
          <span className="font-bold text-foreground">
            {point.benchmarkAverageRaw !== null
              ? `${point.benchmarkAverageRaw.toFixed(1)}/100`
              : "sem dados"}
          </span>
        </div>
      </div>
      {delta !== null && (
        <div className="mt-1.5 pt-1.5 border-t border-border">
          <span
            className={
              delta > 0
                ? "text-success font-semibold"
                : delta < 0
                  ? "text-danger font-semibold"
                  : "text-muted-foreground/60"
            }
          >
            {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} pts vs. média
          </span>
        </div>
      )}
    </div>
  );
}

function buildComparisonRadarData(
  comparison: ComparisonRadarProps["comparison"],
): RadarDataPoint[] {
  return ODS_DIMENSIONS.map((dim) => {
    const members = dim.odsNumbers
      .map((n) => comparison.find((c) => c.odsNumber === n))
      .filter((c): c is ComparisonRadarProps["comparison"][number] => c !== undefined);

    const municipalityMembers = members.filter((m) => m.municipalityScore !== null);
    const benchmarkMembers = members.filter((m) => m.benchmarkAverage !== null);

    const municipalityAvg =
      municipalityMembers.length > 0
        ? Math.round(
            municipalityMembers.reduce((acc, m) => acc + (m.municipalityScore ?? 0), 0) /
              municipalityMembers.length,
          )
        : null;

    const benchmarkAvg =
      benchmarkMembers.length > 0
        ? Math.round(
            benchmarkMembers.reduce((acc, m) => acc + (m.benchmarkAverage ?? 0), 0) /
              benchmarkMembers.length,
          )
        : null;

    return {
      dimension: dim.name,
      description: dim.description,
      municipalityScore: municipalityAvg ?? 0,
      benchmarkAverage: benchmarkAvg ?? 0,
      municipalityScoreRaw: municipalityAvg,
      benchmarkAverageRaw: benchmarkAvg,
      fullMark: 100,
    };
  });
}

export function ComparisonRadar({ comparison, municipalityName }: ComparisonRadarProps) {
  const { resolvedTheme } = useTheme();

  const colors = useMemo(() => {
    const isDark = resolvedTheme === "dark";
    return {
      grid: isDark ? "hsl(215, 28%, 25%)" : "#e5e7eb",
      axis: isDark ? "hsl(218, 11%, 65%)" : "#6b7280",
      radius: isDark ? "#6b7280" : "#9ca3af",
      municipalityStroke: isDark ? "#60a5fa" : "#2563eb",
      municipalityFill: isDark ? "#3b82f6" : "#3b82f6",
      benchmarkStroke: isDark ? "#9ca3af" : "#6b7280",
      benchmarkFill: isDark ? "#6b7280" : "#9ca3af",
    };
  }, [resolvedTheme]);

  const validItems = comparison.filter(
    (item) => item.municipalityScore !== null || item.benchmarkAverage !== null,
  );

  if (validItems.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-card p-4 flex items-center justify-center h-80">
        <p className="text-sm text-muted-foreground/60 italic text-center">
          Selecione municípios para comparar
        </p>
      </div>
    );
  }

  const data = buildComparisonRadarData(comparison);
  const hasAnyData = data.some((d) => d.municipalityScore > 0 || d.benchmarkAverage > 0);

  if (!hasAnyData) {
    return (
      <div className="bg-card rounded-xl shadow-card p-4 flex items-center justify-center h-80">
        <p className="text-sm text-muted-foreground/60 italic text-center">
          Nenhum dado disponível para exibir o gráfico.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">Radar Comparativo por Dimensão</h3>
      <p className="text-xs text-muted-foreground mb-3">{municipalityName} vs. média do grupo</p>

      <ResponsiveContainer width="100%" height={340}>
        <RadarChart data={data} outerRadius={110}>
          <PolarGrid stroke={colors.grid} />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: colors.axis }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: colors.radius }}
            tickCount={5}
          />
          <Tooltip content={<ComparisonTooltip />} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />

          {/* Série 2: Média do grupo — cinza tracejado, atrás */}
          <Radar
            name="Média do grupo"
            dataKey="benchmarkAverage"
            stroke={colors.benchmarkStroke}
            fill={colors.benchmarkFill}
            fillOpacity={0.15}
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />

          {/* Série 1: Município alvo — azul, destaque */}
          <Radar
            name="Seu município"
            dataKey="municipalityScore"
            stroke={colors.municipalityStroke}
            fill={colors.municipalityFill}
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-muted-foreground/60 text-center mt-1">
        Cada dimensão agrupa a média dos ODS correspondentes (Social, Econômico, Ambiental,
        Institucional, Parcerias).
      </p>
    </div>
  );
}
