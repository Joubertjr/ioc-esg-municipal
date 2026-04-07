import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  AnaDataFileSchema,
  type AnaMunicipalData,
} from "../../../shared/types/agents/ana.types.js";
import anaRawData from "../../../shared/data/ana_2022.json" with { type: "json" };

// Validação na carga do módulo — falha graceful para não crashar o Express
const _anaParseResult = AnaDataFileSchema.safeParse(anaRawData);
if (!_anaParseResult.success) {
  logger.error(
    "ana_2022.json validation failed — collector will return null for all municipalities",
    {
      errors: _anaParseResult.error.errors.slice(0, 3),
    },
  );
}
const ANA_DATA = _anaParseResult.success ? _anaParseResult.data : null;

const REFERENCE_YEAR = 2022;
const REFERENCE_DATE = new Date("2022-12-31");

export class AnaCollector {
  async collect(ibgeCode: string): Promise<AnaMunicipalData | null> {
    if (!ANA_DATA) return null;

    const entry = ANA_DATA[ibgeCode];
    if (!entry) {
      logger.debug(`No ANA data for ${ibgeCode}`);
      return null;
    }

    // Se ambos são null, não há dados úteis para reportar
    if (entry.iqaRios === null && entry.mataCiliarPct === null) {
      return null;
    }

    return {
      ibgeCode,
      siconfiCode: ibgeToSiconfi(ibgeCode),
      referenceYear: REFERENCE_YEAR,
      referenceDate: REFERENCE_DATE,
      dataAvailable: true,
      indicators: {
        iqaRios: entry.iqaRios,
        mataCiliarPct: entry.mataCiliarPct,
      },
    };
  }

  async collectBatch(ibgeCodes: string[]): Promise<Map<string, AnaMunicipalData>> {
    const results = new Map<string, AnaMunicipalData>();
    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) results.set(code, data);
    }
    logger.info(`ANA batch: ${results.size}/${ibgeCodes.length} municípios com dados`);
    return results;
  }
}
