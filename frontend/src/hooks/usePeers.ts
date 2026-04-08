import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api";
import type { PeersResult } from "../types/api";

export function usePeers(ibgeCode: string, topN = 5) {
  return useQuery<PeersResult>({
    queryKey: ["peers", ibgeCode, topN],
    queryFn: () => apiGet<PeersResult>(`/api/municipalities/${ibgeCode}/peers?topN=${topN}`),
    enabled: /^\d{7}$/.test(ibgeCode),
    staleTime: 10 * 60_000, // 10 min — peers are stable
  });
}
