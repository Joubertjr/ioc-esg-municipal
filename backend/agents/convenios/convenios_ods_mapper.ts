import type { ConveniosMunicipalData } from "../../../shared/types/agents/convenios.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados de Convênios/Consórcios para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos:
 * - ODS 17 (Parcerias para implementação): proxy via convênios federais ativos,
 *   percentual do orçamento oriundo de convênios e participação em consórcios intermunicipais.
 *
 * Scoring:
 * - convenios_federais:
 *   >= 10 → 100 (forte articulação com União)
 *   >= 5  → 50-100 (interpolação linear)
 *   < 5   → 0-50  (interpolação linear)
 *
 * - pct_orcamento_convenios:
 *   >= 15% → 100 (alta dependência/captação federal)
 *   >= 5%  → 50-100 (interpolação linear)
 *   < 5%   → 0-50  (interpolação linear)
 *
 * - consorcios:
 *   >= 5 → 100 (ampla cooperação intermunicipal)
 *   >= 2 → 50-100 (interpolação linear)
 *   < 2  → 0-50  (interpolação linear)
 */
export function mapToOdsIndicators(data: ConveniosMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 17 — Convênios federais ativos
  if (ind.conveniosFederaisAtivos !== null) {
    indicators.push(
      makeIndicator({
        municipalityId: ibgeCode,
        odsNumber: 17,
        indicatorName: "convenios_federais",
        value: ind.conveniosFederaisAtivos,
        score: scoreConvenios(ind.conveniosFederaisAtivos),
        referenceYear,
        referenceDate,
      })
    );
  }

  // ODS 17 — Percentual do orçamento via convênios federais
  if (ind.pctOrcamentoConvenios !== null) {
    indicators.push(
      makeIndicator({
        municipalityId: ibgeCode,
        odsNumber: 17,
        indicatorName: "pct_orcamento_convenios",
        value: ind.pctOrcamentoConvenios,
        score: scorePctOrcamento(ind.pctOrcamentoConvenios),
        referenceYear,
        referenceDate,
      })
    );
  }

  // ODS 17 — Consórcios intermunicipais
  if (ind.consorciosIntermunicipais !== null) {
    indicators.push(
      makeIndicator({
        municipalityId: ibgeCode,
        odsNumber: 17,
        indicatorName: "consorcios_intermunicipais",
        value: ind.consorciosIntermunicipais,
        score: scoreConsorcios(ind.consorciosIntermunicipais),
        referenceYear,
        referenceDate,
      })
    );
  }

  return indicators;
}

// ─── Funções de normalização ──────────────────────────────────────────────────

/**
 * Número de convênios federais ativos → score 0-100.
 *
 * >= 10 → 100
 * >= 5  → 50-100 (interpolação linear)
 * < 5   → 0-50  (interpolação linear)
 */
function scoreConvenios(n: number): number {
  if (n >= 10) return 100;
  if (n >= 5) return 50 + ((n - 5) / 5) * 50;
  return (n / 5) * 50;
}

/**
 * Percentual do orçamento via convênios → score 0-100.
 *
 * >= 15% → 100
 * >= 5%  → 50-100 (interpolação linear)
 * < 5%   → 0-50  (interpolação linear)
 */
function scorePctOrcamento(pct: number): number {
  if (pct >= 15) return 100;
  if (pct >= 5) return 50 + ((pct - 5) / 10) * 50;
  return (pct / 5) * 50;
}

/**
 * Número de consórcios intermunicipais → score 0-100.
 *
 * >= 5 → 100
 * >= 2 → 50-100 (interpolação linear)
 * < 2  → 0-50  (interpolação linear)
 */
function scoreConsorcios(n: number): number {
  if (n >= 5) return 100;
  if (n >= 2) return 50 + ((n - 2) / 3) * 50;
  return (n / 2) * 50;
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
    source: "convenios",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
