import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks devem ser declarados antes de qualquer import dos módulos testados
vi.mock("../../../backend/utils/http-client.js", () => ({
  fetchWithRetry: vi.fn(),
}));

vi.mock("../../../backend/utils/cache.js", () => ({
  withCache: vi.fn(
    async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
  ),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { InpeCollector } from "../../../backend/agents/inpe/inpe_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/inpe/inpe_ods_mapper.js";
import type { InpeMunicipalData } from "../../../shared/types/agents/inpe.types.js";

const { fetchWithRetry } = await import("../../../backend/utils/http-client.js");
const mockFetch = vi.mocked(fetchWithRetry);

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * Resposta válida da camada municipalities_mata_atlantica_biome (passo 1).
 * Contém bbox diretamente no feature — caminho mais simples.
 */
const MOCK_MUNICIPALITY_RESPONSE_WITH_BBOX = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { geocodigo: "4204202", nome: "Florianópolis", state: "SC" },
      geometry: { type: "MultiPolygon", coordinates: [] },
      bbox: [-48.7, -27.9, -48.3, -27.4] as [number, number, number, number],
    },
  ],
};

/**
 * Resposta válida da camada municipalities — bbox ausente no feature,
 * presente na coleção (passo 1, caminho alternativo).
 */
const MOCK_MUNICIPALITY_RESPONSE_COLLECTION_BBOX = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { geocodigo: "4204202", nome: "Florianópolis", state: "SC" },
      geometry: { type: "MultiPolygon", coordinates: [] },
    },
  ],
  bbox: [-48.7, -27.9, -48.3, -27.4] as [number, number, number, number],
};

/**
 * Resposta da camada municipalities sem bbox alguma — bbox deve ser extraída
 * das coordenadas da geometry (passo 1, caminho de fallback).
 */
const MOCK_MUNICIPALITY_RESPONSE_GEOMETRY_COORDS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { geocodigo: "4204202", nome: "Florianópolis", state: "SC" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-48.7, -27.9],
            [-48.3, -27.9],
            [-48.3, -27.4],
            [-48.7, -27.4],
            [-48.7, -27.9],
          ],
        ],
      },
    },
  ],
};

/**
 * Resposta válida da camada municipalities — zero features (município não
 * pertence ao bioma Mata Atlântica ou código inválido).
 */
const MOCK_MUNICIPALITY_EMPTY_FEATURES = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Resposta válida da camada yearly_deforestation (passo 2).
 * Representa série histórica com dois anos para habilitar cálculo de tendência.
 */
const MOCK_DEFORESTATION_RESPONSE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { year: 2022, area_km: 1.2, state: "SC", main_class: "desmatamento" },
      geometry: null,
    },
    {
      type: "Feature",
      properties: { year: 2023, area_km: 0.8, state: "SC", main_class: "desmatamento" },
      geometry: null,
    },
  ],
};

/** Resposta yearly_deforestation sem features — nenhum desmatamento detectado na bbox. */
const MOCK_DEFORESTATION_EMPTY = {
  type: "FeatureCollection",
  features: [],
};

// ─── InpeCollector ───────────────────────────────────────────────────────────

