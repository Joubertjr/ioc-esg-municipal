import { schedule, type ScheduledTask } from "node-cron";
import { logger } from "../../utils/logger.js";
import {
  runFullIngestion,
  isIngestionRunning,
  cleanupStaleRuns,
} from "./ingestion_orchestrator.js";

let scheduledTask: ScheduledTask | null = null;

/**
 * Inicializa o scheduler de ingestão diária.
 * Cron: 02:00 UTC (ADR-010 — node-cron embutido no processo Express).
 * Proteção contra overlap: se run anterior ainda estiver rodando, nova execução aborta.
 */
export async function startIngestionScheduler(): Promise<void> {
  // Limpar runs "running" que ficaram presas (processo reiniciou no meio)
  await cleanupStaleRuns();

  // Agendar ingestão diária às 02:00 UTC
  scheduledTask = schedule(
    "0 2 * * *",
    async () => {
      if (isIngestionRunning()) {
        logger.warn("[scheduler] skipping scheduled ingestion — previous run still active");
        return;
      }

      logger.info("[scheduler] starting scheduled daily ingestion");

      try {
        const result = await runFullIngestion(undefined, "cron");
        logger.info("[scheduler] scheduled ingestion completed", {
          totalDurationMs: result.totalDurationMs,
          sourcesProcessed: result.sources.length,
          scoresRecalculated: result.scoresRecalculated,
        });
      } catch (err) {
        logger.error("[scheduler] scheduled ingestion failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    {
      timezone: "UTC",
    },
  );

  logger.info("[scheduler] ingestion scheduler started — cron: 0 2 * * * UTC");
}

/**
 * Para o scheduler (para graceful shutdown).
 */
export function stopIngestionScheduler(): void {
  if (scheduledTask) {
    void scheduledTask.stop();
    scheduledTask = null;
    logger.info("[scheduler] ingestion scheduler stopped");
  }
}

/**
 * Retorna o próximo horário agendado (para endpoint de status).
 */
export function getNextScheduledRun(): string {
  // Próxima execução: 02:00 UTC do dia seguinte (ou hoje se ainda não passou)
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(2, 0, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}
