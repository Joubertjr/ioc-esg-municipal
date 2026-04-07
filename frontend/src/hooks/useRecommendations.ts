import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api";
import type { RecommendationReport } from "../types/api";

async function fetchRecommendations(ibgeCode: string): Promise<RecommendationReport> {
  return apiGet<RecommendationReport>(`/api/recommendations/${ibgeCode}`);
}

export function useRecommendations(ibgeCode: string) {
  return useQuery<RecommendationReport, Error>({
    queryKey: ["recommendations", ibgeCode],
    queryFn: () => fetchRecommendations(ibgeCode),
    enabled: /^\d{7}$/.test(ibgeCode),
    staleTime: 10 * 60_000,
  });
}
