import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  SisvanDataFileSchema,
  type SisvanMunicipalData,
} from "../../../shared/types/agents/sisvan.types.js";
import sisvanRawData from "../../../shared/data/sisvan_2023.json";

// Validação única na carga do módulo
const parseResult = SisvanDataFileSchema.safeParse(sisvanRawData);
if (!parseResult.success) {
  throw new Error(`sisvan_2023.json validation failed: ${JSON.stringify(parseResult.error.errors)}`);
}
const SISVAN_DATA = parseResult.data;

const REFERENCE_YEAR = 2023;
const REFERENCE_DATE = new Date("2023-12-31");

export class SisvanCollector {
  async collect(ibgeCode: string): Promise<SisvanMunicipalData | null> {
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
