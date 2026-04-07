import { useState, useCallback, useEffect } from "react";
import { useOdsReport } from "../hooks/useOdsReport";
import { AppShell } from "../components/layout/AppShell";
import { GlobalScore } from "../components/ods/GlobalScore";
import { CoverageSummary } from "../components/ods/CoverageSummary";
import { OdsCard, OdsCardSkeleton } from "../components/ods/OdsCard";
import { OdsDetailDrawer } from "../components/ods/OdsDetailDrawer";
import { OdsRadarChart } from "../components/charts/OdsRadarChart";
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

  return (
    <AppShell
      ibgeCode={ibgeCode}
      onSelect={setIbgeCode}
      referenceYear={report?.referenceYear ?? null}
    >
      {isError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-800">Erro ao carregar dados ODS</p>
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
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Objetivos de Desenvolvimento Sustentável
            </h2>
            {report && (
              <p className="text-sm text-gray-500 mt-0.5">
                {report.odsCount.amarelo + report.odsCount.vermelho > 0 ? (
                  <>
                    <span className="text-amber-600 font-medium">
                      {report.odsCount.amarelo + report.odsCount.vermelho}{" "}
                      {report.odsCount.amarelo + report.odsCount.vermelho === 1
                        ? "ODS precisa"
                        : "ODS precisam"}{" "}
                      de atenção
                    </span>
                    {" — "}
                    <span className="text-green-600 font-medium">
                      {report.odsCount.verde} {report.odsCount.verde === 1 ? "está" : "estão"} no
                      caminho
                    </span>
                  </>
                ) : (
                  <span className="text-green-600 font-medium">
                    Todos os ODS estão no caminho certo
                  </span>
                )}
              </p>
            )}
          </div>

          {!isLoading && !report && !isError && (
            <div className="text-center py-16 text-gray-400">
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
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="text-sm">Selecione um município para ver os scores ODS</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {isLoading
              ? Array.from({ length: 17 }, (_, i) => <OdsCardSkeleton key={i} />)
              : report?.ods.map((ods) => (
                  <OdsCard key={ods.odsNumber} ods={ods} onClick={() => setSelectedOds(ods)} />
                ))}
          </div>

          {/* Legenda permanente de cores */}
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
            <span className="font-medium text-gray-600">Legenda:</span>
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
      </div>

      <OdsDetailDrawer ods={selectedOds} onClose={handleCloseDrawer} />
    </AppShell>
  );
}
