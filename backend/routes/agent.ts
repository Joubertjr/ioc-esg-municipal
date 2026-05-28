import { Router, type Request, type Response, type Router as RouterType } from "express";
import type { ZodIssue } from "zod";
import { generateExecutiveReport } from "../services/agent/executive_report_service.js";
import { answerAgentQuery } from "../services/agent/agent_query_service.js";
import { checkHitlRequirement } from "../services/agent/hitl_service.js";
import { AgentQueryInputSchema, HitlCheckInputSchema } from "../services/agent/schemas.js";
import { requireMunicipalityScope, requireRole } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();

function formatZodErrors(issues: ZodIssue[]): string[] {
  return issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

/**
 * GET /api/agent/reports/:ibgeCode/executive
 * Relatório executivo no contrato MDO (ExecutiveReportSchema) — determinístico, sem LLM.
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
 * POST /api/agent/query
 * Q&A determinístico sobre scores ODS (P-011 — sem LLM na resposta).
 */
router.post(
  "/query",
  requireRole("admin", "prefeito", "secretario"),
  requireMunicipalityScope(),
  async (req: Request, res: Response) => {
    const parsed = AgentQueryInputSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Dados de entrada inválidos",
        details: formatZodErrors(parsed.error.issues),
      });
      return;
    }

    const userMunicipality = req.user?.municipalityId;
    if (
      userMunicipality &&
      parsed.data.municipalityId !== userMunicipality &&
      req.user?.role !== "admin"
    ) {
      res.status(403).json({ error: "Acesso negado ao município solicitado" });
      return;
    }

    try {
      const response = await answerAgentQuery(parsed.data);

      if (!response) {
        res
          .status(404)
          .json({ error: `Nenhum dado encontrado para ${parsed.data.municipalityId}` });
        return;
      }

      res.json(response);
    } catch (error) {
      logger.error("[agent] erro em /query", {
        municipalityId: parsed.data.municipalityId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro interno ao processar pergunta" });
    }
  },
);

/**
 * POST /api/agent/hitl/check
 * Verifica se ação exige aprovação humana (G-HITL-IOC).
 */
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

export default router;
