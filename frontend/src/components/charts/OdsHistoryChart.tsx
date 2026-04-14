import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from "recharts";
import { useOdsHistory } from "../../hooks/useOdsHistory";
import { useTheme } from "../../hooks/useTheme";
import type { TooltipProps } from "recharts";

interface OdsHistoryChartProps {
  ibgeCode: string;
}

interface YearDataPoint {
  year: number;
  score: number;
  coverage: number;
}

function scoreToStatus(score: number): string {
  if (score >= 70) return "verde";
  if (score >= 40) return "amarelo";
  return "vermelho";
}

interface CustomTooltipPayload {
  year: number;
  score: number;
  coverage: number;
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload as CustomTooltipPayload | undefined;
  if (!data) return null;

  const { year, score, coverage } = data;
  const status = scoreToStatus(score);
  const statusColors: Record<string, string> = {
    verde: "text-success",
    amarelo: "text-warning",
    vermelho: "text-danger",
  };

  return (
    <div className="bg-card border-0 rounded-xl shadow-popover px-3 py-2 text-sm">
      <p className="font-semibold text-foreground">Ano: {year}</p>
      <p className="text-foreground">
        Score: <span className="font-bold tabular-nums">{score.toFixed(1)}</span>
        /100
      </p>
      <p className="text-foreground">
        Cobertura: <span className="font-bold tabular-nums">{coverage}</span>/17 ODS
      </p>
      <p>
        Status:{" "}
        <span
          className={`font-medium capitalize ${statusColors[status] ?? "text-muted-foreground"}`}
        >
          {status}
        </span>
      </p>
    </div>
  );
}

export function OdsHistoryChart({ ibgeCode }: OdsHistoryChartProps) {
  const { data, isLoading } = useOdsHistory(ibgeCode, 0);
  const { resolvedTheme } = useTheme();

  const colors = useMemo(() => {
    const isDark = resolvedTheme === "dark";
    return {
      grid: isDark ? "hsl(215, 28%, 25%)" : "#f0f0f0",
      tick: isDark ? "hsl(218, 11%, 65%)" : "#6b7280",
      redBand: isDark ? "hsla(0, 60%, 30%, 0.15)" : "#fef2f2",
      yellowBand: isDark ? "hsla(40, 60%, 30%, 0.15)" : "#fffbeb",
      greenBand: isDark ? "hsla(140, 60%, 25%, 0.15)" : "#f0fdf4",
      bandOpacity: isDark ? 0.8 : 0.5,
      line: isDark ? "#60a5fa" : "#2563eb",
      refGreen: isDark ? "#4ade80" : "#22c55e",
      refRed: isDark ? "#f87171" : "#ef4444",
      refLabel: isDark ? "#4ade80" : "#16a34a",
    };
  }, [resolvedTheme]);

  if (isLoading) {
    return (
      <div>
        <h3 className="text-base font-semibold text-foreground mb-4">
          Histórico do score calculado
        </h3>
        <div className="animate-pulse h-[300px] bg-muted rounded-lg" />
      </div>
    );
  }

  const trend = data?.trend;
  const isComparable = trend?.enabled === true;

  // odsNumber=0 = pre-computed global score, one per referenceYear — no averaging needed
  const chartData: YearDataPoint[] = (data?.history ?? [])
    .filter((r) => r.score !== null)
    .map((r) => ({
      year: r.referenceYear,
      score: r.score as number,
      coverage: r.indicatorCount,
    }))
    .sort((a, b) => a.year - b.year);

  // State 3: single point or no data
  if (chartData.length < 2) {
    return (
      <div>
        <h3 className="text-base font-semibold text-foreground mb-4">
          Histórico do score calculado
        </h3>
        <div className="flex items-center justify-center h-[300px] text-muted-foreground/60 text-sm">
          Ainda não há série histórica suficiente para indicar tendência
        </div>
      </div>
    );
  }

  // Title depends on comparability
  const title = isComparable ? "Evolução do Score ESG" : "Histórico do score calculado";

  return (
    <div>
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>

      {/* State 2: not comparable — show warning */}
      {!isComparable && trend && (
        <div className="mb-3 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg">
          <p className="text-xs text-warning font-medium">Série não comparável entre anos</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {trend.reason === "coverage_mismatch" || trend.reason === "insufficient_coverage"
              ? `A cobertura de dados mudou de ${trend.previousCoverage ?? "?"}/17 para ${trend.currentCoverage ?? "?"}/17 ODS neste período. A variação entre os anos reflete também mudança na cobertura dos dados, não representa isoladamente melhora ou piora real.`
              : "Dados insuficientes para comparação válida entre os anos."}
          </p>
        </div>
      )}

      {/* State 1: comparable — show tooltip hint */}
      {isComparable && (
        <p className="text-[10px] text-muted-foreground/60 mb-2">
          Comparação válida: cobertura e metodologia compatíveis
        </p>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} fill="transparent" />

          {/* Colored bands: red <40, yellow 40-70, green 70-100 */}
          <ReferenceArea y1={0} y2={40} fill={colors.redBand} fillOpacity={colors.bandOpacity} />
          <ReferenceArea
            y1={40}
            y2={70}
            fill={colors.yellowBand}
            fillOpacity={colors.bandOpacity}
          />
          <ReferenceArea
            y1={70}
            y2={100}
            fill={colors.greenBand}
            fillOpacity={colors.bandOpacity}
          />

          <XAxis dataKey="year" tick={{ fontSize: 12, fill: colors.tick }} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: colors.tick }}
            tickLine={false}
            axisLine={false}
            width={36}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />

          {/* Reference lines for thresholds */}
          <ReferenceLine
            y={70}
            stroke={colors.refGreen}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: "Meta",
              position: "insideTopRight",
              fontSize: 11,
              fill: colors.refLabel,
            }}
          />
          <ReferenceLine y={40} stroke={colors.refRed} strokeDasharray="4 3" strokeWidth={1.5} />

          <Line
            type="monotone"
            dataKey="score"
            name="Score Global"
            stroke={colors.line}
            strokeWidth={2}
            dot={{ r: 4, fill: colors.line, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Coverage annotation per year */}
      <div className="flex justify-center gap-4 mt-2">
        {chartData.map((d) => (
          <span key={d.year} className="text-[10px] text-muted-foreground tabular-nums">
            {d.year}: {d.coverage}/17 ODS
          </span>
        ))}
      </div>
    </div>
  );
}
