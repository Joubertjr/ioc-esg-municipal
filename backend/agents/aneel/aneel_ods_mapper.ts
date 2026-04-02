import type { AneelMunicipalData } from "../../../shared/types/agents/aneel.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados ANEEL (Geração Distribuída solar) para indicadores ODS normalizados (score 0-100).
 *
 * ODS coberto:
 * - ODS 7 (Energia limpa e acessível): 2 indicadores de geração distribuída solar
 *
 * Indicadores:
 * - gd_per_capita_w: potência GD instalada em Watts por habitante
 *   >= 500 W/hab = 100 | >= 100 = 50-100 (linear) | < 100 = 0-50 (linear)
 *
 * - penetracao_gd: unidades consumidoras com GD por 1.000 habitantes
 *   >= 50/1000 = 100 | >= 10/1000 = 50-100 (linear) | < 10/1000 = 0-50 (linear)
 *
 * Referências de benchmark SC 2023:
 * - SC é o estado com maior penetração per capita de GD solar do Brasil
 * - 500 W/hab representa ~top 10% dos municípios catarinenses
 * - 50 unidades/1.000 hab é um nível de excelência regional
 */
export function mapToOdsIndicators(data: AneelMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 7 — GD per capita (W/hab)
  if (ind.geracaoDistribuidaKw !== null && ind.populacao !== null && ind.populacao > 0) {
    const gdPerCapitaW = (ind.geracaoDistribuidaKw * 1_000) / ind.populacao;
    indicators.push(
      makeIndicator({
        municipalityId: ibgeCode,
        odsNumber: 7,
        indicatorName: "gd_per_capita_w",
        value: gdPerCapitaW,
        score: scoreGdPerCapita(gdPerCapitaW),
        referenceYear,
        referenceDate,
      })
    );
  }

  // ODS 7 — Penetração GD (unidades/1.000 hab)
  if (ind.unidadesGd !== null && ind.populacao !== null && ind.populacao > 0) {
    const penetracaoPor1000 = (ind.unidadesGd / ind.populacao) * 1_000;
    indicators.push(
      makeIndicator({
        municipalityId: ibgeCode,
        odsNumber: 7,
        indicatorName: "penetracao_gd",
        value: penetracaoPor1000,
        score: scorePenetracao(penetracaoPor1000),
        referenceYear,
        referenceDate,
      })
    );
  }

  return indicators;
}

// ─── Funções de normalização ──────────────────────────────────────────────────

/**
 * GD per capita (W/hab) → score ODS 0-100.
 *
 * >= 500 W/hab → 100 (excelente, referência top SC)
 * >= 100 W/hab → 50-100 (interpolação linear)
 * < 100 W/hab  → 0-50  (interpolação linear)
 */
function scoreGdPerCapita(wPerHab: number): number {
  if (wPerHab >= 500) return 100;
  if (wPerHab >= 100) return 50 + ((wPerHab - 100) / 400) * 50;
  return (wPerHab / 100) * 50;
}

/**
 * Penetração GD (unidades/1.000 hab) → score ODS 0-100.
 *
 * >= 50/1.000 → 100 (excelente)
 * >= 10/1.000 → 50-100 (interpolação linear)
 * < 10/1.000  → 0-50  (interpolação linear)
 */
function scorePenetracao(por1000: number): number {
  if (por1000 >= 50) return 100;
  if (por1000 >= 10) return 50 + ((por1000 - 10) / 40) * 50;
  return (por1000 / 10) * 50;
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
    source: "aneel",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
