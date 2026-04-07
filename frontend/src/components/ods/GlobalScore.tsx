import type { OdsStatus } from "../../types/api";
import { STATUS_LABELS } from "../../types/api";

interface GlobalScoreProps {
  score: number | null;
  status: OdsStatus | null;
  isLoading: boolean;
}

const STATUS_STROKE: Record<OdsStatus, string> = {
  verde: "#22c55e",
  amarelo: "#f59e0b",
  vermelho: "#ef4444",
};

const STATUS_BG: Record<OdsStatus, string> = {
  verde: "bg-green-100 text-green-800",
  amarelo: "bg-amber-100 text-amber-800",
  vermelho: "bg-red-100 text-red-800",
};

export function GlobalScore({ score, status, isLoading }: GlobalScoreProps) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 270 / 360;
  const arcLength = circumference * arcFraction;
  const progress = score !== null ? (score / 100) * arcLength : 0;
  const offset = arcLength - progress;
  const strokeColor = status ? STATUS_STROKE[status] : "#d1d5db";

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-2 w-52">
        <div className="w-40 h-40 rounded-full bg-gray-200 animate-pulse" />
        <div className="w-24 h-6 rounded bg-gray-200 animate-pulse" />
        <div className="w-36 h-4 rounded bg-gray-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 w-52">
      {/* Tooltip sobre o score global */}
      <div className="group relative flex flex-col items-center">
        <div className="relative w-40 h-40">
          <svg viewBox="0 0 160 160" className="w-full h-full -rotate-[135deg]">
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="12"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth="12"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-baseline gap-0.5">
              <span className="text-4xl font-bold text-gray-900">
                {score !== null ? score : "—"}
              </span>
              {score !== null && <span className="text-sm text-gray-400">/100</span>}
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide text-center leading-tight mt-0.5">
              Score ESG
            </span>
          </div>
        </div>

        {/* Tooltip flutuante */}
        <div className="invisible group-hover:visible absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none transition-opacity opacity-0 group-hover:opacity-100">
          <p className="font-semibold mb-1">Score ESG Municipal</p>
          <p className="text-gray-300">
            Média ponderada dos 17 ODS da Agenda 2030 da ONU, calculada com base em dados públicos
            de saúde, educação, saneamento, meio ambiente e governança.
          </p>
          <p className="text-gray-400 mt-2 text-[10px]">
            Verde ≥ 70 · Amarelo 40–69 · Vermelho &lt; 40
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 bg-gray-900 rotate-45" />
          </div>
        </div>
      </div>

      {/* Badge de status */}
      {status ? (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BG[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      ) : (
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-500">
          Sem dados
        </span>
      )}

      {/* Legenda de zonas */}
      <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≥ 70
        </span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          40–69
        </span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          &lt; 40
        </span>
      </div>
    </div>
  );
}
