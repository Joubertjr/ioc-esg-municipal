import { z } from "zod";

// ─── Schema de uma contratação retornada pelo PNCP (API de consulta) ─────────

/**
 * Schema de uma contratação retornada por
 * GET /api/consulta/v1/contratacoes/publicacao
 *
 * Gotcha: o campo srp (Sistema de Registro de Preços) pode vir como boolean
 * ou null. A modalidade de dispensa tem codigoModalidadeContratacao === 7.
 */
export const PncpContratacaoSchema = z.object({
  sequencialCompra: z.number().optional(),
  anoCompra: z.number().optional(),
  numeroCompra: z.string().optional(),
  orgaoEntidade: z
    .object({
      cnpj: z.string().optional(),
      razaoSocial: z.string().optional(),
    })
    .optional(),
  unidadeOrgao: z
    .object({
      codigoMunicipioIbge: z.string().optional(),
      ufSigla: z.string().optional(),
    })
    .optional(),
  objetoCompra: z.string().optional(),
  /** Valor total estimado (R$) — antes do pregão */
  valorTotalEstimado: z.number().nullable().optional(),
  /** Valor total homologado (R$) — após o pregão */
  valorTotalHomologado: z.number().nullable().optional(),
  dataPublicacaoPncp: z.string().optional(),
  modoDisputaNome: z.string().optional(),
  /**
   * Indica se a contratação usa Sistema de Registro de Preços (SRP).
   * Proxy de eficiência — permite adesão por outros órgãos.
   */
  srp: z.boolean().nullable().optional(),
  /**
   * Código da modalidade de contratação.
   * 7 = Dispensa (contratação direta, menos competitiva).
   */
  codigoModalidadeContratacao: z.number().optional(),
  modalidadeNome: z.string().optional(),
});

export type PncpContratacao = z.infer<typeof PncpContratacaoSchema>;

/**
 * Envelope paginado retornado pelo PNCP /api/consulta/v1.
 */
export const PncpContratacaoListaSchema = z.object({
  /** Registros da página corrente */
  data: z.array(PncpContratacaoSchema),
  /** Total de registros disponíveis (para cálculo de paginação) */
  totalRegistros: z.number(),
  /** Total de páginas disponíveis */
  totalPaginas: z.number().optional(),
  numeroPagina: z.number().optional(),
  paginasRestantes: z.number().optional(),
});

export type PncpContratacaoLista = z.infer<typeof PncpContratacaoListaSchema>;

// ─── Tipos internos normalizados ─────────────────────────────────────────────

/**
 * Indicadores agregados de contratações PNCP para um município.
 * Usados pelo ODS 16 (Paz, Justiça e Instituições Eficazes).
 */
export interface PncpIndicators {
  /** Total de licitações/contratações publicadas no período de referência */
  totalContratacoes: number;
  /** Percentual de dispensas sobre o total (modalidade 7) — menor = melhor */
  percentualDispensas: number | null;
  /**
   * Taxa de homologação: valorTotalHomologado / valorTotalEstimado.
   * >= 0.9 (90%) indica que os valores foram executados conforme planejado.
   */
  taxaHomologacao: number | null;
  /**
   * Percentual de contratações com SRP (Sistema de Registro de Preços).
   * Maior uso de SRP = maior eficiência e transparência nas compras.
   */
  percentualSrp: number | null;
  /** Ano de referência dos dados */
  anoReferencia: number;
}

export interface PncpMunicipalData {
  ibgeCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: PncpIndicators;
}
