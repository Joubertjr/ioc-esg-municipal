import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  SnisDataFileSchema,
  type SnisMunicipalData,
} from "../../../shared/types/agents/snis.types.js";
import snisRawData from "../../../shared/data/snis_2022.json";

// Validação única na carga do módulo
const parseResult = SnisDataFileSchema.safeParse(snisRawData);
if (!parseResult.success) {
  throw new Error(`snis_2022.json validation failed: ${JSON.stringify(parseResult.error.errors)}`);
}
const SNIS_DATA = parseResult.data;

const REFERENCE_YEAR = 2022;
const REFERENCE_DATE = new Date("2022-12-31");

export class SnisCollector {
  async collect(ibgeCode: string): Promise<SnisMunicipalData | null> {
    const entry = SNIS_DATA[ibgeCode];
    if (!entry) {
      logger.debug(`No SNIS data for ${ibgeCode}`);
      return null;
    }

    // Se todos os campos são null, não reportar como disponível
    const { atendimentoAgua, atendimentoEsgoto, esgotoTratado, perdaFaturamento } = entry;
    if (
      atendimentoAgua === null &&
      atendimentoEsgoto === null &&
      esgotoTratado === null &&
      perdaFaturamento === null
    ) {
      return null;
    }

    return {
      ibgeCode,
      siconfiCode: ibgeToSiconfi(ibgeCode),
      referenceYear: REFERENCE_YEAR,
      referenceDate: REFERENCE_DATE,
      dataAvailable: true,
      indicators: { atendimentoAgua, atendimentoEsgoto, esgotoTratado, perdaFaturamento },
    };
  }

  async collectBatch(ibgeCodes: string[]): Promise<Map<string, SnisMunicipalData>> {
    const results = new Map<string, SnisMunicipalData>();
    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) results.set(code, data);
    }
    logger.info(`SNIS batch: ${results.size}/${ibgeCodes.length} municípios com dados`);
    return results;
  }
}
