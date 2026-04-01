import { fetchWithRetry } from "../../utils/http-client.js";
import { withCache } from "../../utils/cache.js";
import { logger } from "../../utils/logger.js";
import { API_CONFIGS, ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  PrevineBrasilResponseSchema,
  type DatasusMunicipalData,
  type DatasusIndicators,
  type PrevineBrasilItem,
} from "../../../shared/types/agents/datasus.types.js";

const config = API_CONFIGS["datasus"];

/**
 * Coletor de dados de saúde via API DEMAS (Dados Abertos do Ministério da Saúde).
 *
 * Fonte principal: Previne Brasil — indicadores de desempenho da atenção primária.
 * Endpoint: /atencao-primaria/indicador-desempenho-programa-previne-brasil
 *
 * Gotchas:
 * - API usa código IBGE 6 dígitos (siconfiCode), não 7
 * - Quadrimestral: Q1 (jan-abr), Q2 (mai-ago), Q3 (set-dez)
 * - Municípios muito pequenos podem não ter dados
 * - SIM/SINASC (mortalidade/nascidos) não tem filtro municipal — não usar
 */
export class DatasusCollector {
  private readonly baseUrl = config.baseUrl;
  private readonly cacheTtl = config.cacheTtlSeconds;
  private readonly timeout = config.timeoutMs;

  async collect(ibgeCode: string): Promise<DatasusMunicipalData | null> {
    const siconfiCode = ibgeToSiconfi(ibgeCode);
    const cacheKey = `datasus:previne:${ibgeCode}`;

    try {
      return await withCache(cacheKey, this.cacheTtl, async () => {
        const { year, quadrimestre } = this.getMostRecentQuadrimestre();
        let items = await this.fetchPrevineBrasil(siconfiCode, year, quadrimestre);

        // Fallback: tentar quadrimestre anterior
        if (!items || items.length === 0) {
          const prev = this.getPreviousQuadrimestre(year, quadrimestre);
          items = await this.fetchPrevineBrasil(siconfiCode, prev.year, prev.quadrimestre);
        }

        // Fallback: tentar ano anterior Q3
        if (!items || items.length === 0) {
          items = await this.fetchPrevineBrasil(siconfiCode, year - 1, 3);
        }

        if (!items || items.length === 0) {
          logger.warn(`No Previne Brasil data for ${ibgeCode}`);
          return null;
        }

        const indicators = this.parseIndicators(items);
        const referenceDate = this.quadrimestreToDate(year, quadrimestre);

        return {
          ibgeCode,
          siconfiCode,
          referenceYear: year,
          referenceDate,
          dataAvailable: true,
          indicators,
        };
      });
    } catch (error) {
      logger.error("DATASUS collection failed", {
        ibgeCode,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async collectBatch(ibgeCodes: string[]): Promise<(DatasusMunicipalData | null)[]> {
    return Promise.all(ibgeCodes.map((code) => this.collect(code)));
  }

  private async fetchPrevineBrasil(
    siconfiCode: string,
    year: number,
    quadrimestre: number,
  ): Promise<PrevineBrasilItem[] | null> {
    const quad = `${year}Q${quadrimestre}`;
    const url =
      `${this.baseUrl}/atencao-primaria/indicador-desempenho-programa-previne-brasil` +
      `?uf=SC&codigo_municipio=${siconfiCode}&quadrimestre=${quad}`;

    logger.info(`Fetching Previne Brasil: ${siconfiCode} ${quad}`);

    try {
      const data = await fetchWithRetry<unknown>(url, {
        timeoutMs: this.timeout,
        maxRetries: config.retryCount,
      });

      const parsed = PrevineBrasilResponseSchema.safeParse(data);

      if (!parsed.success) {
        logger.warn("Previne Brasil Zod validation failed", {
          siconfiCode,
          quad,
          error: parsed.error.message,
        });
        return null;
      }

      const items = parsed.data.sisab_indicador_desempenho;
      return items.length > 0 ? items : null;
    } catch (error) {
      logger.warn(`Previne Brasil fetch failed for ${siconfiCode} ${quad}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private parseIndicators(items: PrevineBrasilItem[]): DatasusIndicators {
    const byType = new Map<number, number[]>();
    for (const item of items) {
      if (item.percentual !== null) {
        const existing = byType.get(item.codigo_tipo_indicador) ?? [];
        existing.push(item.percentual);
        byType.set(item.codigo_tipo_indicador, existing);
      }
    }

    const getAvg = (tipo: number): number | null => {
      const values = byType.get(tipo);
      if (!values || values.length === 0) return null;
      return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
    };

    const prenatal = getAvg(10);
    const diabetes = getAvg(20);
    const hipertensao = getAvg(30);
    const crescimentoInfantil = getAvg(40);
    const cancerColoUterino = getAvg(50);
    const saudeBucal = getAvg(70);

    const allValues = [prenatal, diabetes, hipertensao, crescimentoInfantil, cancerColoUterino, saudeBucal]
      .filter((v): v is number => v !== null);
    const mediaGeral = allValues.length > 0
      ? Math.round((allValues.reduce((a, b) => a + b, 0) / allValues.length) * 100) / 100
      : null;

    return {
      prenatal,
      diabetes,
      hipertensao,
      crescimentoInfantil,
      cancerColoUterino,
      saudeBucal,
      mediaGeral,
    };
  }

  private getMostRecentQuadrimestre(): { year: number; quadrimestre: number } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Dados do quadrimestre atual provavelmente não estão disponíveis ainda.
    // Usar o quadrimestre anterior com margem de ~2 meses.
    if (month <= 6) {
      // Jan-Jun: usar Q3 do ano anterior (set-dez)
      return { year: year - 1, quadrimestre: 3 };
    }
    if (month <= 10) {
      // Jul-Out: usar Q1 do ano corrente (jan-abr)
      return { year, quadrimestre: 1 };
    }
    // Nov-Dez: usar Q2 do ano corrente (mai-ago)
    return { year, quadrimestre: 2 };
  }

  private getPreviousQuadrimestre(year: number, q: number): { year: number; quadrimestre: number } {
    if (q === 1) return { year: year - 1, quadrimestre: 3 };
    return { year, quadrimestre: q - 1 };
  }

  private quadrimestreToDate(year: number, q: number): Date {
    // Último dia do quadrimestre
    const endMonths = { 1: 4, 2: 8, 3: 12 } as const;
    const month = endMonths[q as keyof typeof endMonths] ?? 12;
    return new Date(year, month, 0); // dia 0 do mês seguinte = último dia do mês
  }
}
