import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  IdebDataFileSchema,
  type InepMunicipalData,
} from "../../../shared/types/agents/inep.types.js";
import idebRawData from "../../../shared/data/ideb_latest.json" with { type: "json" };

// Extrai metadados de atualização (inseridos por scripts/update-inep-data.ts)
const _idebRawRecord = idebRawData as Record<string, unknown>;
const _idebMeta = _idebRawRecord["__meta"] as { referenceYear?: number } | undefined;
const { __meta: _idebMetaIgnored, ...idebEntries } = _idebRawRecord;

// Validação na carga do módulo — falha graceful para não crashar o Express
const _inepParseResult = IdebDataFileSchema.safeParse(idebEntries);
if (!_inepParseResult.success) {
  logger.error(
    "ideb_latest.json validation failed — collector will return null for all municipalities",
    {
      errors: _inepParseResult.error.errors.slice(0, 3),
    },
  );
}
const IDEB_DATA = _inepParseResult.success ? _inepParseResult.data : null;

const REFERENCE_YEAR = _idebMeta?.referenceYear ?? 2023;
const REFERENCE_DATE = new Date(`${REFERENCE_YEAR}-12-31`);

export class InepCollector {
  async collect(ibgeCode: string): Promise<InepMunicipalData | null> {
    if (!IDEB_DATA) return null;

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
