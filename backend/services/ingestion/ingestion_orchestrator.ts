import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { getRedisClient } from "../../utils/cache.js";
import { ingestionDuration, ingestionLastSuccess } from "../../utils/metrics.js";
import {
  runSourceIngestion,
  ALL_SOURCES,
  type SourceName,
  type SourceRunResult,
} from "./ingestion_source_runner.js";
import { recalculateAllScores } from "./score_recalculator.js";

// ─── Estado ─────────────────────────────────────────────────���────────────────

let isRunning = false;

export function isIngestionRunning(): boolean {
  return isRunning;
}

// ─── Orquestrador ────────────────────────────────────────────────────────────

export interface IngestionResult {
  totalDurationMs: number;
  sources: SourceRunResult[];
  scoresRecalculated: number;
}

/**
 * Executa a ingestão completa: todas as fontes → recalcula scores → invalida cache.
 * Se `sourcesToRun` for fornecido, roda apenas essas fontes.
 */
export async function runFullIngestion(
  sourcesToRun?: SourceName[],
  triggeredBy = "cron",
): Promise<IngestionResult> {
  if (isRunning) {
    throw new Error("Ingestion already running — overlap protection");
  }

  isRunning = true;
  const start = Date.now();
  const sources = sourcesToRun ?? ALL_SOURCES;

  logger.info("[ingestion] starting full ingestion", {
    triggeredBy,
    sources: sources.length,
  });

  try {
    // Buscar todos os municípios de SC
    const municipalities = await prisma.municipality.findMany({
      where: { state: "SC", deletedAt: null },
      select: { id: true, ibgeCode: true },
    });

    logger.info(`[ingestion] processing ${municipalities.length} municipalities`);

    // Grupo 1: APIs externas (sequencial entre si por rate limiting)
    // Grupo 2: JSONs estáticos (paralelo — sem HTTP)
    const apiSources: SourceName[] = ["ibge", "siconfi", "datasus", "pncp", "inpe"];
    const staticSources: SourceName[] = [
      "ieps",
      "inep",
      "snis",
      "sisvan",
      "anatel",
      "aneel",
      "convenios",
      "tse",
      "ana",
      "snis_rs",
    ];

    const selectedApi = sources.filter((s) => apiSources.includes(s));
    const selectedStatic = sources.filter((s) => staticSources.includes(s));

    const results: SourceRunResult[] = [];

    // Estáticos em paralelo (sem HTTP, instantâneo)
    if (selectedStatic.length > 0) {
      const staticPromises = selectedStatic.map((source) =>
        runAndPersistSource(source, municipalities, triggeredBy),
      );
      const staticResults = await Promise.all(staticPromises);
      results.push(...staticResults);
    }

    // APIs externas sequencialmente (cada uma já tem rate limiting interno)
    for (const source of selectedApi) {
      const result = await runAndPersistSource(source, municipalities, triggeredBy);
      results.push(result);
    }

    // Recalcular scores ODS a partir dos indicadores no banco
    logger.info("[ingestion] recalculating ODS scores from database");
    const { scoresUpserted } = await recalculateAllScores();

    // Invalidar cache Redis para forçar leitura do banco
    await invalidateOdsCache();

    const totalDurationMs = Date.now() - start;
    logger.info("[ingestion] full ingestion complete", {
      totalDurationMs,
      sourcesProcessed: results.length,
      scoresUpserted: scoresUpserted,
    });

    return { totalDurationMs, sources: results, scoresRecalculated: scoresUpserted };
  } finally {
    isRunning = false;
  }
}

// ─── Helpers ───────────────────────────────��──────────────────────��──────────

async function runAndPersistSource(
  source: SourceName,
  municipalities: Array<{ id: string; ibgeCode: string }>,
  _triggeredBy: string,
): Promise<SourceRunResult> {
  const start = Date.now();

  // Criar IngestionRun
  const run = await prisma.ingestionRun.create({
    data: {
      source,
      status: "running",
      totalMunicipalities: municipalities.length,
    },
  });

  try {
    const result = await runSourceIngestion(source, municipalities);
    const durationMs = Date.now() - start;

    // Determinar status
    const status =
      result.failureCount === 0 ? "completed" : result.successCount > 0 ? "partial" : "failed";

    // Atualizar IngestionRun
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status,
        completedAt: new Date(),
        durationMs,
        successCount: result.successCount,
        failureCount: result.failureCount,
        skippedCount: result.skippedCount,
        indicatorsWritten: result.indicatorsWritten,
        referenceYear: result.referenceYear,
        errorSummary:
          result.failedMunicipalities.length > 0
            ? `${result.failureCount} municipalities failed. Sample: ${result.failedMunicipalities
                .slice(0, 3)
                .map((f) => `${f.ibgeCode}: ${f.error}`)
                .join("; ")}`
            : null,
      },
    });

    // Gravar logs de falha
    if (result.failedMunicipalities.length > 0) {
      await prisma.ingestionLog.createMany({
        data: result.failedMunicipalities.map((f) => ({
          ingestionRunId: run.id,
          municipalityId: f.municipalityId,
          success: false,
          errorMessage: f.error.slice(0, 500),
          indicatorsCount: 0,
        })),
        skipDuplicates: true,
      });
    }

    // Prometheus
    ingestionDuration.observe({ source, status }, durationMs);
    if (status === "completed" || status === "partial") {
      ingestionLastSuccess.set({ source }, Date.now() / 1000);
    }

    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        durationMs,
        failureCount: municipalities.length,
        errorSummary: errorMsg.slice(0, 500),
      },
    });

    ingestionDuration.observe({ source, status: "failed" }, durationMs);

    logger.error(`[ingestion] source ${source} failed completely`, { error: errorMsg });

    return {
      source,
      successCount: 0,
      failureCount: municipalities.length,
      skippedCount: 0,
      indicatorsWritten: 0,
      referenceYear: null,
      failedMunicipalities: [],
    };
  }
}

async function invalidateOdsCache(): Promise<void> {
  try {
    const redis = await getRedisClient();
    // Deletar todas as keys de ODS report e recommendations
    const patterns = ["ods:report:*", "recommendations:*", "benchmark:*"];
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
        logger.info(`[ingestion] invalidated ${keys.length} cache keys matching ${pattern}`);
      }
    }
  } catch (err) {
    logger.warn("[ingestion] failed to invalidate Redis cache", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Startup cleanup ─────────────────────���────────────��──────────────────────

/**
 * Marca runs "running" com mais de 6h como "failed" (processo reiniciou no meio).
 * Chamar no startup do Express.
 */
export async function cleanupStaleRuns(): Promise<void> {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const staleRuns = await prisma.ingestionRun.updateMany({
    where: {
      status: "running",
      startedAt: { lt: sixHoursAgo },
    },
    data: {
      status: "failed",
      errorSummary: "Process restarted during ingestion — marked as failed on startup",
      completedAt: new Date(),
    },
  });

  if (staleRuns.count > 0) {
    logger.warn(`[ingestion] cleaned up ${staleRuns.count} stale runs on startup`);
  }
}
