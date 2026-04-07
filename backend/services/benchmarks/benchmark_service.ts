import { calculateMunicipalOds, type MunicipalOdsReport } from "../ods/ods_score_service.js";
import { logger } from "../../utils/logger.js";
import { withCache } from "../../utils/cache.js";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MunicipalityBenchmark {
  ibgeCode: string;
  municipalityName: string | null;
  globalScore: number | null;
  globalStatus: string | null;
  odsScores: Record<number, number | null>;
}

export interface BenchmarkResult {
  generatedAt: string;
  referenceYear: number;
  municipalityCount: number;
  municipalities: MunicipalityBenchmark[];
  ranking: RankingEntry[];
  averages: OdsAverage[];
  globalAverage: number | null;
}

export interface RankingEntry {
  position: number;
  ibgeCode: string;
  municipalityName: string | null;
  globalScore: number;
}

export interface OdsAverage {
  odsNumber: number;
  average: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * TTL do cache de benchmark: 1 hora.
 * A chave inclui os códigos ordenados para que a mesma lista em ordens
 * diferentes retorne o cache existente.
 */
const BENCHMARK_CACHE_TTL = 3_600;

function buildBenchmarkCacheKey(ibgeCodes: string[]): string {
  const sorted = [...ibgeCodes].sort();
  return `benchmark:${sorted.join(",")}`;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export async function generateBenchmark(ibgeCodes: string[]): Promise<BenchmarkResult> {
  const cacheKey = buildBenchmarkCacheKey(ibgeCodes);
  logger.info("[benchmarks] gerando benchmark", { count: ibgeCodes.length, cacheKey });

  return withCache(cacheKey, BENCHMARK_CACHE_TTL, () => _computeBenchmark(ibgeCodes));
}

async function _computeBenchmark(ibgeCodes: string[]): Promise<BenchmarkResult> {
  const reports = await Promise.all(
    ibgeCodes.map(async (code) => {
      try {
        return await calculateMunicipalOds(code);
      } catch (err) {
        logger.warn("[benchmarks] falha ao calcular ODS", {
          ibgeCode: code,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    }),
  );

  const validReports = reports.filter((r): r is MunicipalOdsReport => r !== null);

  const municipalities = validReports.map(toBenchmark);
  const ranking = buildRanking(validReports);
  const averages = buildOdsAverages(validReports);
  const globalAverage = computeGlobalAverage(validReports);

  const referenceYear = validReports[0]?.referenceYear ?? new Date().getFullYear();

  return {
    generatedAt: new Date().toISOString(),
    referenceYear,
    municipalityCount: validReports.length,
    municipalities,
    ranking,
    averages,
    globalAverage,
  };
}

/**
 * Compara um município contra a média do grupo.
 */
export async function compareAgainstBenchmark(
  ibgeCode: string,
  benchmarkCodes: string[],
): Promise<{
  municipality: MunicipalityBenchmark | null;
  benchmark: BenchmarkResult;
  comparison: Array<{
    odsNumber: number;
    municipalityScore: number | null;
    benchmarkAverage: number | null;
    delta: number | null;
    aboveAverage: boolean | null;
  }>;
}> {
  // Benchmark calculado apenas sobre os municípios de comparação (exclui o alvo para evitar self-reference bias)
  const peerCodes = benchmarkCodes.filter((c) => c !== ibgeCode);
  const allCodes = [...new Set([ibgeCode, ...peerCodes])];
  const fullBenchmark = await generateBenchmark(allCodes);
  // Recalcular benchmark apenas com peers (sem o município alvo)
  const benchmark = peerCodes.length > 0 ? await generateBenchmark(peerCodes) : fullBenchmark;

  const municipality = fullBenchmark.municipalities.find((m) => m.ibgeCode === ibgeCode) ?? null;

  const comparison = benchmark.averages.map((avg) => {
    const score = municipality?.odsScores[avg.odsNumber] ?? null;
    const delta = score !== null && avg.average !== null ? score - avg.average : null;
    const aboveAverage = delta !== null ? delta >= 0 : null;

    return {
      odsNumber: avg.odsNumber,
      municipalityScore: score,
      benchmarkAverage: avg.average,
      delta: delta !== null ? Math.round(delta * 10) / 10 : null,
      aboveAverage,
    };
  });

  return { municipality, benchmark, comparison };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBenchmark(report: MunicipalOdsReport): MunicipalityBenchmark {
  const odsScores: Record<number, number | null> = {};
  for (const ods of report.ods) {
    odsScores[ods.odsNumber] = ods.score;
  }

  return {
    ibgeCode: report.ibgeCode,
    municipalityName: report.municipalityName,
    globalScore: report.globalScore,
    globalStatus: report.globalStatus,
    odsScores,
  };
}

function buildRanking(reports: MunicipalOdsReport[]): RankingEntry[] {
  return reports
    .filter((r): r is MunicipalOdsReport & { globalScore: number } => r.globalScore !== null)
    .sort((a, b) => b.globalScore - a.globalScore)
    .map((r, idx) => ({
      position: idx + 1,
      ibgeCode: r.ibgeCode,
      municipalityName: r.municipalityName,
      globalScore: r.globalScore,
    }));
}

function buildOdsAverages(reports: MunicipalOdsReport[]): OdsAverage[] {
  const averages: OdsAverage[] = [];

  for (let odsNum = 1; odsNum <= 17; odsNum++) {
    const scores: number[] = [];

    for (const report of reports) {
      const ods = report.ods.find((o) => o.odsNumber === odsNum);
      if (ods?.score !== null && ods?.score !== undefined) {
        scores.push(ods.score);
      }
    }

    if (scores.length === 0) {
      averages.push({ odsNumber: odsNum, average: null, min: null, max: null, count: 0 });
    } else {
      const sum = scores.reduce((a, b) => a + b, 0);
      averages.push({
        odsNumber: odsNum,
        average: Math.round((sum / scores.length) * 10) / 10,
        min: Math.min(...scores),
        max: Math.max(...scores),
        count: scores.length,
      });
    }
  }

  return averages;
}

function computeGlobalAverage(reports: MunicipalOdsReport[]): number | null {
  const globals = reports.map((r) => r.globalScore).filter((s): s is number => s !== null);

  if (globals.length === 0) return null;

  const sum = globals.reduce((a, b) => a + b, 0);
  return Math.round((sum / globals.length) * 10) / 10;
}
