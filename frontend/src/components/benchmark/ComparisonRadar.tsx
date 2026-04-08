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
import { ODS_DEFINITIONS } from "../../../../shared/constants/ods";

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
  subject: string;
  odsName: string;
  municipalityScore: number;
  benchmarkAverage: number;
  municipalityScoreRaw: number | null;
  benchmarkAverageRaw: number | null;
  delta: number | null;
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
  const delta = point.delta;

  return (
    <div className="bg-card px-3 py-2 rounded-lg shadow-lg border border-border text-xs min-w-[180px]">
      <p className="font-semibold text-foreground mb-1.5">{point.odsName}</p>
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

export function ComparisonRadar({ comparison, municipalityName }: ComparisonRadarProps) {
  // Filter ODS where at least one score is available
  const validItems = comparison.filter(
    (item) => item.municipalityScore !== null || item.benchmarkAverage !== null,
  );

  if (validItems.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-4 flex items-center justify-center h-80">
        <p className="text-sm text-muted-foreground/60 italic text-center">
          Selecione municípios para comparar
        </p>
      </div>
    );
  }

  const data: RadarDataPoint[] = validItems.map((item) => {
    const def = ODS_DEFINITIONS.find((d) => d.number === item.odsNumber);
    return {
      subject: def?.shortName ?? `ODS ${item.odsNumber}`,
      odsName: def?.name ?? `ODS ${item.odsNumber}`,
      // Plot 0 when null — tooltip clarifies "sem dados"
      municipalityScore: item.municipalityScore ?? 0,
      benchmarkAverage: item.benchmarkAverage ?? 0,
      municipalityScoreRaw: item.municipalityScore,
      benchmarkAverageRaw: item.benchmarkAverage,
      delta: item.delta,
    };
  });

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">Radar Comparativo ODS</h3>
      <p className="text-xs text-muted-foreground mb-3">{municipalityName} vs. média do grupo</p>

      <ResponsiveContainer width="100%" height={340}>
        <RadarChart data={data} outerRadius={110}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "#6b7280" }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            tickCount={5}
          />
          <Tooltip content={<ComparisonTooltip />} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />

          {/* Série 2: Média do grupo — cinza tracejado, atrás */}
          <Radar
            name="Média do grupo"
            dataKey="benchmarkAverage"
            stroke="#6b7280"
            fill="#9ca3af"
            fillOpacity={0.15}
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />

          {/* Série 1: Município alvo — azul, destaque */}
          <Radar
            name="Seu município"
            dataKey="municipalityScore"
            stroke="#2563eb"
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-muted-foreground/60 text-center mt-1">
        ODS plotados como 0 podem indicar ausência de dados — consulte a tabela abaixo.
      </p>
    </div>
  );
}
