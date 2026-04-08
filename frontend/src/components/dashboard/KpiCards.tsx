import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import type { MunicipalOdsReport, OdsSummary, OdsStatus } from "../../types/api";
import type { StateBenchmarkData } from "../../hooks/useStateBenchmark";
import type { TrendData } from "../../hooks/useTrend";

interface KpiCardsProps {
  report: MunicipalOdsReport | undefined;
  isLoading: boolean;
  benchmark?: StateBenchmarkData;
  trend?: TrendData;
  isBenchmarkLoading?: boolean;
  isTrendLoading?: boolean;
  worstOds?: OdsSummary;
  worstOdsContext?: string;
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
  prefix?: string;
}

function KpiCard({ label, value, suffix, prefix, context, borderClass, animate }: KpiCardProps) {
  return (
    <Card className={cn("border-l-4 rounded-xl overflow-hidden", borderClass)}>
      <CardContent className="p-5 flex flex-col gap-1">
        {/* Label */}
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
          {label}
        </span>

        {/* Big number */}
        <div className="flex items-baseline gap-1 mt-1">
          {prefix && (
            <span className="text-2xl font-extrabold tracking-tight text-foreground leading-none">
              {prefix}
            </span>
          )}
          {animate && typeof value === "number" ? (
            <AnimatedNumber
              value={value}
              className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground leading-none"
            />
          ) : (
            <span className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground leading-none">
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

export function KpiCards({
  report,
  isLoading,
  benchmark,
  trend,
  isBenchmarkLoading,
  isTrendLoading,
  worstOds,
  worstOdsContext,
}: KpiCardsProps) {
  if (isLoading || !report) {
    return <KpiCardsSkeleton />;
  }

  // --- Card 1: Score Global ---
  const globalBorder = borderFromStatus(report.globalStatus);
  let globalContext: React.ReactNode;
  if (benchmark && benchmark.deltaVsState !== null && benchmark.stateAverage !== null) {
    const absDelta = Math.abs(benchmark.deltaVsState);
    const avg = benchmark.stateAverage;
    if (benchmark.deltaVsState === 0) {
      globalContext = <span className="text-muted-foreground">Na média SC ({avg})</span>;
    } else if (benchmark.aboveStateAverage) {
      globalContext = (
        <span className="text-success">
          &uarr; {absDelta} pts acima da média SC ({avg})
        </span>
      );
    } else {
      globalContext = (
        <span className="text-danger">
          &darr; {absDelta} pts abaixo da média SC ({avg})
        </span>
      );
    }
  } else if (report.globalStatus) {
    globalContext = (
      <span className={statusBadgeClass[report.globalStatus]}>
        {statusLabel[report.globalStatus]}
      </span>
    );
  } else {
    globalContext = <span>Sem dados suficientes</span>;
  }

  // --- Card 2: Ranking SC ---
  const rankingPosition = benchmark?.rankingPosition ?? null;
  const totalInBenchmark = benchmark?.totalInBenchmark ?? null;
  let rankingBorder = "border-l-border";
  if (rankingPosition !== null && totalInBenchmark !== null) {
    const topThird = totalInBenchmark / 3;
    const bottomThird = (totalInBenchmark * 2) / 3;
    if (rankingPosition <= topThird) rankingBorder = "border-l-success";
    else if (rankingPosition <= bottomThird) rankingBorder = "border-l-warning";
    else rankingBorder = "border-l-danger";
  }
  const rankingValue = isBenchmarkLoading ? "—" : rankingPosition !== null ? rankingPosition : "—";
  const rankingSuffix =
    isBenchmarkLoading || totalInBenchmark === null ? undefined : `/ ${totalInBenchmark}`;

  // --- Card 3: Tendência ---
  let trendPrefix: string | undefined;
  let trendValue: string | number = "—";
  let trendSuffix: string | undefined;
  let trendBorder = "border-l-border";

  if (!isTrendLoading && trend) {
    if (trend.delta !== null) {
      trendValue = Math.abs(Math.round(trend.delta));
      trendSuffix = "pts";
      if (trend.direction === "up") {
        trendPrefix = "↑";
        trendBorder = "border-l-success";
      } else if (trend.direction === "down") {
        trendPrefix = "↓";
        trendBorder = "border-l-danger";
      } else {
        trendPrefix = "→";
        trendBorder = "border-l-warning";
      }
    }
  }

  const trendContext: React.ReactNode = isTrendLoading ? (
    <Skeleton className="h-3 w-24 rounded" />
  ) : trend && trend.sparklineData.length > 1 ? (
    <div className="flex items-center gap-2 mt-1">
      <div className="w-[60px] h-6 shrink-0" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend.sparklineData}>
            <Line
              type="monotone"
              dataKey="score"
              stroke="currentColor"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <span className="text-xs">
        {trend.previousYear} → {trend.latestYear}
      </span>
    </div>
  ) : (
    <span>Sem histórico</span>
  );

  // --- Card 4: Pior ODS ---
  const worstBorder = worstOds?.status ? statusBorderClass[worstOds.status] : "border-l-border";

  const worstContext: React.ReactNode = worstOdsContext ? (
    <span className="text-xs">{worstOdsContext}</span>
  ) : worstOds ? (
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

      {/* Card 2 — Ranking SC */}
      <KpiCard
        label="Ranking SC"
        value={rankingValue}
        suffix={rankingSuffix}
        context={
          isBenchmarkLoading ? (
            <Skeleton className="h-3 w-32 rounded" />
          ) : rankingPosition !== null ? (
            <span>entre {totalInBenchmark} maiores cidades SC</span>
          ) : (
            <span className="text-muted-foreground">Ranking disponível após benchmark</span>
          )
        }
        borderClass={rankingBorder}
        animate={typeof rankingValue === "number"}
      />

      {/* Card 3 — Tendência */}
      <KpiCard
        label="Tendência"
        value={trendValue}
        suffix={trendSuffix}
        prefix={trendPrefix}
        context={trendContext}
        borderClass={trendBorder}
        animate={typeof trendValue === "number"}
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
