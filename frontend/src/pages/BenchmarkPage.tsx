import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { MunicipalityMultiSelect } from "../components/benchmark/MunicipalityMultiSelect";
import { RankingTable } from "../components/benchmark/RankingTable";
import { ComparisonRadar } from "../components/benchmark/ComparisonRadar";
import { OdsComparisonTable } from "../components/benchmark/OdsComparisonTable";
import { useBenchmark, useCompare } from "../hooks/useBenchmark";

const DEFAULT_IBGE_CODE = "4205407"; // Florianópolis
const DEFAULT_SELECTED_CODES = [
  "4205407", // Florianópolis
  "4209102", // Joinville
  "4204202", // Chapecó
  "4205002", // Criciúma
  "4218707", // São José
];

// ---- Skeleton loaders ----

function SummaryCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 animate-pulse">
      <div className="h-3 w-24 bg-muted rounded mb-3" />
      <div className="h-8 w-16 bg-muted rounded mb-1" />
      <div className="h-3 w-32 bg-muted rounded" />
    </div>
  );
}

function RankingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-10 bg-muted rounded-lg" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-14 bg-background rounded-lg border border-border" />
      ))}
    </div>
  );
}

function RadarSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-4" />
      <div className="h-64 bg-muted rounded-lg" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 animate-pulse space-y-2">
      <div className="h-4 w-40 bg-muted rounded mb-4" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-8 bg-muted rounded" />
      ))}
    </div>
  );
}

// ---- Summary cards ----

interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: "positive" | "negative" | "neutral";
}

