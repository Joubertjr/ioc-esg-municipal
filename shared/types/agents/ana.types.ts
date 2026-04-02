import { z } from "zod";

// ─── Schema do JSON estático (validado na carga) ─────────────────────────────

export const AnaMunicipalEntrySchema = z.object({
  iqaRios: z.number().min(0).max(100).nullable(),
  mataCiliarPct: z.number().min(0).max(100).nullable(),
});

export const AnaDataFileSchema = z.record(z.string(), AnaMunicipalEntrySchema);

export type AnaMunicipalEntry = z.infer<typeof AnaMunicipalEntrySchema>;
export type AnaDataFile = z.infer<typeof AnaDataFileSchema>;

// ─── Dados consolidados do município ──────────────────────────────────────────

export interface AnaMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: AnaIndicators;
}

export interface AnaIndicators {
  iqaRios: number | null;         // Índice de Qualidade da Água (0-100, maior = melhor)
  mataCiliarPct: number | null;   // % de cobertura de mata ciliar preservada
}
