import { useNavigate } from "react-router-dom";
import { useRecommendations } from "../../hooks/useRecommendations";
import { useRecommendedScenario } from "../../hooks/useRecommendedScenario";
import { ODS_DEFINITIONS } from "../../../../shared/constants/ods";
import { RecommendationCard } from "./RecommendationCard";
import type { SmartRecommendation } from "../../types/api";

interface RecommendationPanelProps {
  ibgeCode: string;
  compact?: boolean;
}

const PRIORITY_ORDER: Record<SmartRecommendation["priority"], number> = {
  critica: 0,
  alta: 1,
  media: 2,
};

function SkeletonCard() {
  return (
    <div className="bg-card border-0 rounded-xl shadow-card p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted shrink-0" />
          <div>
            <div className="h-4 w-40 bg-muted rounded mb-1" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-muted rounded-full" />
      </div>
      <div className="flex gap-4 mb-4">
        <div className="h-10 w-20 bg-muted rounded" />
        <div className="h-10 w-20 bg-muted rounded" />
        <div className="h-10 w-20 bg-muted rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-4/5 bg-muted rounded" />
        <div className="h-3 w-3/5 bg-muted rounded" />
      </div>
    </div>
  );
}

export function RecommendationPanel({ ibgeCode, compact = false }: RecommendationPanelProps) {
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

  const displayedRecommendations = compact
    ? sortedRecommendations.slice(0, 1)
    : sortedRecommendations;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recomendações Priorizadas</h2>
          {report && <p className="text-sm text-muted-foreground mt-0.5">{report.summary}</p>}
          {isLoading && <div className="h-4 w-72 bg-muted rounded animate-pulse mt-1" />}
        </div>

        {report && (
          <div className="flex items-center gap-2 text-sm shrink-0">
            <span className="inline-flex items-center gap-1 bg-danger/10 text-danger font-semibold px-3 py-1 rounded-full">
              {report.criticalCount} críticas
            </span>
            <span className="text-muted-foreground">{report.totalRecommendations} total</span>
          </div>
        )}
      </div>

      {/* Estado de erro — nunca mostrar mensagem técnica ao prefeito */}
      {isError && (
        <div className="text-center py-12 text-muted-foreground">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p className="text-sm font-medium text-foreground">
            Recomendações serão geradas após a coleta de dados
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Os dados do município precisam ser coletados para gerar recomendações personalizadas.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
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
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
              />
            </svg>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Skeleton de carregamento */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: compact ? 1 : 3 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {!isLoading && !isError && report && sortedRecommendations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-success"
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
          <p className="text-sm font-medium text-foreground">
            Nenhuma recomendação — todos os ODS estão acima da meta
          </p>
        </div>
      )}

      {/* Botão simular cenário */}
      {!isLoading && report && displayedRecommendations.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleSimulateScenario}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      {!isLoading && displayedRecommendations.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayedRecommendations.map((rec) => (
              <RecommendationCard key={rec.odsNumber} recommendation={rec} />
            ))}
          </div>
          {compact && sortedRecommendations.length > 1 && (
            <p className="text-sm text-primary mt-3">
              + {sortedRecommendations.length - 1} outras recomendações disponíveis
            </p>
          )}
        </>
      )}

      {/* Pontos Fortes */}
      {!isLoading && report && report.strengths.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Pontos Fortes</h3>
          <div className="flex flex-wrap gap-2">
            {report.strengths.map((strength) => {
              const odsDefinition = ODS_DEFINITIONS.find((o) => o.number === strength.odsNumber);
              const odsColor = odsDefinition?.color ?? "#22C55E";

              return (
                <span
                  key={strength.odsNumber}
                  className="inline-flex items-center gap-2 text-xs font-medium bg-success/10 border border-success/20 text-success rounded-full px-3 py-1.5"
                >
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: odsColor }}
                  >
                    {strength.odsNumber}
                  </span>
                  {strength.odsName}
                  <span className="font-semibold text-success">
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
