import { calculateMunicipalOds } from "../ods/ods_score_service.js";
import { ODS_DEFINITIONS, getOdsDefinition } from "../../../shared/constants/ods.js";
import { getOdsStatus, type OdsStatus } from "../../../shared/types/domain/ods.js";
import { logger } from "../../utils/logger.js";

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export type InvestmentArea =
  | "education"
  | "health"
  | "sanitation"
  | "environment"
  | "security"
  | "energy"
  | "urbanization"
  | "governance";

/** Distribuição percentual por área (0–100 cada, soma deve ser 100). */
export type InvestmentAllocationRecord = Record<InvestmentArea, number>;

export interface SimulationInput {
  ibgeCode: string;
  /** Valor total em R$ a ser distribuído pelas áreas. */
  totalAmount: number;
  /** Percentual por área (0–100, soma = 100). */
  allocation: InvestmentAllocationRecord;
}

export interface OdsSimulationResult {
  odsNumber: number;
  name: string;
  shortName: string;
  color: string;
  currentScore: number | null;
  projectedScore: number | null;
  delta: number | null;
  currentStatus: OdsStatus | null;
  projectedStatus: OdsStatus | null;
}

export interface SimulationResult {
  ibgeCode: string;
  municipalityName: string | null;
  totalAmount: number;
  allocation: InvestmentAllocationRecord;
  currentGlobalScore: number | null;
  projectedGlobalScore: number | null;
  globalDelta: number | null;
  ods: OdsSimulationResult[];
}

// ─── Tipo interno de alocação (mantém a lógica de mapeamento existente) ────────

interface InternalAllocation {
  area: InvestmentArea;
  /** Valor absoluto em R$ */
  amount: number;
  /** Array vazio usa mapeamento padrão. */
  targetOds: number[];
}

// ─── Mapeamento padrão de área → ODS ─────────────────────────────────────────

interface OdsImpactMapping {
  primary: number[];
  secondary: number[];
}

const AREA_ODS_MAPPING: Record<InvestmentArea, OdsImpactMapping> = {
  education:    { primary: [4],      secondary: [1, 8, 10] },
  health:       { primary: [3],      secondary: [1] },
  sanitation:   { primary: [6],      secondary: [3, 11, 14] },
  environment:  { primary: [13, 15], secondary: [11, 14] },
  security:     { primary: [16],     secondary: [11] },
  energy:       { primary: [7],      secondary: [9, 13] },
  urbanization: { primary: [11],     secondary: [9] },
  governance:   { primary: [16, 17], secondary: [] },
} as const;

// ─── Constantes de eficiência ─────────────────────────────────────────────────

/** Fator de eficiência por porte do município (baseado em população) */
function getEfficiencyFactor(population: number): number {
  if (population < 20_000) return 0.4;
  if (population <= 100_000) return 0.3;
  return 0.2;
}

/**
 * Estima o orçamento municipal total quando não disponível.
 * Formula: população × R$3.000 (estimativa conservadora per capita/ano).
 */
function estimateTotalBudget(population: number): number {
  return population * 3_000;
}

// ─── Lógica de projeção ────────────────────────────────────────────────────────

interface OdsAccumulator {
  primaryInvestment: number;
  secondaryInvestment: number;
}

/**
 * Calcula os investimentos acumulados por ODS para cada alocação.
 * Respeita override de targetOds quando fornecido pelo caller.
 */
function buildOdsInvestmentMap(
  allocations: InternalAllocation[],
): Map<number, OdsAccumulator> {
  const map = new Map<number, OdsAccumulator>();

  const getOrCreate = (odsNumber: number): OdsAccumulator => {
    const existing = map.get(odsNumber);
    if (existing) return existing;
    const fresh: OdsAccumulator = { primaryInvestment: 0, secondaryInvestment: 0 };
    map.set(odsNumber, fresh);
    return fresh;
  };

  for (const allocation of allocations) {
    const mapping = AREA_ODS_MAPPING[allocation.area];

    if (allocation.targetOds.length > 0) {
      // Caller especificou ODS explicitamente — trata todos como primários
      for (const odsNumber of allocation.targetOds) {
        getOrCreate(odsNumber).primaryInvestment += allocation.amount;
      }
    } else {
      // Usa mapeamento padrão
      for (const odsNumber of mapping.primary) {
        getOrCreate(odsNumber).primaryInvestment += allocation.amount;
      }
      for (const odsNumber of mapping.secondary) {
        getOrCreate(odsNumber).secondaryInvestment += allocation.amount;
      }
    }
  }

  return map;
}

/**
 * Projeta o score de um ODS após os investimentos.
 *
 * Fórmula:
 * - Primário: score + (investmentPct * efficiencyFactor * 100), cap 100
 * - Secundário: score + (investmentPct * efficiencyFactor * 30), cap 100
 * - Se currentScore for null, não há projeção possível (retorna null).
 */
function projectOdsScore(
  currentScore: number | null,
  primaryInvestment: number,
  secondaryInvestment: number,
  totalBudget: number,
  efficiencyFactor: number,
): number | null {
  if (currentScore === null) return null;
  if (totalBudget <= 0) return currentScore;

  const primaryPct = primaryInvestment / totalBudget;
  const secondaryPct = secondaryInvestment / totalBudget;

  const primaryGain = primaryPct * efficiencyFactor * 100;
  const secondaryGain = secondaryPct * efficiencyFactor * 30;

  const projected = currentScore + primaryGain + secondaryGain;
  return Math.min(Math.round(projected), 100);
}

// ─── Serviço principal ─────────────────────────────────────────────────────────

