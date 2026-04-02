import type { AnaMunicipalData } from "../../../shared/types/agents/ana.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados ANA (qualidade da água e mata ciliar) para indicadores ODS normalizados (0-100).
 *
 * ODS cobertos pela ANA:
 * - ODS 14 (Vida na água): 2 indicadores de qualidade hídrica
 *   - IQA dos rios (iqa_rios)
 *   - % cobertura de mata ciliar preservada (mata_ciliar)
 *
 * Scoring — referências:
 * - IQA: escala CETESB (0-100). >= 80 = Ótimo, 52-79 = Bom, 37-51 = Regular, 20-36 = Ruim
 * - Mata ciliar: Código Florestal (Lei 12.651/2012) — faixa obrigatória por tipo de curso d'água
 *
 * iqa_rios:
 * - >= 80 → 100 (qualidade ótima)
 * - >= 50 → 50-100 (interpolação linear)
 * - < 50  → 0-50 (qualidade regular/ruim)
 *
 * mata_ciliar:
 * - >= 80% → 100 (excelente preservação)
 * - >= 40% → 50-100 (interpolação linear)
 * - < 40%  → 0-50 (abaixo do aceitável)
 */
export function mapToOdsIndicators(data: AnaMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 14 — IQA dos rios
  if (ind.iqaRios !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 14,
      indicatorName: "iqa_rios",
      value: ind.iqaRios,
      score: scoreIqaRios(ind.iqaRios),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 14 — % cobertura de mata ciliar
  if (ind.mataCiliarPct !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 14,
      indicatorName: "mata_ciliar",
      value: ind.mataCiliarPct,
      score: scoreMataCiliar(ind.mataCiliarPct),
      referenceYear,
      referenceDate,
    }));
  }

  return indicators;
}

// ─── Funções de normalização ──────────────────────────────────────────────────

/**
 * IQA dos rios (0-100) → score ODS 0-100.
 *
 * >= 80 → 100 (qualidade ótima — CETESB)
 * >= 50 → 50-100 (interpolação linear)
 * < 50  → 0-50 (interpolação linear)
 */
function scoreIqaRios(iqa: number): number {
  if (iqa >= 80) return 100;
  if (iqa >= 50) return 50 + ((iqa - 50) / 30) * 50;
  return (iqa / 50) * 50;
}

/**
 * % cobertura mata ciliar → score ODS 0-100.
 *
 * >= 80% → 100 (excelente preservação)
 * >= 40% → 50-100 (interpolação linear)
 * < 40%  → 0-50 (interpolação linear)
 */
function scoreMataCiliar(pct: number): number {
  if (pct >= 80) return 100;
  if (pct >= 40) return 50 + ((pct - 40) / 40) * 50;
  return (pct / 40) * 50;
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
    source: "ana",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
