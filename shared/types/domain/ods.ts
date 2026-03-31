export interface OdsDefinition {
  number: number;
  name: string;
  shortName: string;
  color: string;
  weight: number;
}

export interface OdsIndicator {
  id: string;
  municipalityId: string;
  odsNumber: number;
  indicatorName: string;
  value: number | null;
  score: number | null;
  status: OdsStatus | null;
  source: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
}

export type OdsStatus = "verde" | "amarelo" | "vermelho";

export function getOdsStatus(score: number): OdsStatus {
  if (score >= 70) return "verde";
  if (score >= 40) return "amarelo";
  return "vermelho";
}
