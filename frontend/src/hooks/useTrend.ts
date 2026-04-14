import { useOdsHistory } from "./useOdsHistory";
import type { ComparabilityReason } from "../types/api";

export interface TrendData {
  delta: number | null;
  direction: "up" | "down" | "neutral";
  sparklineData: Array<{ year: number; score: number }>;
  latestYear: number | null;
  previousYear: number | null;
  comparable: boolean;
  comparabilityReason: ComparabilityReason | null;
  currentCoverage: number | null;
  previousCoverage: number | null;
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
  const trend = data.trend;

  // Use backend comparability assessment when available
  if (trend && !trend.enabled) {
    return {
      data: {
        delta: null,
        direction: "neutral" as const,
        sparklineData,
        latestYear: trend.currentYear,
        previousYear: trend.previousYear,
        comparable: false,
        comparabilityReason: trend.reason,
        currentCoverage: trend.currentCoverage,
        previousCoverage: trend.previousCoverage,
      },
      isLoading,
      isError,
    };
  }

  if (trend && trend.enabled) {
    const delta = trend.delta;
    return {
      data: {
        delta,
        direction:
          delta !== null && delta >= 0.5
            ? ("up" as const)
            : delta !== null && delta <= -0.5
              ? ("down" as const)
              : ("neutral" as const),
        sparklineData,
        latestYear: trend.currentYear,
        previousYear: trend.previousYear,
        comparable: true,
        comparabilityReason: "ok" as const,
        currentCoverage: trend.currentCoverage,
        previousCoverage: trend.previousCoverage,
      },
      isLoading,
      isError,
    };
  }

  // Fallback for when trend is not present in API response
  if (sorted.length < 2) {
    const last = sorted[sorted.length - 1] ?? null;
    return {
      data: {
        delta: null,
        direction: "neutral" as const,
        sparklineData,
        latestYear: last?.year ?? null,
        previousYear: null,
        comparable: false,
        comparabilityReason: "single_point_only" as const,
        currentCoverage: null,
        previousCoverage: null,
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
      comparable: true,
      comparabilityReason: "ok" as const,
      currentCoverage: null,
      previousCoverage: null,
    },
    isLoading,
    isError,
  };
}
