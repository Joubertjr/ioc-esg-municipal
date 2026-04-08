import { useState, useMemo, useEffect } from "react";
import { useOdsReport } from "../hooks/useOdsReport";
import { useOdsHistory } from "../hooks/useOdsHistory";
import { AppShell } from "../components/layout/AppShell";
import { useToast } from "../components/ui/Toast";
import type { OdsSummary, OdsStatus, OdsScoreRecord } from "../types/api";

const DEFAULT_IBGE_CODE = "4205407"; // Florianópolis
const DEFAULT_TARGET = 70;

type SortKey = "odsNumber" | "scoreAsc" | "gapDesc";
type FilterStatus = "all" | OdsStatus;

const ODS_SHORT_NAMES: Record<number, string> = {
  1: "Erradicação da Pobreza",
  2: "Fome Zero",
  3: "Saúde e Bem-Estar",
  4: "Educação de Qualidade",
  5: "Igualdade de Gênero",
  6: "Água e Saneamento",
  7: "Energia Limpa",
  8: "Trabalho Decente",
  9: "Indústria e Inovação",
  10: "Redução de Desigualdades",
  11: "Cidades Sustentáveis",
  12: "Consumo Responsável",
  13: "Ação Climática",
  14: "Vida na Água",
  15: "Vida Terrestre",
  16: "Paz e Justiça",
  17: "Parcerias",
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground/60";
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-danger";
}

function progressBarColor(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score >= 70) return "bg-success";
  if (score >= 40) return "bg-warning";
  return "bg-danger";
}

