import { z } from "zod";

// ─── Schema do JSON estático (validado na carga) ─────────────────────────────

export const SisvanMunicipalEntrySchema = z.object({
  cobertura_acompanhamento: z.number().min(0).max(100),  // % crianças acompanhadas pelo SISVAN
  deficit_nutricional: z.number().min(0).max(100),       // % crianças com déficit nutricional (INVERTIDO)
  sobrepeso_infantil: z.number().min(0).max(100),        // % crianças com sobrepeso (INVERTIDO)
});

export const SisvanDataFileSchema = z.record(z.string(), SisvanMunicipalEntrySchema);

export type SisvanMunicipalEntry = z.infer<typeof SisvanMunicipalEntrySchema>;
export type SisvanDataFile = z.infer<typeof SisvanDataFileSchema>;

// ─── Dados consolidados do município ─────────────────────────────────────────

export interface SisvanMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: SisvanIndicators;
}

export interface SisvanIndicators {
  cobertura_acompanhamento: number;  // % crianças acompanhadas pelo SISVAN (maior = melhor)
  deficit_nutricional: number;       // % crianças com déficit nutricional (INVERTIDO — menor = melhor)
  sobrepeso_infantil: number;        // % crianças com sobrepeso (INVERTIDO — menor = melhor)
}
