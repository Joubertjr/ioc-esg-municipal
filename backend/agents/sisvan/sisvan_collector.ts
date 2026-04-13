import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  SisvanDataFileSchema,
  type SisvanMunicipalData,
} from "../../../shared/types/agents/sisvan.types.js";
import sisvanRawData from "../../../shared/data/sisvan_latest.json" with { type: "json" };

// Extrai metadados de atualização (inseridos por scripts/update-sisvan-data.ts)
const _sisvanRawRecord = sisvanRawData as Record<string, unknown>;
const _sisvanMeta = _sisvanRawRecord["__meta"] as { referenceYear?: number } | undefined;
const { __meta: _sisvanMetaIgnored, ...sisvanEntries } = _sisvanRawRecord;

// Validação na carga do módulo — falha graceful para não crashar o Express
const _sisvanParseResult = SisvanDataFileSchema.safeParse(sisvanEntries);
if (!_sisvanParseResult.success) {
  logger.error(
    "sisvan_latest.json validation failed — collector will return null for all municipalities",
    {
      errors: _sisvanParseResult.error.errors.slice(0, 3),
    },
  );
}
const SISVAN_DATA = _sisvanParseResult.success ? _sisvanParseResult.data : null;

const REFERENCE_YEAR = _sisvanMeta?.referenceYear ?? 2023;
const REFERENCE_DATE = new Date(`${REFERENCE_YEAR}-12-31`);

export class SisvanCollector {
  async collect(ibgeCode: string): Promise<SisvanMunicipalData | null> {
    if (!SISVAN_DATA) return null;

    const entry = SISVAN_DATA[ibgeCode];
    if (!entry) {
      logger.debug(`No SISVAN data for ${ibgeCode}`);
      return null;
    }

    const { cobertura_acompanhamento, deficit_nutricional, sobrepeso_infantil } = entry;

    return {
      ibgeCode,
      siconfiCode: ibgeToSiconfi(ibgeCode),
      referenceYear: REFERENCE_YEAR,
      referenceDate: REFERENCE_DATE,
      dataAvailable: true,
      indicators: { cobertura_acompanhamento, deficit_nutricional, sobrepeso_infantil },
    };
  }

  async collectBatch(ibgeCodes: string[]): Promise<Map<string, SisvanMunicipalData>> {
    const results = new Map<string, SisvanMunicipalData>();
    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) results.set(code, data);
    }
    logger.info(`SISVAN batch: ${results.size}/${ibgeCodes.length} municípios com dados`);
    return results;
  }
}
