import { Router, type Request, type Response, type Router as RouterType } from "express";
import { calculateMunicipalOds } from "../services/ods/index.js";
import { logger } from "../utils/logger.js";
import { batchLimiter } from "../middleware/rate-limit.js";

const router: RouterType = Router();

/**
 * GET /api/ods/:ibgeCode
 * Retorna score ODS consolidado (todas as fontes) para um município.
 */
router.get("/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = req.params["ibgeCode"];

  if (!ibgeCode || !/^\d{7}$/.test(ibgeCode)) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const report = await calculateMunicipalOds(ibgeCode);

    if (!report) {
      res.status(404).json({ error: `Nenhum dado encontrado para ${ibgeCode}` });
      return;
    }

    res.json(report);
  } catch (error) {
    logger.error("Error calculating ODS scores", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao calcular scores ODS" });
  }
});

/**
 * POST /api/ods/compare
 * Body: { ibgeCodes: string[] }
 * Compara scores ODS entre múltiplos municípios (máx 10).
 */
router.post("/compare", batchLimiter, async (req: Request, res: Response) => {
  const { ibgeCodes } = req.body as { ibgeCodes?: string[] };

  if (!Array.isArray(ibgeCodes) || ibgeCodes.length < 2) {
    res.status(400).json({ error: "ibgeCodes deve ter ao menos 2 municípios" });
    return;
  }

  if (ibgeCodes.length > 10) {
    res.status(400).json({ error: "Máximo 10 municípios por comparação" });
    return;
  }

  if (ibgeCodes.some((c) => typeof c !== "string" || !/^\d{7}$/.test(c))) {
    res.status(400).json({ error: "Todos os ibgeCodes devem ter 7 dígitos numéricos" });
    return;
  }

  try {
    const results = await Promise.all(
      ibgeCodes.map((code) => calculateMunicipalOds(code)),
    );

    const comparison = ibgeCodes.map((code, idx) => ({
      ibgeCode: code,
      report: results[idx],
    }));

    res.json({
      total: ibgeCodes.length,
      found: results.filter(Boolean).length,
      comparison,
    });
  } catch (error) {
    logger.error("Error in ODS comparison", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno na comparação ODS" });
  }
});

export default router;
