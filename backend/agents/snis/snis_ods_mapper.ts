import type { SnisMunicipalData } from "../../../shared/types/agents/snis.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados SNIS (Saneamento Básico) para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos pelo SNIS:
 * - ODS 6 (Água e Saneamento): 4 indicadores do Sistema Nacional de Informações sobre Saneamento
 *   - Atendimento água (IN023), atendimento esgoto (IN056),
 *     esgoto tratado (IN046), perda de faturamento (IN049, invertido)
 *
 * Nota: SNIS disponibiliza dados com ~18 meses de atraso. Sempre consulte referenceYear.
 */
export function mapToOdsIndicators(data: SnisMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 6 — Atendimento de água (maior = melhor)
  if (ind.atendimentoAgua !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 6,
      indicatorName: "snis_atendimento_agua",
      value: ind.atendimentoAgua,
      score: scoreAtendimentoAgua(ind.atendimentoAgua),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 6 — Atendimento de esgoto (maior = melhor)
  if (ind.atendimentoEsgoto !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 6,
      indicatorName: "snis_atendimento_esgoto",
      value: ind.atendimentoEsgoto,
      score: scoreAtendimentoEsgoto(ind.atendimentoEsgoto),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 6 — Esgoto tratado sobre coletado (maior = melhor)
  if (ind.esgotoTratado !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 6,
      indicatorName: "snis_esgoto_tratado",
      value: ind.esgotoTratado,
      score: scoreEsgotoTratado(ind.esgotoTratado),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 6 — Perda de faturamento (MENOR = melhor, invertido)
  if (ind.perdaFaturamento !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 6,
      indicatorName: "snis_perda_faturamento",
      value: ind.perdaFaturamento,
      score: scorePerdaFaturamento(ind.perdaFaturamento),
      referenceYear,
      referenceDate,
    }));
  }

  return indicators;
}

// ─── Funções de scoring ───────────────────────────────────────────────────────

/**
 * Atendimento de água → score ODS 0-100 (maior = melhor).
 * >= 95% → 100 (excelente)
 * >= 70% → 50-100 (aceitável a bom)
 * < 70%  → 0-50 (ruim)
 */
function scoreAtendimentoAgua(pct: number): number {
  if (pct >= 95) return 100;
  if (pct >= 70) return 50 + ((pct - 70) / 25) * 50;
  return (pct / 70) * 50;
}

/**
 * Atendimento de esgoto → score ODS 0-100 (maior = melhor).
 * >= 90% → 100 (excelente)
 * >= 50% → 50-100 (regular a bom)
 * < 50%  → 0-50 (ruim)
 */
function scoreAtendimentoEsgoto(pct: number): number {
  if (pct >= 90) return 100;
  if (pct >= 50) return 50 + ((pct - 50) / 40) * 50;
  return (pct / 50) * 50;
}

/**
 * Esgoto tratado sobre coletado → score ODS 0-100 (maior = melhor).
 * >= 90% → 100 (excelente)
 * >= 50% → 50-100 (regular a bom)
 * < 50%  → 0-50 (ruim)
 */
function scoreEsgotoTratado(pct: number): number {
  if (pct >= 90) return 100;
  if (pct >= 50) return 50 + ((pct - 50) / 40) * 50;
  return (pct / 50) * 50;
}

/**
 * Perda de faturamento → score ODS 0-100 (MENOR perda = melhor, invertido).
 * <= 15% → 100 (excelente)
 * <= 35% → 50-100 (aceitável)
 * > 35%  → 0-50 (ruim, clamped a 0)
 */
function scorePerdaFaturamento(pct: number): number {
  if (pct <= 15) return 100;
  if (pct <= 35) return 50 + ((35 - pct) / 20) * 50;
  // > 35%: linear de 50 (pct=35) até 0 (pct=60+)
  return Math.max(0, ((60 - pct) / 25) * 50);
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
    source: "snis",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
