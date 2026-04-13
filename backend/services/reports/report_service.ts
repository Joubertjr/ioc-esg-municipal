import {
  calculateMunicipalOds,
  type MunicipalOdsReport,
  type OdsSummary,
} from "../ods/ods_score_service.js";
import { readOdsReportFromDatabase } from "../ingestion/ods_score_reader.js";
import { logger } from "../../utils/logger.js";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EsgReport {
  ibgeCode: string;
  municipalityName: string | null;
  generatedAt: string;
  referenceYear: number;
  executiveSummary: string;
  globalScore: number | null;
  globalStatus: string | null;
  coverage: { total: number; withData: number; percentage: number };
  statusBreakdown: { verde: number; amarelo: number; vermelho: number };
  odsDetails: OdsReportDetail[];
  recommendations: Recommendation[];
  strengths: string[];
  weaknesses: string[];
}

export interface OdsReportDetail {
  odsNumber: number;
  name: string;
  shortName: string;
  color: string;
  score: number | null;
  status: string | null;
  indicatorCount: number;
  sources: string[];
  indicators: Array<{
    name: string;
    value: number | null;
    score: number | null;
    source: string;
  }>;
}

export interface Recommendation {
  odsNumber: number;
  odsName: string;
  currentScore: number;
  targetScore: number;
  priority: "alta" | "media" | "baixa";
  investmentArea: string;
  description: string;
}

// ─── Mapeamento ODS → área de investimento recomendada ───────────────────────

const ODS_INVESTMENT_AREA: Record<number, string> = {
  1: "assistência social",
  2: "agricultura e segurança alimentar",
  3: "saúde",
  4: "educação",
  5: "políticas de gênero",
  6: "saneamento básico",
  7: "energia",
  8: "desenvolvimento econômico",
  9: "infraestrutura e tecnologia",
  10: "políticas de inclusão",
  11: "urbanismo e habitação",
  12: "gestão de resíduos",
  13: "meio ambiente e clima",
  14: "recursos hídricos",
  15: "preservação ambiental",
  16: "governança e transparência",
  17: "parcerias institucionais",
};

// ─── Serviço ──────────────────────────────────────────────────────────────────

export async function generateEsgReport(ibgeCode: string): Promise<EsgReport | null> {
  logger.info("[reports] gerando relatório ESG", { ibgeCode });

  const report =
    (await readOdsReportFromDatabase(ibgeCode)) ?? (await calculateMunicipalOds(ibgeCode));
  if (!report) {
    logger.warn("[reports] sem dados para relatório", { ibgeCode });
    return null;
  }

  const odsDetails = buildOdsDetails(report);
  const recommendations = buildRecommendations(report);
  const strengths = identifyStrengths(report);
  const weaknesses = identifyWeaknesses(report);
  const executiveSummary = buildExecutiveSummary(report, strengths, weaknesses);

  const withData = report.odsCount.withData;

  return {
    ibgeCode,
    municipalityName: report.municipalityName,
    generatedAt: new Date().toISOString(),
    referenceYear: report.referenceYear,
    executiveSummary,
    globalScore: report.globalScore,
    globalStatus: report.globalStatus,
    coverage: {
      total: 17,
      withData,
      percentage: Math.round((withData / 17) * 100),
    },
    statusBreakdown: {
      verde: report.odsCount.verde,
      amarelo: report.odsCount.amarelo,
      vermelho: report.odsCount.vermelho,
    },
    odsDetails,
    recommendations,
    strengths,
    weaknesses,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildOdsDetails(report: MunicipalOdsReport): OdsReportDetail[] {
  return report.ods.map((ods) => ({
    odsNumber: ods.odsNumber,
    name: ods.name,
    shortName: ods.shortName,
    color: ods.color,
    score: ods.score,
    status: ods.status,
    indicatorCount: ods.indicators.length,
    sources: ods.sources,
    indicators: ods.indicators.map((ind) => ({
      name: ind.indicatorName,
      value: ind.value,
      score: ind.score,
      source: ind.source,
    })),
  }));
}

function buildRecommendations(report: MunicipalOdsReport): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const ods of report.ods) {
    if (ods.score === null) continue;
    if (ods.score >= 70) continue;

    const priority = ods.score < 40 ? "alta" : "media";
    const area = ODS_INVESTMENT_AREA[ods.odsNumber] ?? "desenvolvimento geral";
    const gap = 70 - ods.score;

    recs.push({
      odsNumber: ods.odsNumber,
      odsName: ods.name,
      currentScore: ods.score,
      targetScore: 70,
      priority,
      investmentArea: area,
      description: `Investir em ${area} para elevar o score de ${ods.score} para 70 (+${gap} pontos). ${priority === "alta" ? "Prioridade alta — score abaixo de 40." : "Prioridade média — score entre 40 e 69."}`,
    });
  }

  // Ordenar por prioridade (alta primeiro) e depois por score (menor primeiro)
  return recs.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "alta" ? -1 : 1;
    return a.currentScore - b.currentScore;
  });
}

function identifyStrengths(report: MunicipalOdsReport): string[] {
  return report.ods
    .filter((ods): ods is OdsSummary & { score: number } => ods.score !== null && ods.score >= 70)
    .sort((a, b) => b.score - a.score)
    .map((ods) => `${ods.shortName} (ODS ${ods.odsNumber}): score ${ods.score}/100`);
}

function identifyWeaknesses(report: MunicipalOdsReport): string[] {
  return report.ods
    .filter((ods): ods is OdsSummary & { score: number } => ods.score !== null && ods.score < 40)
    .sort((a, b) => a.score - b.score)
    .map(
      (ods) => `${ods.shortName} (ODS ${ods.odsNumber}): score ${ods.score}/100 — requer atenção`,
    );
}

function buildExecutiveSummary(
  report: MunicipalOdsReport,
  strengths: string[],
  weaknesses: string[],
): string {
  const { globalScore, globalStatus, odsCount } = report;

  if (globalScore === null) {
    return "Dados insuficientes para gerar resumo executivo.";
  }

  const statusText =
    globalStatus === "verde"
      ? "desempenho satisfatório"
      : globalStatus === "amarelo"
        ? "desempenho moderado, com oportunidades de melhoria"
        : "desempenho crítico, requerendo ação imediata";

  const parts: string[] = [
    `O município apresenta score ESG global de ${globalScore}/100, indicando ${statusText}.`,
    `Dos 17 ODS avaliados, ${odsCount.withData} possuem dados disponíveis: ${odsCount.verde} em nível verde, ${odsCount.amarelo} em amarelo e ${odsCount.vermelho} em vermelho.`,
  ];

  if (strengths.length > 0) {
    parts.push(`Pontos fortes: ${strengths.slice(0, 3).join("; ")}.`);
  }

  if (weaknesses.length > 0) {
    parts.push(`Áreas críticas: ${weaknesses.slice(0, 3).join("; ")}.`);
  }

  return parts.join(" ");
}