describe("InpeCollector", () => {
  let collector: InpeCollector;

  beforeEach(() => {
    collector = new InpeCollector();
    vi.clearAllMocks();
  });

  // Caso 1: municipio encontrado com desmatamento disponivel
  it("retorna InpeMunicipalData completo quando município existe e tem dados de desmatamento", async () => {
    mockFetch
      .mockResolvedValueOnce(MOCK_MUNICIPALITY_RESPONSE_WITH_BBOX)
      .mockResolvedValueOnce(MOCK_DEFORESTATION_RESPONSE);

    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.indicators.desmatamentoAnualKm2).toBe(0.8);
    expect(result!.indicators.anoReferencia).toBe(2023);
    expect(result!.indicators.desmatamentoAcumuladoKm2).toBe(2.0);
    // Tendência: (0.8 - 1.2) / 1.2 * 100 = -33.33 → arredondado -33.33
    expect(result!.indicators.tendenciaDesmatamento).toBeCloseTo(-33.33, 1);
    expect(result!.indicators.serieHistorica).toEqual({ 2022: 1.2, 2023: 0.8 });
  });

  // Caso 2: municipio nao existe (bbox null — zero features na camada municipalities)
  it("retorna null quando município não está na camada municipalities_mata_atlantica_biome", async () => {
    mockFetch.mockResolvedValueOnce(MOCK_MUNICIPALITY_EMPTY_FEATURES);

    const result = await collector.collect("9999999");

    expect(result).toBeNull();
    // Não deve chamar o passo 2 (deforestation) se não há bbox
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Caso 3: collect com dados vazios — municipio encontrado mas sem features de desmatamento
  it("retorna dataAvailable false quando série de desmatamento está vazia", async () => {
    mockFetch
      .mockResolvedValueOnce(MOCK_MUNICIPALITY_RESPONSE_WITH_BBOX)
      .mockResolvedValueOnce(MOCK_DEFORESTATION_EMPTY);

    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.dataAvailable).toBe(false);
    expect(result!.indicators.desmatamentoAnualKm2).toBeNull();
    expect(result!.indicators.anoReferencia).toBeNull();
    expect(result!.indicators.desmatamentoAcumuladoKm2).toBeNull();
    expect(result!.indicators.tendenciaDesmatamento).toBeNull();
    expect(result!.indicators.serieHistorica).toEqual({});
  });

  // Caso 4: erro de rede — fetchWithRetry lança exceção
  it("retorna null sem lançar exceção quando fetch falha por erro de rede", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED: Connection refused"));

    const result = await collector.collect("4204202");

    expect(result).toBeNull();
  });

  // Caso 5: collectBatch com mix de sucesso e falha
  it("collectBatch retorna Map apenas com municípios coletados com sucesso", async () => {
    // Municipio 1 (4204202): sucesso — bbox + deforestation
    mockFetch
      .mockResolvedValueOnce(MOCK_MUNICIPALITY_RESPONSE_WITH_BBOX)
      .mockResolvedValueOnce(MOCK_DEFORESTATION_RESPONSE);

    // Municipio 2 (4200101): falha no passo 1 (sem features)
    mockFetch.mockResolvedValueOnce(MOCK_MUNICIPALITY_EMPTY_FEATURES);

    // Municipio 3 (4200051): erro de rede no passo 1
    mockFetch.mockRejectedValueOnce(new Error("timeout"));

    const result = await collector.collectBatch(["4204202", "4200101", "4200051"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(1);
    expect(result.has("4204202")).toBe(true);
    expect(result.has("4200101")).toBe(false);
    expect(result.has("4200051")).toBe(false);
  });

  // Caso 6: validacao Zod — resposta invalida no passo 1
  it("retorna null quando resposta da camada municipalities falha na validação Zod", async () => {
    mockFetch.mockResolvedValueOnce({ invalid_field: "not a feature collection" });

    const result = await collector.collect("4204202");

    expect(result).toBeNull();
  });

  // Caso 6b: validacao Zod — resposta invalida no passo 2
  it("retorna dataAvailable false quando resposta da camada deforestation falha na validação Zod", async () => {
    mockFetch
      .mockResolvedValueOnce(MOCK_MUNICIPALITY_RESPONSE_WITH_BBOX)
      .mockResolvedValueOnce({ broken: true });

    const result = await collector.collect("4204202");

    // O collector não lança — retorna com serieHistorica vazia
    expect(result).not.toBeNull();
    expect(result!.dataAvailable).toBe(false);
    expect(result!.indicators.desmatamentoAnualKm2).toBeNull();
  });

  // Caso 7: geometria sem bbox — bbox extraida das coordenadas da geometry
  it("extrai bbox das coordenadas da geometry quando feature e coleção não têm bbox", async () => {
    mockFetch
      .mockResolvedValueOnce(MOCK_MUNICIPALITY_RESPONSE_GEOMETRY_COORDS)
      .mockResolvedValueOnce(MOCK_DEFORESTATION_RESPONSE);

    const result = await collector.collect("4204202");

    // Se bbox foi extraída corretamente o passo 2 é executado e retorna dados
    expect(result).not.toBeNull();
    expect(result!.dataAvailable).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // Caso 7b: bbox da colecao (segundo fallback antes de coordenadas)
  it("usa bbox da coleção FeatureCollection quando feature não tem bbox própria", async () => {
    mockFetch
      .mockResolvedValueOnce(MOCK_MUNICIPALITY_RESPONSE_COLLECTION_BBOX)
      .mockResolvedValueOnce(MOCK_DEFORESTATION_RESPONSE);

    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.dataAvailable).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ─── mapToOdsIndicators ───────────────────────────────────────────────────────

describe("mapToOdsIndicators (INPE ODS Mapper)", () => {
  const referenceDate = new Date("2023-12-31");

  /** Fixture com todos os indicadores preenchidos — deve gerar 4 indicadores */
  const MOCK_DATA_COMPLETO: InpeMunicipalData = {
    ibgeCode: "4204202",
    referenceYear: 2023,
    referenceDate,
    dataAvailable: true,
    indicators: {
      desmatamentoAnualKm2: 0.8,
      anoReferencia: 2023,
      desmatamentoAcumuladoKm2: 2.0,
      tendenciaDesmatamento: -33.33,
      serieHistorica: { 2022: 1.2, 2023: 0.8 },
    },
  };

  // Caso 8: dados completos geram 4 indicadores (2 ODS 13 + 2 ODS 15)
  it("gera exatamente 4 indicadores para dados completos: 2 ODS 13 + 2 ODS 15", () => {
    const indicators = mapToOdsIndicators(MOCK_DATA_COMPLETO);

    expect(indicators).toHaveLength(4);

    const ods13 = indicators.filter((i) => i.odsNumber === 13);
    const ods15 = indicators.filter((i) => i.odsNumber === 15);

    expect(ods13).toHaveLength(2);
    expect(ods15).toHaveLength(2);

    const names = indicators.map((i) => i.indicatorName);
    expect(names).toContain("desmatamento_anual_km2");
    expect(names).toContain("tendencia_desmatamento_pct");
    expect(names).toContain("desmatamento_acumulado_km2");
    expect(names).toContain("tendencia_desmatamento_vida_terrestre_pct");
  });

  // Caso 9: dados parciais (null fields) → subset de indicadores
  it("gera apenas 2 indicadores quando tendencia é null (ODS 13 anual + ODS 15 acumulado)", () => {
    const partialData: InpeMunicipalData = {
      ...MOCK_DATA_COMPLETO,
      indicators: {
        desmatamentoAnualKm2: 1.5,
        anoReferencia: 2023,
        desmatamentoAcumuladoKm2: 10.0,
        tendenciaDesmatamento: null, // só 1 ano na série — tendência impossível
        serieHistorica: { 2023: 1.5 },
      },
    };

    const indicators = mapToOdsIndicators(partialData);

    expect(indicators).toHaveLength(2);
    expect(indicators.map((i) => i.indicatorName)).toContain("desmatamento_anual_km2");
    expect(indicators.map((i) => i.indicatorName)).toContain("desmatamento_acumulado_km2");
  });

  it("não gera nenhum indicador quando todos os campos são null", () => {
    const emptyData: InpeMunicipalData = {
      ...MOCK_DATA_COMPLETO,
      dataAvailable: false,
      indicators: {
        desmatamentoAnualKm2: null,
        anoReferencia: null,
        desmatamentoAcumuladoKm2: null,
        tendenciaDesmatamento: null,
        serieHistorica: {},
      },
    };

    const indicators = mapToOdsIndicators(emptyData);
    expect(indicators).toHaveLength(0);
  });

  // Caso 10: scoreDesmatamentoAnual — boundary conditions
  describe("scoreDesmatamentoAnual (km²/ano, menor = melhor)", () => {
    function getScoreAnual(km2: number): number {
      const data: InpeMunicipalData = {
        ...MOCK_DATA_COMPLETO,
        indicators: {
          ...MOCK_DATA_COMPLETO.indicators,
          desmatamentoAnualKm2: km2,
          tendenciaDesmatamento: null,
        },
      };
      return mapToOdsIndicators(data).find(
        (i) => i.indicatorName === "desmatamento_anual_km2",
      )!.score!;
    }

    it("0 km²/ano → score 100 (abaixo do mínimo bom)", () => {
      expect(getScoreAnual(0)).toBe(100);
    });

    it("0.1 km²/ano → score 100 (exatamente no limiar bom)", () => {
      expect(getScoreAnual(0.1)).toBe(100);
    });

    it("2.5 km²/ano → score ~51 (ponto médio da escala)", () => {
      // ((5.0 - 2.5) / (5.0 - 0.1)) * 100 = (2.5 / 4.9) * 100 ≈ 51.02 → arredonda 51
      expect(getScoreAnual(2.5)).toBe(51);
    });

    it("5.0 km²/ano → score 0 (exatamente no limiar mau)", () => {
      expect(getScoreAnual(5.0)).toBe(0);
    });

    it("10.0 km²/ano → score 0 (acima do limiar mau — clamped)", () => {
      expect(getScoreAnual(10.0)).toBe(0);
    });
  });

  // Caso 11: scoreDesmatamentoAcumulado — boundary conditions
  describe("scoreDesmatamentoAcumulado (km² total, menor = melhor)", () => {
    function getScoreAcumulado(km2: number): number {
      const data: InpeMunicipalData = {
        ...MOCK_DATA_COMPLETO,
        indicators: {
          ...MOCK_DATA_COMPLETO.indicators,
          desmatamentoAcumuladoKm2: km2,
          tendenciaDesmatamento: null,
        },
      };
      return mapToOdsIndicators(data).find(
        (i) => i.indicatorName === "desmatamento_acumulado_km2",
      )!.score!;
    }

    it("0 km² → score 100 (abaixo do mínimo bom)", () => {
      expect(getScoreAcumulado(0)).toBe(100);
    });

    it("1 km² → score 100 (exatamente no limiar bom)", () => {
      expect(getScoreAcumulado(1)).toBe(100);
    });

    it("50 km² → score ~51 (ponto médio da escala)", () => {
      // ((100 - 50) / (100 - 1)) * 100 = (50 / 99) * 100 ≈ 50.51 → arredonda 51
      expect(getScoreAcumulado(50)).toBe(51);
    });

    it("100 km² → score 0 (exatamente no limiar mau)", () => {
      expect(getScoreAcumulado(100)).toBe(0);
    });

    it("200 km² → score 0 (acima do limiar mau — clamped)", () => {
      // Caso Lages SC: ~200 km² acumulados → score 0
      expect(getScoreAcumulado(200)).toBe(0);
    });
  });

  // Caso 12: scoreTendenciaDesmatamento — boundary conditions
  describe("scoreTendenciaDesmatamento (variação YoY %, redução = melhor)", () => {
    function getScoreTendencia(pct: number): number {
      const data: InpeMunicipalData = {
        ...MOCK_DATA_COMPLETO,
        indicators: {
          ...MOCK_DATA_COMPLETO.indicators,
          desmatamentoAnualKm2: null,
          anoReferencia: null,
          desmatamentoAcumuladoKm2: null,
          tendenciaDesmatamento: pct,
        },
      };
      // Tendência aparece em dois indicadores (ODS 13 e ODS 15) — ambos usam a mesma função
      const ind = mapToOdsIndicators(data).find(
        (i) => i.indicatorName === "tendencia_desmatamento_pct",
      )!;
      return ind.score!;
    }

    it("-50% YoY → score 100 (redução de 50% — limiar excelente)", () => {
      expect(getScoreTendencia(-50)).toBe(100);
    });

    it("0% YoY → score ~67 (sem variação — ponto neutro da escala)", () => {
      // ((100 - 0) / (100 - (-50))) * 100 = (100 / 150) * 100 ≈ 66.67 → arredonda 67
      expect(getScoreTendencia(0)).toBe(67);
    });

    it("50% YoY → score ~33 (aumento moderado)", () => {
      // ((100 - 50) / 150) * 100 = (50 / 150) * 100 ≈ 33.33 → arredonda 33
      expect(getScoreTendencia(50)).toBe(33);
    });

    it("100% YoY → score 0 (aumento de 100% — limiar péssimo)", () => {
      expect(getScoreTendencia(100)).toBe(0);
    });

    it("200% YoY → score 0 (acima do limiar péssimo — clamped)", () => {
      expect(getScoreTendencia(200)).toBe(0);
    });

    it("tendência também aparece em ODS 15 com mesmo score", () => {
      const data: InpeMunicipalData = {
        ...MOCK_DATA_COMPLETO,
        indicators: {
          ...MOCK_DATA_COMPLETO.indicators,
          desmatamentoAnualKm2: null,
          anoReferencia: null,
          desmatamentoAcumuladoKm2: null,
          tendenciaDesmatamento: 0,
        },
      };
      const indicators = mapToOdsIndicators(data);
      const ods13Tendencia = indicators.find(
        (i) => i.odsNumber === 13 && i.indicatorName === "tendencia_desmatamento_pct",
      )!;
      const ods15Tendencia = indicators.find(
        (i) => i.odsNumber === 15 && i.indicatorName === "tendencia_desmatamento_vida_terrestre_pct",
      )!;

      expect(ods13Tendencia.score).toBe(ods15Tendencia.score);
    });
  });

  it("source é sempre 'inpe'", () => {
    const indicators = mapToOdsIndicators(MOCK_DATA_COMPLETO);
    expect(indicators.every((i) => i.source === "inpe")).toBe(true);
  });

  it("status segue regra verde/amarelo/vermelho conforme score", () => {
    const indicators = mapToOdsIndicators(MOCK_DATA_COMPLETO);

    for (const ind of indicators) {
      if (ind.score !== null && ind.score >= 70) {
        expect(ind.status).toBe("verde");
      } else if (ind.score !== null && ind.score >= 40) {
        expect(ind.status).toBe("amarelo");
      } else if (ind.score !== null) {
        expect(ind.status).toBe("vermelho");
      }
    }
  });

  it("municipalityId e referenceYear são propagados corretamente para todos os indicadores", () => {
    const indicators = mapToOdsIndicators(MOCK_DATA_COMPLETO);

    expect(indicators.every((i) => i.municipalityId === "4204202")).toBe(true);
    expect(
      indicators.find((i) => i.indicatorName === "desmatamento_anual_km2")!.referenceYear,
    ).toBe(2023);
    expect(
      indicators.find((i) => i.indicatorName === "tendencia_desmatamento_pct")!.referenceYear,
    ).toBe(2023);
  });

  it("scores estão sempre no intervalo 0-100", () => {
    const indicators = mapToOdsIndicators(MOCK_DATA_COMPLETO);

    for (const ind of indicators) {
      expect(ind.score).toBeGreaterThanOrEqual(0);
      expect(ind.score).toBeLessThanOrEqual(100);
    }
  });
});
