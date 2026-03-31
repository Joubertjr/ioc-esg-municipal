import { useQuery } from "@tanstack/react-query";
import type { MunicipalOdsReport } from "../types/api";

async function fetchOdsReport(ibgeCode: string): Promise<MunicipalOdsReport> {
  const res = await fetch(`/api/ods/${ibgeCode}`);
  if (!res.ok) {
    throw new Error(`Erro ao buscar dados ODS: HTTP ${res.status}`);
  }
  return res.json();
}

export function useOdsReport(ibgeCode: string) {
  return useQuery<MunicipalOdsReport, Error>({
    queryKey: ["ods-report", ibgeCode],
    queryFn: () => fetchOdsReport(ibgeCode),
    enabled: /^\d{7}$/.test(ibgeCode),
  });
}
