import { z } from "zod";
import { fetchWithRetry } from "../../utils/http-client.js";
import { withCache, getRedisClient } from "../../utils/cache.js";
import { logger } from "../../utils/logger.js";
import { API_CONFIGS, ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  IbgeIndicatorResponseSchema,
  IBGE_INDICATORS,
  type IbgeMunicipalData,
  type IbgeIndicators,
  type IbgeIndicatorId,
} from "../../../shared/types/agents/ibge.types.js";

const config = API_CONFIGS["ibge"];

/** IDs dos indicadores que queremos buscar, separados por pipe */
const INDICATOR_IDS = [
  IBGE_INDICATORS.POPULACAO_ESTIMADA,
  IBGE_INDICATORS.PIB_PER_CAPITA,
  IBGE_INDICATORS.PCT_BAIXA_RENDA,
  IBGE_INDICATORS.TAXA_OCUPACAO,
  IBGE_INDICATORS.RECEITAS_ORCAMENTARIAS,
  IBGE_INDICATORS.DESPESAS_ORCAMENTARIAS,
].join("|");

export class IbgeCollector {
  private readonly baseUrl = "https://servicodados.ibge.gov.br/api/v1";
  private readonly cacheTtl = config.cacheTtlSeconds;
  private readonly timeout = config.timeoutMs;

  /**
   * Coleta indicadores IBGE para um município.
   * Retorna null se o município não for encontrado (não lança erro).
   */
  async collect(ibgeCode: string): Promise<IbgeMunicipalData | null> {
    const cacheKey = `ibge:indicators:${ibgeCode}`;

    try {
      return await withCache(cacheKey, this.cacheTtl, async () => {
        const url = `${this.baseUrl}/pesquisas/indicadores/${INDICATOR_IDS}/resultados/${ibgeCode}`;

        const rawData = await fetchWithRetry<unknown[]>(url, {
          timeoutMs: this.timeout,
          maxRetries: config.retryCount,
        });

        // Validar com Zod
        const validated = z.array(IbgeIndicatorResponseSchema).parse(rawData);

        const siconfiCode = ibgeToSiconfi(ibgeCode);
        const indicators = this.parseIndicators(validated, siconfiCode);

        if (!indicators) {
          logger.warn(`No IBGE data found for municipality ${ibgeCode}`);
          return null;
        }

        const referenceYear = this.getMostRecentYear(validated, siconfiCode);

        return {
          ibgeCode,
          siconfiCode,
          referenceYear,
          referenceDate: new Date(`${referenceYear}-12-31`),
          dataAvailable: true,
          indicators,
        };
      });
    } catch (error) {
      logger.error(`Failed to collect IBGE data for ${ibgeCode}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Coleta dados em batch para múltiplos municípios.
   * Rate limit: máx 2 req/s (throttle 500ms entre requests).
   * Otimização: throttle ignorado quando dado já está no Redis (cache hit),
   * pois não há chamada HTTP real — reduz batch de 295 municípios de ~2.5min para ~10s.
   */
  async collectBatch(
    ibgeCodes: string[],
  ): Promise<Map<string, IbgeMunicipalData>> {
    const results = new Map<string, IbgeMunicipalData>();

    for (const code of ibgeCodes) {
      // Verificar cache antes de coletar para decidir se throttle é necessário
      const cacheKey = `ibge:indicators:${code}`;
      const cached = await getRedisClient()
        .then((r) => r.get(cacheKey))
        .catch(() => null);

      const data = await this.collect(code);
      if (data) {
        results.set(code, data);
      }

      // Throttle apenas em cache miss (requisição HTTP real foi feita)
      if (cached === null) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    logger.info(
      `IBGE batch collected: ${results.size}/${ibgeCodes.length} municipalities`,
    );
    return results;
  }

  /**
   * Extrai o valor mais recente de um indicador para uma localidade.
   */
  private getLatestValue(
    data: z.infer<typeof IbgeIndicatorResponseSchema>[],
    indicatorId: IbgeIndicatorId,
    localidade: string,
  ): number | null {
    const indicator = data.find((d) => d.id === indicatorId);
    if (!indicator) return null;

    const result = indicator.res.find((r) => r.localidade === localidade);
    if (!result) return null;

    // Pegar o ano mais recente com valor não-null
    const years = Object.keys(result.res)
      .filter((y) => result.res[y] !== null)
      .sort((a, b) => Number(b) - Number(a));

    if (years.length === 0) return null;

    const value = result.res[years[0]!];
    if (value === null || value === undefined) return null;

    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private parseIndicators(
    data: z.infer<typeof IbgeIndicatorResponseSchema>[],
    siconfiCode: string,
  ): IbgeIndicators | null {
    // IBGE usa código de 6 dígitos (sem verificador) na API de pesquisas
    const loc = siconfiCode;

    const populacao = this.getLatestValue(
      data,
      IBGE_INDICATORS.POPULACAO_ESTIMADA,
      loc,
    );
    const pibPerCapita = this.getLatestValue(
      data,
      IBGE_INDICATORS.PIB_PER_CAPITA,
      loc,
    );
    const pctBaixaRenda = this.getLatestValue(
      data,
      IBGE_INDICATORS.PCT_BAIXA_RENDA,
      loc,
    );
    const taxaOcupacao = this.getLatestValue(
      data,
      IBGE_INDICATORS.TAXA_OCUPACAO,
      loc,
    );
    const receitasOrcamentarias = this.getLatestValue(
      data,
      IBGE_INDICATORS.RECEITAS_ORCAMENTARIAS,
      loc,
    );
    const despesasOrcamentarias = this.getLatestValue(
      data,
      IBGE_INDICATORS.DESPESAS_ORCAMENTARIAS,
      loc,
    );

    // Se nenhum dado disponível, retorna null
    if (
      populacao === null &&
      pibPerCapita === null &&
      pctBaixaRenda === null
    ) {
      return null;
    }

    return {
      populacao,
      pibPerCapita,
      pctBaixaRenda,
      taxaOcupacao,
      receitasOrcamentarias,
      despesasOrcamentarias,
    };
  }

  /**
   * Descobre o ano de referência mais recente disponível.
   */
  private getMostRecentYear(
    data: z.infer<typeof IbgeIndicatorResponseSchema>[],
    siconfiCode: string,
  ): number {
    let maxYear = new Date().getFullYear() - 1;

    for (const indicator of data) {
      const result = indicator.res.find((r) => r.localidade === siconfiCode);
      if (!result) continue;

      const years = Object.keys(result.res)
        .filter((y) => result.res[y] !== null)
        .map(Number)
        .filter((y) => !Number.isNaN(y));

      if (years.length > 0) {
        maxYear = Math.max(maxYear, ...years);
      }
    }

    return maxYear;
  }
}
