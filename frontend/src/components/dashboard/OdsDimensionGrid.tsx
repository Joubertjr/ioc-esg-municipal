import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/utils";
import { ODS_DIMENSIONS, type OdsDimension } from "@/lib/odsDimensions";
import type { OdsSummary, OdsStatus } from "../../types/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BAR_COLOR: Record<OdsStatus, string> = {
  verde: "bg-success",
  amarelo: "bg-warning",
  vermelho: "bg-danger",
};

const STATUS_TEXT_COLOR: Record<OdsStatus, string> = {
  verde: "text-success",
  amarelo: "text-warning",
  vermelho: "text-danger",
};

function averageScore(items: OdsSummary[]): number | null {
  const withData = items.filter((o) => o.score !== null);
  if (withData.length === 0) return null;
  const sum = withData.reduce((acc, o) => acc + (o.score ?? 0), 0);
  return Math.round(sum / withData.length);
}

// ---------------------------------------------------------------------------
// ODS row inside a dimension card
// ---------------------------------------------------------------------------

interface OdsRowProps {
  ods: OdsSummary;
  onClick: () => void;
}

function OdsRow({ ods, onClick }: OdsRowProps) {
  const hasData = ods.score !== null;
  const barColor = ods.status ? STATUS_BAR_COLOR[ods.status] : "bg-muted";
  const scoreColor = ods.status ? STATUS_TEXT_COLOR[ods.status] : "text-muted-foreground";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-2 py-1.5 px-2 rounded-md",
        "hover:bg-muted/50 transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
        !hasData && "opacity-50",
      )}
      aria-label={`ODS ${ods.odsNumber}: ${ods.name}. Score: ${hasData ? `${ods.score} de 100` : "dados indisponíveis"}`}
    >
      {/* ODS number badge */}
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white shrink-0"
        style={{ backgroundColor: ods.color }}
      >
        {ods.odsNumber}
      </span>

      {/* Short name */}
      <span className="text-xs text-muted-foreground flex-1 truncate leading-tight">
        {ods.shortName}
      </span>

      {/* Progress bar */}
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: hasData ? `${Math.min(100, Math.max(0, ods.score ?? 0))}%` : "0%" }}
        />
      </div>

      {/* Score */}
      <span
        className={cn("text-xs font-semibold w-7 text-right shrink-0 tabular-nums", scoreColor)}
      >
        {hasData ? ods.score : "—"}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Single dimension card
// ---------------------------------------------------------------------------

interface DimensionCardProps {
  dimension: OdsDimension;
  odsList: OdsSummary[];
  onOdsClick: (ods: OdsSummary) => void;
}

function DimensionCard({ dimension, odsList, onOdsClick }: DimensionCardProps) {
  const avg = averageScore(odsList);
  const hasAnyData = avg !== null;

  // Derive aggregate status from average
  const avgStatus: OdsStatus | null = hasAnyData
    ? avg >= 70
      ? "verde"
      : avg >= 40
        ? "amarelo"
        : "vermelho"
    : null;

  const avgTextColor = avgStatus ? STATUS_TEXT_COLOR[avgStatus] : "text-muted-foreground";

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Dimension color dot */}
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
              style={{ backgroundColor: dimension.color }}
            />
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-foreground leading-tight">
                {dimension.name}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">{dimension.description}</p>
            </div>
          </div>

          {/* Average score — big number */}
          <div className="text-right shrink-0">
            {hasAnyData && avg !== null ? (
              <>
                <AnimatedNumber
                  value={avg}
                  className={cn("text-2xl font-bold tabular-nums leading-none", avgTextColor)}
                />
                <span className="text-[10px] text-muted-foreground/60 ml-0.5">/100</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground/60">—</span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-3 pt-0 flex-1">
        {odsList.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic text-center py-4">
            Nenhum ODS mapeado nesta dimensão.
          </p>
        ) : (
          <div className="space-y-0.5">
            {odsList.map((ods) => (
              <OdsRow key={ods.odsNumber} ods={ods} onClick={() => onOdsClick(ods)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface OdsDimensionGridProps {
  ods: OdsSummary[];
  isLoading: boolean;
  onOdsClick: (ods: OdsSummary) => void;
}

export function OdsDimensionGrid({ ods, isLoading, onOdsClick }: OdsDimensionGridProps) {
  if (isLoading) {
    return <OdsDimensionGridSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {ODS_DIMENSIONS.map((dimension) => {
        // Preserve ODS order within the dimension as defined in ODS_DIMENSIONS
        const odsList = dimension.odsNumbers
          .map((n) => ods.find((o) => o.odsNumber === n))
          .filter((o): o is OdsSummary => o !== undefined);

        return (
          <DimensionCard
            key={dimension.name}
            dimension={dimension}
            odsList={odsList}
            onOdsClick={onOdsClick}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function OdsDimensionGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                <div>
                  <div className="h-4 w-20 rounded bg-muted mb-1" />
                  <div className="h-3 w-14 rounded bg-muted" />
                </div>
              </div>
              <div className="h-7 w-10 rounded bg-muted" />
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-0">
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2 px-2 py-1.5">
                  <div className="w-5 h-5 rounded bg-muted" />
                  <div className="h-3 flex-1 rounded bg-muted" />
                  <div className="w-20 h-1.5 rounded bg-muted" />
                  <div className="w-7 h-3 rounded bg-muted" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
