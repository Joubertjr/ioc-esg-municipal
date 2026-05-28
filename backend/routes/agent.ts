import { Router, type Request, type Response, type Router as RouterType } from "express";
import { z, type ZodIssue } from "zod";
import { generateExecutiveReport } from "../services/agent/executive_report_service.js";
import { answerAgentQuery } from "../services/agent/agent_query_service.js";
import { checkHitlRequirement } from "../services/agent/hitl_service.js";
import {
  approveHitlRequest,
  listPendingHitlRequests,
  rejectHitlRequest,
  resolveMunicipalityDbId,
} from "../services/agent/hitl_queue_service.js";
import { appendAgentAudit } from "../services/agent/audit_service.js";
import { listAgentAuditLogs } from "../services/agent/audit_query_service.js";
import {
  getLatestPublishedReport,
  requestPublishExecutiveReport,
} from "../services/agent/published_report_service.js";
import { AgentQueryInputSchema, HitlCheckInputSchema } from "../services/agent/schemas.js";
import { requireMunicipalityScope, requireRole } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();

const HitlReviewBodySchema = z.object({
  reviewNote: z.string().max(500).optional(),
});

function formatZodErrors(issues: ZodIssue[]): string[] {
  return issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

async function resolveMunicipalityFromIdentifier(identifier: string) {
  if (/^\d{7}$/.test(identifier)) {
    return prisma.municipality.findUnique({
      where: { ibgeCode: identifier },
      select: { id: true, ibgeCode: true },
    });
  }
  return prisma.municipality.findUnique({
    where: { id: identifier },
    select: { id: true, ibgeCode: true },
  });
}

function assertMunicipalityAccess(req: Request, res: Response, municipalityDbId: string): boolean {
  if (req.user?.role === "admin") return true;
  if (req.user?.municipalityId && req.user.municipalityId !== municipalityDbId) {
    res.status(403).json({ error: "Acesso negado ao município solicitado" });
    return false;
  }
  return true;
}

/**
 * GET /api/agent/reports/:ibgeCode/executive
 */
router.get(
  "/reports/:ibgeCode/executive",
  requireMunicipalityScope(),
  async (req: Request, res: Response) => {
    const ibgeCode = req.params["ibgeCode"];

    if (!ibgeCode || !/^\d{7}$/.test(ibgeCode)) {
      res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
      return;
    }

    try {
      const report = await generateExecutiveReport(ibgeCode);

      if (!report) {
        res.status(404).json({ error: `Nenhum dado encontrado para ${ibgeCode}` });
        return;
      }

      const dbId = await resolveMunicipalityDbId(ibgeCode);
      if (req.user?.sub && dbId) {
        void appendAgentAudit({
          userId: req.user.sub,
          municipalityId: dbId,
          action: "report_generated",
          toolNames: ["ods_score_reader", "report_service"],
        });
      }

      res.json(report);
    } catch (error) {
      logger.error("[agent] erro ao gerar relatório executivo", {
        ibgeCode,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro interno ao gerar relatório executivo" });
    }
  },
);

/**
 * GET /api/agent/reports/:ibgeCode/published — última versão publicada (carimbo institucional)
 */
router.get(
  "/reports/:ibgeCode/published",
  requireMunicipalityScope(),
  async (req: Request, res: Response) => {
    const ibgeCode = req.params["ibgeCode"];
    if (!ibgeCode || !/^\d{7}$/.test(ibgeCode)) {
      res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
      return;
    }

    try {
      const published = await getLatestPublishedReport(ibgeCode);
      if (!published) {
        res.status(404).json({ error: "Nenhum relatório publicado para este município" });
        return;
      }
      res.json(published);
    } catch (error) {
      logger.error("[agent] erro ao buscar publicado", {
        ibgeCode,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro interno" });
    }
  },
);

/**
 * POST /api/agent/reports/:ibgeCode/publish-request — envia para fila HITL (G-HITL-IOC-02)
 */
router.post(
  "/reports/:ibgeCode/publish-request",
  requireRole("admin", "prefeito", "secretario"),
  requireMunicipalityScope(),
  async (req: Request, res: Response) => {
    const ibgeCode = req.params["ibgeCode"];
    if (!ibgeCode || !/^\d{7}$/.test(ibgeCode) || !req.user?.sub) {
      res.status(400).json({ error: "Requisição inválida" });
      return;
    }

    const municipalityDbId = await resolveMunicipalityDbId(ibgeCode);
    if (!municipalityDbId) {
      res.status(404).json({ error: "Município não encontrado" });
      return;
    }

    if (!assertMunicipalityAccess(req, res, municipalityDbId)) return;

    try {
      const result = await requestPublishExecutiveReport({
        ibgeCode,
        requestedByUserId: req.user.sub,
        municipalityDbId,
      });

      void appendAgentAudit({
        userId: req.user.sub,
        municipalityId: municipalityDbId,
        action: "report_generated",
        toolNames: ["hitl_queue", "executive_report"],
        metadata: { hitlRequestId: result.hitlRequestId, intent: "publish_request" },
      });

      res.status(202).json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao solicitar publicação";
      res.status(400).json({ error: msg });
    }
  },
);

/**
 * GET /api/agent/audit/logs — trilha append-only (admin: todos; prefeito: seu município)
 */
router.get("/audit/logs", requireRole("admin", "prefeito"), async (req: Request, res: Response) => {
  const rawLimit = req.query["limit"];
  const limit = rawLimit ? parseInt(String(rawLimit), 10) : 50;
  const scopeId = req.user?.role === "admin" ? undefined : (req.user?.municipalityId ?? undefined);

  try {
    const logs = await listAgentAuditLogs({ municipalityId: scopeId, limit });
    res.json({ logs, count: logs.length });
  } catch (error) {
    logger.error("[agent] erro em /audit/logs", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro ao listar auditoria" });
  }
});

/**
 * POST /api/agent/query — determinístico com fallback LLM opcional (AGENT_LLM_QA_ENABLED)
 */
router.post(
  "/query",
  requireRole("admin", "prefeito", "secretario"),
  async (req: Request, res: Response) => {
    const parsed = AgentQueryInputSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Dados de entrada inválidos",
        details: formatZodErrors(parsed.error.issues),
      });
      return;
    }

    const municipality = await resolveMunicipalityFromIdentifier(parsed.data.municipalityId);
    if (!municipality) {
      res.status(404).json({ error: "Município não encontrado" });
      return;
    }

    if (!assertMunicipalityAccess(req, res, municipality.id)) return;

    try {
      const response = await answerAgentQuery({
        ...parsed.data,
        municipalityId: municipality.ibgeCode,
      });

      if (!response) {
        res.status(404).json({ error: `Nenhum dado encontrado para ${municipality.ibgeCode}` });
        return;
      }

      if (req.user?.sub) {
        void appendAgentAudit({
          userId: req.user.sub,
          municipalityId: municipality.id,
          action: "agent_query",
          toolNames: ["ods_score_reader"],
          promptText: parsed.data.question,
          metadata: { mode: response.mode },
        });
      }

      res.json(response);
    } catch (error) {
      logger.error("[agent] erro em /query", {
        ibgeCode: municipality.ibgeCode,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro interno ao processar pergunta" });
    }
  },
);

router.post(
  "/hitl/check",
  requireRole("admin", "prefeito", "secretario"),
  async (req: Request, res: Response) => {
    const parsed = HitlCheckInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Dados de entrada inválidos",
        details: formatZodErrors(parsed.error.issues),
      });
      return;
    }
    res.json(checkHitlRequirement(parsed.data));
  },
);

/**
 * GET /api/agent/hitl/pending
 */
router.get(
  "/hitl/pending",
  requireRole("admin", "prefeito"),
  async (req: Request, res: Response) => {
    try {
      const scopeId =
        req.user?.role === "admin" ? undefined : (req.user?.municipalityId ?? undefined);
      const items = await listPendingHitlRequests(scopeId);
      res.json({ items, count: items.length });
    } catch (error) {
      logger.error("[agent] erro em /hitl/pending", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao listar fila HITL" });
    }
  },
);

/**
 * POST /api/agent/hitl/:id/approve
 */
router.post(
  "/hitl/:id/approve",
  requireRole("admin", "prefeito"),
  async (req: Request, res: Response) => {
    const id = req.params["id"];
    if (!id || !req.user?.sub) {
      res.status(400).json({ error: "Pedido inválido" });
      return;
    }

    try {
      const item = await approveHitlRequest({
        requestId: id,
        reviewerId: req.user.sub,
        reviewerRole: req.user.role,
        municipalityScopeId: req.user.municipalityId,
      });
      res.json(item);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao aprovar";
      const status = msg.includes("negado") || msg.includes("Apenas") ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  },
);

/**
 * POST /api/agent/hitl/:id/reject
 */
router.post(
  "/hitl/:id/reject",
  requireRole("admin", "prefeito"),
  async (req: Request, res: Response) => {
    const id = req.params["id"];
    const body = HitlReviewBodySchema.safeParse(req.body);
    if (!id || !req.user?.sub) {
      res.status(400).json({ error: "Pedido inválido" });
      return;
    }

    try {
      const item = await rejectHitlRequest({
        requestId: id,
        reviewerId: req.user.sub,
        reviewerRole: req.user.role,
        municipalityScopeId: req.user.municipalityId,
        reviewNote: body.success ? body.data.reviewNote : undefined,
      });
      res.json(item);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao rejeitar";
      const status = msg.includes("negado") || msg.includes("Apenas") ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  },
);

export default router;
