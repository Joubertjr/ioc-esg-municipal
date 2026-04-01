import { z } from "zod";

// ─── Resposta da API Previne Brasil (DEMAS) ──────────────────────────────────

export const PrevineBrasilItemSchema = z.object({
  uf: z.string(),
  municipio: z.string().optional(),
  codigo_municipio: z.union([z.string(), z.number()]),
  quadrimestre: z.string(),
  codigo_tipo_indicador: z.number(),
  numerador: z.number().nullable().optional(),
  denominador_utilizador: z.number().nullable().optional(),
  denominador_identificado: z.number().nullable().optional(),
  denominador_estimado: z.number().nullable().optional(),
  percentual: z.number().nullable(),
  percentual_quadrimestre: z.number().nullable().optional(),
  populacao: z.number().nullable().optional(),
  visao_equipe: z.string().optional(),
  cadastro: z.number().nullable().optional(),
  base_externa: z.number().nullable().optional(),
  competencia: z.number().nullable().optional(),
});

export const PrevineBrasilResponseSchema = z.object({
  sisab_indicador_desempenho: z.array(PrevineBrasilItemSchema),
});

export type PrevineBrasilItem = z.infer<typeof PrevineBrasilItemSchema>;
export type PrevineBrasilResponse = z.infer<typeof PrevineBrasilResponseSchema>;

// ─── Tipos de indicador Previne Brasil ────────────────────────────────────────

export const PREVINE_INDICATOR_TYPES = {
  PRENATAL: 10,       // Cobertura de pré-natal
  DIABETES: 20,       // Manejo de diabetes
  HIPERTENSAO: 30,    // Manejo de hipertensão arterial
  CRIANCA: 40,        // Acompanhamento do crescimento infantil
  CANCER_COLO: 50,    // Rastreamento de câncer de colo uterino
  SAUDE_BUCAL: 70,    // Saúde bucal
} as const;

export const PREVINE_INDICATOR_NAMES: Record<number, string> = {
  10: "prenatal",
  20: "diabetes",
  30: "hipertensao",
  40: "crescimento_infantil",
  50: "cancer_colo_uterino",
  70: "saude_bucal",
};

// ─── Dados consolidados do município ──────────────────────────────────────────

export interface DatasusMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: DatasusIndicators;
}

export interface DatasusIndicators {
  prenatal: number | null;           // Tipo 10
  diabetes: number | null;           // Tipo 20
  hipertensao: number | null;        // Tipo 30
  crescimentoInfantil: number | null; // Tipo 40
  cancerColoUterino: number | null;  // Tipo 50
  saudeBucal: number | null;         // Tipo 70
  mediaGeral: number | null;
}
