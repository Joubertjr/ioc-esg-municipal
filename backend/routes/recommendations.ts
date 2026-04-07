import { Router, type Request, type Response, type Router as RouterType } from "express";
import { z } from "zod";
import { generateRecommendations } from "../services/recommendations/recommendation_service.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();

const ibgeCodeSchema = z
  .string()
  .regex(/^\d{7}$/, "ibgeCode deve ter exatamente 7 dígitos numéricos");

/**
 * GET /api/recommendations/:ibgeCode
 * Gera recomendações inteligentes priorizadas para um município,
 * combinando análise de score ESG com gap vs benchmark estadual.
 */
router.get("/:ibgeCode", async (req: Request, res: Response) => {
  const parseResult = ibgeCodeSchema.safeParse(req.params["ibgeCode"]);

  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message ?? "ibgeCode inválido" });
    return;
  }

  const ibgeCode = parseResult.data;

  try {
    const report = await generateRecommendations(ibgeCode);

    if (!report) {
      res.status(404).json({ error: `Nenhum dado encontrado para o município ${ibgeCode}` });
      return;
    }

    res.json(report);
  } catch (error) {
    logger.error("[recommendations] erro ao gerar recomendações", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao gerar recomendações" });
  }
});

export default router;
