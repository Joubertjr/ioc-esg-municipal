import { Router, type Request, type Response, type Router as RouterType } from "express";
import { z } from "zod";
import {
  generateBenchmark,
  compareAgainstBenchmark,
} from "../services/benchmarks/benchmark_service.js";
import { logger } from "../utils/logger.js";
import { requireRole } from "../middleware/auth.js";

const router: RouterType = Router();

const BenchmarkRequestSchema = z.object({
  ibgeCodes: z
    .array(z.string().regex(/^\d{7}$/))
    .min(2)
    .max(50),
});

const CompareRequestSchema = z.object({
  ibgeCode: z.string().regex(/^\d{7}$/),
  benchmarkCodes: z
    .array(z.string().regex(/^\d{7}$/))
    .min(1)
    .max(49),
});

/**
 * POST /api/benchmarks
 * Body: { ibgeCodes: string[] }
 * Gera benchmark comparativo entre municípios (2-50).
 */
router.post(
  "/",
  requireRole("admin", "prefeito", "secretario"),
  async (req: Request, res: Response) => {
    const parsed = BenchmarkRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Payload inválido" });
      return;
    }

    const { ibgeCodes } = parsed.data;

    try {
      const result = await generateBenchmark(ibgeCodes);
      res.json(result);
    } catch (error) {
      logger.error("[benchmarks] erro ao gerar benchmark", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro interno ao gerar benchmark" });
    }
  },
);

/**
 * POST /api/benchmarks/compare
 * Body: { ibgeCode: string, benchmarkCodes: string[] }
 * Compara um município contra a média do grupo.
 */
router.post(
  "/compare",
  requireRole("admin", "prefeito", "secretario"),
  async (req: Request, res: Response) => {
    const parsed = CompareRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Payload inválido" });
      return;
    }

    const { ibgeCode, benchmarkCodes } = parsed.data;

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
  },
);

export default router;
