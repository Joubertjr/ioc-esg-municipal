import { z } from "zod";
import { fetchWithRetry } from "../../utils/http-client.js";
import { withCache, isCached } from "../../utils/cache.js";
import { logger } from "../../utils/logger.js";
import { API_CONFIGS, ibgeToSiconfi } from "../../../shared/constants/apis.js";
import {
  IbgeIndicatorResponseSchema,
  IbgePamResponseSchema,
  IBGE_INDICATORS,
  type IbgeMunicipalData,
  type IbgeIndicators,
  type IbgeIndicatorId,
} from "../../../shared/types/agents/ibge.types.js";
import {
  GiniDataFileSchema,
  type GiniDataFile,
} from "../../../shared/types/agents/gini.types.js";
import {
  Ibge2022DataFileSchema,
  type Ibge2022DataFile,
} from "../../../shared/types/agents/ibge_2022.types.js";
import giniRawData from "../../../shared/data/gini_2022.json";
import ibge2022RawData from "../../../shared/data/ibge_2022.json";

// Validação única na carga do módulo — falha rápida se o JSON estiver corrompido
const giniParseResult = GiniDataFileSchema.safeParse(giniRawData);
if (!giniParseResult.success) {
  throw new Error(
    `gini_2022.json validation failed: ${JSON.stringify(giniParseResult.error.errors)}`,
  );
}
const GINI_DATA: GiniDataFile = giniParseResult.data;

const ibge2022ParseResult = Ibge2022DataFileSchema.safeParse(ibge2022RawData);
if (!ibge2022ParseResult.success) {
  throw new Error(
    `ibge_2022.json validation failed: ${JSON.stringify(ibge2022ParseResult.error.errors)}`,
  );
}
const IBGE_2022_DATA: Ibge2022DataFile = ibge2022ParseResult.data;

const config = API_CONFIGS["ibge"];

/** Valida que ibgeCode tem exatamente 7 dígitos numéricos (defense in depth) */
const IBGE_CODE_RE = /^\d{7}$/;

/** IDs dos indicadores que queremos buscar, separados por pipe */
const INDICATOR_IDS = [
  IBGE_INDICATORS.POPULACAO_ESTIMADA,
  IBGE_INDICATORS.PIB_PER_CAPITA,
  IBGE_INDICATORS.PCT_BAIXA_RENDA,
  IBGE_INDICATORS.TAXA_OCUPACAO,
  IBGE_INDICATORS.RECEITAS_ORCAMENTARIAS,
  IBGE_INDICATORS.DESPESAS_ORCAMENTARIAS,
  IBGE_INDICATORS.RAZAO_DEPENDENCIA,
  IBGE_INDICATORS.AREA_TERRITORIAL,
].join("|");

export class IbgeCollector {
  private readonly baseUrl = "https://servicodados.ibge.gov.br/api/v1";
  private readonly baseUrlV3 = "https://servicodados.ibge.gov.br/api/v3";
  private readonly cacheTtl = config.cacheTtlSeconds;
  private readonly timeout = config.timeoutMs;

  /** Tabela PAM — Produção Agrícola Municipal (variável 215 = valor da produção em R$ mil) */
  private readonly PAM_TABELA = 5457;
  private readonly PAM_VARIAVEL = 215;
  /** Ano fixo de referência para PAM (último disponível consolidado) */
  private readonly PAM_PERIODO = "2022";

  /** Tabela CEMPRE — Empresas atuantes (variável 2283 = número de empresas) */
  private readonly CEMPRE_TABELA = 9418;
  private readonly CEMPRE_VARIAVEL = 2283;
  /** Ano fixo de referência para CEMPRE (último disponível consolidado) */
  private readonly CEMPRE_PERIODO = "2022";

