import { fetchWithRetry } from "../../utils/http-client.js";
import { withCache } from "../../utils/cache.js";
import { logger } from "../../utils/logger.js";
import { API_CONFIGS } from "../../../shared/constants/apis.js";
import {
  PncpContratacaoListaSchema,
  type PncpMunicipalData,
  type PncpIndicators,
  type PncpContratacao,
} from "../../../shared/types/agents/pncp.types.js";

const config = API_CONFIGS["pncp"];

/**
 * Tamanho máximo de página suportado pelo PNCP /api/consulta/v1.
 * Gotcha: o endpoint aceita no máximo 50 por página — acima disso retorna 400.
 */
const PAGE_SIZE = 50;

/**
 * Código da modalidade de contratação para Dispensa (contratação direta).
 * Fonte: tabela de domínio do PNCP (v1, 2024).
 */
const MODALIDADE_DISPENSA = 7;

export class PncpCollector {
  private readonly baseUrl = config.baseUrl;
  private readonly cacheTtl = config.cacheTtlSeconds;
  private readonly timeout = config.timeoutMs;
  private readonly maxRetries = config.retryCount;

  /**
   * Coleta indicadores de contratações PNCP para um município.
   * Usa o código IBGE de 7 dígitos como filtro direto — não precisa de CNPJ.
   *
   * Período de referência: ano corrente (1/jan a hoje) ou ano anterior completo
   * se ainda estivermos no primeiro trimestre (dados do ano corrente incompletos).
   *
   * Retorna null se o município não tiver publicações no período.
   */
  async collect(ibgeCode: string): Promise<PncpMunicipalData | null> {
    const cacheKey = `pncp:contratacoes:${ibgeCode}`;

    try {
      return await withCache(cacheKey, this.cacheTtl, async () => {
        const anoReferencia = this.resolveReferenceYear();
        const { dataInicial, dataFinal } = this.buildDateRange(anoReferencia);

        const contratacoes = await this.fetchAllContratacoes(
          ibgeCode,
          dataInicial,
          dataFinal,
        );

        if (contratacoes.length === 0) {
          logger.info(`PNCP: nenhuma contratação encontrada para ${ibgeCode} em ${anoReferencia}`);
          return null;
        }

        const indicators = this.buildIndicators(contratacoes, anoReferencia);

        return {
          ibgeCode,
          referenceYear: anoReferencia,
          referenceDate: new Date(`${anoReferencia}-12-31`),
          dataAvailable: true,
          indicators,
        };
      });
    } catch (error) {
      logger.error(`PNCP: falha ao coletar dados para ${ibgeCode}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Coleta dados em batch para múltiplos municípios.
   * Rate limit: 1 req/s — throttle 1000ms entre requisições.
   */
  async collectBatch(ibgeCodes: string[]): Promise<Map<string, PncpMunicipalData>> {
    const results = new Map<string, PncpMunicipalData>();

    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) {
        results.set(code, data);
      }
      // Throttle de 1s entre municípios (rateLimit: 1 req/s no config)
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

    logger.info(`PNCP batch coletado: ${results.size}/${ibgeCodes.length} municípios`);
    return results;
  }

  // ─── Busca com paginação ──────────────────────────────────────────────────

  /**
   * Percorre todas as páginas de contratações de um município.
   *
   * Gotcha: o PNCP limita a 500 registros totais por query (10 páginas × 50).
   * Para municípios grandes com muitas publicações, retornamos apenas os 500
   * primeiros — suficiente para calcular os indicadores com representatividade.
   */
  private async fetchAllContratacoes(
    ibgeCode: string,
    dataInicial: string,
    dataFinal: string,
  ): Promise<PncpContratacao[]> {
    const MAX_PAGES = 10; // Limite de 500 registros por segurança

    const firstPage = await this.fetchPaginaDeContratacoes(
      ibgeCode,
      dataInicial,
      dataFinal,
      1,
    );

    if (!firstPage) return [];

    const { totalPaginas, data: firstData } = firstPage;
    const pagesToFetch = Math.min(totalPaginas ?? 1, MAX_PAGES);

    if (pagesToFetch <= 1) return firstData;

    const allContratacoes: PncpContratacao[] = [...firstData];

    for (let pagina = 2; pagina <= pagesToFetch; pagina++) {
      const pageData = await this.fetchPaginaDeContratacoes(
        ibgeCode,
        dataInicial,
        dataFinal,
        pagina,
      );
      if (pageData) {
        allContratacoes.push(...pageData.data);
      }
      // Throttle 1s por página
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

    logger.debug(`PNCP: ${allContratacoes.length} contratações coletadas para ${ibgeCode}`);
    return allContratacoes;
  }

  private async fetchPaginaDeContratacoes(
    ibgeCode: string,
    dataInicial: string,
    dataFinal: string,
    pagina: number,
  ): Promise<{ data: PncpContratacao[]; totalPaginas: number } | null> {
    const params = new URLSearchParams({
      dataInicial,
      dataFinal,
      codigoMunicipioIbge: ibgeCode,
      pagina: String(pagina),
      tamanhoPagina: String(PAGE_SIZE),
    });

    const url = `${this.baseUrl}/contratacoes/publicacao?${params.toString()}`;
    logger.debug(`PNCP: buscando página ${pagina}`, { ibgeCode, url });

    const raw = await fetchWithRetry<unknown>(url, {
      timeoutMs: this.timeout,
      maxRetries: this.maxRetries,
    });

    const parsed = PncpContratacaoListaSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(`PNCP: schema inválido na resposta`, {
        ibgeCode,
        pagina,
        errors: parsed.error.flatten(),
      });
      return null;
    }

    return {
      data: parsed.data.data,
      totalPaginas: parsed.data.totalPaginas ?? 1,
    };
  }

  // ─── Construção dos indicadores ───────────────────────────────────────────

  private buildIndicators(
    contratacoes: PncpContratacao[],
    anoReferencia: number,
  ): PncpIndicators {
    const totalContratacoes = contratacoes.length;
    let totalDispensas = 0;
    let totalSrp = 0;
    let somaEstimado = 0;
    let somaHomologado = 0;
    let contComValor = 0;

    for (const c of contratacoes) {
      if (c.codigoModalidadeContratacao === MODALIDADE_DISPENSA) {
        totalDispensas++;
      }
      if (c.srp === true) {
        totalSrp++;
      }
      const estimado = c.valorTotalEstimado ?? null;
      const homologado = c.valorTotalHomologado ?? null;
      if (estimado !== null && estimado > 0) {
        somaEstimado += estimado;
        somaHomologado += homologado ?? 0;
        contComValor++;
      }
    }

    const percentualDispensas =
      totalContratacoes > 0
        ? Math.round((totalDispensas / totalContratacoes) * 10_000) / 100
        : null;

    const percentualSrp =
      totalContratacoes > 0
        ? Math.round((totalSrp / totalContratacoes) * 10_000) / 100
        : null;

    // Taxa de homologação: razão entre o que foi efetivamente homologado e o estimado.
    // Valores > 1.0 indicam aditivos de acréscimo — não consideramos > 1.0 como erro.
    const taxaHomologacao =
      contComValor > 0 && somaEstimado > 0
        ? Math.round((somaHomologado / somaEstimado) * 10_000) / 10_000
        : null;

    return {
      totalContratacoes,
      percentualDispensas,
      taxaHomologacao,
      percentualSrp,
      anoReferencia,
    };
  }

  // ─── Utilitários de data ──────────────────────────────────────────────────

  /**
   * Determina o ano de referência para a coleta.
   * Se estivermos antes de 1/abril, usa o ano anterior (dados do corrente incompletos).
   * Caso contrário, usa o ano corrente.
   */
  private resolveReferenceYear(): number {
    const now = new Date();
    const isBeforeApril = now.getMonth() < 3; // 0-indexed: jan=0, apr=3
    return isBeforeApril ? now.getFullYear() - 1 : now.getFullYear();
  }

  /**
   * Constrói as datas no formato YYYYMMDD exigido pelo PNCP.
   */
  private buildDateRange(year: number): { dataInicial: string; dataFinal: string } {
    const now = new Date();
    const isCurrentYear = year === now.getFullYear();
    const dataFinal = isCurrentYear
      ? this.formatDate(now)
      : `${year}1231`;

    return {
      dataInicial: `${year}0101`,
      dataFinal,
    };
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }
}
