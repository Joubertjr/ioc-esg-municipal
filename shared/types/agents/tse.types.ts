import { z } from "zod";

// ─── Schema do JSON estático (validado na carga) ─────────────────────────────

export const TseMunicipalEntrySchema = z.object({
  pctMulheresEleitas: z.number().min(0).max(100).nullable(),
  pctCandidatasMulheres: z.number().min(0).max(100).nullable(),
});

export const TseDataFileSchema = z.record(z.string(), TseMunicipalEntrySchema);

export type TseMunicipalEntry = z.infer<typeof TseMunicipalEntrySchema>;
export type TseDataFile = z.infer<typeof TseDataFileSchema>;

// ─── Dados consolidados do município ──────────────────────────────────────────

export interface TseMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: TseIndicators;
}

export interface TseIndicators {
  pctMulheresEleitas: number | null;      // % vereadoras eleitas sobre total de vereadores
  pctCandidatasMulheres: number | null;   // % candidatas mulheres sobre total de candidatos
}
