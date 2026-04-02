import type { TseMunicipalData } from "../../../shared/types/agents/tse.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados TSE (eleições municipais) para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos pelo TSE:
 * - ODS 5 (Igualdade de gênero): 2 indicadores de representação política feminina
 *   - % vereadoras eleitas (pct_mulheres_eleitas)
 *   - % candidatas mulheres (pct_candidatas_mulheres)
 *
 * Scoring — referências:
 * - Meta ODS 5.5: participação plena e efetiva das mulheres (50%)
 * - Cotas legais Brasil: mínimo 30% de candidatas por partido (Lei 9.504/97)
 *
 * pct_mulheres_eleitas:
 * - >= 50% → 100 (paridade plena)
 * - >= 30% → 50-100 (interpolação linear)
 * - < 30%  → 0-50 (abaixo da meta de cotas)
 *
 * pct_candidatas_mulheres:
 * - >= 50% → 100 (paridade nas candidaturas)
 * - >= 33% → 50-100 (interpolação linear — acima da cota legal)
 * - < 33%  → 0-50 (abaixo do mínimo legal)
 */
export function mapToOdsIndicators(data: TseMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 5 — % vereadoras eleitas
  if (ind.pctMulheresEleitas !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 5,
      indicatorName: "pct_mulheres_eleitas",
      value: ind.pctMulheresEleitas,
      score: scoreMulheresEleitas(ind.pctMulheresEleitas),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 5 — % candidatas mulheres
  if (ind.pctCandidatasMulheres !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 5,
      indicatorName: "pct_candidatas_mulheres",
      value: ind.pctCandidatasMulheres,
      score: scoreCandidatasMulheres(ind.pctCandidatasMulheres),
      referenceYear,
      referenceDate,
    }));
  }

  return indicators;
}

// ─── Funções de normalização ──────────────────────────────────────────────────

/**
 * % vereadoras eleitas → score ODS 0-100.
 *
 * >= 50% → 100 (paridade plena)
 * >= 30% → 50-100 (interpolação linear)
 * < 30%  → 0-50 (interpolação linear)
 */
function scoreMulheresEleitas(pct: number): number {
  if (pct >= 50) return 100;
  if (pct >= 30) return 50 + ((pct - 30) / 20) * 50;
  return (pct / 30) * 50;
}

/**
 * % candidatas mulheres → score ODS 0-100.
 *
 * >= 50% → 100 (paridade nas candidaturas)
 * >= 33% → 50-100 (interpolação linear — acima da cota legal)
 * < 33%  → 0-50 (interpolação linear)
 */
function scoreCandidatasMulheres(pct: number): number {
  if (pct >= 50) return 100;
  if (pct >= 33) return 50 + ((pct - 33) / 17) * 50;
  return (pct / 33) * 50;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    source: "tse",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
