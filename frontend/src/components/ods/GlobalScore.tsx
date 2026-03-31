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
      <div className="flex flex-col items-center gap-2 w-48">
        <div className="w-40 h-40 rounded-full bg-gray-200 animate-pulse" />
        <div className="w-24 h-6 rounded bg-gray-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 w-48">
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
          <span className="text-4xl font-bold text-gray-900">
            {score !== null ? score : "—"}
          </span>
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            Score Global
          </span>
        </div>
      </div>
      {status ? (
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BG[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      ) : (
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-500">
          Sem dados
        </span>
      )}
    </div>
  );
}