function SummaryCard({ label, value, sub, highlight = "neutral" }: SummaryCardProps) {
  const valueColor =
    highlight === "positive"
      ? "text-success"
      : highlight === "negative"
        ? "text-danger"
        : "text-foreground";

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ---- Main Page ----

export function BenchmarkPage() {
  const [ibgeCode, setIbgeCode] = useState(DEFAULT_IBGE_CODE);
  const [selectedCodes, setSelectedCodes] = useState<string[]>(DEFAULT_SELECTED_CODES);

  const {
    data: benchmark,
    isLoading: isBenchmarkLoading,
    isError: isBenchmarkError,
    error: benchmarkError,
    refetch: refetchBenchmark,
  } = useBenchmark(selectedCodes);

  const {
    data: compare,
    isLoading: isCompareLoading,
    isError: isCompareError,
    error: compareError,
    refetch: refetchCompare,
  } = useCompare(ibgeCode, selectedCodes);

  const isLoading = isBenchmarkLoading || isCompareLoading;
  const isError = isBenchmarkError || isCompareError;
  const errorMessage =
    benchmarkError?.message ?? compareError?.message ?? "Verifique se o servidor está rodando.";

  const canCompare = selectedCodes.length >= 2;

  const referenceYear = benchmark?.referenceYear ?? null;
  const generatedAt = benchmark?.generatedAt
    ? new Date(benchmark.generatedAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Summary metrics derived from compare result
  const myMunicipality = compare?.municipality ?? null;
  const myRankingEntry = benchmark?.ranking.find((r) => r.ibgeCode === ibgeCode);
  const totalInGroup = benchmark?.ranking.length ?? selectedCodes.length;

  const aboveAvgCount = compare?.comparison.filter((c) => c.aboveAverage === true).length ?? null;
  const belowAvgCount = compare?.comparison.filter((c) => c.aboveAverage === false).length ?? null;

  const myScore = myMunicipality?.globalScore ?? null;
  const groupAvg = benchmark?.globalAverage ?? null;
  const scoreDelta = myScore !== null && groupAvg !== null ? Math.round(myScore - groupAvg) : null;

  return (
    <AppShell ibgeCode={ibgeCode} onSelect={setIbgeCode} referenceYear={referenceYear}>
      <div className="space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comparativo Municipal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compare o desempenho ESG do seu município com outros de Santa Catarina.
          </p>
        </div>

        {/* Municipality selection */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Municípios para comparação</h2>
            <span className="text-xs text-muted-foreground">
              {selectedCodes.length}{" "}
              {selectedCodes.length === 1 ? "município selecionado" : "municípios selecionados"}
            </span>
          </div>
          <MunicipalityMultiSelect
            selected={selectedCodes}
            onChange={setSelectedCodes}
            maxItems={10}
          />
          {!canCompare && (
            <p className="text-xs text-warning">Selecione pelo menos 2 municípios para comparar.</p>
          )}
        </div>

        {/* Empty state */}
        {!canCompare && (
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
                d="M3 10h4v11H3zM10 3h4v18h-4zM17 7h4v14h-4z"
              />
            </svg>
            <p className="text-sm font-medium text-foreground">
              Selecione pelo menos 2 municípios para comparar
            </p>
            <p className="text-xs mt-1 text-muted-foreground/60">
              Use o campo acima para adicionar municípios ao comparativo.
            </p>
          </div>
        )}

        {/* Error state */}
        {canCompare && isError && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-danger">Erro ao carregar dados</p>
              <p className="text-xs text-danger mt-1">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void refetchBenchmark();
                void refetchCompare();
              }}
              className="px-3 py-1.5 text-sm font-medium text-danger bg-danger/10 rounded-md hover:bg-danger/20 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Summary cards */}
        {canCompare && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <>
                <SummaryCardSkeleton />
                <SummaryCardSkeleton />
                <SummaryCardSkeleton />
                <SummaryCardSkeleton />
              </>
            ) : (
              <>
                <SummaryCard
                  label="Posição no ranking"
                  value={myRankingEntry ? `${myRankingEntry.position}° de ${totalInGroup}` : "—"}
                  sub="dentro do grupo comparado"
                />
                <SummaryCard
                  label="Score vs média"
                  value={
                    myScore !== null
                      ? `${myScore.toFixed(0)} vs ${groupAvg !== null ? groupAvg.toFixed(0) : "—"}`
                      : "—"
                  }
                  sub={
                    scoreDelta !== null
                      ? `${scoreDelta > 0 ? "+" : ""}${scoreDelta} pontos em relação à média`
                      : undefined
                  }
                  highlight={
                    scoreDelta === null ? "neutral" : scoreDelta >= 0 ? "positive" : "negative"
                  }
                />
                <SummaryCard
                  label="ODS acima da média"
                  value={aboveAvgCount !== null ? String(aboveAvgCount) : "—"}
                  sub="objetivos com desempenho superior"
                  highlight={aboveAvgCount !== null && aboveAvgCount > 0 ? "positive" : "neutral"}
                />
                <SummaryCard
                  label="ODS abaixo da média"
                  value={belowAvgCount !== null ? String(belowAvgCount) : "—"}
                  sub="objetivos que precisam de atenção"
                  highlight={belowAvgCount !== null && belowAvgCount > 0 ? "negative" : "neutral"}
                />
              </>
            )}
          </div>
        )}

        {/* Ranking table */}
        {canCompare && (
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Ranking do grupo</h2>
            {isLoading ? (
              <RankingSkeleton />
            ) : benchmark ? (
              <RankingTable
                ranking={benchmark.ranking}
                highlightCode={ibgeCode}
                globalAverage={benchmark.globalAverage}
              />
            ) : null}
          </section>
        )}

        {/* Comparison: radar + ODS table */}
        {canCompare && (
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Análise por ODS</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Left: radar */}
              {isLoading ? (
                <RadarSkeleton />
              ) : compare ? (
                <ComparisonRadar
                  comparison={compare.comparison}
                  municipalityName={myMunicipality?.municipalityName ?? "Município"}
                />
              ) : (
                <RadarSkeleton />
              )}

              {/* Right: ODS comparison table */}
              {isLoading ? (
                <TableSkeleton />
              ) : compare ? (
                <OdsComparisonTable
                  comparison={compare.comparison}
                  averages={benchmark?.averages ?? []}
                />
              ) : (
                <TableSkeleton />
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        {referenceYear !== null && generatedAt !== null && (
          <div className="text-center text-xs text-muted-foreground/60 pt-4 border-t border-border">
            Dados de {referenceYear} — Gerado em {generatedAt}
          </div>
        )}
      </div>
    </AppShell>
  );
}
