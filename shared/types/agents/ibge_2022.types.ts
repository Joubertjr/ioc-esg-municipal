import { z } from "zod";

// ─── Schema do JSON estático ibge_2022.json (validado na carga) ──────────────

export const Ibge2022MunicipalEntrySchema = z.object({
  /**
   * % de domicílios urbanos com infraestrutura adequada (água + esgoto + coleta de lixo).
   * Fonte: IBGE Censo Demográfico 2022.
   * Range válido: 30 – 100 (benchmarks municípios SC: 40–93).
   * Maior valor = melhor infraestrutura urbana = melhor para ODS 11.
   */
  urbanizacaoAdequada: z.number().min(30).max(100),
});

export const Ibge2022DataFileSchema = z.record(
  z.string(),
  Ibge2022MunicipalEntrySchema,
);

export type Ibge2022MunicipalEntry = z.infer<typeof Ibge2022MunicipalEntrySchema>;
export type Ibge2022DataFile = z.infer<typeof Ibge2022DataFileSchema>;
