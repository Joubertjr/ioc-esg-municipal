import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/utils";
import type { MunicipalOdsReport, OdsStatus } from "../../types/api";

interface KpiCardsProps {
  report: MunicipalOdsReport | undefined;
  isLoading: boolean;
}

// Maps ODS status to a left-border accent color class
const statusBorderClass: Record<OdsStatus, string> = {
  verde: "border-l-success",
  amarelo: "border-l-warning",
  vermelho: "border-l-danger",
};

// Maps ODS status to a human-readable label with color
const statusBadgeClass: Record<OdsStatus, string> = {
  verde: "text-success",
  amarelo: "text-warning",
  vermelho: "text-danger",
};

const statusLabel: Record<OdsStatus, string> = {
  verde: "Situação Verde",
  amarelo: "Atenção necessária",
  vermelho: "Situação crítica",
};

function borderFromStatus(status: OdsStatus | null | undefined): string {
  if (!status) return "border-l-border";
  return statusBorderClass[status];
}

// ---------------------------------------------------------------------------
// Individual KPI card shell
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  context: React.ReactNode;
  borderClass: string;
  animate?: boolean;
}

function KpiCard({ label, value, suffix, context, borderClass, animate }: KpiCardProps) {
  return (
    <Card className={cn("border-l-4 rounded-xl overflow-hidden", borderClass)}>
      <CardContent className="p-5 flex flex-col gap-1">
        {/* Label */}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          {label}
        </span>

        {/* Big number */}
        <div className="flex items-baseline gap-1 mt-1">
          {animate && typeof value === "number" ? (
            <AnimatedNumber
              value={value}
              className="text-3xl font-extrabold tracking-tight text-foreground leading-none"
            />
          ) : (
            <span className="text-3xl font-extrabold tracking-tight text-foreground leading-none">
              {value}
            </span>
          )}
          {suffix && <span className="text-sm text-muted-foreground font-normal">{suffix}</span>}
        </div>

        {/* Context line */}
        <div className="text-sm text-muted-foreground mt-0.5">{context}</div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton variant — 4 placeholder cards during loading
// ---------------------------------------------------------------------------

export function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="border-l-4 border-l-border rounded-xl overflow-hidden">
          <CardContent className="p-5 flex flex-col gap-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-8 w-16 rounded mt-1" />
            <Skeleton className="h-3 w-28 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KpiCards({ report, isLoading }: KpiCardsProps) {
  if (isLoading || !report) {
    return <KpiCardsSkeleton />;
  }

  // --- Card 1: Score Global ---
  const globalBorder = borderFromStatus(report.globalStatus);
  const globalContext = report.globalStatus ? (
    <span className={statusBadgeClass[report.globalStatus]}>
      {statusLabel[report.globalStatus]}
    </span>
  ) : (
    <span>Sem dados suficientes</span>
  );

  // --- Card 2: ODS Críticos ---
  const criticalCount = report.odsCount.vermelho + report.odsCount.amarelo;
  const criticalBorder =
    criticalCount === 0
      ? "border-l-success"
      : report.odsCount.vermelho > 0
        ? "border-l-danger"
        : "border-l-warning";
  const criticalContext =
    criticalCount === 0 ? (
      <span className="text-success">Todos no caminho</span>
    ) : (
      <span>ODS precisam de atenção</span>
    );

  // --- Card 3: Cobertura ---
  const coverageBorder =
    report.odsCount.withData === report.odsCount.total
      ? "border-l-success"
      : report.odsCount.withData === 0
        ? "border-l-danger"
        : "border-l-warning";

  // --- Card 4: Pior ODS ---
  const worstOds = report.ods
    .filter((o) => o.score !== null)
    .sort((a, b) => (a.score as number) - (b.score as number))[0];

  const worstBorder = worstOds?.status ? statusBorderClass[worstOds.status] : "border-l-border";

  const worstContext = worstOds ? (
    <span style={{ color: worstOds.color }}>{worstOds.name}</span>
  ) : (
    <span>Sem dados</span>
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1 — Score Global */}
      <KpiCard
        label="Score Global"
        value={report.globalScore !== null ? Math.round(report.globalScore) : "—"}
        suffix="/100"
        context={globalContext}
        borderClass={globalBorder}
        animate
      />

      {/* Card 2 — ODS Críticos */}
      <KpiCard
        label="ODS Críticos"
        value={criticalCount}
        context={criticalContext}
        borderClass={criticalBorder}
        animate
      />

      {/* Card 3 — Cobertura */}
      <KpiCard
        label="Cobertura"
        value={report.odsCount.withData}
        suffix={`/${report.odsCount.total}`}
        context={<span>ODS com dados disponíveis</span>}
        borderClass={coverageBorder}
        animate
      />

      {/* Card 4 — Pior ODS */}
      <KpiCard
        label="Pior ODS"
        value={
          worstOds?.score !== undefined && worstOds.score !== null
            ? Math.round(worstOds.score)
            : "—"
        }
        suffix={worstOds ? "/100" : undefined}
        context={worstContext}
        borderClass={worstBorder}
        animate
      />
    </div>
  );
}
