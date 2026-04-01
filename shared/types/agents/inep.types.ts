import { z } from "zod";

// ─── Schema do JSON estático (validado na carga) ─────────────────────────────

export const IdebMunicipalEntrySchema = z.object({
  idebAnosIniciais: z.number().min(0).max(10).nullable(),
  idebAnosFinais: z.number().min(0).max(10).nullable(),
});

export const IdebDataFileSchema = z.record(z.string(), IdebMunicipalEntrySchema);

export type IdebMunicipalEntry = z.infer<typeof IdebMunicipalEntrySchema>;
export type IdebDataFile = z.infer<typeof IdebDataFileSchema>;

// ─── Dados consolidados do município ──────────────────────────────────────────

export interface InepMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: InepIndicators;
}

export interface InepIndicators {
  idebAnosIniciais: number | null;   // Nota 0-10, rede pública, anos iniciais (1-5 ano)
  idebAnosFinais: number | null;     // Nota 0-10, rede pública, anos finais (6-9 ano)
}
