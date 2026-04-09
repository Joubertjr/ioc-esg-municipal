import { z } from "zod";

// ─── Categorias de avaliação LongMemEval-ESG ────────────────────────────────

export const QuestionCategory = z.enum([
  "extraction",
  "multi_session",
  "temporal",
  "knowledge_update",
  "abstention",
]);
export type QuestionCategory = z.infer<typeof QuestionCategory>;

// ─── Sessão de contexto (simula dados de coleta passada) ────────────────────

export const ContextSessionSchema = z.object({
  agentSource: z.string(),
  ibgeCode: z.string(),
  referenceYear: z.number(),
  collectedAt: z.string().datetime(),
  data: z.record(z.string(), z.unknown()),
});
export type ContextSession = z.infer<typeof ContextSessionSchema>;

// ─── Instância de avaliação ─────────────────────────────────────────────────

export const EvaluationInstanceSchema = z.object({
  id: z.string(),
  municipality: z.string(),
  ibgeCode: z.string(),
  category: QuestionCategory,
  question: z.string(),
  contextSessions: z.array(ContextSessionSchema),
  expectedAnswer: z.string(),
});
export type EvaluationInstance = z.infer<typeof EvaluationInstanceSchema>;

// ─── Resposta do LLM Judge ──────────────────────────────────────────────────

export const LLMJudgeResponseSchema = z.object({
  isCorrect: z.boolean(),
  reasoning: z.string(),
});
export type LLMJudgeResponse = z.infer<typeof LLMJudgeResponseSchema>;

// ─── Resultado individual ───────────────────────────────────────────────────

export const EvaluationResultSchema = z.object({
  instanceId: z.string(),
  category: QuestionCategory,
  question: z.string(),
  expectedAnswer: z.string(),
  actualAnswer: z.string(),
  isCorrect: z.boolean(),
  reasoning: z.string(),
  latencyMs: z.number(),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// ─── Relatório agregado ─────────────────────────────────────────────────────

export const CategoryMetricsSchema = z.object({
  category: QuestionCategory,
  total: z.number(),
  correct: z.number(),
  accuracy: z.number(),
});
export type CategoryMetrics = z.infer<typeof CategoryMetricsSchema>;

export const EvaluationReportSchema = z.object({
  runDate: z.string().datetime(),
  totalInstances: z.number(),
  globalAccuracy: z.number(),
  categoryMetrics: z.array(CategoryMetricsSchema),
  results: z.array(EvaluationResultSchema),
});
export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;
