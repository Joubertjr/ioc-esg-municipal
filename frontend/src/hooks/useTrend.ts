import { useOdsHistory } from "./useOdsHistory";

export interface TrendData {
  delta: number | null;
  direction: "up" | "down" | "neutral";
  sparklineData: Array<{ year: number; score: number }>;
  latestYear: number | null;
  previousYear: number | null;
}

export function useTrend(ibgeCode: string) {
  const { data, isLoading, isError } = useOdsHistory(ibgeCode);

  if (!data) return { data: undefined as TrendData | undefined, isLoading, isError };

  // Group by referenceYear, compute average score per year
  const yearMap = new Map<number, { sum: number; count: number }>();
  for (const record of data.history) {
    if (record.score === null) continue;
    const existing = yearMap.get(record.referenceYear);
    if (existing) {
      existing.sum += record.score;
      existing.count += 1;
    } else {
      yearMap.set(record.referenceYear, { sum: record.score, count: 1 });
    }
  }

  const sorted = Array.from(yearMap.entries())
    .map(([year, { sum, count }]) => ({ year, score: Math.round((sum / count) * 10) / 10 }))
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
        delta > 0.5 ? ("up" as const) : delta < -0.5 ? ("down" as const) : ("neutral" as const),
      sparklineData,
      latestYear: latest.year,
      previousYear: previous.year,
    },
    isLoading,
    isError,
  };
}
