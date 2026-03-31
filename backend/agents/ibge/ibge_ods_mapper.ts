import type { IbgeMunicipalData } from "../../../shared/types/agents/ibge.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados brutos do IBGE para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos pelo IBGE:
 * - ODS 1 (Pobreza): % população com renda até 1/2 SM (invertido: menor = melhor)
 * - ODS 8 (Trabalho): taxa de ocupação + PIB per capita
 * - ODS 10 (Desigualdade): % baixa renda (invertido)
 * - ODS 11 (Cidades): receitas vs despesas (equilíbrio fiscal)
 */
export function mapToOdsIndicators(data: IbgeMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 1 — Erradicação da Pobreza (% baixa renda — invertido)
  if (ind.pctBaixaRenda !== null) {
    const score = scorePctBaixaRenda(ind.pctBaixaRenda);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 1,
      indicatorName: "pct_baixa_renda",
      value: ind.pctBaixaRenda,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 8 — Trabalho Decente (taxa de ocupação)
  if (ind.taxaOcupacao !== null) {
    const score = scoreTaxaOcupacao(ind.taxaOcupacao);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 8,
      indicatorName: "taxa_ocupacao",
      value: ind.taxaOcupacao,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 8 — PIB per capita
  if (ind.pibPerCapita !== null) {
    const score = scorePibPerCapita(ind.pibPerCapita);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 8,
      indicatorName: "pib_per_capita",
      value: ind.pibPerCapita,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 10 — Redução das Desigualdades (proxy: % baixa renda invertido)
  if (ind.pctBaixaRenda !== null) {
    const score = scorePctBaixaRenda(ind.pctBaixaRenda);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 10,
      indicatorName: "pct_baixa_renda_desigualdade",
      value: ind.pctBaixaRenda,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 11 — Cidades Sustentáveis (equilíbrio fiscal: receitas/despesas)
  if (
    ind.receitasOrcamentarias !== null &&
    ind.despesasOrcamentarias !== null &&
    ind.despesasOrcamentarias > 0
  ) {
    const ratio = ind.receitasOrcamentarias / ind.despesasOrcamentarias;
    const score = scoreEquilibrioFiscal(ratio);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 11,
      indicatorName: "equilibrio_fiscal",
      value: Math.round(ratio * 10000) / 10000,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  return indicators;
}

// ─── Funções de normalização (score 0-100) ──────────────────────────────────

/**
 * % população com rendimento até 1/2 SM → score 0-100 (invertido: menor % = melhor).
 * Benchmarks SC: 20% = excelente (score 100), 70% = péssimo (score 0).
 */
function scorePctBaixaRenda(pct: number): number {
  return clampScore(((70 - pct) / (70 - 20)) * 100);
}

/**
 * Taxa de ocupação → score 0-100 (maior = melhor).
 * Benchmarks SC: >= 60% = excelente (score 100), <= 30% = péssimo (score 0).
 */
function scoreTaxaOcupacao(taxa: number): number {
  return clampScore(((taxa - 30) / (60 - 30)) * 100);
}

/**
 * PIB per capita → score 0-100.
 * Benchmarks SC: mediana ~R$35k, top quartil ~R$55k.
 * >= R$60.000 = 100, <= R$10.000 = 0.
 */
function scorePibPerCapita(valor: number): number {
  return clampScore(((valor - 10000) / (60000 - 10000)) * 100);
}

/**
 * Equilíbrio fiscal (receitas/despesas) → score 0-100.
 * Ratio 1.0 = 80 (equilibrado). > 1.1 = 100. < 0.7 = 0.
 */
function scoreEquilibrioFiscal(ratio: number): number {
  if (ratio >= 1.1) return 100;
  if (ratio >= 1.0) return 80 + ((ratio - 1.0) / 0.1) * 20;
  if (ratio >= 0.7) return ((ratio - 0.7) / 0.3) * 80;
  return 0;
}

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}
