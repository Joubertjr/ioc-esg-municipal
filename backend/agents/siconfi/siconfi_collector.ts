import { z } from "zod";
import { fetchWithRetry } from "../../utils/http-client.js";
import { withCache } from "../../utils/cache.js";
import { logger } from "../../utils/logger.js";
import { API_CONFIGS, ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  SiconfiRreoResponseSchema,
  type SiconfiRreoItem,
  type SiconfiMunicipalData,
  type SiconfiIndicators,
} from "../../../shared/types/agents/siconfi.types.js";

const config = API_CONFIGS["siconfi"];

/**
 * Coletor de dados financeiros municipais via API SICONFI (Tesouro Nacional).
 *
 * Busca o RREO (Relatório Resumido de Execução Orçamentária) último bimestre
 * do exercício, extraindo: FPM, receitas, despesas por função.
 *
 * Gotchas:
 * - Usa código IBGE 7 dígitos (a API aceita ambos 6 e 7)
 * - Período 6 = último bimestre = dados acumulados do ano
 * - Coluna "TOTAL (ÚLTIMOS 12 MESES)" para FPM anual
 * - Exercício corrente pode estar incompleto até março seguinte
 */
export class SiconfiCollector {
  private readonly baseUrl = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
  private readonly cacheTtl = config.cacheTtlSeconds;
  private readonly timeout = config.timeoutMs;

