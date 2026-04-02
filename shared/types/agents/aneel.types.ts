import { z } from "zod";

// ─── Schema do JSON estático (validado na carga) ─────────────────────────────

export const AneelMunicipalEntrySchema = z.object({
  geracaoDistribuidaKw: z.number().min(0).nullable(),
  unidadesGd: z.number().int().min(0).nullable(),
  populacao: z.number().int().min(0).nullable(),
});

export const AneelDataFileSchema = z.record(z.string(), AneelMunicipalEntrySchema);

export type AneelMunicipalEntry = z.infer<typeof AneelMunicipalEntrySchema>;
export type AneelDataFile = z.infer<typeof AneelDataFileSchema>;

// ─── Dados consolidados do município ─────────────────────────────────────────

export interface AneelMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: AneelIndicators;
}

export interface AneelIndicators {
  geracaoDistribuidaKw: number | null; // potência instalada GD solar em kW
  unidadesGd: number | null;           // número de unidades consumidoras com GD
  populacao: number | null;            // população do município (para per capita)
}
