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

/**
 * Classificação de frescor dos dados usados para calcular um score ODS.
 * - fresh    : < 1 ano (dados do mês corrente ou recentes)
 * - recent   : 1-2 anos (aceitável para indicadores anuais)
 * - stale    : 2-4 anos (usar com cautela, avisar o usuário)
 * - critical : > 4 anos (risco alto de decisão errada — precisa re-coleta)
 * - unknown  : sem metadata de referência
 */
export type DataStaleness = "fresh" | "recent" | "stale" | "critical" | "unknown";

export interface SourceFreshness {
  name: string;
  referenceYear: number;
  ageYears: number;
  staleness: DataStaleness;
}

export interface DataFreshness {
  newestYear: number | null;
  oldestYear: number | null;
  ageYears: number | null;
  staleness: DataStaleness;
  sources: SourceFreshness[];
}

/**
 * Classifica idade em anos para bucket de staleness.
 * Regras calibradas para o domínio de dados públicos brasileiros:
 * IBGE/SICONFI/DATASUS/INPE/PNCP publicam contínuo → fresh (<1a).
 * IDEB é bienal, SNIS tem ~18 meses de atraso → recent OK até 2a.
 * IEPS 2021 (5a) e INPE desatualizado → critical.
 */
export function classifyStaleness(ageYears: number): DataStaleness {
  if (ageYears < 1) return "fresh";
  if (ageYears < 2) return "recent";
  if (ageYears < 4) return "stale";
  return "critical";
}

export interface OdsSummary {
  odsNumber: number;
  name: string;
  shortName: string;
  color: string;
  weight: number;
  score: number | null;
  status: OdsStatus | null;
  indicators: OdsIndicator[];
  sources: string[];
  dataFreshness: DataFreshness;
}

export interface MunicipalOdsReport {
  ibgeCode: string;
  municipalityName: string | null;
  referenceYear: number;
  globalScore: number | null;
  globalStatus: OdsStatus | null;
  geometricScore: number | null;
  geometricStatus: OdsStatus | null;
  odsCount: { total: number; withData: number; verde: number; amarelo: number; vermelho: number };
  dataFreshness: DataFreshness;
  ods: OdsSummary[];
  dataSource?: "database" | "realtime";
  dataCollectedAt?: string | null;
}
