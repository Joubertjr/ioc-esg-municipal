export interface MunicipalityBenchmark {
  ibgeCode: string;
  municipalityName: string | null;
  globalScore: number | null;
  globalStatus: string | null;
  odsScores: Record<number, number | null>;
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

export interface BenchmarkResult {
  generatedAt: string;
  referenceYear: number;
  municipalityCount: number;
  municipalities: MunicipalityBenchmark[];
  ranking: RankingEntry[];
  averages: OdsAverage[];
  globalAverage: number | null;
}

export interface CompareResult {
  municipality: MunicipalityBenchmark | null;
  benchmark: BenchmarkResult;
  comparison: Array<{
    odsNumber: number;
    municipalityScore: number | null;
    benchmarkAverage: number | null;
    delta: number | null;
    aboveAverage: boolean | null;
  }>;
}
