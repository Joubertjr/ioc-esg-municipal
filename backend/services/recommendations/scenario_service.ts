import { generateRecommendations, type SmartRecommendation } from "./recommendation_service.js";
import {
  ODS_TO_AREA_MAP,
  ALL_INVESTMENT_AREAS,
  type InvestmentArea,
} from "../../../shared/constants/ods_area_map.js";
import { logger } from "../../utils/logger.js";
import { withCache } from "../../utils/cache.js";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ScenarioReasoning {
  area: InvestmentArea;
  percentage: number;
  odsNumbers: number[];
  justification: string;
}

export interface RecommendedScenario {
  ibgeCode: string;
  municipalityName: string | null;
  totalAmount: null;
  allocation: Record<InvestmentArea, number>;
  reasoning: ScenarioReasoning[];
  basedOnRecommendations: number;
  allOdsGreen: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SCENARIO_CACHE_TTL = 3_600; // 1 hora

const PRIORITY_WEIGHT: Record<string, number> = {
  critica: 3,
  alta: 2,
  media: 1,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGapFactor(gap: number | null): number {
  if (gap === null) return 1.0;
  const absGap = Math.abs(gap);
  if (absGap > 20) return 1.5;
  if (absGap > 10) return 1.25;
  return 1.0;
}

function buildEqualSplit(): Record<InvestmentArea, number> {
  const base = Math.floor(100 / ALL_INVESTMENT_AREAS.length);
  const remainder = 100 - base * ALL_INVESTMENT_AREAS.length;
  const allocation = {} as Record<InvestmentArea, number>;
  ALL_INVESTMENT_AREAS.forEach((area, i) => {
    allocation[area] = base + (i < remainder ? 1 : 0);
  });
  return allocation;
}

function computeAllocation(recommendations: SmartRecommendation[]): {
  allocation: Record<InvestmentArea, number>;
  reasoning: ScenarioReasoning[];
  allOdsGreen: boolean;
} {
  if (recommendations.length === 0) {
    return { allocation: buildEqualSplit(), reasoning: [], allOdsGreen: true };
  }

  // Acumular pesos e ODS por área
  const areaWeight: Record<InvestmentArea, number> = {} as Record<InvestmentArea, number>;
  const areaOds: Record<InvestmentArea, number[]> = {} as Record<InvestmentArea, number[]>;
  const areaBestRec: Record<InvestmentArea, { rec: SmartRecommendation; weight: number }> =
    {} as Record<InvestmentArea, { rec: SmartRecommendation; weight: number }>;

  for (const area of ALL_INVESTMENT_AREAS) {
    areaWeight[area] = 0;
    areaOds[area] = [];
  }

  for (const rec of recommendations) {
    const area = ODS_TO_AREA_MAP[rec.odsNumber];
    if (!area) continue;

    const rawWeight = (PRIORITY_WEIGHT[rec.priority] ?? 1) * getGapFactor(rec.gap);
    areaWeight[area] += rawWeight;
    areaOds[area].push(rec.odsNumber);

    const current = areaBestRec[area];
    if (!current || rawWeight > current.weight) {
      areaBestRec[area] = { rec, weight: rawWeight };
    }
  }

  // Normalizar para 100%
  const totalWeight = Object.values(areaWeight).reduce((sum, w) => sum + w, 0);

  if (totalWeight === 0) {
    return { allocation: buildEqualSplit(), reasoning: [], allOdsGreen: true };
  }

  const sortedAreas = ALL_INVESTMENT_AREAS.filter((a) => areaWeight[a] > 0).sort(
    (a, b) => areaWeight[b] - areaWeight[a],
  );

  const allocation = {} as Record<InvestmentArea, number>;
  let sum = 0;

  for (const area of ALL_INVESTMENT_AREAS) {
    allocation[area] = Math.floor((areaWeight[area] / totalWeight) * 100);
    sum += allocation[area];
  }

  // Remainder vai para a área de maior peso
  const remainder = 100 - sum;
  if (remainder > 0 && sortedAreas.length > 0) {
    const topArea = sortedAreas[0];
    if (topArea) {
      allocation[topArea] += remainder;
    }
  }

  // Construir reasoning apenas para áreas com alocação > 0
  const reasoning: ScenarioReasoning[] = [];

  for (const area of sortedAreas) {
    if (allocation[area] <= 0) continue;

    const best = areaBestRec[area];
    if (!best) continue;

    let justification = `ODS ${best.rec.odsNumber} — ${best.rec.priority}, score ${best.rec.currentScore}`;
    if (best.rec.gap !== null) {
      justification += `, ${Math.abs(best.rec.gap)} pontos abaixo da média SC`;
    }

    reasoning.push({
      area,
      percentage: allocation[area],
      odsNumbers: [...new Set(areaOds[area])],
      justification,
    });
  }

  return { allocation, reasoning, allOdsGreen: false };
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

async function _computeScenario(ibgeCode: string): Promise<RecommendedScenario | null> {
  logger.info("[scenario] calculando cenário recomendado", { ibgeCode });

  const report = await generateRecommendations(ibgeCode);
  if (!report) {
    logger.warn("[scenario] sem recomendações para município", { ibgeCode });
    return null;
  }

  const { allocation, reasoning, allOdsGreen } = computeAllocation(report.recommendations);

  return {
    ibgeCode,
    municipalityName: report.municipalityName,
    totalAmount: null,
    allocation,
    reasoning,
    basedOnRecommendations: report.recommendations.length,
    allOdsGreen,
  };
}

export async function computeRecommendedScenario(
  ibgeCode: string,
): Promise<RecommendedScenario | null> {
  return withCache(`scenario:${ibgeCode}`, SCENARIO_CACHE_TTL, () => _computeScenario(ibgeCode));
}
