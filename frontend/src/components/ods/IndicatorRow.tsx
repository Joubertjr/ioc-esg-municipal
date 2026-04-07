import type { ApiOdsIndicator, OdsStatus } from "../../types/api";
import { getIndicatorMeta } from "../../../../shared/constants/ods-descriptions";

interface IndicatorRowProps {
  indicator: ApiOdsIndicator;
  odsNumber: number;
}

const STATUS_CONFIG: Record<
  OdsStatus,
  { icon: string; label: string; color: string; barColor: string }
> = {
  verde: {
    icon: "✓",
    label: "Bom",
    color: "text-green-700",
    barColor: "bg-green-500",
  },
  amarelo: {
    icon: "⚠",
    label: "Atenção",
    color: "text-amber-600",
    barColor: "bg-amber-400",
  },
  vermelho: {
    icon: "✗",
    label: "Crítico",
    color: "text-red-600",
    barColor: "bg-red-500",
  },
};

function formatIndicatorName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function IndicatorRow({ indicator, odsNumber }: IndicatorRowProps) {
  const meta = getIndicatorMeta(odsNumber, indicator.indicatorName);
  const displayName = meta?.label ?? formatIndicatorName(indicator.indicatorName);
  const unit = meta?.unit ?? "";
  const config = indicator.status ? STATUS_CONFIG[indicator.status] : null;
  const directionIcon =
    meta?.goodDirection === "up" ? "↑" : meta?.goodDirection === "down" ? "↓" : "";

  const formattedValue =
    indicator.value !== null
      ? typeof indicator.value === "number"
        ? indicator.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
        : String(indicator.value)
      : "—";

  return (
    <div className="group py-3 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-2">
        {/* Coluna esquerda: nome, valor e fonte */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">{displayName}</span>
            {directionIcon && (
              <span
                className="text-[10px] text-muted-foreground/60"
                title={meta?.goodDirection === "up" ? "Maior é melhor" : "Menor é melhor"}
                aria-label={meta?.goodDirection === "up" ? "Maior é melhor" : "Menor é melhor"}
              >
                {directionIcon}
              </span>
            )}
          </div>

          {/* Valor + unidade */}
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {formattedValue}
            </span>
            {unit && <span className="text-xs text-muted-foreground/60">{unit}</span>}
          </div>

          {/* Fonte e ano */}
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">
            {indicator.source.toUpperCase()} · {indicator.referenceYear}
          </div>
        </div>

        {/* Coluna direita: score + status */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-lg font-bold tabular-nums text-foreground">
            {indicator.score !== null ? indicator.score : "—"}
          </span>
          {config && (
            <span
              className={`flex items-center gap-0.5 text-[10px] font-medium ${config.color}`}
              aria-label={`Status: ${config.label}`}
            >
              {config.icon} {config.label}
            </span>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      {indicator.score !== null && (
        <div
          className="h-1 bg-muted rounded-full overflow-hidden mt-2"
          role="progressbar"
          aria-valuenow={indicator.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Score ${indicator.score} de 100`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${config?.barColor ?? "bg-gray-300"}`}
            style={{ width: `${Math.min(100, Math.max(0, indicator.score))}%` }}
          />
        </div>
      )}

      {/* Tooltip ao passar o mouse: explicação */}
      {meta?.explanation && (
        <div className="hidden group-hover:block mt-2 p-2 bg-muted rounded text-[10px] text-muted-foreground leading-relaxed">
          {meta.explanation}
          <span className="block mt-0.5 text-muted-foreground/60">Fonte: {meta.source}</span>
        </div>
      )}
    </div>
  );
}
