import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { OdsSummary } from "../../types/api";

interface OdsRadarChartProps {
  ods: OdsSummary[];
  isLoading: boolean;
}

interface RadarDataPoint {
  subject: string;
  score: number;
  fullMark: number;
  meta: number;
}

// Recharts não exporta tipos precisos para custom tooltips — uso explícito aqui
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: RadarDataPoint }>;
}

function RadarTooltipContent({ active, payload }: TooltipProps) {
  if (!active || !payload?.[0]) return null;
  const { subject, score } = payload[0].payload;
  return (
    <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200 text-xs">
      <p className="font-semibold text-gray-900">{subject}</p>
      <p className="text-gray-600">
        Score: <span className="font-bold text-gray-900">{score}/100</span>
      </p>
      {score >= 70 ? (
        <p className="text-green-600 mt-0.5">Acima da meta (≥ 70)</p>
      ) : (
        <p className="text-amber-600 mt-0.5">Abaixo da meta (70)</p>
      )}
    </div>
  );
}

export function OdsRadarChart({ ods, isLoading }: OdsRadarChartProps) {
  if (isLoading) {
    return <div className="h-80 w-full rounded-lg bg-gray-200 animate-pulse" />;
  }

  // ODS sem dados são excluídos do gráfico — plotar null como 0 é enganoso
  const data: RadarDataPoint[] = ods
    .filter((o) => o.score !== null)
    .map((o) => ({
      subject: o.shortName,
      score: o.score ?? 0,
      fullMark: 100,
      meta: 70,
    }));

  const odsWithoutData = ods.filter((o) => o.score === null);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Visão Geral dos ODS</h3>
        <p className="text-sm text-gray-400 italic text-center py-10">
          Nenhum ODS com dados disponíveis para exibir o gráfico.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-600 mb-2">Visão Geral dos ODS</h3>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} outerRadius={110}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#6b7280" }} />
          <Tooltip content={<RadarTooltipContent />} />

          {/* Linha de referência: meta = 70 (tracejada) */}
          <Radar
            name="Meta"
            dataKey="meta"
            stroke="#9ca3af"
            strokeDasharray="4 4"
            fill="none"
            strokeWidth={1}
          />

          {/* Score real do município */}
          <Radar
            name="Score"
            dataKey="score"
            stroke="#2563eb"
            fill="#2563eb"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Legenda manual */}
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-blue-600" />
          <span className="text-[10px] text-gray-500">Score atual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-4 h-0.5 bg-gray-400"
            style={{ borderTop: "1px dashed #9ca3af", background: "none" }}
          />
          <span className="text-[10px] text-gray-500">Meta (70)</span>
        </div>
      </div>

      {/* Aviso sobre ODS sem dados */}
      {odsWithoutData.length > 0 && (
        <p className="text-[10px] text-gray-400 text-center mt-2">
          ODS sem dados não são exibidos no gráfico
          {odsWithoutData.length <= 5 && (
            <>
              {": "}
              {odsWithoutData.map((o) => o.shortName).join(", ")}
            </>
          )}
          {odsWithoutData.length > 5 && <> ({odsWithoutData.length} ODS omitidos)</>}.
        </p>
      )}
    </div>
  );
}
