import { z } from "zod";

// ─── Schema do JSON estático gini_2022.json (validado na carga) ──────────────

export const GiniMunicipalEntrySchema = z.object({
  /**
   * Coeficiente de Gini de renda domiciliar per capita.
   * Fonte: IBGE Censo Demográfico 2022.
   * Range válido: 0.30 – 0.65 (benchmarks municípios SC).
   * Menor valor = menor desigualdade = melhor para ODS 10.
   */
  coeficienteGini: z.number().min(0.3).max(0.65),
  /**
   * Razão de renda entre os 20% mais ricos e os 20% mais pobres.
   * Fonte: derivado do Censo IBGE 2022 correlacionado com Gini.
   * Range típico: 5–22 para municípios SC.
   * Menor valor = menor desigualdade = melhor para ODS 10.
   */
  razao2020: z.number().min(4).max(25),
});

export const GiniDataFileSchema = z.record(z.string(), GiniMunicipalEntrySchema);

export type GiniMunicipalEntry = z.infer<typeof GiniMunicipalEntrySchema>;
export type GiniDataFile = z.infer<typeof GiniDataFileSchema>;
