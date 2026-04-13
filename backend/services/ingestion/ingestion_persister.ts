import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import type { OdsIndicator } from "../../../shared/types/domain/ods.js";

const BATCH_SIZE = 100;

export interface PersistResult {
  upserted: number;
  errors: number;
}

/**
 * Persiste indicadores ODS no banco via upsert em batches.
 * Retorna contagem de upserts e erros.
 */
export async function persistIndicators(
  municipalityId: string,
  indicators: OdsIndicator[],
): Promise<PersistResult> {
  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < indicators.length; i += BATCH_SIZE) {
    const batch = indicators.slice(i, i + BATCH_SIZE);

    const upserts = batch.map((ind) =>
      prisma.odsIndicator.upsert({
        where: {
          municipalityId_indicatorName_referenceYear: {
            municipalityId,
            indicatorName: ind.indicatorName,
            referenceYear: ind.referenceYear,
          },
        },
        create: {
          municipalityId,
          odsNumber: ind.odsNumber,
          indicatorName: ind.indicatorName,
          value: ind.value !== null ? new Decimal(ind.value) : null,
          score: ind.score,
          status: ind.status,
          source: ind.source,
          referenceYear: ind.referenceYear,
          referenceDate: ind.referenceDate,
          dataAvailable: ind.dataAvailable,
        },
        update: {
          value: ind.value !== null ? new Decimal(ind.value) : null,
          score: ind.score,
          status: ind.status,
          dataAvailable: ind.dataAvailable,
        },
      }),
    );

    try {
      await prisma.$transaction(upserts);
      upserted += batch.length;
    } catch (err) {
      errors += batch.length;
      logger.error("[ingestion-persister] batch upsert failed", {
        municipalityId,
        batchStart: i,
        batchSize: batch.length,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { upserted, errors };
}
