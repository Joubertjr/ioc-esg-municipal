import type { SnisRsMunicipalData } from "../../../shared/types/agents/snis_rs.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados SNIS-RS (Resíduos Sólidos) para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos pelo SNIS-RS:
 * - ODS 12 (Consumo e Produção Responsáveis): 3 indicadores de gestão de resíduos
 *   - Coleta seletiva (% da população atendida)
 *   - Taxa de reciclagem (% resíduos reciclados)
 *   - Resíduo per capita (kg/hab/dia — INVERTIDO, menor é melhor)
 *
 * Nota: SNIS-RS disponibiliza dados com ~18 meses de atraso. Consulte sempre referenceYear.
 */
export function mapToOdsIndicators(data: SnisRsMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 12 — Coleta seletiva (maior = melhor)
  if (ind.coletaSeletivaPct !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 12,
      indicatorName: "snis_rs_coleta_seletiva",
      value: ind.coletaSeletivaPct,
      score: scoreColetaSeletiva(ind.coletaSeletivaPct),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 12 — Taxa de reciclagem (maior = melhor)
  if (ind.taxaReciclagemPct !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 12,
      indicatorName: "snis_rs_taxa_reciclagem",
      value: ind.taxaReciclagemPct,
      score: scoreTaxaReciclagem(ind.taxaReciclagemPct),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 12 — Resíduo per capita (MENOR = melhor, invertido)
  if (ind.residuoPerCapitaKgDia !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 12,
      indicatorName: "snis_rs_residuo_per_capita",
      value: ind.residuoPerCapitaKgDia,
      score: scoreResiduoPerCapita(ind.residuoPerCapitaKgDia),
      referenceYear,
      referenceDate,
    }));
  }

  return indicators;
}

// ─── Funções de scoring ───────────────────────────────────────────────────────

/**
 * Coleta seletiva (% população atendida) → score ODS 0-100 (maior = melhor).
 * >= 80% → 100 (excelente)
 * >= 40% → 50-100 (interpolação linear)
 * < 40%  → 0-50 (interpolação linear)
 */
function scoreColetaSeletiva(pct: number): number {
  if (pct >= 80) return 100;
  if (pct >= 40) return 50 + ((pct - 40) / 40) * 50;
  return (pct / 40) * 50;
}

/**
 * Taxa de reciclagem (% resíduos reciclados) → score ODS 0-100 (maior = melhor).
 * >= 40% → 100 (excelente, referência internacional)
 * >= 15% → 50-100 (interpolação linear)
 * < 15%  → 0-50 (interpolação linear)
 */
function scoreTaxaReciclagem(pct: number): number {
  if (pct >= 40) return 100;
  if (pct >= 15) return 50 + ((pct - 15) / 25) * 50;
  return (pct / 15) * 50;
}

/**
 * Resíduo per capita (kg/hab/dia) → score ODS 0-100 (MENOR = melhor, invertido).
 * <= 0.5 kg/hab/dia → 100 (excelente)
 * <= 1.0 kg/hab/dia → 50-100 (interpolação linear)
 * >  1.0 kg/hab/dia → 0-50 (interpolação linear, clamped a 0 acima de 2.0)
 */
function scoreResiduoPerCapita(kgDia: number): number {
  if (kgDia <= 0.5) return 100;
  if (kgDia <= 1.0) return 50 + ((1.0 - kgDia) / 0.5) * 50;
  return Math.max(0, ((2.0 - kgDia) / 1.0) * 50);
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
    source: "snis_rs",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
