import { useQuery } from "@tanstack/react-query";
import { apiPost } from "../lib/api";
import type { BenchmarkResult, CompareResult } from "../types/api";

function isValidCode(code: string): boolean {
  return /^\d{7}$/.test(code);
}

async function fetchBenchmark(ibgeCodes: string[]): Promise<BenchmarkResult> {
  return apiPost<BenchmarkResult>("/api/benchmarks", { ibgeCodes });
}

async function fetchCompare(ibgeCode: string, benchmarkCodes: string[]): Promise<CompareResult> {
  return apiPost<CompareResult>("/api/benchmarks/compare", {
    ibgeCode,
    benchmarkCodes,
  });
}

export function useBenchmark(ibgeCodes: string[]) {
  const validCodes = ibgeCodes.filter(isValidCode);
  return useQuery<BenchmarkResult, Error>({
    queryKey: ["benchmark", ...validCodes.sort()],
    queryFn: () => fetchBenchmark(validCodes),
    enabled: validCodes.length >= 2,
    staleTime: 5 * 60_000,
  });
}

export function useCompare(ibgeCode: string, benchmarkCodes: string[]) {
  const validBenchmarkCodes = benchmarkCodes.filter(isValidCode);
  return useQuery<CompareResult, Error>({
    queryKey: ["benchmark-compare", ibgeCode, ...validBenchmarkCodes.sort()],
    queryFn: () => fetchCompare(ibgeCode, validBenchmarkCodes),
    enabled: isValidCode(ibgeCode) && validBenchmarkCodes.length >= 1,
    staleTime: 5 * 60_000,
  });
}
