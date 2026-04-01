import type { PncpMunicipalData } from "../../../shared/types/agents/pncp.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados brutos do PNCP para indicadores ODS normalizados (score 0-100).
 *
 * ODS coberto pelo PNCP:
 * - ODS 16 (Paz, Justiça e Instituições Eficazes)
 *   Meta 16.6: Desenvolver instituições eficazes, responsáveis e transparentes
 *   Meta 16.7: Garantir tomada de decisões participativas, representativas e responsivas
 *
 * Quatro indicadores derivados do /api/consulta:
 * 1. total_contratacoes_publicadas — volume de publicações (proxy de transparência ativa)
 * 2. percentual_dispensas         — menor % dispensa = mais processo competitivo
 * 3. taxa_homologacao             — razão homologado/estimado (eficiência orçamentária)
 * 4. percentual_srp               — maior uso de SRP = eficiência em compras
 *
 * Benchmarks de referência (municípios de SC, PNCP 2024):
 * - Transparência: >= 50 publicações/ano → score 100
 * - Dispensas: <= 20% → score 100 | >= 40% → score 0
 * - Taxa homologação: >= 90% → score 100 | < 50% → score 0
 * - SRP: >= 30% → score 100 | 0% → score 0
 */
export function mapToOdsIndicators(data: PncpMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // Indicador 1: total de contratações publicadas (transparência ativa)
  {
    const score = scoreTotalContratacoes(ind.totalContratacoes);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 16,
      indicatorName: "total_contratacoes_publicadas",
      value: ind.totalContratacoes,
      score,
      status: getOdsStatus(score),
      source: "pncp",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // Indicador 2: percentual de dispensas (processo competitivo)
  if (ind.percentualDispensas !== null) {
    const score = scorePercentualDispensas(ind.percentualDispensas);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 16,
      indicatorName: "percentual_dispensas",
      value: ind.percentualDispensas,
      score,
      status: getOdsStatus(score),
      source: "pncp",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // Indicador 3: taxa de homologação (eficiência orçamentária)
  if (ind.taxaHomologacao !== null) {
    const score = scoreTaxaHomologacao(ind.taxaHomologacao);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 16,
      indicatorName: "taxa_homologacao",
      value: ind.taxaHomologacao,
      score,
      status: getOdsStatus(score),
      source: "pncp",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // Indicador 4: percentual de uso de SRP (eficiência em compras)
  if (ind.percentualSrp !== null) {
    const score = scorePercentualSrp(ind.percentualSrp);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 16,
      indicatorName: "percentual_srp",
      value: ind.percentualSrp,
      score,
      status: getOdsStatus(score),
      source: "pncp",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  return indicators;
}

// ─── Funções de normalização (score 0-100) ───────────────────────────────────

/**
 * Total de contratações publicadas → score 0-100 (mais publicações = mais transparência).
 *
 * Benchmarks SC (2024):
 *   0 publicações  → score 0   (ausência total = nenhuma transparência detectável)
 *   >= 50          → score 100 (boa atividade contratual pública)
 *
 * Interpolação linear entre 0 e 50.
 */
function scoreTotalContratacoes(total: number): number {
  const BENCHMARK = 50;
  if (total <= 0) return 0;
  if (total >= BENCHMARK) return 100;
  return clampScore((total / BENCHMARK) * 100);
}

/**
 * Percentual de dispensas (modalidade 7) → score 0-100 (menor % = melhor).
 *
 * Dispensa = contratação direta sem licitação competitiva.
 * Alta % de dispensas sugere menor competitividade e maior risco de irregularidade.
 *
 * Benchmarks:
 *   <= 20% dispensas → score 100 (maioria via processo competitivo)
 *   >= 40% dispensas → score 0   (excesso de contratação direta)
 *
 * Interpolação linear entre 20% e 40%.
 */
function scorePercentualDispensas(pct: number): number {
  const GOOD = 20;
  const BAD = 40;
  if (pct <= GOOD) return 100;
  if (pct >= BAD) return 0;
  return clampScore(((BAD - pct) / (BAD - GOOD)) * 100);
}

/**
 * Taxa de homologação (homologado/estimado) → score 0-100.
 *
 * Taxa próxima de 1.0 (100%) indica que os valores foram executados conforme
 * o planejamento orçamentário — sinal de boa governança financeira.
 * Taxa muito abaixo de 1.0 pode indicar cancelamentos ou superfaturamento inicial.
 *
 * Benchmarks:
 *   >= 0.9 (90%) → score 100
 *   < 0.5 (50%)  → score 0
 *
 * Interpolação linear entre 0.5 e 0.9.
 * Nota: taxa > 1.0 (aditivos) é mapeada para 70 (nota média — não é positivo nem negativo).
 */
function scoreTaxaHomologacao(taxa: number): number {
  if (taxa > 1.0) return 70; // aditivos de acréscimo — situação neutra
  const GOOD = 0.9;
  const BAD = 0.5;
  if (taxa >= GOOD) return 100;
  if (taxa < BAD) return 0;
  return clampScore(((taxa - BAD) / (GOOD - BAD)) * 100);
}

/**
 * Percentual de uso de SRP → score 0-100 (maior uso = melhor eficiência).
 *
 * SRP (Sistema de Registro de Preços) permite que outros órgãos adiram à ata,
 * reduzindo redundância de licitações e custos administrativos.
 *
 * Benchmarks:
 *   0%   → score 0
 *   >= 30% → score 100 (bom uso de instrumentos de eficiência)
 *
 * Interpolação linear entre 0% e 30%.
 */
function scorePercentualSrp(pct: number): number {
  const BENCHMARK = 30;
  if (pct <= 0) return 0;
  if (pct >= BENCHMARK) return 100;
  return clampScore((pct / BENCHMARK) * 100);
}

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}
