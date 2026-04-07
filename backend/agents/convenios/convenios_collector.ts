import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  ConveniosDataFileSchema,
  type ConveniosMunicipalData,
} from "../../../shared/types/agents/convenios.types.js";
import conveniosRawData from "../../../shared/data/convenios_2023.json" with { type: "json" };

// Validação na carga do módulo — falha graceful para não crashar o Express
const _conveniosParseResult = ConveniosDataFileSchema.safeParse(conveniosRawData);
if (!_conveniosParseResult.success) {
  logger.error(
    "convenios_2023.json validation failed — collector will return null for all municipalities",
    {
      errors: _conveniosParseResult.error.errors.slice(0, 3),
    },
  );
}
const CONVENIOS_DATA = _conveniosParseResult.success ? _conveniosParseResult.data : null;

const REFERENCE_YEAR = 2023;
const REFERENCE_DATE = new Date("2023-12-31");

export class ConveniosCollector {
  async collect(ibgeCode: string): Promise<ConveniosMunicipalData | null> {
    if (!CONVENIOS_DATA) return null;

    const entry = CONVENIOS_DATA[ibgeCode];
    if (!entry) {
      logger.debug(`No convenios data for ${ibgeCode}`);
      return null;
    }

    // Se todos os indicadores são null, não vale reportar como dados disponíveis
    const allNull =
      entry.conveniosFederaisAtivos === null &&
      entry.pctOrcamentoConvenios === null &&
      entry.consorciosIntermunicipais === null;

    if (allNull) {
      return null;
    }

    return {
      ibgeCode,
      siconfiCode: ibgeToSiconfi(ibgeCode),
      referenceYear: REFERENCE_YEAR,
      referenceDate: REFERENCE_DATE,
      dataAvailable: true,
      indicators: {
        conveniosFederaisAtivos: entry.conveniosFederaisAtivos,
        pctOrcamentoConvenios: entry.pctOrcamentoConvenios,
        consorciosIntermunicipais: entry.consorciosIntermunicipais,
      },
    };
  }

  async collectBatch(ibgeCodes: string[]): Promise<Map<string, ConveniosMunicipalData>> {
    const results = new Map<string, ConveniosMunicipalData>();
    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) results.set(code, data);
    }
    logger.info(`Convenios batch: ${results.size}/${ibgeCodes.length} municípios com dados`);
    return results;
  }
}
