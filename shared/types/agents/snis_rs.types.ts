import { z } from "zod";

// ─── Schema do JSON estático (validado na carga) ─────────────────────────────

export const SnisRsMunicipalEntrySchema = z.object({
  coletaSeletivaPct: z.number().min(0).max(100).nullable(),      // % da pop atendida por coleta seletiva
  taxaReciclagemPct: z.number().min(0).max(100).nullable(),      // % resíduos reciclados sobre total coletado
  residuoPerCapitaKgDia: z.number().min(0).max(10).nullable(),   // kg/hab/dia gerados (menor = melhor)
});

export const SnisRsDataFileSchema = z.record(z.string(), SnisRsMunicipalEntrySchema);

export type SnisRsMunicipalEntry = z.infer<typeof SnisRsMunicipalEntrySchema>;
export type SnisRsDataFile = z.infer<typeof SnisRsDataFileSchema>;

// ─── Dados consolidados do município ──────────────────────────────────────────

export interface SnisRsMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: SnisRsIndicators;
}

export interface SnisRsIndicators {
  coletaSeletivaPct: number | null;      // % da pop atendida por coleta seletiva
  taxaReciclagemPct: number | null;      // % resíduos reciclados
  residuoPerCapitaKgDia: number | null;  // kg/hab/dia de resíduos gerados (menor = melhor)
}
