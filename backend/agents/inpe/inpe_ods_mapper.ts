import type { InpeMunicipalData } from "../../../shared/types/agents/inpe.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados brutos do INPE/PRODES para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos pelo INPE (bioma Mata Atlântica, dados PRODES):
 * - ODS 13 (Ação Climática): desmatamento anual — menor = melhor
 * - ODS 15 (Vida Terrestre): desmatamento acumulado + tendência de desmatamento
 *
 * Referência de benchmarks para SC (série PRODES 2004-2024):
 * - Municípios com baixo desmatamento: < 0.1 km²/ano
 * - Municípios com alto desmatamento: > 5 km²/ano (ex: Lages 2023 = 45.4 km²)
 */
export function mapToOdsIndicators(data: InpeMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 13 — Ação Climática: desmatamento anual (menor = melhor)
  if (ind.desmatamentoAnualKm2 !== null && ind.anoReferencia !== null) {
    const score = scoreDesmatamentoAnual(ind.desmatamentoAnualKm2);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 13,
      indicatorName: "desmatamento_anual_km2",
      value: ind.desmatamentoAnualKm2,
      score,
      status: getOdsStatus(score),
      source: "inpe",
      referenceYear: ind.anoReferencia,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 13 — Ação Climática: tendência de desmatamento (YoY)
  if (ind.tendenciaDesmatamento !== null) {
    const score = scoreTendenciaDesmatamento(ind.tendenciaDesmatamento);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 13,
      indicatorName: "tendencia_desmatamento_pct",
      value: ind.tendenciaDesmatamento,
      score,
      status: getOdsStatus(score),
      source: "inpe",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 15 — Vida Terrestre: desmatamento acumulado (menor = melhor)
  if (ind.desmatamentoAcumuladoKm2 !== null) {
    const score = scoreDesmatamentoAcumulado(ind.desmatamentoAcumuladoKm2);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 15,
      indicatorName: "desmatamento_acumulado_km2",
      value: ind.desmatamentoAcumuladoKm2,
      score,
      status: getOdsStatus(score),
      source: "inpe",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 15 — Vida Terrestre: tendência de desmatamento (proxy de saúde dos biomas)
  if (ind.tendenciaDesmatamento !== null) {
    const score = scoreTendenciaDesmatamento(ind.tendenciaDesmatamento);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 15,
      indicatorName: "tendencia_desmatamento_vida_terrestre_pct",
      value: ind.tendenciaDesmatamento,
      score,
      status: getOdsStatus(score),
      source: "inpe",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  return indicators;
}

// ─── Funções de normalização (score 0-100) ───────────────────────────────────

/**
 * Desmatamento anual (km²) → score 0-100 (menor = melhor).
 * Benchmarks SC/PRODES:
 *   <= 0.1 km²/ano → score 100 (excelente — quase nenhum desmatamento detectado)
 *   >= 5.0 km²/ano → score 0  (péssimo — município de alto impacto)
 *
 * Interpolação linear entre os extremos.
 */
function scoreDesmatamentoAnual(km2: number): number {
  const MIN = 0.1;
  const MAX = 5.0;
  if (km2 <= MIN) return 100;
  if (km2 >= MAX) return 0;
  return clampScore(((MAX - km2) / (MAX - MIN)) * 100);
}

/**
 * Desmatamento acumulado (km²) → score 0-100 (menor = melhor).
 * Benchmarks SC:
 *   <= 1 km²  → score 100
 *   >= 100 km² → score 0
 * (Lages acumula ~200 km² desde 2004 — score 0 neste indicador)
 */
function scoreDesmatamentoAcumulado(km2: number): number {
  const MIN = 1;
  const MAX = 100;
  if (km2 <= MIN) return 100;
  if (km2 >= MAX) return 0;
  return clampScore(((MAX - km2) / (MAX - MIN)) * 100);
}

/**
 * Tendência de desmatamento (variação YoY em %) → score 0-100.
 * Redução >= 50% YoY → score 100 (excelente — tendência de recuperação)
 * Aumento >= 100% YoY → score 0 (péssimo — aceleração do desmatamento)
 *
 * A tendência negativa (redução) é recompensada; positiva (aumento) é penalizada.
 */
function scoreTendenciaDesmatamento(pct: number): number {
  const MIN_GOOD = -50; // redução de 50% ou mais → score 100
  const MAX_BAD = 100;  // aumento de 100% ou mais → score 0
  if (pct <= MIN_GOOD) return 100;
  if (pct >= MAX_BAD) return 0;
  return clampScore(((MAX_BAD - pct) / (MAX_BAD - MIN_GOOD)) * 100);
}

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}
