import { logger } from "../../utils/logger.js";
import { ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  IepsDataFileSchema,
  type IepsMunicipalData,
} from "../../../shared/types/agents/ieps.types.js";
import iepsRawData from "../../../shared/data/ieps_latest.json" with { type: "json" };

// Extrai metadados de atualização (inseridos por scripts/update-ieps-data.ts)
const _iepsRawRecord = iepsRawData as Record<string, unknown>;
const _iepsMeta = _iepsRawRecord["__meta"] as { referenceYear?: number } | undefined;
const { __meta: _iepsMetaIgnored, ...iepsEntries } = _iepsRawRecord;

// Validação na carga do módulo — falha graceful para não crashar o Express
const _iepsParseResult = IepsDataFileSchema.safeParse(iepsEntries);
if (!_iepsParseResult.success) {
  logger.error(
    "ieps_latest.json validation failed — IEPS indicators will be unavailable for ODS 3",
    {
      errors: _iepsParseResult.error.errors.slice(0, 3),
    },
  );
}
const IEPS_DATA = _iepsParseResult.success ? _iepsParseResult.data : null;

const REFERENCE_YEAR = _iepsMeta?.referenceYear ?? 2021;
const REFERENCE_DATE = new Date(`${REFERENCE_YEAR}-12-31`);

/**
 * Coletor de dados de saúde municipal via IEPS Data.
 *
 * Fonte: IEPS Data (iepsdata.org.br) — dados padronizados de saúde
 * originários do DATASUS (SIM, SIH, SIAB, CNES, SIOPS).
 *
 * Vantagem sobre DATASUS direto: dados já limpos, padronizados e
 * disponíveis por município desde 2010.
 *
 * Dados carregados de JSON estático (shared/data/ieps_latest.json).
 * Para atualizar com dados reais: npx tsx scripts/update-ieps-data.ts
 *
 * Gotchas:
 * - Dados deflacionados (gastoSaudePerCapita) usam R$ 2019 como base
 * - Municípios <5k hab podem ter mortalidadeInfantil=null (amostra insuficiente)
 * - Cobertura temporal: 2010-2021 (defasagem ~2-3 anos)
 */
export class IepsCollector {
  async collect(ibgeCode: string): Promise<IepsMunicipalData | null> {
    if (!IEPS_DATA) return null;

    const entry = IEPS_DATA[ibgeCode];
    if (!entry) {
      logger.debug(`No IEPS data for ${ibgeCode}`);
      return null;
    }

    // Se todos os indicadores são null, não vale reportar
    const hasAnyData =
      entry.mortalidadeInfantil !== null ||
      entry.coberturaEsf !== null ||
      entry.coberturaVacinal !== null ||
      entry.internacoesCsap !== null ||
      entry.gastoSaudePerCapita !== null ||
      entry.prenatalAdequado !== null;

    if (!hasAnyData) {
      return null;
    }

    return {
      ibgeCode,
      siconfiCode: ibgeToSiconfi(ibgeCode),
      referenceYear: REFERENCE_YEAR,
      referenceDate: REFERENCE_DATE,
      dataAvailable: true,
      indicators: {
        mortalidadeInfantil: entry.mortalidadeInfantil,
        coberturaEsf: entry.coberturaEsf,
        coberturaVacinal: entry.coberturaVacinal,
        internacoesCsap: entry.internacoesCsap,
        gastoSaudePerCapita: entry.gastoSaudePerCapita,
        prenatalAdequado: entry.prenatalAdequado,
      },
    };
  }

  async collectBatch(ibgeCodes: string[]): Promise<Map<string, IepsMunicipalData>> {
    const results = new Map<string, IepsMunicipalData>();
    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) results.set(code, data);
    }
    logger.info(`IEPS batch: ${results.size}/${ibgeCodes.length} municípios com dados`);
    return results;
  }
}
