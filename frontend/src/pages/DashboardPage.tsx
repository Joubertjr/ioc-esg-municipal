import { useState, useCallback, useEffect } from "react";
import { useOdsReport } from "../hooks/useOdsReport";
import { useStateBenchmark } from "../hooks/useStateBenchmark";
import { useTrend } from "../hooks/useTrend";
import { useRecommendations } from "../hooks/useRecommendations";
import { AppShell } from "../components/layout/AppShell";
import { KpiCards } from "../components/dashboard/KpiCards";
import { OdsDimensionGrid } from "../components/dashboard/OdsDimensionGrid";
import { DimensionRadarChart } from "../components/dashboard/DimensionRadarChart";
import { OdsDetailPanel } from "../components/ods/OdsDetailPanel";
import { OdsHistoryChart } from "../components/charts/OdsHistoryChart";
import { RecommendationPanel } from "../components/recommendations/RecommendationPanel";
import { useToast } from "../components/ui/Toast";
import type { OdsSummary } from "../types/api";

const DEFAULT_IBGE_CODE = "4205407"; // Florianopolis

export function DashboardPage() {
  const [ibgeCode, setIbgeCode] = useState(DEFAULT_IBGE_CODE);
  const [selectedOds, setSelectedOds] = useState<OdsSummary | null>(null);
  const { data: report, isLoading, isError, error, refetch } = useOdsReport(ibgeCode);
  const { data: benchmark, isLoading: isBenchmarkLoading } = useStateBenchmark(ibgeCode);
  const { data: trend, isLoading: isTrendLoading } = useTrend(ibgeCode);
  const { data: recommendations } = useRecommendations(ibgeCode);
  const { showToast } = useToast();

  useEffect(() => {
    if (isError && error) {
      showToast(error.message ?? "Erro ao carregar dados ODS.", "error");
    }
  }, [isError, error, showToast]);

  const handleCloseDrawer = useCallback(() => setSelectedOds(null), []);
  const handleOdsClick = useCallback((ods: OdsSummary) => setSelectedOds(ods), []);

  const worstOds = report?.ods
    .filter((o) => o.score !== null)
    .sort((a, b) => (a.score as number) - (b.score as number))[0];
  const worstRec = worstOds
    ? recommendations?.recommendations.find((r) => r.odsNumber === worstOds.odsNumber)
    : undefined;
  const worstOdsContext = worstOds
    ? `ODS ${worstOds.odsNumber} · ${worstOds.shortName}${worstRec?.ranking ? ` · ${worstRec.ranking}` : ""}`
    : undefined;

  return (
    <AppShell
      ibgeCode={ibgeCode}
      onSelect={setIbgeCode}
      referenceYear={report?.referenceYear ?? null}
    >
      {isError && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-destructive">Erro ao carregar dados ODS</p>
            <p className="text-xs text-destructive/80 mt-1">
              {error?.message ?? "Verifique se o servidor esta rodando."}
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

      <div className="space-y-8 pb-20 md:pb-0">
        {/* ── Row 1: KPI Cards — the "3-second" view ── */}
        <section>
          <KpiCards
            report={report}
            isLoading={isLoading}
            benchmark={benchmark}
            trend={trend}
            isBenchmarkLoading={isBenchmarkLoading}
            isTrendLoading={isTrendLoading}
            worstOds={worstOds}
            worstOdsContext={worstOdsContext}
          />
        </section>

        {/* ── Row 2: Dimension Grid + Radar side-by-side ── */}
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
          <OdsDimensionGrid
            ods={report?.ods ?? []}
            isLoading={isLoading}
            onOdsClick={handleOdsClick}
          />
          <div className="hidden xl:block xl:sticky xl:top-20 xl:self-start">
            <DimensionRadarChart ods={report?.ods ?? []} isLoading={isLoading} />
          </div>
        </section>

        {/* ── Row 3: Recommendations + History side-by-side ── */}
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <RecommendationPanel ibgeCode={ibgeCode} compact />
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <OdsHistoryChart ibgeCode={ibgeCode} />
          </div>
        </section>
      </div>

      <OdsDetailPanel ods={selectedOds} onClose={handleCloseDrawer} />
    </AppShell>
  );
}
