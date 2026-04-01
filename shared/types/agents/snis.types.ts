import { z } from "zod";

// ─── Schema do JSON estático (validado na carga) ─────────────────────────────

export const SnisMunicipalEntrySchema = z.object({
  atendimentoAgua: z.number().nonnegative().nullable(),       // IN023 (%)
  atendimentoEsgoto: z.number().nonnegative().nullable(),     // IN056 (%)
  esgotoTratado: z.number().nonnegative().nullable(),         // IN046 (%)
  perdaFaturamento: z.number().nonnegative().nullable(),      // IN049 (%)
});

export const SnisDataFileSchema = z.record(z.string(), SnisMunicipalEntrySchema);

export type SnisMunicipalEntry = z.infer<typeof SnisMunicipalEntrySchema>;
export type SnisDataFile = z.infer<typeof SnisDataFileSchema>;

// ─── Dados consolidados do município ──────────────────────────────────────────

export interface SnisMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: SnisIndicators;
}

export interface SnisIndicators {
  atendimentoAgua: number | null;       // % população com acesso a água (IN023)
  atendimentoEsgoto: number | null;     // % população com coleta de esgoto (IN056)
  esgotoTratado: number | null;         // % esgoto tratado sobre coletado (IN046)
  perdaFaturamento: number | null;      // % perda de faturamento (IN049)
}
