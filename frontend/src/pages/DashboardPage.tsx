import { useState, useCallback } from "react";
import { useOdsReport } from "../hooks/useOdsReport";
import { AppShell } from "../components/layout/AppShell";
import { GlobalScore } from "../components/ods/GlobalScore";
import { CoverageSummary } from "../components/ods/CoverageSummary";
import { OdsCard, OdsCardSkeleton } from "../components/ods/OdsCard";
import { OdsDetailDrawer } from "../components/ods/OdsDetailDrawer";
import { OdsRadarChart } from "../components/charts/OdsRadarChart";
import type { OdsSummary } from "../types/api";

const DEFAULT_IBGE_CODE = "4205407"; // Florianopolis

export function DashboardPage() {
  const [ibgeCode, setIbgeCode] = useState(DEFAULT_IBGE_CODE);
  const [selectedOds, setSelectedOds] = useState<OdsSummary | null>(null);
  const { data: report, isLoading, isError, error, refetch } = useOdsReport(ibgeCode);

  const handleCloseDrawer = useCallback(() => setSelectedOds(null), []);

  return (
    <AppShell
      ibgeCode={ibgeCode}
      onSelect={setIbgeCode}
      referenceYear={report?.referenceYear ?? null}
    >
      {isError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-800">
              Erro ao carregar dados ODS
            </p>
            <p className="text-xs text-red-600 mt-1">
              {error?.message ?? "Verifique se o servidor esta rodando."}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="space-y-8">
        {/* Top section: score + radar */}
        <section className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex flex-col items-center gap-4">
            <GlobalScore
              score={report?.globalScore ?? null}
              status={report?.globalStatus ?? null}
              isLoading={isLoading}
            />
            <CoverageSummary
              odsCount={
                report?.odsCount ?? {
                  total: 17,
                  withData: 0,
                  verde: 0,
                  amarelo: 0,
                  vermelho: 0,
                }
              }
              isLoading={isLoading}
            />
          </div>
          <div className="flex-1 min-w-0">
            <OdsRadarChart ods={report?.ods ?? []} isLoading={isLoading} />
          </div>
        </section>

        {/* ODS Grid */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Objetivos de Desenvolvimento Sustentavel
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {isLoading
              ? Array.from({ length: 17 }, (_, i) => (
                  <OdsCardSkeleton key={i} />
                ))
              : report?.ods.map((ods) => (
                  <OdsCard
                    key={ods.odsNumber}
                    ods={ods}
                    onClick={() => setSelectedOds(ods)}
                  />
                ))}
          </div>
        </section>
      </div>

      <OdsDetailDrawer ods={selectedOds} onClose={handleCloseDrawer} />
    </AppShell>
  );
}