  async collect(ibgeCode: string): Promise<SiconfiMunicipalData | null> {
    const cacheKey = `siconfi:rreo:${ibgeCode}`;

    try {
      return await withCache(cacheKey, this.cacheTtl, async () => {
        const year = this.getMostRecentFiscalYear();
        const items = await this.fetchRreo(ibgeCode, year);

        if (!items || items.length === 0) {
          // Try previous year if current is empty
          const prevItems = await this.fetchRreo(ibgeCode, year - 1);
          if (!prevItems || prevItems.length === 0) {
            logger.warn(`No SICONFI RREO data for ${ibgeCode} (${year} or ${year - 1})`);
            return null;
          }
          return this.parseRreo(prevItems, ibgeCode, year - 1);
        }

        return this.parseRreo(items, ibgeCode, year);
      });
    } catch (error) {
      logger.error(`Failed to collect SICONFI data for ${ibgeCode}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Coleta dados em batch para múltiplos municípios.
   * Rate limit: máx 2 req/s (throttle 500ms entre cada request).
   * Throttle incondicional — cache hit resolve rápido via withCache,
   * mas throttle garante proteção contra flood se Redis estiver down.
   */
  async collectBatch(
    ibgeCodes: string[],
  ): Promise<Map<string, SiconfiMunicipalData>> {
    const results = new Map<string, SiconfiMunicipalData>();

    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) {
        results.set(code, data);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    logger.info(
      `SICONFI batch collected: ${results.size}/${ibgeCodes.length} municipalities`,
    );
    return results;
  }

  /**
   * O exercício fiscal mais recente com dados completos.
   * RREO do ano corrente só fica disponível completo após março do ano seguinte.
   */
  private getMostRecentFiscalYear(): number {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    // Antes de abril, dados do ano anterior podem estar incompletos
    return month < 4 ? year - 2 : year - 1;
  }

  private async fetchRreo(
    ibgeCode: string,
    year: number,
  ): Promise<SiconfiRreoItem[] | null> {
    const url = `${this.baseUrl}/rreo?an_exercicio=${year}&nr_periodo=6&co_tipo_demonstrativo=RREO&id_ente=${ibgeCode}`;

    try {
      const rawData = await fetchWithRetry<unknown>(url, {
        timeoutMs: this.timeout,
        maxRetries: config.retryCount,
      });

      const validated = SiconfiRreoResponseSchema.parse(rawData);
      return validated.items;
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`SICONFI Zod validation failed for ${ibgeCode}/${year}`, {
          errors: error.errors.slice(0, 3),
        });
      }
      return null;
    }
  }

  private parseRreo(
    items: SiconfiRreoItem[],
    ibgeCode: string,
    year: number,
  ): SiconfiMunicipalData | null {
    const siconfiCode = ibgeToSiconfi(ibgeCode);
    const populacao = items[0]?.populacao ?? null;

    const indicators: SiconfiIndicators = {
      fpmAnual: this.extractFpm(items),
      receitaTotal: this.extractValue(items, "RREO-Anexo 01", "RECEITAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)", "Até o Bimestre (c)"),
      despesaTotal: this.extractValue(items, "RREO-Anexo 02", "DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)", "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)"),
      despesaSaude: this.extractValue(items, "RREO-Anexo 02", "Saúde", "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)"),
      despesaEducacao: this.extractValue(items, "RREO-Anexo 02", "Educação", "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)"),
      despesaUrbanismo: this.extractValue(items, "RREO-Anexo 02", "Urbanismo", "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)"),
      despesaAssistencia: this.extractValue(items, "RREO-Anexo 02", "Assistência Social", "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)"),
      transferenciasUniao: this.extractValue(items, "RREO-Anexo 01", "Transferências da União e de suas Entidades", "Até o Bimestre (c)"),
      fundeb: this.extractFundeb(items),
      populacao,
    };

    // Se nenhum dado principal disponível, retorna null
    if (indicators.receitaTotal === null && indicators.despesaTotal === null && indicators.fpmAnual === null) {
      return null;
    }

    return {
      ibgeCode,
      siconfiCode,
      referenceYear: year,
      referenceDate: new Date(`${year}-12-31`),
      dataAvailable: true,
      indicators,
    };
  }

  /**
   * Extrai FPM anual do RREO Anexo 03.
   * Usa "TOTAL (ÚLTIMOS 12 MESES)" se disponível, senão soma os MR-1..MR-12.
   */
  private extractFpm(items: SiconfiRreoItem[]): number | null {
    const fpmItems = items.filter(
      (i) => i.conta === "Cota-Parte do FPM" && i.anexo === "RREO-Anexo 03",
    );

    // Tentar pegar o total anual
    const total = fpmItems.find((i) => i.coluna === "TOTAL (ÚLTIMOS 12 MESES)");
    if (total?.valor !== null && total?.valor !== undefined) {
      return total.valor;
    }

    // Fallback: somar valores mensais (MR-1 a MR-12 + MR)
    let sum = 0;
    let hasAny = false;
    for (const item of fpmItems) {
      if (item.coluna.startsWith("<MR") && item.valor !== null) {
        sum += item.valor;
        hasAny = true;
      }
    }

    return hasAny ? sum : null;
  }

  /**
   * Extrai FUNDEB anual do RREO Anexo 03.
   */
  private extractFundeb(items: SiconfiRreoItem[]): number | null {
    const fundebItems = items.filter(
      (i) => i.conta === "Transferências do FUNDEB" && i.anexo === "RREO-Anexo 03",
    );

    const total = fundebItems.find((i) => i.coluna === "TOTAL (ÚLTIMOS 12 MESES)");
    if (total?.valor !== null && total?.valor !== undefined) {
      return total.valor;
    }

    let sum = 0;
    let hasAny = false;
    for (const item of fundebItems) {
      if (item.coluna.startsWith("<MR") && item.valor !== null) {
        sum += item.valor;
        hasAny = true;
      }
    }

    return hasAny ? sum : null;
  }

  /**
   * Extrai um valor específico filtrado por anexo, conta e coluna.
   */
  private extractValue(
    items: SiconfiRreoItem[],
    anexo: string,
    conta: string,
    coluna: string,
  ): number | null {
    const item = items.find(
      (i) => i.anexo === anexo && i.conta === conta && i.coluna === coluna,
    );
    return item?.valor ?? null;
  }
}
