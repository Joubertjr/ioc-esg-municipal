import type { IepsMunicipalData } from "../../../shared/types/agents/ieps.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados IEPS Data para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos pelo IEPS:
 * - ODS 3 (Saúde e Bem-Estar): 6 indicadores complementares ao DATASUS
 *   - Mortalidade infantil (3.2), Cobertura ESF (3.8), Vacinação (3.b),
 *     Internações CSAP (qualidade APS), Gasto saúde per capita (3.c),
 *     Pré-natal adequado (3.1)
 *
 * Scoring baseado em benchmarks nacionais e metas do Ministério da Saúde.
 * Indicadores invertidos (mortalidadeInfantil, internacoesCsap): menor = melhor.
 */
export function mapToOdsIndicators(data: IepsMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 3.2 — Mortalidade infantil (invertido: menor = melhor)
  if (ind.mortalidadeInfantil !== null) {
    indicators.push(
      makeIndicator({
        municipalityId: ibgeCode,
        odsNumber: 3,
        indicatorName: "ieps_mortalidade_infantil",
        value: ind.mortalidadeInfantil,
        score: scoreMortalidadeInfantil(ind.mortalidadeInfantil),
        referenceYear,
        referenceDate,
      }),
    );
  }

  // ODS 3.8 — Cobertura ESF (maior = melhor)
  if (ind.coberturaEsf !== null) {
    indicators.push(
      makeIndicator({
        municipalityId: ibgeCode,
        odsNumber: 3,
        indicatorName: "ieps_cobertura_esf",
        value: ind.coberturaEsf,
        score: scoreCoberturaPercentual(ind.coberturaEsf),
        referenceYear,
        referenceDate,
      }),
    );
  }

  // ODS 3.b — Cobertura vacinal (maior = melhor)
  if (ind.coberturaVacinal !== null) {
    indicators.push(
      makeIndicator({
        municipalityId: ibgeCode,
        odsNumber: 3,
        indicatorName: "ieps_cobertura_vacinal",
        value: ind.coberturaVacinal,
        score: scoreCoberturaVacinal(ind.coberturaVacinal),
        referenceYear,
        referenceDate,
      }),
    );
  }

  // ODS 3 — Internações CSAP (invertido: menor = melhor)
  if (ind.internacoesCsap !== null) {
    indicators.push(
      makeIndicator({
        municipalityId: ibgeCode,
        odsNumber: 3,
        indicatorName: "ieps_internacoes_csap",
        value: ind.internacoesCsap,
        score: scoreInternacoesCsap(ind.internacoesCsap),
        referenceYear,
        referenceDate,
      }),
    );
  }

  // ODS 3.c — Gasto saúde per capita (maior = melhor, com teto)
  if (ind.gastoSaudePerCapita !== null) {
    indicators.push(
      makeIndicator({
        municipalityId: ibgeCode,
        odsNumber: 3,
        indicatorName: "ieps_gasto_saude_pc",
        value: ind.gastoSaudePerCapita,
        score: scoreGastoSaudePerCapita(ind.gastoSaudePerCapita),
        referenceYear,
        referenceDate,
      }),
    );
  }

  // ODS 3.1 — Pré-natal adequado (maior = melhor)
  if (ind.prenatalAdequado !== null) {
    indicators.push(
      makeIndicator({
        municipalityId: ibgeCode,
        odsNumber: 3,
        indicatorName: "ieps_prenatal_adequado",
        value: ind.prenatalAdequado,
        score: scoreCoberturaPercentual(ind.prenatalAdequado),
        referenceYear,
        referenceDate,
      }),
    );
  }

  return indicators;
}

// ─── Funções de normalização ─────────────────────────────────────────────────

/**
 * Mortalidade infantil (por 1.000 NV) → score 0-100.
 * Invertido: menor taxa = melhor score.
 *
 * Benchmarks:
 * - Meta ODS 2030: <= 12 por 1.000 NV
 * - SC média ~8-10 por 1.000 NV
 * - Brasil média ~12-14 por 1.000 NV
 *
 * <= 8  → 100 (excelente, nível países desenvolvidos)
 * <= 12 → 70-100 (atinge meta ODS)
 * <= 25 → 30-70 (regular)
 * > 25  → 0-30 (crítico)
 */
function scoreMortalidadeInfantil(taxa: number): number {
  if (taxa <= 8) return 100;
  if (taxa <= 12) return 70 + ((12 - taxa) / 4) * 30;
  if (taxa <= 25) return 30 + ((25 - taxa) / 13) * 40;
  if (taxa <= 50) return ((50 - taxa) / 25) * 30;
  return 0;
}

/**
 * Cobertura percentual genérica (ESF, pré-natal) → score 0-100.
 *
 * >= 90% → 100 (cobertura universal)
 * >= 70% → 70-100 (boa cobertura)
 * >= 40% → 30-70 (cobertura parcial)
 * < 40%  → 0-30 (cobertura insuficiente)
 */
function scoreCoberturaPercentual(pct: number): number {
  if (pct >= 90) return 100;
  if (pct >= 70) return 70 + ((pct - 70) / 20) * 30;
  if (pct >= 40) return 30 + ((pct - 40) / 30) * 40;
  return (pct / 40) * 30;
}

/**
 * Cobertura vacinal → score 0-100.
 * Meta OMS/MS: >= 95% para vacinas do calendário básico.
 *
 * >= 95% → 100 (meta atingida)
 * >= 80% → 70-100 (boa cobertura)
 * >= 50% → 30-70 (risco epidemiológico)
 * < 50%  → 0-30 (crítico)
 */
function scoreCoberturaVacinal(pct: number): number {
  if (pct >= 95) return 100;
  if (pct >= 80) return 70 + ((pct - 80) / 15) * 30;
  if (pct >= 50) return 30 + ((pct - 50) / 30) * 40;
  return (pct / 50) * 30;
}

/**
 * Internações CSAP (por 100k hab) → score 0-100.
 * Invertido: menor taxa = melhor (significa melhor atenção primária).
 *
 * Benchmarks Brasil:
 * - Bom: <= 500 por 100k
 * - Regular: 500-1500
 * - Ruim: > 1500
 *
 * <= 500  → 100 (excelente APS)
 * <= 1000 → 70-100
 * <= 2000 → 30-70
 * > 2000  → 0-30
 */
function scoreInternacoesCsap(taxa: number): number {
  if (taxa <= 500) return 100;
  if (taxa <= 1000) return 70 + ((1000 - taxa) / 500) * 30;
  if (taxa <= 2000) return 30 + ((2000 - taxa) / 1000) * 40;
  if (taxa <= 4000) return ((4000 - taxa) / 2000) * 30;
  return 0;
}

/**
 * Gasto total saúde per capita (R$ deflacionado 2019) → score 0-100.
 *
 * Benchmarks Brasil municipal:
 * - Mediana ~R$ 600-800
 * - Bom: >= R$ 1.000
 * - Muito bom: >= R$ 1.500
 *
 * >= 1500 → 100
 * >= 800  → 70-100
 * >= 400  → 30-70
 * < 400   → 0-30
 */
function scoreGastoSaudePerCapita(valor: number): number {
  if (valor >= 1500) return 100;
  if (valor >= 800) return 70 + ((valor - 800) / 700) * 30;
  if (valor >= 400) return 30 + ((valor - 400) / 400) * 40;
  return (valor / 400) * 30;
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
    source: "ieps",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
