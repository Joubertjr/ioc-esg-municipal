import { useMemo } from "react";
import { useCompare } from "./useBenchmark";
import { SC_BENCHMARK_CODES } from "../../../shared/constants/sc-benchmark-codes";

export interface StateBenchmarkData {
  globalScore: number | null;
  stateAverage: number | null;
  deltaVsState: number | null;
  rankingPosition: number | null;
  totalInBenchmark: number;
  aboveStateAverage: boolean | null;
}

export function useStateBenchmark(ibgeCode: string) {
  const peerCodes = SC_BENCHMARK_CODES.filter((c) => c !== ibgeCode);
  const { data, isLoading, isError } = useCompare(ibgeCode, [...peerCodes]);

  const result = useMemo((): StateBenchmarkData | undefined => {
    if (!data) return undefined;

    const myScore = data.municipality?.globalScore ?? null;
    const stateAverage = data.benchmark.globalAverage;
    const deltaVsState =
      myScore !== null && stateAverage !== null
        ? Math.round((myScore - stateAverage) * 10) / 10
        : null;

    const ranking = data.benchmark.ranking;
    const myEntry = ranking.find((r) => r.ibgeCode === ibgeCode);
    const rankingPosition = myEntry?.position ?? null;

    return {
      globalScore: myScore,
      stateAverage,
      deltaVsState,
      rankingPosition,
      totalInBenchmark: ranking.length,
      aboveStateAverage: deltaVsState !== null ? deltaVsState > 0 : null,
    };
  }, [data, ibgeCode]);

  return { data: result, isLoading, isError };
}
