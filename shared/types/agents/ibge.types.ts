import { z } from "zod";

// ─── Resposta da API de Pesquisas/Indicadores ───────────────────────────────

export const IbgeIndicatorResultSchema = z.object({
  localidade: z.string(),
  res: z.record(z.string(), z.string().nullable()),
});

export const IbgeIndicatorResponseSchema = z.object({
  id: z.number(),
  res: z.array(IbgeIndicatorResultSchema),
});

export type IbgeIndicatorResponse = z.infer<typeof IbgeIndicatorResponseSchema>;

// ─── Indicadores IBGE usados no IOC ────────────────────────────────────────

/** IDs dos indicadores na API de pesquisas do IBGE */
export const IBGE_INDICATORS = {
  /** População estimada (anual) */
  POPULACAO_ESTIMADA: 29171,
  /** População Censo */
  POPULACAO_CENSO: 25207,
  /** PIB per capita (R$) */
  PIB_PER_CAPITA: 47001,
  /** Receitas orçamentárias realizadas (R$) */
  RECEITAS_ORCAMENTARIAS: 28141,
  /** Despesas orçamentárias empenhadas (R$) */
  DESPESAS_ORCAMENTARIAS: 29749,
  /** % da população com rendimento até 1/2 salário mínimo (menor = melhor) */
  PCT_BAIXA_RENDA: 60048,
  /** % da população ocupada (maior = melhor) */
  TAXA_OCUPACAO: 60036,
  /** Taxa de escolarização 6-14 anos (%) */
  TAXA_ESCOLARIZACAO: 30255,
} as const;

export type IbgeIndicatorId =
  (typeof IBGE_INDICATORS)[keyof typeof IBGE_INDICATORS];

// ─── Dados normalizados para uso interno ────────────────────────────────────

export interface IbgeMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: IbgeIndicators;
}

export interface IbgeIndicators {
  populacao: number | null;
  pibPerCapita: number | null;
  /** % da população com rendimento até 1/2 salário mínimo (menor = melhor) */
  pctBaixaRenda: number | null;
  /** % da população ocupada (maior = melhor) */
  taxaOcupacao: number | null;
  receitasOrcamentarias: number | null;
  despesasOrcamentarias: number | null;
}
