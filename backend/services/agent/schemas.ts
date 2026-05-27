/**
 * Contratos Zod — camada agêntica IOC ESG (MDO Day 0, arquétipo D).
 * Termos alinhados a docs/mdo/glossario.md
 */
import { z } from "zod";

export const OdsStatusSchema = z.enum(["verde", "amarelo", "vermelho"]);
export const DataStalenessSchema = z.enum(["fresh", "recent", "stale", "critical", "unknown"]);

/** Input principal: pergunta do gestor sobre dados do município */
export const AgentQueryInputSchema = z.object({
  municipalityId: z.string().min(1),
  question: z.string().min(3).max(4000),
  role: z.enum(["admin", "prefeito", "secretario"]),
  odsFilter: z.array(z.number().int().min(1).max(17)).optional(),
  locale: z.literal("pt-BR").default("pt-BR"),
});
export type AgentQueryInput = z.infer<typeof AgentQueryInputSchema>;

/** Estado entre turnos da sessão agêntica */
export const AgentSessionContextSchema = z.object({
  sessionId: z.string().uuid(),
  municipalityId: z.string().min(1),
  lastOdsDiscussed: z.number().int().min(1).max(17).optional(),
  pendingHitlActionId: z.string().optional(),
});
export type AgentSessionContext = z.infer<typeof AgentSessionContextSchema>;

export const SourceCitationSchema = z.object({
  sourceName: z.string().min(1),
  referenceYear: z.number().int().min(1990).max(2100),
  indicatorId: z.string().optional(),
  url: z.string().url().optional(),
});
export type SourceCitation = z.infer<typeof SourceCitationSchema>;

export const PrioritizedRecommendationSchema = z.object({
  title: z.string().min(1).max(200),
  targetOds: z.number().int().min(1).max(17),
  rationale: z.string().min(10),
  estimatedImpact: z.string().min(1),
  citations: z.array(SourceCitationSchema).min(1),
  priority: z.enum(["alta", "media", "baixa"]),
});
export type PrioritizedRecommendation = z.infer<typeof PrioritizedRecommendationSchema>;

/** Output principal: relatório executivo estruturado */
export const ExecutiveReportSchema = z.object({
  municipalityId: z.string().min(1),
  generatedAt: z.string().datetime(),
  summary: z.string().min(20),
  odsScores: z.array(
    z.object({
      odsNumber: z.number().int().min(1).max(17),
      score: z.number().min(0).max(100),
      status: OdsStatusSchema,
      staleness: DataStalenessSchema,
    }),
  ),
  recommendations: z.array(PrioritizedRecommendationSchema).min(1).max(10),
  citations: z.array(SourceCitationSchema).min(1),
  confidence: z.number().min(0).max(1),
});
export type ExecutiveReport = z.infer<typeof ExecutiveReportSchema>;

/** Pedido de simulação FPM (efêmero ou para HITL) */
export const SimulationRequestSchema = z.object({
  municipalityId: z.string().min(1),
  scenarioName: z.string().min(1).max(120),
  investmentAmountBrl: z.number().positive(),
  investmentType: z.enum(["education", "health", "sanitation", "security", "environment"]),
  targetOds: z.array(z.number().int().min(1).max(17)).min(1),
  persistScenario: z.boolean().default(false),
});
export type SimulationRequest = z.infer<typeof SimulationRequestSchema>;

/** Trilha de auditoria append-only (P-006 / LGPD) */
export const AuditLogEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  municipalityId: z.string().min(1),
  action: z.enum([
    "agent_query",
    "report_generated",
    "simulation_run",
    "hitl_approved",
    "hitl_rejected",
  ]),
  toolNames: z.array(z.string()).max(6),
  promptHash: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;
