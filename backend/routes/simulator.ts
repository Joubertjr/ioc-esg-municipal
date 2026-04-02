import { Router, type Request, type Response, type Router as RouterType } from "express";
import { z, type ZodIssue } from "zod";
import { runSimulation, type SimulationInput } from "../services/simulator/simulator_service.js";
import { batchLimiter } from "../middleware/rate-limit.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();

// ─── Schemas de validação ─────────────────────────────────────────────────────

/** Percentual por área: número entre 0 e 100 inclusive. */
const AllocationPercentSchema = z
  .number()
  .min(0, "percentual deve ser >= 0")
  .max(100, "percentual deve ser <= 100")
  .finite("percentual deve ser um número finito");

const InvestmentAllocationSchema = z.object({
  education:    AllocationPercentSchema,
  health:       AllocationPercentSchema,
  sanitation:   AllocationPercentSchema,
  environment:  AllocationPercentSchema,
  security:     AllocationPercentSchema,
  energy:       AllocationPercentSchema,
  urbanization: AllocationPercentSchema,
  governance:   AllocationPercentSchema,
});

const SimulationInputSchema = z.object({
  ibgeCode: z
    .string({ required_error: "ibgeCode é obrigatório" })
    .regex(/^\d{7}$/, "ibgeCode deve ter exatamente 7 dígitos numéricos"),
  totalAmount: z
    .number({ required_error: "totalAmount é obrigatório" })
    .positive("totalAmount deve ser positivo")
    .finite("totalAmount deve ser um número finito"),
  allocation: InvestmentAllocationSchema,
});

/** /compare aceita array direto no body */
const CompareBodySchema = z
  .array(SimulationInputSchema)
  .min(2, "compare requer ao menos 2 cenários")
  .max(5, "compare aceita no máximo 5 cenários");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatZodErrors(issues: ZodIssue[]): string[] {
  return issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

// ─── POST /api/simulator/simulate ────────────────────────────────────────────

/**
 * Executa uma simulação de cenário único.
 *
 * Body: SimulationInput
 * Response: SimulationResult
 */
router.post("/simulate", async (req: Request, res: Response) => {
  const parsed = SimulationInputSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Dados de entrada inválidos",
      details: formatZodErrors(parsed.error.issues),
    });
    return;
  }

  const input: SimulationInput = parsed.data;

  logger.info("[route:simulator] simulate chamado", {
    ibgeCode: input.ibgeCode,
    totalAmount: input.totalAmount,
  });

  try {
    const result = await runSimulation(input);
    res.json(result);
  } catch (error) {
    logger.error("[route:simulator] erro em /simulate", {
      ibgeCode: input.ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao executar simulação" });
  }
});

// ─── POST /api/simulator/compare ─────────────────────────────────────────────

/**
 * Executa múltiplos cenários em paralelo para comparação side-by-side.
 *
 * Body: SimulationInput[] (array direto, mín 2, máx 5)
 * Response: SimulationResult[]
 */
router.post("/compare", batchLimiter, async (req: Request, res: Response) => {
  const parsed = CompareBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Dados de entrada inválidos",
      details: formatZodErrors(parsed.error.issues),
    });
    return;
  }

  const scenarios: SimulationInput[] = parsed.data;

  logger.info("[route:simulator] compare chamado", {
    scenariosCount: scenarios.length,
    ibgeCodes: scenarios.map((s) => s.ibgeCode),
  });

  try {
    const results = await Promise.all(scenarios.map((s) => runSimulation(s)));
    res.json(results);
  } catch (error) {
    logger.error("[route:simulator] erro em /compare", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao executar comparação de cenários" });
  }
});

export default router;
