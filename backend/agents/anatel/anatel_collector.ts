import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  AnatelDataFileSchema,
  type AnatelMunicipalData,
} from "../../../shared/types/agents/anatel.types.js";
import anatelRawData from "../../../shared/data/anatel_2023.json" with { type: "json" };

// Validação na carga do módulo — falha graceful para não crashar o Express
const _anatelParseResult = AnatelDataFileSchema.safeParse(anatelRawData);
if (!_anatelParseResult.success) {
  logger.error(
    "anatel_2023.json validation failed — collector will return null for all municipalities",
    {
      errors: _anatelParseResult.error.errors.slice(0, 3),
    },
  );
}
const ANATEL_DATA = _anatelParseResult.success ? _anatelParseResult.data : null;

const REFERENCE_YEAR = 2023;
const REFERENCE_DATE = new Date("2023-12-31");

export class AnatelCollector {
  async collect(ibgeCode: string): Promise<AnatelMunicipalData | null> {
    if (!ANATEL_DATA) return null;

    const entry = ANATEL_DATA[ibgeCode];
    if (!entry) {
      logger.debug(`No ANATEL data for ${ibgeCode}`);
      return null;
    }

    return {
      ibgeCode,
      siconfiCode: ibgeToSiconfi(ibgeCode),
      referenceYear: REFERENCE_YEAR,
      referenceDate: REFERENCE_DATE,
      dataAvailable: true,
      indicators: {
        acessosBandaLargaPor100hab: entry.acessosBandaLargaPor100hab,
        cobertura4gPercentual: entry.cobertura4gPercentual,
      },
    };
  }

  async collectBatch(ibgeCodes: string[]): Promise<Map<string, AnatelMunicipalData>> {
    const results = new Map<string, AnatelMunicipalData>();
    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) results.set(code, data);
    }
    logger.info(`ANATEL batch: ${results.size}/${ibgeCodes.length} municípios com dados`);
    return results;
  }
}
