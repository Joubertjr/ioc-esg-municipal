import type { DatasusMunicipalData } from "../../../shared/types/agents/datasus.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados DATASUS (Previne Brasil) para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos pelo DATASUS:
 * - ODS 3 (Saúde): 6 indicadores de atenção primária + média geral
 *   - Pré-natal, diabetes, hipertensão, crescimento infantil, câncer colo, saúde bucal
 *
 * Scoring: percentuais do Previne Brasil já são 0-100, mas aplicamos
 * escala não-linear para refletir benchmarks nacionais.
 */
export function mapToOdsIndicators(data: DatasusMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 3 — Pré-natal
  if (ind.prenatal !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 3,
      indicatorName: "previne_prenatal",
      value: ind.prenatal,
      score: scorePrevinePct(ind.prenatal),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 3 — Diabetes
  if (ind.diabetes !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 3,
      indicatorName: "previne_diabetes",
      value: ind.diabetes,
      score: scorePrevinePct(ind.diabetes),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 3 — Hipertensão
  if (ind.hipertensao !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 3,
      indicatorName: "previne_hipertensao",
      value: ind.hipertensao,
      score: scorePrevinePct(ind.hipertensao),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 3 — Crescimento infantil
  if (ind.crescimentoInfantil !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 3,
      indicatorName: "previne_crescimento_infantil",
      value: ind.crescimentoInfantil,
      score: scorePrevinePct(ind.crescimentoInfantil),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 3 — Câncer de colo uterino
  if (ind.cancerColoUterino !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 3,
      indicatorName: "previne_cancer_colo",
      value: ind.cancerColoUterino,
      score: scorePrevinePct(ind.cancerColoUterino),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 3 — Saúde bucal
  if (ind.saudeBucal !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 3,
      indicatorName: "previne_saude_bucal",
      value: ind.saudeBucal,
      score: scorePrevinePct(ind.saudeBucal),
      referenceYear,
      referenceDate,
    }));
  }

  return indicators;
}

// ─── Função de normalização ───────────────────────────────────────────────────

/**
 * Percentual Previne Brasil → score ODS 0-100.
 *
 * Os percentuais do Previne já representam desempenho (0-100), mas
 * benchmarks nacionais mostram que 60% é bom e 80%+ é excelente.
 * Escala não-linear para refletir isso:
 *
 * >= 80% = 100 (excelente)
 * >= 60% = 70-100 (bom)
 * >= 30% = 30-70 (regular)
 * < 30% = 0-30 (ruim)
 */
function scorePrevinePct(pct: number): number {
  if (pct >= 80) return 100;
  if (pct >= 60) return 70 + ((pct - 60) / 20) * 30;
  if (pct >= 30) return 30 + ((pct - 30) / 30) * 40;
  return (pct / 30) * 30;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}

interface IndicatorInput {
  municipalityId: string;
  odsNumber: number;
  indicatorName: string;
  value: number;
  score: number;
  referenceYear: number;
  referenceDate: Date;
}

function makeIndicator(input: IndicatorInput): OdsIndicator {
  const score = clampScore(input.score);
  return {
    id: "",
    municipalityId: input.municipalityId,
    odsNumber: input.odsNumber,
    indicatorName: input.indicatorName,
    value: input.value,
    score,
    status: getOdsStatus(score),
    source: "datasus",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
