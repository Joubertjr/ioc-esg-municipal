import { Router, type Request, type Response, type Router as RouterType } from "express";
import { z, type ZodIssue } from "zod";
import { runSimulation, type SimulationInput } from "../services/simulator/simulator_service.js";
import { batchLimiter } from "../middleware/rate-limit.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();

// ─── Schemas de validação ─────────────────────────────────────────────────────

const InvestmentAreaSchema = z.enum([
  "education",
  "health",
  "sanitation",
  "environment",
  "security",
  "energy",
  "urbanization",
  "governance",
]);

const InvestmentAllocationSchema = z.object({
  area: InvestmentAreaSchema,
  amount: z
    .number({ required_error: "amount é obrigatório" })
    .positive("amount deve ser positivo")
    .finite("amount deve ser um número finito"),
  targetOds: z
    .array(z.number().int().min(1).max(17))
    .default([]),
});

const SimulationInputSchema = z.object({
  ibgeCode: z
    .string({ required_error: "ibgeCode é obrigatório" })
    .regex(/^\d{7}$/, "ibgeCode deve ter exatamente 7 dígitos numéricos"),
  scenarioName: z
    .string({ required_error: "scenarioName é obrigatório" })
    .min(1, "scenarioName não pode ser vazio")
    .max(100, "scenarioName deve ter no máximo 100 caracteres"),
  allocations: z
    .array(InvestmentAllocationSchema)
    .min(1, "allocations deve ter ao menos 1 item")
    .max(20, "allocations deve ter no máximo 20 itens"),
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
    scenarioName: input.scenarioName,
    allocationsCount: input.allocations.length,
  });

  try {
    const result = await runSimulation(input);
    res.json(result);
  } catch (error) {
    logger.error("[route:simulator] erro em /simulate", {
      ibgeCode: input.ibgeCode,
      scenarioName: input.scenarioName,
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
    scenarioNames: scenarios.map((s) => s.scenarioName),
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
