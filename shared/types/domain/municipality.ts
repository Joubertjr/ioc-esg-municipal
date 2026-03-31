import type { Decimal } from "decimal.js";

export interface Municipality {
  id: string;
  ibgeCode: string;
  siconfiCode: string;
  name: string;
  state: string;
  population: number | null;
  fpmAnnual: Decimal | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface MunicipalitySeed {
  ibgeCode: string;
  siconfiCode: string;
  name: string;
  population?: number;
}
