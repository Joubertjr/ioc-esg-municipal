import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  AneelDataFileSchema,
  type AneelMunicipalData,
} from "../../../shared/types/agents/aneel.types.js";
import aneelRawData from "../../../shared/data/aneel_gd_2023.json";

// Validação única na carga do módulo
const parseResult = AneelDataFileSchema.safeParse(aneelRawData);
if (!parseResult.success) {
  throw new Error(
    `aneel_gd_2023.json validation failed: ${JSON.stringify(parseResult.error.errors)}`
  );
}
const ANEEL_DATA = parseResult.data;

const REFERENCE_YEAR = 2023;
const REFERENCE_DATE = new Date("2023-12-31");

export class AneelCollector {
  async collect(ibgeCode: string): Promise<AneelMunicipalData | null> {
    const entry = ANEEL_DATA[ibgeCode];
    if (!entry) {
      logger.debug(`No ANEEL GD data for ${ibgeCode}`);
      return null;
    }

    // Sem dados úteis se GD e unidades forem null simultaneamente
    if (entry.geracaoDistribuidaKw === null && entry.unidadesGd === null) {
      return null;
    }

    return {
      ibgeCode,
      siconfiCode: ibgeToSiconfi(ibgeCode),
      referenceYear: REFERENCE_YEAR,
      referenceDate: REFERENCE_DATE,
      dataAvailable: true,
      indicators: {
        geracaoDistribuidaKw: entry.geracaoDistribuidaKw,
        unidadesGd: entry.unidadesGd,
        populacao: entry.populacao,
      },
    };
  }

  async collectBatch(ibgeCodes: string[]): Promise<Map<string, AneelMunicipalData>> {
    const results = new Map<string, AneelMunicipalData>();
    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) results.set(code, data);
    }
    logger.info(`ANEEL batch: ${results.size}/${ibgeCodes.length} municípios com dados`);
    return results;
  }
}
