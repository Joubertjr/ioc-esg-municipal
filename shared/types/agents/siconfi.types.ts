import { z } from "zod";

// ─── Resposta da API SICONFI (RREO) ────────────────────────────────────────

export const SiconfiRreoItemSchema = z.object({
  exercicio: z.number(),
  demonstrativo: z.string(),
  periodo: z.number(),
  periodicidade: z.string(),
  instituicao: z.string(),
  cod_ibge: z.number(),
  uf: z.string(),
  populacao: z.number(),
  anexo: z.string(),
  esfera: z.string(),
  rotulo: z.string(),
  coluna: z.string(),
  cod_conta: z.string().nullable(),
  conta: z.string(),
  valor: z.number().nullable(),
});

export const SiconfiRreoResponseSchema = z.object({
  items: z.array(SiconfiRreoItemSchema),
});

export type SiconfiRreoItem = z.infer<typeof SiconfiRreoItemSchema>;
export type SiconfiRreoResponse = z.infer<typeof SiconfiRreoResponseSchema>;

// ─── Contas-chave que extraímos do RREO ────────────────────────────────────

/** Contas do RREO Anexo 01 (Receitas) */
export const SICONFI_RECEITA_CONTAS = {
  RECEITA_TOTAL: "RECEITAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)",
  TRANSFERENCIAS_UNIAO: "Transferências da União e de suas Entidades",
  TRANSFERENCIAS_CORRENTES: "Transferências Correntes",
} as const;

/** Contas do RREO Anexo 02 (Despesas por função) */
export const SICONFI_DESPESA_CONTAS = {
  DESPESA_TOTAL: "DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)",
  SAUDE: "Saúde",
  EDUCACAO: "Educação",
  URBANISMO: "Urbanismo",
  ASSISTENCIA_SOCIAL: "Assistência Social",
  ADMINISTRACAO: "Administração",
  ENCARGOS_ESPECIAIS: "Encargos Especiais",
  PREVIDENCIA: "Previdência Social",
} as const;

/** Contas do RREO Anexo 03 (Receitas por fonte) */
export const SICONFI_FONTE_CONTAS = {
  FPM: "Cota-Parte do FPM",
  FUNDEB: "Transferências do FUNDEB",
  LC_61: "Transferências da LC nº 61/1989",
} as const;

/** Colunas relevantes para extração de valores */
export const SICONFI_COLUNAS = {
  /** Receita realizada acumulada no ano (Anexo 01) */
  RECEITA_REALIZADA: "Até o Bimestre (c)",
  /** Previsão atualizada de receita (Anexo 01) */
  RECEITA_PREVISAO: "PREVISÃO ATUALIZADA (a)",
  /** Despesa empenhada acumulada (Anexo 02) */
  DESPESA_EMPENHADA: "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)",
  /** Despesa liquidada acumulada (Anexo 02) */
  DESPESA_LIQUIDADA: "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)",
  /** Dotação atualizada (Anexo 02) */
  DOTACAO_ATUALIZADA: "DOTAÇÃO ATUALIZADA (a)",
  /** Previsão atualizada fonte (Anexo 03) */
  FONTE_PREVISAO: "PREVISÃO ATUALIZADA 2023",
} as const;

// ─── Dados normalizados para uso interno ────────────────────────────────────

export interface SiconfiMunicipalData {
  ibgeCode: string;
  siconfiCode: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
  indicators: SiconfiIndicators;
}

export interface SiconfiIndicators {
  /** Cota-parte do FPM anual (R$) — soma dos 12 meses/MR */
  fpmAnual: number | null;
  /** Receita total realizada (R$) */
  receitaTotal: number | null;
  /** Despesa total empenhada (R$) */
  despesaTotal: number | null;
  /** Despesa com saúde (R$) */
  despesaSaude: number | null;
  /** Despesa com educação (R$) */
  despesaEducacao: number | null;
  /** Despesa com urbanismo (R$) */
  despesaUrbanismo: number | null;
  /** Despesa com assistência social (R$) */
  despesaAssistencia: number | null;
  /** Transferências da União (R$) */
  transferenciasUniao: number | null;
  /** Transferências do FUNDEB (R$) */
  fundeb: number | null;
  /** População usada no SICONFI */
  populacao: number | null;
}
