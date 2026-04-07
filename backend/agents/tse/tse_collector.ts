import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  TseDataFileSchema,
  type TseMunicipalData,
} from "../../../shared/types/agents/tse.types.js";
import tseRawData from "../../../shared/data/tse_2024.json" with { type: "json" };

// Validação na carga do módulo — falha graceful para não crashar o Express
const _tseParseResult = TseDataFileSchema.safeParse(tseRawData);
if (!_tseParseResult.success) {
  logger.error(
    "tse_2024.json validation failed — collector will return null for all municipalities",
    {
      errors: _tseParseResult.error.errors.slice(0, 3),
    },
  );
}
const TSE_DATA = _tseParseResult.success ? _tseParseResult.data : null;

const REFERENCE_YEAR = 2024;
const REFERENCE_DATE = new Date("2024-10-06"); // 1º turno eleições municipais 2024

export class TseCollector {
  async collect(ibgeCode: string): Promise<TseMunicipalData | null> {
    if (!TSE_DATA) return null;

    const entry = TSE_DATA[ibgeCode];
    if (!entry) {
      logger.debug(`No TSE data for ${ibgeCode}`);
      return null;
    }

    // Se ambos são null, não há dados úteis para reportar
    if (entry.pctMulheresEleitas === null && entry.pctCandidatasMulheres === null) {
      return null;
    }

    return {
      ibgeCode,
      siconfiCode: ibgeToSiconfi(ibgeCode),
      referenceYear: REFERENCE_YEAR,
      referenceDate: REFERENCE_DATE,
      dataAvailable: true,
      indicators: {
        pctMulheresEleitas: entry.pctMulheresEleitas,
        pctCandidatasMulheres: entry.pctCandidatasMulheres,
      },
    };
  }

  async collectBatch(ibgeCodes: string[]): Promise<Map<string, TseMunicipalData>> {
    const results = new Map<string, TseMunicipalData>();
    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) results.set(code, data);
    }
    logger.info(`TSE batch: ${results.size}/${ibgeCodes.length} municípios com dados`);
    return results;
  }
}
