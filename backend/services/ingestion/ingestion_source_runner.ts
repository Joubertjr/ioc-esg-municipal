import { logger } from "../../utils/logger.js";
import { persistIndicators } from "./ingestion_persister.js";
import { ingestionIndicatorsUpserted, ingestionMunicipalitiesFailed } from "../../utils/metrics.js";
import type { OdsIndicator } from "../../../shared/types/domain/ods.js";

// ─── Importar coletores e mappers ────────────────────────────────────────────

import { IbgeCollector, mapToOdsIndicators as mapIbgeOds } from "../../agents/ibge/index.js";
import {
  SiconfiCollector,
  mapToOdsIndicators as mapSiconfiOds,
} from "../../agents/siconfi/index.js";
import {
  DatasusCollector,
  mapToOdsIndicators as mapDatasusOds,
} from "../../agents/datasus/index.js";
import { InepCollector, mapToOdsIndicators as mapInepOds } from "../../agents/inep/index.js";
import { SnisCollector, mapToOdsIndicators as mapSnisOds } from "../../agents/snis/index.js";
import { InpeCollector, mapToOdsIndicators as mapInpeOds } from "../../agents/inpe/index.js";
import { PncpCollector, mapToOdsIndicators as mapPncpOds } from "../../agents/pncp/index.js";
import { TseCollector, mapToOdsIndicators as mapTseOds } from "../../agents/tse/index.js";
import { AneelCollector, mapToOdsIndicators as mapAneelOds } from "../../agents/aneel/index.js";
import { SnisRsCollector, mapToOdsIndicators as mapSnisRsOds } from "../../agents/snis_rs/index.js";
import { AnaCollector, mapToOdsIndicators as mapAnaOds } from "../../agents/ana/index.js";
import {
  ConveniosCollector,
  mapToOdsIndicators as mapConveniosOds,
} from "../../agents/convenios/index.js";
import { AnatelCollector, mapToOdsIndicators as mapAnatelOds } from "../../agents/anatel/index.js";
import { SisvanCollector, mapToOdsIndicators as mapSisvanOds } from "../../agents/sisvan/index.js";
import { IepsCollector, mapToOdsIndicators as mapIepsOds } from "../../agents/ieps/index.js";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type SourceName =
  | "ibge"
  | "siconfi"
  | "datasus"
  | "pncp"
  | "inpe"
  | "ieps"
  | "inep"
  | "snis"
  | "sisvan"
  | "anatel"
  | "aneel"
  | "convenios"
  | "tse"
  | "ana"
  | "snis_rs";

