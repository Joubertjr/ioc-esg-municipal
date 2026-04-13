import { useOdsHistory } from "./useOdsHistory";

export interface TrendData {
  delta: number | null;
  direction: "up" | "down" | "neutral";
  sparklineData: Array<{ year: number; score: number }>;
  latestYear: number | null;
  previousYear: number | null;
}

export function useTrend(ibgeCode: string) {
  const { data, isLoading, isError } = useOdsHistory(ibgeCode, 0);

  if (!data) return { data: undefined as TrendData | undefined, isLoading, isError };

  // odsNumber=0 = pre-computed global score, one per referenceYear — no averaging needed
  const sorted = data.history
    .filter((r) => r.score !== null)
    .map((r) => ({ year: r.referenceYear, score: r.score as number }))
    .sort((a, b) => a.year - b.year);

  const sparklineData = sorted.slice(-4);

  if (sorted.length < 2) {
    const last = sorted[sorted.length - 1] ?? null;
    return {
      data: {
        delta: null,
        direction: "neutral" as const,
        sparklineData,
        latestYear: last?.year ?? null,
        previousYear: null,
      },
      isLoading,
      isError,
    };
  }

  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const delta = Math.round((latest.score - previous.score) * 10) / 10;

  return {
    data: {
      delta,
      direction:
        delta >= 0.5 ? ("up" as const) : delta <= -0.5 ? ("down" as const) : ("neutral" as const),
      sparklineData,
      latestYear: latest.year,
      previousYear: previous.year,
    },
    isLoading,
    isError,
  };
}
