import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api";

export interface FormulaVariable {
  symbol: string;
  meaning: string;
}

export interface IndicatorMethodology {
  name: string;
  label: string;
  unit: string;
  source: string;
  agent: string;
  explanation: string;
  goodDirection: "up" | "down";
  formula: string;
  formulaVariables: FormulaVariable[];
  benchmarks: { min: string; max: string; description: string };
}

export interface OdsMethodology {
  odsNumber: number;
  name: string;
  shortName: string;
  color: string;
  weight: number;
  description: string;
  meta2030: string;
  aggregation: string;
  indicators: IndicatorMethodology[];
}

export interface MethodologyReport {
  version: string;
  lastUpdated: string;
  globalScoreMethod: {
    arithmetic: string;
    geometric: string;
    preferred: string;
  };
  statusThresholds: {
    verde: string;
    amarelo: string;
    vermelho: string;
  };
  ods: OdsMethodology[];
}

async function fetchMethodology(): Promise<MethodologyReport> {
  return apiGet<MethodologyReport>("/api/ods/methodology");
}

export function useMethodology() {
  return useQuery<MethodologyReport, Error>({
    queryKey: ["ods-methodology"],
    queryFn: fetchMethodology,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
