import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api";
import type { MunicipalOdsReport } from "../types/api";

async function fetchOdsReport(ibgeCode: string): Promise<MunicipalOdsReport> {
  return apiGet<MunicipalOdsReport>(`/api/ods/${ibgeCode}`);
}

export function useOdsReport(ibgeCode: string) {
  return useQuery<MunicipalOdsReport, Error>({
    queryKey: ["ods-report", ibgeCode],
    queryFn: () => fetchOdsReport(ibgeCode),
    enabled: /^\d{7}$/.test(ibgeCode),
  });
}
