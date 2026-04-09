import { z } from "zod";

// ─── Schema do JSON estático ieps_2021.json (validado na carga) ─────────────
// Fonte: IEPS Data (iepsdata.org.br) via Base dos Dados (BigQuery)
// Tabela: basedosdados-dev.br_ieps_saude.municipio
// Dados: 2010-2021, indicadores de saúde municipal padronizados
// Para atualizar: npx tsx scripts/fetch-ieps-data.ts

export const IepsMunicipalEntrySchema = z.object({
  /** Taxa de mortalidade infantil por 1.000 nascidos vivos (menor = melhor) */
  mortalidadeInfantil: z.number().min(0).max(100).nullable(),
  /** Cobertura da Estratégia Saúde da Família (%) (maior = melhor) */
  coberturaEsf: z.number().min(0).max(100).nullable(),
  /** Cobertura vacinal — poliomielite (%) como proxy geral (maior = melhor) */
  coberturaVacinal: z.number().min(0).max(100).nullable(),
  /** Internações por Condições Sensíveis à Atenção Primária por 100k hab (menor = melhor) */
  internacoesCsap: z.number().min(0).max(10000).nullable(),
  /** Gasto total em saúde per capita deflacionado — R$ 2019 (maior = melhor, com teto) */
  gastoSaudePerCapita: z.number().min(0).max(50000).nullable(),
  /** Pré-natal adequado (7+ consultas) % (maior = melhor) */
  prenatalAdequado: z.number().min(0).max(100).nullable(),
});

export const IepsDataFileSchema = z.record(z.string(), IepsMunicipalEntrySchema);

export type IepsMunicipalEntry = z.infer<typeof IepsMunicipalEntrySchema>;
export type IepsDataFile = z.infer<typeof IepsDataFileSchema>;

// ─── Dados consolidados do município ──────────────────────────────────────────

export interface IepsMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: IepsIndicators;
}

export interface IepsIndicators {
  /** Taxa de mortalidade infantil por 1.000 NV (ODS 3.2) */
  mortalidadeInfantil: number | null;
  /** Cobertura ESF % (ODS 3.8 — cobertura universal de saúde) */
  coberturaEsf: number | null;
  /** Cobertura vacinal polio % (ODS 3.b — vacinas) */
  coberturaVacinal: number | null;
  /** Internações CSAP por 100k (qualidade da atenção primária) */
  internacoesCsap: number | null;
  /** Gasto total saúde per capita R$ deflacionado (ODS 3.c — gasto em saúde) */
  gastoSaudePerCapita: number | null;
  /** Pré-natal adequado % (ODS 3.1 — mortalidade materna) */
  prenatalAdequado: number | null;
}