export const ALL_SOURCES: SourceName[] = [
  "ibge",
  "siconfi",
  "datasus",
  "pncp",
  "inpe",
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

interface CollectorEntry {
  collector: { collectBatch(codes: string[]): Promise<Map<string, unknown>> };
  mapper: (data: unknown) => OdsIndicator[];
}

// Singletons — reutilizam rate limiting existente
const COLLECTORS: Record<SourceName, CollectorEntry> = {
  ibge: { collector: new IbgeCollector(), mapper: mapIbgeOds as (d: unknown) => OdsIndicator[] },
  siconfi: {
    collector: new SiconfiCollector(),
    mapper: mapSiconfiOds as (d: unknown) => OdsIndicator[],
  },
  datasus: {
    collector: new DatasusCollector(),
    mapper: mapDatasusOds as (d: unknown) => OdsIndicator[],
  },
  pncp: { collector: new PncpCollector(), mapper: mapPncpOds as (d: unknown) => OdsIndicator[] },
  inpe: { collector: new InpeCollector(), mapper: mapInpeOds as (d: unknown) => OdsIndicator[] },
  ieps: { collector: new IepsCollector(), mapper: mapIepsOds as (d: unknown) => OdsIndicator[] },
  inep: { collector: new InepCollector(), mapper: mapInepOds as (d: unknown) => OdsIndicator[] },
  snis: { collector: new SnisCollector(), mapper: mapSnisOds as (d: unknown) => OdsIndicator[] },
  sisvan: {
    collector: new SisvanCollector(),
    mapper: mapSisvanOds as (d: unknown) => OdsIndicator[],
  },
  anatel: {
    collector: new AnatelCollector(),
    mapper: mapAnatelOds as (d: unknown) => OdsIndicator[],
  },
  aneel: { collector: new AneelCollector(), mapper: mapAneelOds as (d: unknown) => OdsIndicator[] },
  convenios: {
    collector: new ConveniosCollector(),
    mapper: mapConveniosOds as (d: unknown) => OdsIndicator[],
  },
  tse: { collector: new TseCollector(), mapper: mapTseOds as (d: unknown) => OdsIndicator[] },
  ana: { collector: new AnaCollector(), mapper: mapAnaOds as (d: unknown) => OdsIndicator[] },
  snis_rs: {
    collector: new SnisRsCollector(),
    mapper: mapSnisRsOds as (d: unknown) => OdsIndicator[],
  },
};

// ─── Runner ──────────────────────────────────────────────────────────────────

export interface SourceRunResult {
  source: SourceName;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  indicatorsWritten: number;
  referenceYear: number | null;
  failedMunicipalities: Array<{ municipalityId: string; ibgeCode: string; error: string }>;
}

/**
 * Executa a ingestão de 1 fonte para todos os municípios fornecidos.
 * Usa o collectBatch existente (já tem rate limiting interno).
 */
export async function runSourceIngestion(
  source: SourceName,
  municipalities: Array<{ id: string; ibgeCode: string }>,
): Promise<SourceRunResult> {
  const entry = COLLECTORS[source];
  const ibgeCodes = municipalities.map((m) => m.ibgeCode);

  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  let indicatorsWritten = 0;
  let referenceYear: number | null = null;
  const failedMunicipalities: SourceRunResult["failedMunicipalities"] = [];

  try {
    const batchResult = await entry.collector.collectBatch(ibgeCodes);

    for (const municipality of municipalities) {
      const data = batchResult.get(municipality.ibgeCode);

      if (!data) {
        skippedCount++;
        continue;
      }

      try {
        const indicators = entry.mapper(data);

        if (indicators.length === 0) {
          skippedCount++;
          continue;
        }

        // Extrair referenceYear do primeiro indicador
        if (referenceYear === null && indicators[0]) {
          referenceYear = indicators[0].referenceYear;
        }

        const result = await persistIndicators(municipality.id, indicators);
        indicatorsWritten += result.upserted;

        if (result.errors > 0) {
          failureCount++;
          failedMunicipalities.push({
            municipalityId: municipality.id,
            ibgeCode: municipality.ibgeCode,
            error: `${result.errors} indicators failed to persist`,
          });
        } else {
          successCount++;
        }
      } catch (err) {
        failureCount++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        failedMunicipalities.push({
          municipalityId: municipality.id,
          ibgeCode: municipality.ibgeCode,
          error: errorMsg,
        });
      }
    }
  } catch (err) {
    // collectBatch inteiro falhou
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[ingestion] collectBatch failed for source ${source}`, { error: errorMsg });
    failureCount = municipalities.length;
    for (const m of municipalities) {
      failedMunicipalities.push({
        municipalityId: m.id,
        ibgeCode: m.ibgeCode,
        error: errorMsg,
      });
    }
  }

  // Prometheus metrics
  ingestionIndicatorsUpserted.inc({ source }, indicatorsWritten);
  if (failureCount > 0) {
    ingestionMunicipalitiesFailed.inc({ source }, failureCount);
  }

  logger.info(`[ingestion] source ${source} completed`, {
    successCount,
    failureCount,
    skippedCount,
    indicatorsWritten,
    referenceYear,
  });

  return {
    source,
    successCount,
    failureCount,
    skippedCount,
    indicatorsWritten,
    referenceYear,
    failedMunicipalities,
  };
}
