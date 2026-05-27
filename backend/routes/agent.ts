import { Router, type Request, type Response, type Router as RouterType } from "express";
import { generateExecutiveReport } from "../services/agent/executive_report_service.js";
import { requireMunicipalityScope } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();

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

export default router;
