import { Router, type Request, type Response, type Router as RouterType } from "express";
import { requireRole } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";
import { prisma } from "../lib/prisma.js";
import {
  runFullIngestion,
  isIngestionRunning,
} from "../services/ingestion/ingestion_orchestrator.js";
import { getNextScheduledRun } from "../services/ingestion/ingestion_scheduler.js";
import type { SourceName } from "../services/ingestion/ingestion_source_runner.js";
import { ALL_SOURCES } from "../services/ingestion/ingestion_source_runner.js";

const router: RouterType = Router();

/**
 * GET /api/ingestion/status
 * Retorna status da última ingestão por fonte + run atual + próximo agendamento.
 */
router.get("/status", requireRole("admin"), async (_req: Request, res: Response) => {
  try {
    // Último run completo por fonte
    const lastRuns = await prisma.ingestionRun.findMany({
      where: { status: { in: ["completed", "partial", "failed"] } },
      orderBy: { completedAt: "desc" },
      distinct: ["source"],
      select: {
        source: true,
        status: true,
        completedAt: true,
        startedAt: true,
        durationMs: true,
        successCount: true,
        failureCount: true,
        skippedCount: true,
        indicatorsWritten: true,
        referenceYear: true,
        errorSummary: true,
      },
    });

    // Run em andamento (se houver)
    const currentRun = await prisma.ingestionRun.findFirst({
      where: { status: "running" },
      orderBy: { startedAt: "desc" },
      select: {
        source: true,
        startedAt: true,
        totalMunicipalities: true,
      },
    });

    res.json({
      lastRuns,
      currentRun,
      isRunning: isIngestionRunning(),
      nextScheduledAt: getNextScheduledRun(),
    });
  } catch (err) {
    logger.error("[ingestion-route] error fetching status", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Erro ao buscar status de ingestão" });
  }
});

/**
 * POST /api/ingestion/trigger
 * Dispara ingestão manual. Body opcional: { "source": "ibge" }
 * Retorna 202 com runId ou 409 se já estiver rodando.
 */
router.post("/trigger", requireRole("admin"), async (req: Request, res: Response) => {
  if (isIngestionRunning()) {
    res.status(409).json({ error: "Ingestão já em execução" });
    return;
  }

  const { source } = req.body as { source?: string };

  // Validar source se fornecido
  if (source && !ALL_SOURCES.includes(source as SourceName)) {
    res.status(400).json({
      error: `Fonte inválida: ${source}. Válidas: ${ALL_SOURCES.join(", ")}`,
    });
    return;
  }

  const sourcesToRun = source ? [source as SourceName] : undefined;

  // Responder 202 imediatamente e rodar em background
  res.status(202).json({
    message: source ? `Ingestão da fonte ${source} iniciada` : "Ingestão completa iniciada",
    sources: sourcesToRun ?? ALL_SOURCES,
  });

  // Fire-and-forget
  runFullIngestion(sourcesToRun, "manual").catch((err) => {
    logger.error("[ingestion-route] manual ingestion failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
});

export default router;
