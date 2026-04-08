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
  geometricScore: number | null;
  geometricStatus: OdsStatus | null;
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
  education: "Educação",
  health: "Saúde",
  sanitation: "Saneamento",
  environment: "Meio Ambiente",
  security: "Segurança",
  energy: "Energia",
  urbanization: "Urbanização",
  governance: "Governança",
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
  verde: "bg-success",
  amarelo: "bg-warning",
  vermelho: "bg-danger",
};

export const STATUS_TEXT_COLORS: Record<OdsStatus, string> = {
  verde: "text-success",
  amarelo: "text-warning",
  vermelho: "text-danger",
};

export const STATUS_LABELS: Record<OdsStatus, string> = {
  verde: "Verde",
  amarelo: "Amarelo",
  vermelho: "Vermelho",
};

// ---- Benchmarks ----

export interface MunicipalityBenchmark {
  ibgeCode: string;
  municipalityName: string | null;
  globalScore: number | null;
  globalStatus: string | null;
  odsScores: Record<number, number | null>;
}

export interface RankingEntry {
  position: number;
  ibgeCode: string;
  municipalityName: string | null;
  globalScore: number;
}

export interface OdsAverage {
  odsNumber: number;
  average: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

export interface BenchmarkResult {
  generatedAt: string;
  referenceYear: number;
  municipalityCount: number;
  municipalities: MunicipalityBenchmark[];
  ranking: RankingEntry[];
  averages: OdsAverage[];
  globalAverage: number | null;
}

export interface OdsComparisonEntry {
  odsNumber: number;
  municipalityScore: number | null;
  benchmarkAverage: number | null;
  delta: number | null;
  aboveAverage: boolean | null;
}

export interface CompareResult {
  municipality: MunicipalityBenchmark | null;
  benchmark: BenchmarkResult;
  comparison: OdsComparisonEntry[];
}

// ---- History ----

export interface OdsScoreRecord {
  id: string;
  municipalityId: string;
  odsNumber: number;
  score: number | null;
  status: OdsStatus | null;
  indicatorCount: number;
  referenceYear: number;
  calculatedAt: string;
  sources: string[];
}

export interface OdsHistoryResponse {
  ibgeCode: string;
  total: number;
  history: OdsScoreRecord[];
}

// ---- Recommendations ----

export interface SmartRecommendation {
  odsNumber: number;
  odsName: string;
  priority: "critica" | "alta" | "media";
  currentScore: number;
  stateAverage: number | null;
  gap: number | null;
  ranking: string;
  actions: string[];
  investmentArea: string;
  estimatedImpact: string;
}

export interface RecommendationReport {
  ibgeCode: string;
  municipalityName: string | null;
  generatedAt: string;
  totalRecommendations: number;
  criticalCount: number;
  summary: string;
  recommendations: SmartRecommendation[];
  strengths: Array<{ odsNumber: number; odsName: string; score: number }>;
}

export interface ScenarioReasoning {
  area: InvestmentArea;
  percentage: number;
  odsNumbers: number[];
  justification: string;
}

export interface RecommendedScenario {
  ibgeCode: string;
  municipalityName: string | null;
  totalAmount: null;
  allocation: InvestmentAllocation;
  reasoning: ScenarioReasoning[];
  basedOnRecommendations: number;
  allOdsGreen: boolean;
}
