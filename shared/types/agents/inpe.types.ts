import { z } from "zod";

// ─── Schemas Zod para validar respostas GeoJSON do GeoServer ────────────────

export const InpeMunicipalityFeatureSchema = z.object({
  type: z.literal("Feature"),
  properties: z.object({
    geocodigo: z.string().optional(),
    nome: z.string().optional(),
    state: z.string().optional(),
  }),
  geometry: z
    .object({
      type: z.string(),
      coordinates: z.unknown(),
    })
    .nullable()
    .optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

export const InpeMunicipalityCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(InpeMunicipalityFeatureSchema),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

export const InpeDeforestationFeatureSchema = z.object({
  type: z.literal("Feature"),
  properties: z.object({
    /** Estado (ex: "SC") */
    state: z.string().optional(),
    /** Ano do desmatamento */
    year: z.number(),
    /** Área desmatada em km² */
    area_km: z.number(),
    /** Classe principal (ex: "desmatamento") */
    main_class: z.string().optional(),
    /** Satélite usado (ex: "sentinel 2B") */
    satellite: z.string().optional(),
  }),
  geometry: z
    .object({
      type: z.string(),
      coordinates: z.unknown(),
    })
    .nullable()
    .optional(),
});

export const InpeDeforestationCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(InpeDeforestationFeatureSchema),
});

export type InpeMunicipalityCollection = z.infer<
  typeof InpeMunicipalityCollectionSchema
>;
export type InpeDeforestationCollection = z.infer<
  typeof InpeDeforestationCollectionSchema
>;

// ─── BBox ────────────────────────────────────────────────────────────────────

/** [minX, minY, maxX, maxY] — EPSG:4674 */
export type BBox = [number, number, number, number];

// ─── Dados normalizados para uso interno ────────────────────────────────────

export interface InpeIndicators {
  /** Desmatamento no ano mais recente disponível (km²) */
  desmatamentoAnualKm2: number | null;
  /** Ano de referência do desmatamento anual */
  anoReferencia: number | null;
  /** Desmatamento acumulado desde 2000 (km²) — soma da série histórica */
  desmatamentoAcumuladoKm2: number | null;
  /**
   * Tendência de desmatamento (variação YoY do último ano completo vs. anterior).
   * Positivo = aumentou | Negativo = diminuiu | null = sem dados suficientes.
   */
  tendenciaDesmatamento: number | null;
  /** Série histórica anual: { ano → km² } */
  serieHistorica: Record<number, number>;
}

export interface InpeMunicipalData {
  ibgeCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: InpeIndicators;
}
