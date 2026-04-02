import type { AnatelMunicipalData } from "../../../shared/types/agents/anatel.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados ANATEL (infraestrutura digital) para indicadores ODS normalizados (score 0-100).
 *
 * ODS coberto:
 * - ODS 9 (Indústria, Inovação e Infraestrutura): 2 indicadores de conectividade digital
 *
 * Indicadores:
 * - banda_larga_por_100hab: acessos de banda larga fixa por 100 habitantes
 *   >= 30/100hab → 100 | >= 15 → 50-100 (linear) | < 15 → 0-50 (linear)
 *
 * - cobertura_4g: percentual de cobertura 4G no município
 *   >= 95% → 100 | >= 80% → 50-100 (linear) | < 80% → 0-50 (linear)
 *
 * Referências de benchmark SC 2023:
 * - SC tem uma das maiores densidades de banda larga fixa do Brasil
 * - 30 acessos/100hab representa nível de excelência digital municipal
 * - Cobertura 4G >= 95% é meta nacional do PNB (Plano Nacional de Banda Larga)
 */
export function mapToOdsIndicators(data: AnatelMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 9 — Banda larga por 100 hab
  indicators.push(
    makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 9,
      indicatorName: "banda_larga_por_100hab",
      value: ind.acessosBandaLargaPor100hab,
      score: scoreBandaLarga(ind.acessosBandaLargaPor100hab),
      referenceYear,
      referenceDate,
    })
  );

  // ODS 9 — Cobertura 4G (%)
  indicators.push(
    makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 9,
      indicatorName: "cobertura_4g",
      value: ind.cobertura4gPercentual,
      score: scoreCobertura4g(ind.cobertura4gPercentual),
      referenceYear,
      referenceDate,
    })
  );

  return indicators;
}

// ─── Funções de normalização ──────────────────────────────────────────────────

/**
 * Acessos banda larga por 100 hab → score ODS 0-100.
 *
 * >= 30/100hab → 100 (excelência digital, meta PNB)
 * >= 15/100hab → 50-100 (interpolação linear)
 * < 15/100hab  → 0-50  (interpolação linear)
 */
export function scoreBandaLarga(por100hab: number): number {
  if (por100hab >= 30) return 100;
  if (por100hab >= 15) return clampScore(50 + ((por100hab - 15) / (30 - 15)) * 50);
  return clampScore((por100hab / 15) * 50);
}

/**
 * Cobertura 4G (%) → score ODS 0-100.
 *
 * >= 95% → 100 (meta nacional de cobertura)
 * >= 80% → 50-100 (interpolação linear)
 * < 80%  → 0-50  (interpolação linear)
 */
export function scoreCobertura4g(percentual: number): number {
  if (percentual >= 95) return 100;
  if (percentual >= 80) return clampScore(50 + ((percentual - 80) / (95 - 80)) * 50);
  return clampScore((percentual / 80) * 50);
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
    source: "anatel",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