  /**
   * Coleta indicadores IBGE para um município.
   * Faz três chamadas em paralelo:
   *   1. API v1 — pesquisas/indicadores (dados socioeconômicos)
   *   2. API v3 — agregados/5457 PAM (produção agrícola, ODS 2)
   *   3. API v3 — agregados/9418 CEMPRE (empresas atuantes, ODS 9)
   * Chamadas 2 e 3 falham silenciosamente — não bloqueiam dados principais.
   * Retorna null se o município não for encontrado (não lança erro).
   */
  async collect(ibgeCode: string): Promise<IbgeMunicipalData | null> {
    if (!IBGE_CODE_RE.test(ibgeCode)) {
      logger.warn(`IBGE: ibgeCode inválido: ${ibgeCode}`);
      return null;
    }

    const cacheKey = `ibge:indicators:${ibgeCode}`;

    try {
      return await withCache(cacheKey, this.cacheTtl, async () => {
        const indicadoresUrl = `${this.baseUrl}/pesquisas/indicadores/${INDICATOR_IDS}/resultados/${ibgeCode}`;
        const pamUrl =
          `${this.baseUrlV3}/agregados/${this.PAM_TABELA}/periodos/${this.PAM_PERIODO}` +
          `/variaveis/${this.PAM_VARIAVEL}?localidades=N6[${ibgeCode}]`;
        const cempreUrl =
          `${this.baseUrlV3}/agregados/${this.CEMPRE_TABELA}/periodos/${this.CEMPRE_PERIODO}` +
          `/variaveis/${this.CEMPRE_VARIAVEL}?localidades=N6[${ibgeCode}]`;

        // Chamadas em paralelo — PAM e CEMPRE falham silenciosamente
        const [rawData, rawPam, rawCempre] = await Promise.all([
          fetchWithRetry<unknown[]>(indicadoresUrl, {
            timeoutMs: this.timeout,
            maxRetries: config.retryCount,
          }),
          fetchWithRetry<unknown[]>(pamUrl, {
            timeoutMs: this.timeout,
            maxRetries: config.retryCount,
          }).catch((err: unknown) => {
            logger.warn(
              `PAM fetch failed for ${ibgeCode}, continuing without producaoAgricola`,
              { error: err instanceof Error ? err.message : String(err) },
            );
            return null;
          }),
          fetchWithRetry<unknown[]>(cempreUrl, {
            timeoutMs: this.timeout,
            maxRetries: config.retryCount,
          }).catch((err: unknown) => {
            logger.warn(
              `CEMPRE fetch failed for ${ibgeCode}, continuing without empresasAtuantes`,
              { error: err instanceof Error ? err.message : String(err) },
            );
            return null;
          }),
        ]);

        // Validar indicadores principais com Zod
        const validated = z.array(IbgeIndicatorResponseSchema).parse(rawData);

        const siconfiCode = ibgeToSiconfi(ibgeCode);
        const indicators = this.parseIndicators(validated, siconfiCode);

        if (!indicators) {
          logger.warn(`No IBGE data found for municipality ${ibgeCode}`);
          return null;
        }

        // Enriquecer com dados opcionais da API v3
        indicators.producaoAgricolaMilReais = this.parseAgregadosValue(
          rawPam,
          ibgeCode,
          this.PAM_PERIODO,
          "PAM",
        );
        indicators.empresasAtuantes = this.parseAgregadosValue(
          rawCempre,
          ibgeCode,
          this.CEMPRE_PERIODO,
          "CEMPRE",
        );

        // Enriquecer com Coeficiente de Gini e Razão 20/20 do Censo 2022 (JSON estático)
        const giniEntry = GINI_DATA[ibgeCode];
        if (giniEntry) {
          indicators.coeficienteGini = giniEntry.coeficienteGini;
          indicators.razao2020 = giniEntry.razao2020;
        } else {
          logger.debug(`Gini: sem dados para município ${ibgeCode}`);
        }

        // Enriquecer com % domicílios urbanos com infraestrutura adequada (ODS 11)
        const ibge2022Entry = IBGE_2022_DATA[ibgeCode];
        if (ibge2022Entry) {
          indicators.urbanizacaoAdequada = ibge2022Entry.urbanizacaoAdequada;
        } else {
          logger.debug(`IBGE 2022: sem dados de urbanizacaoAdequada para município ${ibgeCode}`);
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
   * Rate limit: máx 2 req/s (throttle 500ms entre cada request).
   * Throttle aplicado incondicionalmente — cache hit resolve instantaneamente
   * dentro do `collect()` via `withCache`, então o throttle não adiciona latência
   * significativa em cache hits, mas garante proteção contra flood se Redis estiver down.
   */
  async collectBatch(
    ibgeCodes: string[],
  ): Promise<Map<string, IbgeMunicipalData>> {
    const results = new Map<string, IbgeMunicipalData>();

    for (const code of ibgeCodes) {
      const cacheKey = `ibge:indicators:${code}`;
      const cached = await isCached(cacheKey);

      const data = await this.collect(code);
      if (data) {
        results.set(code, data);
      }

      // Throttle apenas em cache miss — evita flood nas APIs governamentais
      // mas não adiciona latência quando o Redis já tem os dados.
      if (!cached) {
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
    const razaoDependencia = this.getLatestValue(
      data,
      IBGE_INDICATORS.RAZAO_DEPENDENCIA,
      loc,
    );
    const areaterritorial = this.getLatestValue(
      data,
      IBGE_INDICATORS.AREA_TERRITORIAL,
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
      razaoDependencia,
      areaterritorial,
      // Campos da API v3 — preenchidos após esta função no collect()
      producaoAgricolaMilReais: null,
      empresasAtuantes: null,
      // Preenchido a partir do JSON estático após esta função no collect()
      coeficienteGini: null,
      razao2020: null,
      urbanizacaoAdequada: null,
    };
  }

  /**
   * Extrai valor numérico de uma resposta da API v3 de Agregados (PAM, CEMPRE etc.).
   * Formato esperado: array de variáveis, cada uma com resultados contendo localidade + serie.
   * Retorna null em caso de dado ausente, valor "-", ou parse inválido.
   *
   * @param rawData  resposta bruta da API (null = chamada falhou)
   * @param ibgeCode código IBGE de 7 dígitos do município
   * @param periodo  string do ano/período solicitado (ex: "2022")
   * @param label    nome da fonte para logging
   */
  private parseAgregadosValue(
    rawData: unknown[] | null,
    ibgeCode: string,
    periodo: string,
    label: string,
  ): number | null {
    if (!rawData) return null;

    try {
      const validated = IbgePamResponseSchema.parse(rawData);
      const variavel = validated[0];
      if (!variavel) return null;

      // API v3 retorna localidade com código de 7 dígitos (ibgeCode completo)
      const resultado = variavel.resultados.find(
        (r) => r.localidade.id === ibgeCode,
      );
      if (!resultado) return null;

      const valor = resultado.serie[periodo];
      if (!valor || valor === "-" || valor.trim() === "") return null;

      const parsed = Number(valor);
      return Number.isNaN(parsed) ? null : parsed;
    } catch (err) {
      logger.warn(`Failed to parse ${label} response for ${ibgeCode}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
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
