import { Router, type Request, type Response, type Router as RouterType } from "express";
import { calculateMunicipalOds } from "../services/ods/index.js";
import { getMethodology } from "../services/ods/index.js";
import {
  calculateAndPersistScores,
  getScoreHistory,
  assessComparability,
} from "../services/ods/ods_history_service.js";
import { logger } from "../utils/logger.js";
import { batchLimiter } from "../middleware/rate-limit.js";
import { requireRole, requireMunicipalityScope } from "../middleware/auth.js";
import { withCache } from "../utils/cache.js";
import { prisma } from "../lib/prisma.js";

const router: RouterType = Router();

/**
 * GET /api/ods/methodology
 * Retorna a metodologia completa de cálculo dos 17 ODS:
 * fórmulas, benchmarks, fontes de dados e método de agregação.
 */
router.get("/methodology", async (_req: Request, res: Response) => {
  try {
    const methodology = await withCache("ods:methodology", 86400, () =>
      Promise.resolve(getMethodology()),
    );
    res.json(methodology);
  } catch (error) {
    logger.error("Error fetching ODS methodology", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao buscar metodologia ODS" });
  }
});

/**
 * GET /api/ods/:ibgeCode
 * Retorna score ODS consolidado (todas as fontes) para um município.
 */
router.get("/:ibgeCode", requireMunicipalityScope(), async (req: Request, res: Response) => {
  const ibgeCode = req.params["ibgeCode"];

  if (!ibgeCode || !/^\d{7}$/.test(ibgeCode)) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    // Valida existência no banco antes de acionar coletores externos.
    // Alguns coletores (ex: DATASUS) retornam dados para qualquer código
    // 7-dígitos — sem esta guarda, municípios inexistentes retornam scores
    // calculados a partir de dados inválidos.
    const municipality = await prisma.municipality.findUnique({
      where: { ibgeCode },
      select: { name: true },
    });

    if (!municipality) {
      res.status(404).json({ error: `Município ${ibgeCode} não encontrado` });
      return;
    }

    const report = await withCache(`ods:report:${ibgeCode}`, 3600, () =>
      calculateMunicipalOds(ibgeCode),
    );

    if (!report) {
      res.status(404).json({ error: `Nenhum dado encontrado para ${ibgeCode}` });
      return;
    }

    if (!report.municipalityName) {
      report.municipalityName = municipality.name;
    }

    res.json(report);

    // Fire-and-forget: persiste snapshot histórico sem bloquear a resposta.
    // Passa o report já calculado para evitar segunda chamada às APIs externas.
    calculateAndPersistScores(ibgeCode, report).catch((err: unknown) =>
      logger.error("[ods-history] falha ao persistir scores", {
        ibgeCode,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  } catch (error) {
    logger.error("Error calculating ODS scores", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao calcular scores ODS" });
  }
});

/**
 * GET /api/ods/:ibgeCode/history
 * Retorna histórico de scores ODS persistidos para um município.
 * Query param opcional: odsNumber (filtra por ODS específico, 0-17)
 */
router.get(
  "/:ibgeCode/history",
  requireMunicipalityScope(),
  async (req: Request, res: Response) => {
    const ibgeCode = req.params["ibgeCode"];

    if (!ibgeCode || !/^\d{7}$/.test(ibgeCode)) {
      res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
      return;
    }

    const rawOdsNumber = req.query["odsNumber"];
    let odsNumber: number | undefined;

    if (rawOdsNumber !== undefined) {
      const parsed = Number(rawOdsNumber);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 17) {
        res.status(400).json({ error: "odsNumber deve ser um inteiro entre 0 e 17" });
        return;
      }
      odsNumber = parsed;
    }

    try {
      const history = await getScoreHistory(ibgeCode, odsNumber);

      // For global score (odsNumber=0 or unfiltered), include trend comparability assessment
      const includesTrend = odsNumber === undefined || odsNumber === 0;
      const globalEntries = includesTrend
        ? history
            .filter((h) => h.odsNumber === 0)
            .sort((a, b) => a.referenceYear - b.referenceYear)
            .map((h) => ({
              referenceYear: h.referenceYear,
              score: h.score,
              indicatorCount: h.indicatorCount,
            }))
        : [];

      const trend = includesTrend ? assessComparability(globalEntries) : undefined;

      res.json({
        ibgeCode,
        total: history.length,
        history,
        trend,
      });
    } catch (error) {
      logger.error("Error fetching ODS history", {
        ibgeCode,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro interno ao buscar histórico ODS" });
    }
  },
);

/**
 * POST /api/ods/compare
 * Body: { ibgeCodes: string[] }
 * Compara scores ODS entre múltiplos municípios (máx 10).
 */
router.post(
  "/compare",
  requireRole("admin", "prefeito", "secretario"),
  batchLimiter,
  async (req: Request, res: Response) => {
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
      // Valida existência de todos os municípios antes de acionar coletores.
      const municipalities = await prisma.municipality.findMany({
        where: { ibgeCode: { in: ibgeCodes } },
        select: { ibgeCode: true, name: true },
      });
      const nameByCode = new Map(municipalities.map((m) => [m.ibgeCode, m.name]));

      const unknownCodes = ibgeCodes.filter((code) => !nameByCode.has(code));
      if (unknownCodes.length > 0) {
        res.status(404).json({
          error: `Municípios não encontrados: ${unknownCodes.join(", ")}`,
        });
        return;
      }

      const results = await Promise.all(
        ibgeCodes.map((code) =>
          withCache(`ods:report:${code}`, 3600, () => calculateMunicipalOds(code)),
        ),
      );

      const comparison = ibgeCodes.map((code, idx) => {
        const report = results[idx];
        if (report && !report.municipalityName) {
          report.municipalityName = nameByCode.get(code) ?? null;
        }
        return { ibgeCode: code, report };
      });

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
  },
);

export default router;
