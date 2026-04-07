import type { OdsSummary, OdsStatus } from "../../types/api";
import { OdsTooltip } from "./OdsTooltip";

interface OdsCardProps {
  ods: OdsSummary;
  onClick: () => void;
}

const STATUS_CONFIG: Record<
  OdsStatus,
  { icon: string; label: string; textColor: string; barColor: string }
> = {
  verde: {
    icon: "✓",
    label: "No caminho",
    textColor: "text-green-700",
    barColor: "bg-green-500",
  },
  amarelo: {
    icon: "⚠",
    label: "Atenção",
    textColor: "text-amber-600",
    barColor: "bg-amber-400",
  },
  vermelho: {
    icon: "✗",
    label: "Crítico",
    textColor: "text-red-600",
    barColor: "bg-red-500",
  },
};

export function OdsCard({ ods, onClick }: OdsCardProps) {
  const hasData = ods.score !== null;
  const config = ods.status ? STATUS_CONFIG[ods.status] : null;

  return (
    <OdsTooltip odsNumber={ods.odsNumber} name={ods.name}>
      <button
        onClick={onClick}
        className={`relative w-full text-left rounded-lg bg-card shadow-sm border border-border p-3 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
          hasData ? "" : "opacity-50"
        }`}
        style={{ borderLeftWidth: "4px", borderLeftColor: ods.color }}
        aria-label={`ODS ${ods.odsNumber}: ${ods.name}. Score: ${hasData ? `${ods.score} de 100` : "dados indisponíveis"}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: ods.color }}
          >
            {ods.odsNumber}
          </span>
          <span className="text-xs font-medium text-muted-foreground leading-tight line-clamp-2">
            {ods.shortName}
          </span>
        </div>

        {hasData ? (
          <>
            <div className="flex items-baseline gap-1 mb-1.5">
              <span className="text-2xl font-bold text-foreground">{ods.score}</span>
              <span className="text-xs text-muted-foreground/60">/100</span>
            </div>

            {/* Barra de progresso */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${config?.barColor ?? "bg-gray-300"}`}
                style={{ width: `${Math.min(100, Math.max(0, ods.score ?? 0))}%` }}
              />
            </div>

            {/* Status com ícone + texto */}
            {config && (
              <div className={`flex items-center gap-1 text-xs font-medium ${config.textColor}`}>
                <span>{config.icon}</span>
                <span>{config.label}</span>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/60 mt-1.5">Ver detalhes →</p>
          </>
        ) : (
          <div>
            <span className="text-xs text-muted-foreground/60">Dados indisponíveis</span>
            <p className="text-[10px] text-muted-foreground/40 mt-1">
              Sem dados para este município
            </p>
          </div>
        )}
      </button>
    </OdsTooltip>
  );
}

export function OdsCardSkeleton() {
  return (
    <div className="rounded-lg bg-card shadow-sm border border-border p-3 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded bg-muted animate-pulse" />
        <div className="h-3 w-16 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-8 w-12 rounded bg-muted animate-pulse mb-2" />
      <div className="h-1.5 w-full rounded bg-muted animate-pulse mb-2" />
      <div className="h-3 w-16 rounded bg-muted animate-pulse" />
    </div>
  );
}
