import type { Decimal } from "decimal.js";

export type InvestmentType =
  | "education"
  | "health"
  | "sanitation"
  | "security"
  | "environment";

export type SimulationStatus = "pending" | "running" | "completed" | "failed";

export interface Simulation {
  id: string;
  municipalityId: string;
  scenarioName: string;
  investmentAmount: Decimal;
  investmentType: InvestmentType;
  targetOds: number[];
  projectedImpact: Record<string, unknown>;
  status: SimulationStatus;
  createdAt: Date;
  completedAt: Date | null;
}
