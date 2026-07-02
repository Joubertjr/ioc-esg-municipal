import { z } from "zod";

// ─── Schema do JSON estático (validado na carga) ─────────────────────────────

export const ConveniosMunicipalEntrySchema = z.object({
  conveniosFederaisAtivos: z.number().int().min(0).nullable(),
  pctOrcamentoConvenios: z.number().min(0).max(100).nullable(),
  consorciosIntermunicipais: z.number().int().min(0).nullable(),
  valorTotalRepasse: z.number().min(0).nullable().optional(),
  valorTotalDesembolsado: z.number().min(0).nullable().optional(),
  valorTotalGlobal: z.number().min(0).nullable().optional(),
});

export const ConveniosDataFileSchema = z.record(z.string(), ConveniosMunicipalEntrySchema);

export type ConveniosMunicipalEntry = z.infer<typeof ConveniosMunicipalEntrySchema>;
export type ConveniosDataFile = z.infer<typeof ConveniosDataFileSchema>;

// ─── Dados consolidados do município ──────────────────────────────────────────

export interface ConveniosMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: ConveniosIndicators;
}

export interface ConveniosIndicators {
  conveniosFederaisAtivos: number | null;
  pctOrcamentoConvenios: number | null;
  consorciosIntermunicipais: number | null;
  valorTotalRepasse: number | null;
  valorTotalDesembolsado: number | null;
  valorTotalGlobal: number | null;
}
