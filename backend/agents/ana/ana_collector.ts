import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  AnaDataFileSchema,
  type AnaMunicipalData,
} from "../../../shared/types/agents/ana.types.js";
import anaRawData from "../../../shared/data/ana_2022.json";

// Validação única na carga do módulo
const parseResult = AnaDataFileSchema.safeParse(anaRawData);
if (!parseResult.success) {
  throw new Error(`ana_2022.json validation failed: ${JSON.stringify(parseResult.error.errors)}`);
}
const ANA_DATA = parseResult.data;

const REFERENCE_YEAR = 2022;
const REFERENCE_DATE = new Date("2022-12-31");

export class AnaCollector {
  async collect(ibgeCode: string): Promise<AnaMunicipalData | null> {
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