/**
 * Executa a simulação de cenário de investimento FPM para um município.
 *
 * Fluxo:
 * 1. Converte allocation percentual → valores absolutos em R$
 * 2. Busca scores ODS atuais via calculateMunicipalOds
 * 3. Determina orçamento e eficiência baseados em população IBGE
 * 4. Projeta novos scores por ODS para cada alocação
 * 5. Recalcula score global projetado (média ponderada)
 * 6. Retorna current vs projected com delta no formato esperado pelo frontend
 *
 * Quando nenhum dado ODS está disponível para o município, retorna resultado degenerado
 * com scores nulos e deltas nulos (nunca retorna null).
 */
export async function runSimulation(input: SimulationInput): Promise<SimulationResult> {
  const { ibgeCode, totalAmount, allocation } = input;

  logger.info("[simulator] iniciando simulação", {
    ibgeCode,
    totalAmount,
  });

  // 1. Converter allocation percentual para alocações internas com valores absolutos
  const internalAllocations: InternalAllocation[] = (Object.keys(allocation) as InvestmentArea[])
    .filter((area) => allocation[area] > 0)
    .map((area) => ({
      area,
      amount: (allocation[area] / 100) * totalAmount,
      targetOds: [],
    }));

  // 2. Buscar estado atual dos ODS
  const report = await calculateMunicipalOds(ibgeCode);

  if (!report) {
    logger.warn("[simulator] nenhum dado ODS disponível para município", { ibgeCode });
    return buildDegenerateResult(ibgeCode, totalAmount, allocation);
  }

  // 3. Determinar população e orçamento estimado
  const population = extractPopulation(report.ods);
  const totalBudget = population > 0 ? estimateTotalBudget(population) : 10_000_000;
  const efficiencyFactor = getEfficiencyFactor(population);

  logger.info("[simulator] parâmetros calculados", {
    ibgeCode,
    population,
    totalBudget,
    efficiencyFactor,
    totalAmount,
  });

  // 4. Construir mapa de investimentos por ODS
  const investmentMap = buildOdsInvestmentMap(internalAllocations);

  // 5. Projetar scores para cada ODS
  const odsResults: OdsSimulationResult[] = ODS_DEFINITIONS.map((def) => {
    const summary = report.ods.find((o) => o.odsNumber === def.number);
    const currentScore = summary?.score ?? null;

    const investment = investmentMap.get(def.number);
    const primaryInvestment = investment?.primaryInvestment ?? 0;
    const secondaryInvestment = investment?.secondaryInvestment ?? 0;

    const projectedScore = projectOdsScore(
      currentScore,
      primaryInvestment,
      secondaryInvestment,
      totalBudget,
      efficiencyFactor,
    );

    const delta =
      projectedScore !== null && currentScore !== null
        ? projectedScore - currentScore
        : null;

    return {
      odsNumber: def.number,
      name: def.name,
      shortName: def.shortName,
      color: def.color,
      currentScore,
      projectedScore,
      delta,
      currentStatus: currentScore !== null ? getOdsStatus(currentScore) : null,
      projectedStatus: projectedScore !== null ? getOdsStatus(projectedScore) : null,
    };
  });

  // 6. Recalcular score global projetado (média ponderada dos ODS com dados projetados)
  const projectedGlobalScore = calculateGlobalScore(odsResults, "projected");
  const currentGlobalScore = report.globalScore;
  const globalDelta =
    projectedGlobalScore !== null && currentGlobalScore !== null
      ? projectedGlobalScore - currentGlobalScore
      : null;

  logger.info("[simulator] simulação concluída", {
    ibgeCode,
    currentGlobalScore,
    projectedGlobalScore,
    globalDelta,
  });

  return {
    ibgeCode,
    municipalityName: report.municipalityName ?? null,
    totalAmount,
    allocation,
    currentGlobalScore,
    projectedGlobalScore,
    globalDelta,
    ods: odsResults,
  };
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

/**
 * Extrai a população do relatório ODS via indicadores IBGE (indicador populacao).
 * Retorna 0 se não encontrado — o caller usará um budget default.
 */
function extractPopulation(ods: Array<{ indicators: Array<{ indicatorName: string; value: number | null }> }>): number {
  for (const odsSummary of ods) {
    for (const indicator of odsSummary.indicators) {
      if (
        indicator.indicatorName === "populacao" &&
        indicator.value !== null &&
        indicator.value > 0
      ) {
        return indicator.value;
      }
    }
  }
  return 0;
}

/** Calcula score global projetado (média ponderada). */
function calculateGlobalScore(
  results: OdsSimulationResult[],
  mode: "current" | "projected",
): number | null {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const result of results) {
    const score = mode === "projected" ? result.projectedScore : result.currentScore;
    if (score === null) continue;

    const def = getOdsDefinition(result.odsNumber);
    const weight = def?.weight ?? 1.0;
    weightedSum += score * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null;
}

/** Resultado degenerado quando nenhum dado ODS está disponível para o município. */
function buildDegenerateResult(
  ibgeCode: string,
  totalAmount: number,
  allocation: InvestmentAllocationRecord,
): SimulationResult {
  const ods: OdsSimulationResult[] = ODS_DEFINITIONS.map((def) => ({
    odsNumber: def.number,
    name: def.name,
    shortName: def.shortName,
    color: def.color,
    currentScore: null,
    projectedScore: null,
    delta: null,
    currentStatus: null,
    projectedStatus: null,
  }));

  return {
    ibgeCode,
    municipalityName: null,
    totalAmount,
    allocation,
    currentGlobalScore: null,
    projectedGlobalScore: null,
    globalDelta: null,
    ods,
  };
}
