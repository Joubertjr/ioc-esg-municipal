import type { SiconfiMunicipalData } from "../../../shared/types/agents/siconfi.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados SICONFI para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos pelo SICONFI:
 * - ODS 3 (Saúde): % despesa com saúde sobre despesa total (mín constitucional 15%)
 * - ODS 4 (Educação): % despesa com educação sobre despesa total (mín constitucional 25%)
 * - ODS 11 (Cidades): % despesa com urbanismo sobre despesa total
 * - ODS 16 (Instituições): equilíbrio fiscal (receita/despesa) + dependência de transferências
 * - ODS 17 (Parcerias): diversificação de receitas (FPM/receita total)
 */
export function mapToOdsIndicators(data: SiconfiMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 3 — Saúde (% da despesa total destinada à saúde)
  if (ind.despesaSaude !== null && ind.despesaTotal !== null && ind.despesaTotal > 0) {
    const pctSaude = (ind.despesaSaude / ind.despesaTotal) * 100;
    const score = scorePctSaude(pctSaude);
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 3,
      indicatorName: "pct_despesa_saude",
      value: round(pctSaude),
      score,
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 4 — Educação (% da despesa total destinada à educação)
  if (ind.despesaEducacao !== null && ind.despesaTotal !== null && ind.despesaTotal > 0) {
    const pctEducacao = (ind.despesaEducacao / ind.despesaTotal) * 100;
    const score = scorePctEducacao(pctEducacao);
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 4,
      indicatorName: "pct_despesa_educacao",
      value: round(pctEducacao),
      score,
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 11 — Cidades Sustentáveis (% despesa com urbanismo)
  if (ind.despesaUrbanismo !== null && ind.despesaTotal !== null && ind.despesaTotal > 0) {
    const pctUrbanismo = (ind.despesaUrbanismo / ind.despesaTotal) * 100;
    const score = scorePctUrbanismo(pctUrbanismo);
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 11,
      indicatorName: "pct_despesa_urbanismo",
      value: round(pctUrbanismo),
      score,
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 16 — Instituições Fortes (equilíbrio fiscal)
  if (ind.receitaTotal !== null && ind.despesaTotal !== null && ind.despesaTotal > 0) {
    const ratio = ind.receitaTotal / ind.despesaTotal;
    const score = scoreEquilibrioFiscal(ratio);
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 16,
      indicatorName: "equilibrio_fiscal_siconfi",
      value: round(ratio),
      score,
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 17 — Parcerias (autonomia fiscal: menor dependência de FPM = melhor)
  if (ind.fpmAnual !== null && ind.receitaTotal !== null && ind.receitaTotal > 0) {
    const dependenciaFpm = (ind.fpmAnual / ind.receitaTotal) * 100;
    const score = scoreDependenciaFpm(dependenciaFpm);
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 17,
      indicatorName: "dependencia_fpm",
      value: round(dependenciaFpm),
      score,
      referenceYear,
      referenceDate,
    }));
  }

  return indicators;
}

// ─── Funções de normalização (score 0-100) ──────────────────────────────────

/**
 * % despesa com saúde → score 0-100.
 * Mínimo constitucional: 15% das receitas. Benchmarks SC:
 * >= 25% = excelente (100), 15% = adequado (60), < 10% = péssimo (0).
 */
function scorePctSaude(pct: number): number {
  if (pct >= 25) return 100;
  if (pct >= 15) return 60 + ((pct - 15) / 10) * 40;
  if (pct >= 10) return ((pct - 10) / 5) * 60;
  return 0;
}

/**
 * % despesa com educação → score 0-100.
 * Mínimo constitucional: 25% das receitas de impostos. Benchmarks SC:
 * >= 35% = excelente (100), 25% = adequado (70), < 15% = péssimo (0).
 */
function scorePctEducacao(pct: number): number {
  if (pct >= 35) return 100;
  if (pct >= 25) return 70 + ((pct - 25) / 10) * 30;
  if (pct >= 15) return ((pct - 15) / 10) * 70;
  return 0;
}

/**
 * % despesa com urbanismo → score 0-100.
 * >= 20% = excelente (100), 10% = bom (60), < 3% = péssimo (0).
 */
function scorePctUrbanismo(pct: number): number {
  if (pct >= 20) return 100;
  if (pct >= 10) return 60 + ((pct - 10) / 10) * 40;
  if (pct >= 3) return ((pct - 3) / 7) * 60;
  return 0;
}

/**
 * Equilíbrio fiscal (receita/despesa) → score 0-100.
 * Ratio >= 1.1 = 100. 1.0 = 80. < 0.7 = 0.
 */
function scoreEquilibrioFiscal(ratio: number): number {
  if (ratio >= 1.1) return 100;
  if (ratio >= 1.0) return 80 + ((ratio - 1.0) / 0.1) * 20;
  if (ratio >= 0.7) return ((ratio - 0.7) / 0.3) * 80;
  return 0;
}

/**
 * Dependência de FPM → score 0-100 (invertido: menor dependência = melhor).
 * <= 5% = excelente (100), 30% = médio (50), >= 60% = péssimo (0).
 */
function scoreDependenciaFpm(pct: number): number {
  if (pct <= 5) return 100;
  if (pct <= 30) return 50 + ((30 - pct) / 25) * 50;
  if (pct <= 60) return ((60 - pct) / 30) * 50;
  return 0;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
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
    source: "siconfi",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
