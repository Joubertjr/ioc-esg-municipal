import { useState, useCallback, useEffect } from "react";
import { useOdsReport } from "../hooks/useOdsReport";
import { AppShell } from "../components/layout/AppShell";
import { KpiCards } from "../components/dashboard/KpiCards";
import { OdsDimensionGrid } from "../components/dashboard/OdsDimensionGrid";
import { DimensionRadarChart } from "../components/dashboard/DimensionRadarChart";
import { OdsCard, OdsCardSkeleton } from "../components/ods/OdsCard";
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
  const { showToast } = useToast();

  useEffect(() => {
    if (isError && error) {
      showToast(error.message ?? "Erro ao carregar dados ODS.", "error");
    }
  }, [isError, error, showToast]);

  const handleCloseDrawer = useCallback(() => setSelectedOds(null), []);
  const handleOdsClick = useCallback((ods: OdsSummary) => setSelectedOds(ods), []);

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

      <div className="space-y-6">
        {/* ── Row 1: KPI Cards — the "3-second" view ── */}
        <section>
          <KpiCards report={report} isLoading={isLoading} />
        </section>

        {/* ── Row 2: Dimension Grid + Radar side-by-side ── */}
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
          <OdsDimensionGrid
            ods={report?.ods ?? []}
            isLoading={isLoading}
            onOdsClick={handleOdsClick}
          />
          <div className="xl:sticky xl:top-20 xl:self-start">
            <DimensionRadarChart ods={report?.ods ?? []} isLoading={isLoading} />
          </div>
        </section>

        {/* ── Row 3: Historical ESG Score ── */}
        <section className="bg-card rounded-xl shadow-sm border border-border p-6">
          <OdsHistoryChart ibgeCode={ibgeCode} />
        </section>

        {/* ── Row 4: All 17 ODS Cards ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-heading-3 font-semibold text-foreground">Todos os ODS</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Clique em um ODS para ver detalhes e indicadores
            </p>
          </div>

          {!isLoading && !report && !isError && (
            <div className="text-center py-16 text-muted-foreground/60">
              <p className="text-sm">Selecione um município para ver os scores ODS</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {isLoading
              ? Array.from({ length: 17 }, (_, i) => <OdsCardSkeleton key={i} />)
              : report?.ods.map((ods) => (
                  <OdsCard key={ods.odsNumber} ods={ods} onClick={() => handleOdsClick(ods)} />
                ))}
          </div>

          {/* Status legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3">
            <span className="font-medium">Legenda:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
              <span>Verde — score ≥ 70</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              <span>Amarelo — score 40–69</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              <span>Vermelho — score &lt; 40</span>
            </span>
          </div>
        </section>

        {/* ── Row 5: Smart Recommendations ── */}
        <section className="bg-card rounded-xl shadow-sm border border-border p-6">
          <RecommendationPanel ibgeCode={ibgeCode} />
        </section>
      </div>

      <OdsDetailPanel ods={selectedOds} onClose={handleCloseDrawer} />
    </AppShell>
  );
}
