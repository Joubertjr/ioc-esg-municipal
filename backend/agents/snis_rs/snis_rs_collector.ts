import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  SnisRsDataFileSchema,
  type SnisRsMunicipalData,
} from "../../../shared/types/agents/snis_rs.types.js";
import snisRsRawData from "../../../shared/data/snis_rs_2022.json" with { type: "json" };

// Validação na carga do módulo — falha graceful para não crashar o Express
const _snisRsParseResult = SnisRsDataFileSchema.safeParse(snisRsRawData);
if (!_snisRsParseResult.success) {
  logger.error(
    "snis_rs_2022.json validation failed — collector will return null for all municipalities",
    {
      errors: _snisRsParseResult.error.errors.slice(0, 3),
    },
  );
}
const SNIS_RS_DATA = _snisRsParseResult.success ? _snisRsParseResult.data : null;

const REFERENCE_YEAR = 2022;
const REFERENCE_DATE = new Date("2022-12-31");

export class SnisRsCollector {
  async collect(ibgeCode: string): Promise<SnisRsMunicipalData | null> {
    if (!SNIS_RS_DATA) return null;

    const entry = SNIS_RS_DATA[ibgeCode];
    if (!entry) {
      logger.debug(`No SNIS-RS data for ${ibgeCode}`);
      return null;
    }

    const { coletaSeletivaPct, taxaReciclagemPct, residuoPerCapitaKgDia } = entry;

    // Se todos os campos são null, não reportar como disponível
    if (
      coletaSeletivaPct === null &&
      taxaReciclagemPct === null &&
      residuoPerCapitaKgDia === null
    ) {
      return null;
    }

    return {
      ibgeCode,
      siconfiCode: ibgeToSiconfi(ibgeCode),
      referenceYear: REFERENCE_YEAR,
      referenceDate: REFERENCE_DATE,
      dataAvailable: true,
      indicators: { coletaSeletivaPct, taxaReciclagemPct, residuoPerCapitaKgDia },
    };
  }

  async collectBatch(ibgeCodes: string[]): Promise<Map<string, SnisRsMunicipalData>> {
    const results = new Map<string, SnisRsMunicipalData>();
    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) results.set(code, data);
    }
    logger.info(`SNIS-RS batch: ${results.size}/${ibgeCodes.length} municípios com dados`);
    return results;
  }
}
