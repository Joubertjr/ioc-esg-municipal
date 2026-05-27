import type { DataStaleness, OdsStatus } from "../../../shared/types/domain/ods.js";
import type { MunicipalOdsReport } from "../ods/ods_score_service.js";
import type { EsgReport } from "../reports/report_service.js";
import {
  ExecutiveReportSchema,
  type ExecutiveReport,
  type PrioritizedRecommendation,
  type SourceCitation,
} from "./schemas.js";

/** Mapeia relatório ESG determinístico → contrato MDO ExecutiveReport (sem LLM). */
export function mapEsgReportToExecutiveReport(
  esg: EsgReport,
  municipal: MunicipalOdsReport,
): ExecutiveReport {
  const odsScores = municipal.ods
    .filter((ods): ods is typeof ods & { score: number; status: OdsStatus } => {
      return ods.score !== null && ods.status !== null;
    })
    .map((ods) => ({
      odsNumber: ods.odsNumber,
      score: ods.score,
      status: ods.status,
      staleness: ods.dataFreshness.staleness as DataStaleness,
    }));

  const recommendations = buildPrioritizedRecommendations(esg);
  const citations = buildReportCitations(municipal);

  const draft = {
    municipalityId: esg.ibgeCode,
    generatedAt: esg.generatedAt,
    summary: esg.executiveSummary,
    odsScores,
    recommendations,
    citations,
    confidence: computeConfidence(municipal),
  };

  return ExecutiveReportSchema.parse(draft);
}

function buildPrioritizedRecommendations(esg: EsgReport): PrioritizedRecommendation[] {
  const fromEsg: PrioritizedRecommendation[] = esg.recommendations.slice(0, 10).map((rec) => ({
    title: `Investir em ${rec.investmentArea}`,
    targetOds: rec.odsNumber,
    rationale: rec.description.length >= 10 ? rec.description : `${rec.description}.`,
    estimatedImpact: `Elevar score de ${rec.currentScore} para ${rec.targetScore} no ODS ${rec.odsNumber}`,
    citations: [
      {
        sourceName: "IOC ESG Municipal",
        referenceYear: new Date(esg.generatedAt).getFullYear(),
        indicatorId: `ods-${rec.odsNumber}`,
      },
    ],
    priority: rec.priority,
  }));

  if (fromEsg.length > 0) {
    return fromEsg;
  }

  return [
    {
      title: "Manter monitoramento dos ODS prioritários",
      targetOds: 3,
      rationale:
        "Indicadores dentro do limiar aceitável; foco em manter coleta de APIs públicas e revisão periódica.",
      estimatedImpact: "Estabilidade dos scores municipais nos ODS 3, 4 e 6",
      citations: [
        {
          sourceName: "IOC ESG Municipal",
          referenceYear: new Date(esg.generatedAt).getFullYear(),
        },
      ],
      priority: "baixa",
    },
  ];
}

function buildReportCitations(municipal: MunicipalOdsReport): SourceCitation[] {
  const bySource = new Map<string, number>();

  for (const ods of municipal.ods) {
    for (const ind of ods.indicators) {
      const prev = bySource.get(ind.source);
      if (prev === undefined || ind.referenceYear > prev) {
        bySource.set(ind.source, ind.referenceYear);
      }
    }
  }

  if (bySource.size === 0) {
    return [
      {
        sourceName: "IOC ESG Municipal",
        referenceYear: municipal.referenceYear,
      },
    ];
  }

  return Array.from(bySource.entries()).map(([sourceName, referenceYear]) => ({
    sourceName,
    referenceYear,
  }));
}

function computeConfidence(municipal: MunicipalOdsReport): number {
  const { withData, total } = municipal.odsCount;
  const coverage = withData / total;
  const stalenessPenalty =
    municipal.dataFreshness.staleness === "critical"
      ? 0.15
      : municipal.dataFreshness.staleness === "stale"
        ? 0.08
        : 0;
  return (
    Math.round(Math.max(0.5, Math.min(0.95, coverage * 0.9 + 0.1 - stalenessPenalty)) * 100) / 100
  );
}