function StatusBadge({ status }: { status: OdsStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
        Sem dados
      </span>
    );
  }
  const map: Record<OdsStatus, { bg: string; dot: string; label: string }> = {
    verde: { bg: "bg-success/10 text-success", dot: "bg-success", label: "Verde" },
    amarelo: { bg: "bg-warning/10 text-warning", dot: "bg-warning", label: "Amarelo" },
    vermelho: { bg: "bg-danger/10 text-danger", dot: "bg-danger", label: "Vermelho" },
  };
  const { bg, dot, label } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function GapBadge({ gap }: { gap: number | null }) {
  if (gap === null) return <span className="text-muted-foreground/60 text-sm">—</span>;
  if (gap <= 0) {
    return (
      <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
        Meta atingida
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-danger bg-danger/10 px-2 py-0.5 rounded-full tabular-nums">
      -{gap.toFixed(1)} pts
    </span>
  );
}

type TrendDirection = "up" | "down" | "neutral";

function TrendBadge({ trend }: { trend: TrendDirection }) {
  if (trend === "up") {
    return (
      <span
        className="text-xs font-bold text-success bg-success/10 px-1.5 py-0.5 rounded"
        title="Tendencia de alta"
      >
        ↑
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span
        className="text-xs font-bold text-danger bg-danger/10 px-1.5 py-0.5 rounded"
        title="Tendencia de queda"
      >
        ↓
      </span>
    );
  }
  return (
    <span
      className="text-xs font-bold text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded"
      title="Sem variacao"
    >
      →
    </span>
  );
}

interface OdsRowProps {
  ods: OdsSummary;
  target: number;
  trend: TrendDirection;
}

function OdsRow({ ods, target, trend }: OdsRowProps) {
  const gap = ods.score !== null ? target - ods.score : null;
  const pct = ods.score !== null ? Math.min(100, Math.max(0, ods.score)) : 0;
  const targetPct = Math.min(100, Math.max(0, target));

  return (
    <div className="bg-card rounded-xl shadow-card border-0 p-4 transition-shadow hover:shadow-card-hover">
      <div className="flex items-start gap-4">
        {/* ODS number circle */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: ods.color }}
        >
          {ods.odsNumber}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-foreground truncate">
              {ODS_SHORT_NAMES[ods.odsNumber] ?? ods.shortName}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={ods.status} />
              <GapBadge gap={gap} />
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-muted rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressBarColor(ods.score)}`}
              style={{ width: `${pct}%` }}
            />
            {/* Target marker */}
            <div
              className="absolute top-0 h-full w-0.5 bg-muted-foreground opacity-60"
              style={{ left: `${targetPct}%` }}
              title={`Meta: ${target}`}
            />
          </div>

          {/* Score labels */}
          <div className="flex items-center justify-between mt-1">
            <span className={`text-sm font-semibold tabular-nums ${scoreColor(ods.score)}`}>
              {ods.score !== null ? ods.score.toFixed(1) : "—"}
              <span className="text-xs font-normal text-muted-foreground/60 ml-1">atual</span>
              <span className="ml-2">
                <TrendBadge trend={trend} />
              </span>
            </span>
            <span className="text-xs text-muted-foreground/60">
              Meta: <span className="font-medium text-muted-foreground">{target}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStats({
  verde,
  amarelo,
  vermelho,
  noData,
  total,
}: {
  verde: number;
  amarelo: number;
  vermelho: number;
  noData: number;
  total: number;
}) {
  const items = [
    {
      label: "Verde (meta atingida)",
      value: verde,
      color: "text-success",
      bg: "bg-success/10",
      bar: "bg-success",
    },
    {
      label: "Amarelo (atenção)",
      value: amarelo,
      color: "text-warning",
      bg: "bg-warning/10",
      bar: "bg-warning",
    },
    {
      label: "Vermelho (crítico)",
      value: vermelho,
      color: "text-danger",
      bg: "bg-danger/10",
      bar: "bg-danger",
    },
    {
      label: "Sem dados",
      value: noData,
      color: "text-muted-foreground",
      bg: "bg-muted",
      bar: "bg-muted-foreground/40",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map(({ label, value, color, bg, bar }) => (
        <div key={label} className={`rounded-lg p-4 ${bg}`}>
          <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
          <div className="text-xs text-foreground mt-0.5">{label}</div>
          <div className="mt-2 h-1.5 bg-card/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${bar}`}
              style={{ width: total > 0 ? `${(value / total) * 100}%` : "0%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MonitoringPage() {
  const [ibgeCode, setIbgeCode] = useState(DEFAULT_IBGE_CODE);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("odsNumber");

  const { data: report, isLoading, isError, error, refetch } = useOdsReport(ibgeCode);
  const { data: historyData } = useOdsHistory(ibgeCode);
  const { showToast } = useToast();

  useEffect(() => {
    if (isError && error) {
      showToast(error.message ?? "Erro ao carregar dados ODS.", "error");
    }
  }, [isError, error, showToast]);

  const { verde, amarelo, vermelho, noData } = useMemo(() => {
    if (!report) return { verde: 0, amarelo: 0, vermelho: 0, noData: 0 };
    return {
      verde: report.odsCount.verde,
      amarelo: report.odsCount.amarelo,
      vermelho: report.odsCount.vermelho,
      noData: report.odsCount.total - report.odsCount.withData,
    };
  }, [report]);

  // Build a map of odsNumber -> TrendDirection based on last two available years
  const trendByOds = useMemo((): Map<number, TrendDirection> => {
    const map = new Map<number, TrendDirection>();
    if (!historyData?.history) return map;

    // Group records by odsNumber
    const byOds = new Map<number, OdsScoreRecord[]>();
    for (const record of historyData.history) {
      const existing = byOds.get(record.odsNumber);
      if (existing) {
        existing.push(record);
      } else {
        byOds.set(record.odsNumber, [record]);
      }
    }

    for (const [odsNumber, records] of byOds.entries()) {
      const sorted = records
        .filter((r) => r.score !== null)
        .sort((a, b) => b.referenceYear - a.referenceYear);

      if (sorted.length < 2) {
        map.set(odsNumber, "neutral");
        continue;
      }

      const latest = sorted[0].score as number;
      const previous = sorted[1].score as number;
      const delta = latest - previous;

      if (delta > 0.05) {
        map.set(odsNumber, "up");
      } else if (delta < -0.05) {
        map.set(odsNumber, "down");
      } else {
        map.set(odsNumber, "neutral");
      }
    }

    return map;
  }, [historyData]);

  const filteredAndSorted = useMemo(() => {
    if (!report) return [];

    let list = [...report.ods];

    // Filter
    if (filterStatus !== "all") {
      list = list.filter((o) => o.status === filterStatus);
    }

    // Sort
    if (sortKey === "scoreAsc") {
      list.sort((a, b) => {
        if (a.score === null && b.score === null) return 0;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return a.score - b.score;
      });
    } else if (sortKey === "gapDesc") {
      list.sort((a, b) => {
        const gapA = a.score !== null ? target - a.score : -Infinity;
        const gapB = b.score !== null ? target - b.score : -Infinity;
        return gapB - gapA;
      });
    } else {
      list.sort((a, b) => a.odsNumber - b.odsNumber);
    }

    return list;
  }, [report, filterStatus, sortKey, target]);

  const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "vermelho", label: "Vermelho" },
    { value: "amarelo", label: "Amarelo" },
    { value: "verde", label: "Verde" },
  ];

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "odsNumber", label: "Número ODS" },
    { value: "scoreAsc", label: "Menor score" },
    { value: "gapDesc", label: "Mais urgente" },
  ];

  return (
    <AppShell
      ibgeCode={ibgeCode}
      onSelect={setIbgeCode}
      referenceYear={report?.referenceYear ?? null}
    >
      <div className="space-y-8">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Monitoramento de Metas ODS</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe o progresso do município em cada um dos 17 Objetivos de Desenvolvimento
            Sustentável.
          </p>
        </div>

        {isError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-destructive">Erro ao carregar dados ODS</p>
              <p className="text-xs text-destructive mt-1">
                {error?.message ?? "Verifique se o servidor está rodando."}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 text-sm font-medium text-destructive bg-destructive/10 rounded-md hover:bg-destructive/20 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Summary cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : report ? (
          <SummaryStats
            verde={verde}
            amarelo={amarelo}
            vermelho={vermelho}
            noData={noData}
            total={report.odsCount.total}
          />
        ) : null}

        {/* Controls */}
        <div className="bg-card rounded-xl shadow-card border-0 p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            {/* Target score */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Meta de score
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="range"
                    min={40}
                    max={100}
                    step={5}
                    value={target}
                    onChange={(e) => setTarget(parseInt(e.target.value, 10))}
                    className="w-full accent-primary"
                    aria-label={`Meta de score: ${target}`}
                  />
                  {/* Tooltip label above thumb */}
                  <div
                    className="absolute -top-6 text-xs font-bold text-primary tabular-nums pointer-events-none"
                    style={{
                      left: `calc(${((target - 40) / (100 - 40)) * 100}% - 12px)`,
                    }}
                  >
                    {target}
                  </div>
                </div>
                <span className="text-sm font-bold text-primary tabular-nums w-8 text-right">
                  {target}
                </span>
              </div>
            </div>

            {/* Filter */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Filtrar por status
              </label>
              <div className="flex gap-1">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilterStatus(opt.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      filterStatus === opt.value
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Ordenar por
              </label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="px-3 py-1.5 border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ODS list */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 17 }, (_, i) => (
              <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground/60">
            <svg
              className="w-12 h-12 mx-auto mb-3 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {report ? (
              <p className="text-sm">Nenhum ODS encontrado com o filtro selecionado.</p>
            ) : (
              <>
                <p className="text-sm">Nenhuma meta cadastrada</p>
                <p className="text-xs mt-1">
                  Selecione um município para ver o monitoramento de metas ODS.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredAndSorted.map((ods) => (
              <OdsRow
                key={ods.odsNumber}
                ods={ods}
                target={target}
                trend={trendByOds.get(ods.odsNumber) ?? "neutral"}
              />
            ))}
          </div>
        )}

        {/* Legenda permanente de status */}
        <div className="flex items-center justify-center gap-6 py-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-success shrink-0" />
            Verde (≥70)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-warning shrink-0" />
            Amarelo (40-69)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-danger shrink-0" />
            Vermelho (&lt;40)
          </span>
        </div>
      </div>
    </AppShell>
  );
}
