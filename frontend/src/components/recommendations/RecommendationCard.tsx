import { ODS_DEFINITIONS } from "../../../../shared/constants/ods";
import type { SmartRecommendation } from "../../types/api";

interface RecommendationCardProps {
  recommendation: SmartRecommendation;
}

const PRIORITY_STYLES: Record<SmartRecommendation["priority"], string> = {
  critica: "bg-red-100 text-red-800",
  alta: "bg-amber-100 text-amber-800",
  media: "bg-blue-100 text-blue-800",
};

const PRIORITY_LABELS: Record<SmartRecommendation["priority"], string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
};

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const {
    odsNumber,
    odsName,
    priority,
    currentScore,
    stateAverage,
    gap,
    ranking,
    actions,
    investmentArea,
    estimatedImpact,
  } = recommendation;

  const odsDefinition = ODS_DEFINITIONS.find((o) => o.number === odsNumber);
  const odsColor = odsDefinition?.color ?? "#6B7280";

  const deltaValue = gap !== null ? -gap : null;

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: odsColor }}
          >
            {odsNumber}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{odsName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{ranking}</p>
          </div>
        </div>
        <span
          className={`inline-block shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${PRIORITY_STYLES[priority]}`}
        >
          {PRIORITY_LABELS[priority]}
        </span>
      </div>

      {/* Scores */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Score atual</span>
          <span className="font-semibold text-foreground">{currentScore}/100</span>
        </div>

        {stateAverage !== null && (
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Média SC</span>
            <span className="font-semibold text-foreground">{stateAverage}/100</span>
          </div>
        )}

        {deltaValue !== null && (
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Diferença</span>
            <span
              className={`font-semibold ${deltaValue >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {deltaValue >= 0 ? "+" : ""}
              {deltaValue.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Impacto estimado */}
      <div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          Impacto: {estimatedImpact}
        </span>
      </div>

      {/* Ações recomendadas */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-1.5">Ações recomendadas</p>
        <ul className="space-y-1">
          {actions.map((action, index) => (
            <li key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
              {action}
            </li>
          ))}
        </ul>
      </div>

      {/* Área de investimento */}
      <div>
        <span className="inline-block text-xs bg-muted text-muted-foreground rounded-md px-2.5 py-1 font-medium">
          {investmentArea}
        </span>
      </div>
    </div>
  );
}
