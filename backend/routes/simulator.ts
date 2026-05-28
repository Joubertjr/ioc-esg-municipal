import { Router, type Request, type Response, type Router as RouterType } from "express";
import { z, type ZodIssue } from "zod";
import { runSimulation, type SimulationInput } from "../services/simulator/simulator_service.js";
import { resolveMunicipalityDbId } from "../services/agent/hitl_queue_service.js";
import { appendAgentAudit } from "../services/agent/audit_service.js";
import { batchLimiter } from "../middleware/rate-limit.js";
import { logger } from "../utils/logger.js";
import { requireRole } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router: RouterType = Router();

// ─── Schemas de validação ─────────────────────────────────────────────────────

/** Percentual por área: número entre 0 e 100 inclusive. */
const AllocationPercentSchema = z
  .number()
  .min(0, "percentual deve ser >= 0")
  .max(100, "percentual deve ser <= 100")
  .finite("percentual deve ser um número finito");

const InvestmentAllocationSchema = z
  .object({
    education: AllocationPercentSchema,
    health: AllocationPercentSchema,
    sanitation: AllocationPercentSchema,
    environment: AllocationPercentSchema,
    security: AllocationPercentSchema,
    energy: AllocationPercentSchema,
    urbanization: AllocationPercentSchema,
    governance: AllocationPercentSchema,
  })
  .refine(
    (data) => {
      const sum = Object.values(data).reduce((a, b) => a + b, 0);
      return Math.abs(sum - 100) <= 0.01;
    },
    { message: "A soma dos percentuais de alocação deve ser 100%" },
  );

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

const SimulateBodySchema = SimulationInputSchema.extend({
  persistScenario: z.boolean().optional().default(false),
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
router.post(
  "/simulate",
  requireRole("admin", "prefeito", "secretario"),
  async (req: Request, res: Response) => {
    const parsed = SimulateBodySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Dados de entrada inválidos",
        details: formatZodErrors(parsed.error.issues),
      });
      return;
    }

    const { persistScenario, ...input }: SimulationInput & { persistScenario: boolean } =
      parsed.data;

    logger.info("[route:simulator] simulate chamado", {
      ibgeCode: input.ibgeCode,
      totalAmount: input.totalAmount,
      persistScenario,
    });

    try {
      const municipalityDbId = persistScenario
        ? await resolveMunicipalityDbId(input.ibgeCode)
        : null;

      if (persistScenario && !municipalityDbId) {
        res.status(404).json({ error: "Município não encontrado para persistência" });
        return;
      }

      const result = await runSimulation(input, {
        persistScenario,
        requestedByUserId: persistScenario ? req.user?.sub : undefined,
        municipalityDbId: municipalityDbId ?? undefined,
      });

      if (req.user?.sub && municipalityDbId) {
        void appendAgentAudit({
          userId: req.user.sub,
          municipalityId: municipalityDbId,
          action: "simulation_run",
          toolNames: ["simulator_service"],
          metadata: { persistScenario, hitlRequestId: result.hitlRequestId ?? null },
        });
      }

      res.json(result);
    } catch (error) {
      logger.error("[route:simulator] erro em /simulate", {
        ibgeCode: input.ibgeCode,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro interno ao executar simulação" });
    }
  },
);

// ─── POST /api/simulator/compare ─────────────────────────────────────────────

/**
 * Executa múltiplos cenários em paralelo para comparação side-by-side.
 *
 * Body: SimulationInput[] (array direto, mín 2, máx 5)
 * Response: SimulationResult[]
 */
router.post(
  "/compare",
  requireRole("admin", "prefeito", "secretario"),
  batchLimiter,
  async (req: Request, res: Response) => {
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
  },
);

// ─── GET /api/simulator/history/:ibgeCode ────────────────────────────────────

/**
 * Retorna simulações anteriores de um município.
 *
 * Params: ibgeCode (7 dígitos)
 * Query:  limit (1-100, default 20)
 * Response: Simulation[]
 */
router.get(
  "/history/:ibgeCode",
  requireRole("admin", "prefeito", "secretario"),
  async (req: Request, res: Response) => {
    const ibgeCode = req.params["ibgeCode"];

    if (!ibgeCode || !/^\d{7}$/.test(ibgeCode)) {
      res.status(400).json({ error: "ibgeCode deve ter exatamente 7 dígitos numéricos" });
      return;
    }

    const rawLimit = req.query["limit"];
    const limit = rawLimit ? Math.min(Math.max(parseInt(String(rawLimit), 10) || 20, 1), 100) : 20;

    logger.info("[route:simulator] history chamado", { ibgeCode, limit });

    try {
      // Single query: join Municipality → Simulation via nested select
      const municipality = await prisma.municipality.findUnique({
        where: { ibgeCode },
        select: {
          id: true,
          simulations: {
            orderBy: { createdAt: "desc" },
            take: limit,
          },
        },
      });

      if (!municipality) {
        res.status(404).json({ error: "Município não encontrado" });
        return;
      }

      // IDOR protection: non-admin users can only see their own municipality
      if (req.user!.role !== "admin" && req.user!.municipalityId !== municipality.id) {
        res
          .status(403)
          .json({ error: "Acesso negado. Você só pode consultar o histórico do seu município." });
        return;
      }

      res.json(municipality.simulations);
    } catch (error) {
      logger.error("[route:simulator] erro em /history", {
        ibgeCode,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro interno ao buscar histórico de simulações" });
    }
  },
);

export default router;
