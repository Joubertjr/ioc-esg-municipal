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
    // Backend excludes target from ranking to avoid self-reference bias.
    // Calculate position by counting peers with higher globalScore.
    let rankingPosition: number | null = null;
    if (myScore !== null) {
      const peersAbove = ranking.filter((r) => (r.globalScore ?? 0) > myScore).length;
      rankingPosition = peersAbove + 1;
    }

    return {
      globalScore: myScore,
      stateAverage,
      deltaVsState,
      rankingPosition,
      totalInBenchmark: ranking.length + 1,
      aboveStateAverage: deltaVsState !== null ? deltaVsState > 0 : null,
    };
  }, [data, ibgeCode]);

  return { data: result, isLoading, isError };
}
