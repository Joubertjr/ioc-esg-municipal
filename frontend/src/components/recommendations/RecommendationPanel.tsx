import { useNavigate } from "react-router-dom";
import { useRecommendations } from "../../hooks/useRecommendations";
import { useRecommendedScenario } from "../../hooks/useRecommendedScenario";
import { ODS_DEFINITIONS } from "../../../../shared/constants/ods";
import { RecommendationCard } from "./RecommendationCard";
import type { SmartRecommendation } from "../../types/api";

interface RecommendationPanelProps {
  ibgeCode: string;
}

const PRIORITY_ORDER: Record<SmartRecommendation["priority"], number> = {
  critica: 0,
  alta: 1,
  media: 2,
};

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-200 shrink-0" />
          <div>
            <div className="h-4 w-40 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-gray-200 rounded-full" />
      </div>
      <div className="flex gap-4 mb-4">
        <div className="h-10 w-20 bg-gray-100 rounded" />
        <div className="h-10 w-20 bg-gray-100 rounded" />
        <div className="h-10 w-20 bg-gray-100 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-4/5 bg-gray-100 rounded" />
        <div className="h-3 w-3/5 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

export function RecommendationPanel({ ibgeCode }: RecommendationPanelProps) {
  const { data: report, isLoading, isError, error } = useRecommendations(ibgeCode);
  const { fetchScenario, isPending } = useRecommendedScenario();
  const navigate = useNavigate();

  const handleSimulateScenario = async () => {
    try {
      const scenario = await fetchScenario(ibgeCode);
      navigate("/simulator", {
        state: {
          scenarioAllocation: scenario.allocation,
          ibgeCode: scenario.ibgeCode,
          allOdsGreen: scenario.allOdsGreen,
        },
      });
    } catch {
      // Error handled by mutation state
    }
  };

  const sortedRecommendations = report?.recommendations
    ? [...report.recommendations].sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Recomendações Priorizadas</h2>
          {report && <p className="text-sm text-gray-500 mt-0.5">{report.summary}</p>}
          {isLoading && <div className="h-4 w-72 bg-gray-200 rounded animate-pulse mt-1" />}
        </div>

        {report && (
          <div className="flex items-center gap-2 text-sm shrink-0">
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 font-semibold px-3 py-1 rounded-full">
              {report.criticalCount} críticas
            </span>
            <span className="text-gray-500">{report.totalRecommendations} total</span>
          </div>
        )}
      </div>

      {/* Estado de erro */}
      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">
            Não foi possível carregar as recomendações
          </p>
          <p className="text-xs text-red-600 mt-1">
            {error?.message ?? "Verifique se o servidor está rodando e tente novamente."}
          </p>
        </div>
      )}

      {/* Skeleton de carregamento */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {!isLoading && !isError && report && sortedRecommendations.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm font-medium text-gray-700">
            Nenhuma recomendação — todos os ODS estão acima da meta
          </p>
        </div>
      )}

      {/* Botão simular cenário */}
      {!isLoading && report && sortedRecommendations.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleSimulateScenario}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Calculando...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25Z"
                  />
                </svg>
                Simular cenário recomendado
              </>
            )}
          </button>
        </div>
      )}

      {/* Lista de recomendações */}
      {!isLoading && sortedRecommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedRecommendations.map((rec) => (
            <RecommendationCard key={rec.odsNumber} recommendation={rec} />
          ))}
        </div>
      )}

      {/* Pontos Fortes */}
      {!isLoading && report && report.strengths.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Pontos Fortes</h3>
          <div className="flex flex-wrap gap-2">
            {report.strengths.map((strength) => {
              const odsDefinition = ODS_DEFINITIONS.find((o) => o.number === strength.odsNumber);
              const odsColor = odsDefinition?.color ?? "#22C55E";

              return (
                <span
                  key={strength.odsNumber}
                  className="inline-flex items-center gap-2 text-xs font-medium bg-green-50 border border-green-200 text-green-800 rounded-full px-3 py-1.5"
                >
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: odsColor }}
                  >
                    {strength.odsNumber}
                  </span>
                  {strength.odsName}
                  <span className="font-semibold text-green-700">
                    {strength.score.toFixed(0)}/100
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
