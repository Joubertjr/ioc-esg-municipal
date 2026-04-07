// Canonical mapping: ODS number → simulator investment area
// Used by both backend scenario service and frontend

export type InvestmentArea =
  | "education"
  | "health"
  | "sanitation"
  | "environment"
  | "security"
  | "energy"
  | "urbanization"
  | "governance";

export const ODS_TO_AREA_MAP: Record<number, InvestmentArea> = {
  1: "governance",
  2: "governance",
  3: "health",
  4: "education",
  5: "governance",
  6: "sanitation",
  7: "energy",
  8: "urbanization",
  9: "urbanization",
  10: "governance",
  11: "urbanization",
  12: "environment",
  13: "environment",
  14: "sanitation",
  15: "environment",
  16: "governance",
  17: "governance",
} as const;

export const ALL_INVESTMENT_AREAS: InvestmentArea[] = [
  "education",
  "health",
  "sanitation",
  "environment",
  "security",
  "energy",
  "urbanization",
  "governance",
];
