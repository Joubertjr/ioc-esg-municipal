export type OdsStatus = "verde" | "amarelo" | "vermelho";

export interface ApiOdsIndicator {
  id: string;
  municipalityId: string;
  odsNumber: number;
  indicatorName: string;
  value: number | null;
  score: number | null;
  status: OdsStatus | null;
  source: string;
  referenceYear: number;
  referenceDate: string;
  dataAvailable: boolean;
}

export interface OdsSummary {
  odsNumber: number;
  name: string;
  shortName: string;
  color: string;
  weight: number;
  score: number | null;
  status: OdsStatus | null;
  indicators: ApiOdsIndicator[];
  sources: string[];
}

export interface MunicipalOdsReport {
  ibgeCode: string;
  municipalityName: string | null;
  referenceYear: number;
  globalScore: number | null;
  globalStatus: OdsStatus | null;
  odsCount: {
    total: number;
    withData: number;
    verde: number;
    amarelo: number;
    vermelho: number;
  };
  ods: OdsSummary[];
}

// ---- Simulator ----

export type InvestmentArea =
  | "education"
  | "health"
  | "sanitation"
  | "environment"
  | "security"
  | "energy"
  | "urbanization"
  | "governance";

export const INVESTMENT_AREA_LABELS: Record<InvestmentArea, string> = {
  education: "Educacao",
  health: "Saude",
  sanitation: "Saneamento",
  environment: "Meio Ambiente",
  security: "Seguranca",
  energy: "Energia",
  urbanization: "Urbanizacao",
  governance: "Governanca",
};

export type InvestmentAllocation = Record<InvestmentArea, number>;

export interface SimulationRequest {
  ibgeCode: string;
  totalAmount: number;
  allocation: InvestmentAllocation;
}

export interface OdsSimulationResult {
  odsNumber: number;
  name: string;
  shortName: string;
  color: string;
  currentScore: number | null;
  projectedScore: number | null;
  delta: number | null;
  currentStatus: OdsStatus | null;
  projectedStatus: OdsStatus | null;
}

export interface SimulationResult {
  ibgeCode: string;
  municipalityName: string | null;
  totalAmount: number;
  allocation: InvestmentAllocation;
  currentGlobalScore: number | null;
  projectedGlobalScore: number | null;
  globalDelta: number | null;
  ods: OdsSimulationResult[];
}

// ---- Municipalities ----

export interface MunicipalityListItem {
  ibgeCode: string;
  name: string;
  population: number | null;
}

// ---- Auth ----

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export const STATUS_COLORS: Record<OdsStatus, string> = {
  verde: "bg-green-500",
  amarelo: "bg-amber-400",
  vermelho: "bg-red-500",
};

export const STATUS_TEXT_COLORS: Record<OdsStatus, string> = {
  verde: "text-green-700",
  amarelo: "text-amber-700",
  vermelho: "text-red-700",
};

export const STATUS_LABELS: Record<OdsStatus, string> = {
  verde: "Verde",
  amarelo: "Amarelo",
  vermelho: "Vermelho",
};
