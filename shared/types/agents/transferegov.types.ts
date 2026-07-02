import { z } from "zod";

export const TransfereGovProgramaSchema = z.object({
  nome: z.string(),
  orgaoSuperior: z.string(),
  modalidade: z.string(),
  inicioJanela: z.string().nullable(),
  fimJanela: z.string().nullable(),
  acaoOrcamentaria: z.string().nullable(),
  naturezaJuridica: z.string(),
});

export const TransfereGovDataFileSchema = z.object({
  programasAbertos: z.array(TransfereGovProgramaSchema),
  totalProgramasSC: z.number().int().min(0),
  totalEncerrados: z.number().int().min(0),
  totalAbertos: z.number().int().min(0),
  programasPorOrgao: z.record(z.string(), z.number().int()),
});

export type TransfereGovPrograma = z.infer<typeof TransfereGovProgramaSchema>;
export type TransfereGovDataFile = z.infer<typeof TransfereGovDataFileSchema>;
