import { z } from "zod";

// ─── Resposta da API de Pesquisas/Indicadores (v1) ──────────────────────────

export const IbgeIndicatorResultSchema = z.object({
  localidade: z.string(),
  res: z.record(z.string(), z.string().nullable()),
});

export const IbgeIndicatorResponseSchema = z.object({
  id: z.number(),
  res: z.array(IbgeIndicatorResultSchema),
});

// ─── Resposta da API de Agregados (v3) — PAM tabela 5457 ────────────────────

/**
 * Formato de resposta da API v3:
 * GET /api/v3/agregados/{tabela}/periodos/{periodo}/variaveis/{variavel}?localidades=N6[{cod}]
 */
export const IbgePamResultadoSchema = z.object({
  /** Código da localidade (7 dígitos para município) */
  localidade: z.object({
    id: z.string(),
    nivel: z.object({ id: z.string(), nome: z.string() }),
    nome: z.string(),
  }),
  /** Mapa período → valor (string numérico ou "-") */
  serie: z.record(z.string(), z.string()),
});

export const IbgePamVariavelSchema = z.object({
  id: z.string(),
  nome: z.string(),
  unidade: z.string(),
  resultados: z.array(IbgePamResultadoSchema),
});

export const IbgePamResponseSchema = z.array(IbgePamVariavelSchema);

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
  /**
   * Razão de dependência — (pop 0-14 + 65+) / pop 15-64 × 100.
   * Proxy de desigualdade estrutural para ODS 10. Menor = melhor.
   * API IBGE pesquisas indicador 29168.
   */
  RAZAO_DEPENDENCIA: 29168,
  /**
   * Área territorial km² — usada para calcular densidade demográfica (ODS 11).
   * Densidade = populacao / area_territorial.
   * API IBGE pesquisas indicador 29001.
   */
  AREA_TERRITORIAL: 29001,
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
  /**
   * Razão de dependência (%) — (pop 0-14 + 65+) / pop 15-64 × 100.
   * Menor valor indica menor dependência demográfica. Proxy para ODS 10.
   */
  razaoDependencia: number | null;
  /**
   * Área territorial (km²). Usada junto com populacao para calcular
   * densidade demográfica (hab/km²) no ODS 11.
   */
  areaterritorial: number | null;
  /**
   * Valor da produção agrícola municipal em R$ mil (PAM tabela 5457, variável 215).
   * Proxy para segurança alimentar (ODS 2). null quando município não tem dados PAM.
   */
  producaoAgricolaMilReais: number | null;
  /**
   * Número de empresas atuantes no município (CEMPRE tabela 9418, variável 2283).
   * Proxy para industrialização e inovação (ODS 9). null quando sem dados.
   */
  empresasAtuantes: number | null;
}
