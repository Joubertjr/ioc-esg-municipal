import type { SisvanMunicipalData } from "../../../shared/types/agents/sisvan.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados SISVAN (Vigilância Alimentar e Nutricional) para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos pelo SISVAN:
 * - ODS 2 (Fome Zero e Agricultura Sustentável): 3 indicadores de segurança alimentar infantil
 *   - Cobertura de acompanhamento (% crianças acompanhadas — maior = melhor)
 *   - Déficit nutricional (% crianças com déficit — INVERTIDO, menor = melhor)
 *   - Sobrepeso infantil (% crianças com sobrepeso — INVERTIDO, menor = melhor)
 *
 * Fonte: SISVAN/DAB/MS. Dados municipais anuais, referência 2023.
 */
export function mapToOdsIndicators(data: SisvanMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 2 — Cobertura de acompanhamento (maior = melhor)
  indicators.push(makeIndicator({
    municipalityId: ibgeCode,
    odsNumber: 2,
    indicatorName: "sisvan_cobertura_acompanhamento",
    value: ind.cobertura_acompanhamento,
    score: scoreCoberturaAcompanhamento(ind.cobertura_acompanhamento),
    referenceYear,
    referenceDate,
  }));

  // ODS 2 — Déficit nutricional (INVERTIDO — menor = melhor)
  indicators.push(makeIndicator({
    municipalityId: ibgeCode,
    odsNumber: 2,
    indicatorName: "sisvan_deficit_nutricional",
    value: ind.deficit_nutricional,
    score: scoreDeficitNutricional(ind.deficit_nutricional),
    referenceYear,
    referenceDate,
  }));

  // ODS 2 — Sobrepeso infantil (INVERTIDO — menor = melhor)
  indicators.push(makeIndicator({
    municipalityId: ibgeCode,
    odsNumber: 2,
    indicatorName: "sisvan_sobrepeso_infantil",
    value: ind.sobrepeso_infantil,
    score: scoreSobrepesoInfantil(ind.sobrepeso_infantil),
    referenceYear,
    referenceDate,
  }));

  return indicators;
}

// ─── Funções de scoring ───────────────────────────────────────────────────────

/**
 * Cobertura de acompanhamento SISVAN (% crianças acompanhadas) → score 0-100 (maior = melhor).
 * >= 85% → 100 (meta ODS recomendada)
 * >= 60% → 50-100 (interpolação linear)
 * < 60%  → 0-50 (interpolação linear)
 */
function scoreCoberturaAcompanhamento(pct: number): number {
  if (pct >= 85) return 100;
  if (pct >= 60) return 50 + ((pct - 60) / 25) * 50;
  return (pct / 60) * 50;
}

/**
 * Déficit nutricional (% crianças com déficit) → score 0-100 (INVERTIDO — menor = melhor).
 * <= 5%  → 100 (abaixo da meta OMS)
 * <= 10% → 50-100 (interpolação linear)
 * > 10%  → 0-50 (interpolação linear, clamped a 0 acima de 20%)
 */
function scoreDeficitNutricional(pct: number): number {
  if (pct <= 5) return 100;
  if (pct <= 10) return 50 + ((10 - pct) / 5) * 50;
  return Math.max(0, ((20 - pct) / 10) * 50);
}

/**
 * Sobrepeso infantil (% crianças com sobrepeso) → score 0-100 (INVERTIDO — menor = melhor).
 * <= 10% → 100 (abaixo da média nacional)
 * <= 20% → 50-100 (interpolação linear)
 * > 20%  → 0-50 (interpolação linear, clamped a 0 acima de 40%)
 */
function scoreSobrepesoInfantil(pct: number): number {
  if (pct <= 10) return 100;
  if (pct <= 20) return 50 + ((20 - pct) / 10) * 50;
  return Math.max(0, ((40 - pct) / 20) * 50);
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
    source: "sisvan",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
