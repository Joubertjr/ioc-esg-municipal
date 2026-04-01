import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  IdebDataFileSchema,
  type InepMunicipalData,
} from "../../../shared/types/agents/inep.types.js";
import idebRawData from "../../../shared/data/ideb_2023.json";

// Validação única na carga do módulo
const parseResult = IdebDataFileSchema.safeParse(idebRawData);
if (!parseResult.success) {
  throw new Error(`ideb_2023.json validation failed: ${JSON.stringify(parseResult.error.errors)}`);
}
const IDEB_DATA = parseResult.data;

const REFERENCE_YEAR = 2023;
const REFERENCE_DATE = new Date("2023-12-31");

export class InepCollector {
  async collect(ibgeCode: string): Promise<InepMunicipalData | null> {
    const entry = IDEB_DATA[ibgeCode];
    if (!entry) {
      logger.debug(`No IDEB data for ${ibgeCode}`);
      return null;
    }

    // Se ambos são null, não vale reportar como "dados disponíveis"
    if (entry.idebAnosIniciais === null && entry.idebAnosFinais === null) {
      return null;
    }

    return {
      ibgeCode,
      siconfiCode: ibgeToSiconfi(ibgeCode),
      referenceYear: REFERENCE_YEAR,
      referenceDate: REFERENCE_DATE,
      dataAvailable: true,
      indicators: {
        idebAnosIniciais: entry.idebAnosIniciais,
        idebAnosFinais: entry.idebAnosFinais,
      },
    };
  }

  async collectBatch(ibgeCodes: string[]): Promise<Map<string, InepMunicipalData>> {
    const results = new Map<string, InepMunicipalData>();
    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) results.set(code, data);
    }
    logger.info(`INEP batch: ${results.size}/${ibgeCodes.length} municípios com dados`);
    return results;
  }
}
