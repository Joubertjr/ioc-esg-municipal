import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api";
import type { OdsHistoryResponse } from "../types/api";

async function fetchOdsHistory(ibgeCode: string, odsNumber?: number): Promise<OdsHistoryResponse> {
  const params = odsNumber !== undefined ? `?odsNumber=${odsNumber}` : "";
  return apiGet<OdsHistoryResponse>(`/api/ods/${ibgeCode}/history${params}`);
}

export function useOdsHistory(ibgeCode: string, odsNumber?: number) {
  return useQuery<OdsHistoryResponse, Error>({
    queryKey: ["ods-history", ibgeCode, odsNumber ?? "all"],
    queryFn: () => fetchOdsHistory(ibgeCode, odsNumber),
    enabled: /^\d{7}$/.test(ibgeCode),
    staleTime: 10 * 60_000,
  });
}
