import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api";
import type { ExecutiveReport } from "../types/api";

async function fetchExecutiveReport(ibgeCode: string): Promise<ExecutiveReport> {
  return apiGet<ExecutiveReport>(`/api/agent/reports/${ibgeCode}/executive`);
}

export function useExecutiveReport(ibgeCode: string) {
  return useQuery<ExecutiveReport, Error>({
    queryKey: ["executive-report", ibgeCode],
    queryFn: () => fetchExecutiveReport(ibgeCode),
    enabled: /^\d{7}$/.test(ibgeCode),
    staleTime: 5 * 60_000,
  });
}
