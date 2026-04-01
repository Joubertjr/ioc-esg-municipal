import { fetchWithRetry } from "../../utils/http-client.js";
import { withCache } from "../../utils/cache.js";
import { logger } from "../../utils/logger.js";
import { API_CONFIGS } from "../../../shared/constants/apis.js";
import {
  InpeMunicipalityCollectionSchema,
  InpeDeforestationCollectionSchema,
  type BBox,
  type InpeMunicipalData,
  type InpeIndicators,
} from "../../../shared/types/agents/inpe.types.js";

const config = API_CONFIGS["inpe"];

/** SRS usado pelo PRODES Mata Atlântica */
const EPSG = "EPSG:4674";

/** Workspace e layers do GeoServer */
const WORKSPACE = config.workspace ?? "prodes-mata-atlantica-nb";
const BASE_OWS = `${config.baseUrl}/${WORKSPACE}/ows`;

/** Valida que ibgeCode tem exatamente 7 dígitos numéricos (defense in depth) */
const IBGE_CODE_RE = /^\d{7}$/;

export class InpeCollector {
  private readonly cacheTtl = config.cacheTtlSeconds;
  private readonly timeout = config.timeoutMs;
  private readonly maxRetries = config.retryCount;

  /**
   * Coleta indicadores INPE/PRODES de desmatamento para um município.
   * Workflow de 2 passos: bbox por geocódigo → desmatamento por bbox.
   * Retorna null se o município não for encontrado (não lança erro).
   */
  async collect(ibgeCode: string): Promise<InpeMunicipalData | null> {
    if (!IBGE_CODE_RE.test(ibgeCode)) {
      logger.warn(`INPE: ibgeCode inválido: ${ibgeCode}`);
      return null;
    }

    const cacheKey = `inpe:deforestation:${ibgeCode}`;

    try {
      return await withCache(cacheKey, this.cacheTtl, async () => {
        // Passo 1: obter bbox do município via geocódigo IBGE
        const bbox = await this.fetchMunicipalityBbox(ibgeCode);
        if (!bbox) {
          logger.warn(`INPE: município ${ibgeCode} não encontrado na camada municipalities_mata_atlantica_biome`);
          return null;
        }

        // Passo 2: buscar série histórica de desmatamento por bbox
        const serieHistorica = await this.fetchYearlyDeforestation(bbox);

        const indicators = this.buildIndicators(serieHistorica);
        const referenceYear = indicators.anoReferencia ?? new Date().getFullYear() - 1;

        return {
          ibgeCode,
          referenceYear,
          referenceDate: new Date(`${referenceYear}-12-31`),
          dataAvailable: Object.keys(serieHistorica).length > 0,
          indicators,
        };
      });
    } catch (error) {
      logger.error(`INPE: falha ao coletar dados para ${ibgeCode}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Coleta dados em batch para múltiplos municípios.
   * Rate limit: máx 10 req/s — throttle 100ms entre pares de requests.
   */
  async collectBatch(ibgeCodes: string[]): Promise<Map<string, InpeMunicipalData>> {
    const results = new Map<string, InpeMunicipalData>();

    for (const code of ibgeCodes) {
      const data = await this.collect(code);
      if (data) {
        results.set(code, data);
      }
      // Throttle: 100ms entre requests (10 req/s)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.info(`INPE batch collected: ${results.size}/${ibgeCodes.length} municipalities`);
    return results;
  }

  // ─── Passo 1: BBox do município ────────────────────────────────────────────

  /**
   * Busca o bounding box do município pelo geocódigo IBGE de 7 dígitos.
   * Usa a camada municipalities_mata_atlantica_biome do PRODES.
   *
   * Gotcha: a bbox é retangular — pode capturar fragmentos de municípios vizinhos.
   */
  private async fetchMunicipalityBbox(ibgeCode: string): Promise<BBox | null> {
    const params = new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeName: `${WORKSPACE}:municipalities_mata_atlantica_biome`,
      outputFormat: "application/json",
      CQL_FILTER: `geocodigo='${ibgeCode}'`,
    });

    const url = `${BASE_OWS}?${params.toString()}`;
    logger.debug(`INPE passo 1 — buscando bbox para ${ibgeCode}`);

    const raw = await fetchWithRetry<unknown>(url, {
      timeoutMs: this.timeout,
      maxRetries: this.maxRetries,
    });

    const parsed = InpeMunicipalityCollectionSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(`INPE: schema inválido na camada municipalities`, {
        ibgeCode,
        errors: parsed.error.flatten(),
      });
      return null;
    }

    const feature = parsed.data.features[0];
    if (!feature) return null;

    // Preferir bbox do feature; se não disponível, extrair da geometry
    if (feature.bbox) {
      return feature.bbox;
    }

    // Tentar extrair bbox da coleção
    if (parsed.data.bbox) {
      return parsed.data.bbox;
    }

    // Extrair bbox da geometria via coordenadas brutas
    const coords = this.extractCoordinatesFromGeometry(feature.geometry);
    if (coords.length === 0) return null;

    return this.coordinatesToBbox(coords);
  }

  // ─── Passo 2: Desmatamento anual por bbox ──────────────────────────────────

  /**
   * Busca a série histórica de desmatamento anual (2004–presente) dentro de uma bbox.
   *
   * Gotcha: propertyName com >5 campos quebra o GeoServer com ArrayIndexOutOfBoundsException.
   * Por isso buscamos apenas year e area_km (2 campos).
   */
  private async fetchYearlyDeforestation(bbox: BBox): Promise<Record<number, number>> {
    const [minX, minY, maxX, maxY] = bbox;
    const bboxParam = `${minX},${minY},${maxX},${maxY},${EPSG}`;

    const params = new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeName: `${WORKSPACE}:yearly_deforestation`,
      outputFormat: "application/json",
      BBOX: bboxParam,
    });

    const url = `${BASE_OWS}?${params.toString()}`;
    logger.debug(`INPE passo 2 — buscando desmatamento por bbox`, { bbox: bboxParam });

    const raw = await fetchWithRetry<unknown>(url, {
      timeoutMs: this.timeout,
      maxRetries: this.maxRetries,
    });

    const parsed = InpeDeforestationCollectionSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(`INPE: schema inválido na camada yearly_deforestation`, {
        errors: parsed.error.flatten(),
      });
      return {};
    }

    // Agregar area_km por ano
    const serieHistorica: Record<number, number> = {};
    for (const feature of parsed.data.features) {
      const { year, area_km } = feature.properties;
      serieHistorica[year] = (serieHistorica[year] ?? 0) + area_km;
    }

    // Arredondar para 4 casas decimais (precision de km²)
    for (const year of Object.keys(serieHistorica)) {
      const y = Number(year);
      serieHistorica[y] = Math.round((serieHistorica[y] ?? 0) * 10_000) / 10_000;
    }

    return serieHistorica;
  }

  // ─── Construção dos indicadores ────────────────────────────────────────────

  private buildIndicators(serieHistorica: Record<number, number>): InpeIndicators {
    const anos = Object.keys(serieHistorica)
      .map(Number)
      .sort((a, b) => a - b);

    if (anos.length === 0) {
      return {
        desmatamentoAnualKm2: null,
        anoReferencia: null,
        desmatamentoAcumuladoKm2: null,
        tendenciaDesmatamento: null,
        serieHistorica: {},
      };
    }

    // Ano mais recente com dados (pode ser parcial)
    const anoRecente = anos[anos.length - 1]!;
    const desmatamentoAnual = serieHistorica[anoRecente] ?? null;

    // Acumulado = soma de todos os anos
    const desmatamentoAcumulado = anos.reduce(
      (acc, ano) => acc + (serieHistorica[ano] ?? 0),
      0,
    );

    // Tendência: variação YoY entre os dois últimos anos completos
    // Se só há um ano parcial (o mais recente), usar o penúltimo como referência
    let tendencia: number | null = null;
    if (anos.length >= 2) {
      const anoAnterior = anos[anos.length - 2]!;
      const valorAnterior = serieHistorica[anoAnterior] ?? 0;
      const valorRecente = serieHistorica[anoRecente] ?? 0;

      if (valorAnterior > 0) {
        tendencia = Math.round(((valorRecente - valorAnterior) / valorAnterior) * 10_000) / 100;
      } else if (valorRecente > 0) {
        tendencia = 100; // passou de zero para positivo = 100% de aumento
      } else {
        tendencia = 0;
      }
    }

    return {
      desmatamentoAnualKm2: desmatamentoAnual,
      anoReferencia: anoRecente,
      desmatamentoAcumuladoKm2: Math.round(desmatamentoAcumulado * 10_000) / 10_000,
      tendenciaDesmatamento: tendencia,
      serieHistorica,
    };
  }

  // ─── Utilitários de geometria ──────────────────────────────────────────────

  private extractCoordinatesFromGeometry(
    geometry: { type: string; coordinates?: unknown } | null | undefined,
  ): [number, number][] {
    if (!geometry) return [];

    try {
      const coords: [number, number][] = [];
      this.flattenCoords(geometry.coordinates, coords);
      return coords;
    } catch {
      return [];
    }
  }

  private flattenCoords(value: unknown, acc: [number, number][]): void {
    if (!Array.isArray(value)) return;

    if (
      value.length === 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      acc.push([value[0], value[1]]);
      return;
    }

    for (const item of value) {
      this.flattenCoords(item, acc);
    }
  }

  private coordinatesToBbox(coords: [number, number][]): BBox {
    const xs = coords.map((c) => c[0]);
    const ys = coords.map((c) => c[1]);
    return [
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys),
    ];
  }
}
