import { useState, useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { AppShell } from "../components/layout/AppShell";
import { MunicipalityMultiSelect } from "../components/benchmark/MunicipalityMultiSelect";
import { RankingTable } from "../components/benchmark/RankingTable";
import { ComparisonRadar } from "../components/benchmark/ComparisonRadar";
import { OdsComparisonTable } from "../components/benchmark/OdsComparisonTable";
import { useBenchmark, useCompare } from "../hooks/useBenchmark";
import { usePeers } from "../hooks/usePeers";
import { getMunicipalityName } from "../lib/municipalityLookup";
import { useAuthContext } from "../contexts/AuthContext";

const DEFAULT_IBGE_CODE = "4205407"; // Florianópolis (fallback)
const DEFAULT_SELECTED_CODES = [
  "4205407", // Florianópolis
  "4209102", // Joinville
  "4204202", // Chapecó
  "4204608", // Criciúma
  "4218707", // São José
];

// ---- Skeleton loaders ----

function SummaryCardSkeleton() {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-5 flex flex-col gap-2">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-8 w-16 rounded" />
        <Skeleton className="h-3 w-32 rounded" />
      </CardContent>
    </Card>
  );
}

function RankingSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

function RadarSkeleton() {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-5 space-y-4">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-5 space-y-2">
        <Skeleton className="h-4 w-40 rounded mb-4" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </CardContent>
    </Card>
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

  const borderAccent =
    highlight === "positive"
      ? "border-l-success"
      : highlight === "negative"
        ? "border-l-danger"
        : "border-l-border";

  return (
    <Card className={`border-l-4 ${borderAccent} rounded-xl`}>
      <CardContent className="p-5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em] mb-1">
          {label}
        </p>
        <p className={`text-3xl font-extrabold tabular-nums ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ---- Main Page ----

export function BenchmarkPage() {
  const { currentUser } = useAuthContext();
  const [ibgeCode, setIbgeCode] = useState(currentUser?.ibgeCode ?? DEFAULT_IBGE_CODE);
  const [selectedCodes, setSelectedCodes] = useState<string[]>(DEFAULT_SELECTED_CODES);
  const [suggestedCodes, setSuggestedCodes] = useState<string[]>([]);

  useEffect(() => {
    if (currentUser?.ibgeCode) {
      setIbgeCode(currentUser.ibgeCode);
    }
  }, [currentUser?.ibgeCode]);

  const { data: peersData, isLoading: isPeersLoading } = usePeers(ibgeCode);

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
        <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Municípios para comparação</h2>
            <span className="text-xs text-muted-foreground">
              {selectedCodes.length}{" "}
              {selectedCodes.length === 1 ? "município selecionado" : "municípios selecionados"}
            </span>
          </div>

          {/* Suggest peers button */}
          <button
            type="button"
            disabled={isPeersLoading || !peersData?.peers?.length}
            onClick={() => {
              if (peersData?.peers) {
                const newCodes = [ibgeCode, ...peersData.peers];
                setSelectedCodes(newCodes);
                setSuggestedCodes(peersData.peers);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPeersLoading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Buscando similares...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Sugerir municípios similares
              </>
            )}
          </button>

          <MunicipalityMultiSelect
            selected={selectedCodes}
            onChange={(codes) => {
              setSelectedCodes(codes);
              setSuggestedCodes((prev) => prev.filter((c) => codes.includes(c)));
            }}
            maxItems={10}
            suggestedCodes={suggestedCodes}
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
            {isBenchmarkLoading || isCompareLoading ? (
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
            {isBenchmarkLoading ? (
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
              {isCompareLoading ? (
                <RadarSkeleton />
              ) : compare ? (
                <ComparisonRadar
                  comparison={compare.comparison}
                  municipalityName={
                    myMunicipality?.municipalityName ?? getMunicipalityName(ibgeCode)
                  }
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                  Dados de comparação indisponíveis
                </div>
              )}

              {/* Right: ODS comparison table */}
              {isCompareLoading ? (
                <TableSkeleton />
              ) : compare ? (
                <OdsComparisonTable
                  comparison={compare.comparison}
                  averages={benchmark?.averages ?? []}
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                  Dados de comparação indisponíveis
                </div>
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
