import { z } from "zod";

// ─── Schema do JSON estático (validado na carga) ─────────────────────────────

export const AnatelMunicipalEntrySchema = z.object({
  acessosBandaLargaPor100hab: z.number().min(0).max(100),
  cobertura4gPercentual: z.number().min(0).max(100),
});

export const AnatelDataFileSchema = z.record(z.string(), AnatelMunicipalEntrySchema);

export type AnatelMunicipalEntry = z.infer<typeof AnatelMunicipalEntrySchema>;
export type AnatelDataFile = z.infer<typeof AnatelDataFileSchema>;

// ─── Dados consolidados do município ─────────────────────────────────────────

export interface AnatelMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: AnatelIndicators;
}

export interface AnatelIndicators {
  acessosBandaLargaPor100hab: number; // acessos banda larga fixa por 100 habitantes
  cobertura4gPercentual: number;      // percentual de cobertura 4G no município
}
