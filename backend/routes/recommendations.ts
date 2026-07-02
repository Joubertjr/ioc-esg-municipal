import { Router, type Request, type Response, type Router as RouterType } from "express";
import { z } from "zod";
import { generateRecommendations } from "../services/recommendations/recommendation_service.js";
import { computeRecommendedScenario } from "../services/recommendations/scenario_service.js";
import { TransfereGovCollector } from "../agents/transferegov/transferegov_collector.js";
import { requireMunicipalityScope } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();

const ibgeCodeSchema = z
  .string()
  .regex(/^\d{7}$/, "ibgeCode deve ter exatamente 7 dígitos numéricos");

/**
 * GET /api/recommendations/oportunidades
 * Lista programas federais abertos para municípios de SC no TransfereGov.
 * Registrada ANTES das rotas com :ibgeCode para evitar conflito de params.
 */
router.get("/oportunidades", async (_req: Request, res: Response) => {
  try {
    const collector = new TransfereGovCollector();
    const summary = collector.getSummary();

    if (!summary) {
      res.status(503).json({ error: "Dados do TransfereGov não disponíveis" });
      return;
    }

    res.json(summary);
  } catch (error) {
    logger.error("[recommendations] erro ao buscar oportunidades TransfereGov", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao buscar oportunidades" });
  }
});

/**
 * GET /api/recommendations/:ibgeCode/scenario
 * Calcula o cenário de alocação de investimento recomendado para um município,
 * derivado das recomendações priorizadas por ODS e gap vs benchmark estadual.
 */
router.get(
  "/:ibgeCode/scenario",
  requireMunicipalityScope(),
  async (req: Request, res: Response) => {
    const parseResult = ibgeCodeSchema.safeParse(req.params["ibgeCode"]);

    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message ?? "ibgeCode inválido" });
      return;
    }

    const ibgeCode = parseResult.data;

    try {
      const scenario = await computeRecommendedScenario(ibgeCode);

      if (!scenario) {
        res.status(404).json({ error: `Nenhum dado encontrado para o município ${ibgeCode}` });
        return;
      }

      res.json(scenario);
    } catch (error) {
      logger.error("[recommendations] erro ao calcular cenário recomendado", {
        ibgeCode,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro interno ao calcular cenário recomendado" });
    }
  },
);

/**
 * GET /api/recommendations/:ibgeCode
 * Gera recomendações inteligentes priorizadas para um município,
 * combinando análise de score ESG com gap vs benchmark estadual.
 */
router.get("/:ibgeCode", requireMunicipalityScope(), async (req: Request, res: Response) => {
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
