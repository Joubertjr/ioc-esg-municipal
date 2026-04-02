import { Router, type Request, type Response, type Router as RouterType } from "express";
import { generateBenchmark, compareAgainstBenchmark } from "../services/benchmarks/benchmark_service.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();

/**
 * POST /api/benchmarks
 * Body: { ibgeCodes: string[] }
 * Gera benchmark comparativo entre municípios (2-20).
 */
router.post("/", async (req: Request, res: Response) => {
  const { ibgeCodes } = req.body as { ibgeCodes?: string[] };

  if (!Array.isArray(ibgeCodes) || ibgeCodes.length < 2) {
    res.status(400).json({ error: "ibgeCodes deve ter ao menos 2 municípios" });
    return;
  }

  if (ibgeCodes.length > 20) {
    res.status(400).json({ error: "Máximo 20 municípios por benchmark" });
    return;
  }

  if (ibgeCodes.some((c) => typeof c !== "string" || !/^\d{7}$/.test(c))) {
    res.status(400).json({ error: "Todos os ibgeCodes devem ter 7 dígitos numéricos" });
    return;
  }

  try {
    const result = await generateBenchmark(ibgeCodes);
    res.json(result);
  } catch (error) {
    logger.error("[benchmarks] erro ao gerar benchmark", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao gerar benchmark" });
  }
});

/**
 * POST /api/benchmarks/compare
 * Body: { ibgeCode: string, benchmarkCodes: string[] }
 * Compara um município contra a média do grupo.
 */
router.post("/compare", async (req: Request, res: Response) => {
  const { ibgeCode, benchmarkCodes } = req.body as {
    ibgeCode?: string;
    benchmarkCodes?: string[];
  };

  if (!ibgeCode || !/^\d{7}$/.test(ibgeCode)) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  if (!Array.isArray(benchmarkCodes) || benchmarkCodes.length < 1) {
    res.status(400).json({ error: "benchmarkCodes deve ter ao menos 1 município" });
    return;
  }

  if (benchmarkCodes.length > 20) {
    res.status(400).json({ error: "Máximo 20 municípios de comparação" });
    return;
  }

  if (benchmarkCodes.some((c) => typeof c !== "string" || !/^\d{7}$/.test(c))) {
    res.status(400).json({ error: "Todos os benchmarkCodes devem ter 7 dígitos numéricos" });
    return;
  }

  try {
    const result = await compareAgainstBenchmark(ibgeCode, benchmarkCodes);
    res.json(result);
  } catch (error) {
    logger.error("[benchmarks] erro ao comparar", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno na comparação benchmark" });
  }
});

export default router;
