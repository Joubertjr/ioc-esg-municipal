import { Router, type Request, type Response, type Router as RouterType } from "express";
import { generateEsgReport } from "../services/reports/report_service.js";
import { logger } from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";

const router: RouterType = Router();

/**
 * GET /api/reports/:ibgeCode
 * Gera relatório ESG completo para um município.
 */
router.get("/:ibgeCode", authenticateToken, async (req: Request, res: Response) => {
  const ibgeCode = req.params["ibgeCode"];

  if (!ibgeCode || !/^\d{7}$/.test(ibgeCode)) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const report = await generateEsgReport(ibgeCode);

    if (!report) {
      res.status(404).json({ error: `Nenhum dado encontrado para ${ibgeCode}` });
      return;
    }

    res.json(report);
  } catch (error) {
    logger.error("[reports] erro ao gerar relatório", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao gerar relatório ESG" });
  }
});

export default router;
