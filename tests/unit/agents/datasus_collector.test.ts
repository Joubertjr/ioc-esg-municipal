import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFetchWithRetry } = vi.hoisted(() => ({
  mockFetchWithRetry: vi.fn(),
}));

vi.mock("../../../backend/utils/http-client.js", () => ({
  fetchWithRetry: mockFetchWithRetry,
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

import { DatasusCollector } from "../../../backend/agents/datasus/datasus_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/datasus/datasus_ods_mapper.js";
import type { DatasusMunicipalData } from "../../../shared/types/agents/datasus.types.js";

function makePrevineBrasilResponse(siconfiCode: string) {
  return {
    sisab_indicador_desempenho: [
      { uf: "SC", codigo_municipio: Number(siconfiCode), quadrimestre: "2025Q1", codigo_tipo_indicador: 10, percentual: 72.5, visao_equipe: "validas" },
      { uf: "SC", codigo_municipio: Number(siconfiCode), quadrimestre: "2025Q1", codigo_tipo_indicador: 20, percentual: 45.3, visao_equipe: "validas" },
      { uf: "SC", codigo_municipio: Number(siconfiCode), quadrimestre: "2025Q1", codigo_tipo_indicador: 30, percentual: 38.1, visao_equipe: "validas" },
      { uf: "SC", codigo_municipio: Number(siconfiCode), quadrimestre: "2025Q1", codigo_tipo_indicador: 40, percentual: 85.0, visao_equipe: "validas" },
      { uf: "SC", codigo_municipio: Number(siconfiCode), quadrimestre: "2025Q1", codigo_tipo_indicador: 50, percentual: 28.7, visao_equipe: "validas" },
      { uf: "SC", codigo_municipio: Number(siconfiCode), quadrimestre: "2025Q1", codigo_tipo_indicador: 70, percentual: 62.4, visao_equipe: "validas" },
    ],
  };
}

describe("DatasusCollector", () => {
  const collector = new DatasusCollector();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("coleta dados Previne Brasil com 6 indicadores", async () => {
    mockFetchWithRetry.mockResolvedValueOnce(makePrevineBrasilResponse("420420"));

    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.indicators.prenatal).toBe(72.5);
    expect(result!.indicators.diabetes).toBe(45.3);
    expect(result!.indicators.hipertensao).toBe(38.1);
    expect(result!.indicators.crescimentoInfantil).toBe(85);
    expect(result!.indicators.cancerColoUterino).toBe(28.7);
    expect(result!.indicators.saudeBucal).toBe(62.4);
  });

  it("calcula média geral dos indicadores", async () => {
    mockFetchWithRetry.mockResolvedValueOnce(makePrevineBrasilResponse("420420"));

    const result = await collector.collect("4204202");

    const expected = Math.round(((72.5 + 45.3 + 38.1 + 85 + 28.7 + 62.4) / 6) * 100) / 100;
    expect(result!.indicators.mediaGeral).toBe(expected);
  });

  it("retorna null para município sem dados", async () => {
    const empty = { sisab_indicador_desempenho: [] };
    mockFetchWithRetry
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(empty);

    const result = await collector.collect("0000000");
    expect(result).toBeNull();
  });

  it("faz fallback para quadrimestre anterior", async () => {
    const empty = { sisab_indicador_desempenho: [] };
    mockFetchWithRetry
      .mockResolvedValueOnce(empty) // primeiro quadrimestre vazio
      .mockResolvedValueOnce(makePrevineBrasilResponse("420420")); // fallback funciona

    const result = await collector.collect("4204202");
    expect(result).not.toBeNull();
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(2);
  });

  it("retorna null em caso de erro de rede", async () => {
    mockFetchWithRetry.mockRejectedValue(new Error("Network error"));

    const result = await collector.collect("4204202");
    expect(result).toBeNull();
  });

  it("valida Zod: rejeita dados malformados", async () => {
    mockFetchWithRetry.mockResolvedValueOnce([
      { uf: "SC", codigo_municipio: "420420", quadrimestre: "2025Q1", tipo_indicador: "invalid" },
    ]);

    // Zod rejects, falls through to next attempt
    mockFetchWithRetry.mockResolvedValueOnce([]);
    mockFetchWithRetry.mockResolvedValueOnce([]);

    const result = await collector.collect("4204202");
    expect(result).toBeNull();
  });
});

describe("DATASUS ODS Mapper", () => {
  const mockData: DatasusMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2025,
    referenceDate: new Date("2025-04-30"),
    dataAvailable: true,
    indicators: {
      prenatal: 72.5,
      diabetes: 45.3,
      hipertensao: 38.1,
      crescimentoInfantil: 85.0,
      cancerColoUterino: 28.7,
      saudeBucal: 62.4,
      mediaGeral: 55.33,
    },
  };

  it("gera indicadores apenas para ODS 3", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.length).toBe(6);
    expect(indicators.every((i) => i.odsNumber === 3)).toBe(true);
    expect(indicators.every((i) => i.source === "datasus")).toBe(true);
  });

  it("scores ficam entre 0 e 100", () => {
    const indicators = mapToOdsIndicators(mockData);

    for (const ind of indicators) {
      expect(ind.score).toBeGreaterThanOrEqual(0);
      expect(ind.score).toBeLessThanOrEqual(100);
    }
  });

  it("scoring: 85% → score alto, 28.7% → score baixo", () => {
    const indicators = mapToOdsIndicators(mockData);

    const crescimento = indicators.find((i) => i.indicatorName === "previne_crescimento_infantil")!;
    const cancer = indicators.find((i) => i.indicatorName === "previne_cancer_colo")!;

    // 85% → score 100 (>= 80%)
    expect(crescimento.score).toBe(100);
    // 28.7% → score ~29 (< 30%)
    expect(cancer.score).toBeLessThan(30);
  });

  it("não gera indicadores quando valores são null", () => {
    const nullData: DatasusMunicipalData = {
      ...mockData,
      indicators: {
        prenatal: null,
        diabetes: null,
        hipertensao: null,
        crescimentoInfantil: null,
        cancerColoUterino: null,
        saudeBucal: null,
        mediaGeral: null,
      },
    };

    const indicators = mapToOdsIndicators(nullData);
    expect(indicators).toHaveLength(0);
  });

  it("indicadores têm status verde/amarelo/vermelho", () => {
    const indicators = mapToOdsIndicators(mockData);

    const crescimento = indicators.find((i) => i.indicatorName === "previne_crescimento_infantil")!;
    expect(crescimento.status).toBe("verde"); // score 100

    const cancer = indicators.find((i) => i.indicatorName === "previne_cancer_colo")!;
    expect(cancer.status).toBe("vermelho"); // score < 40
  });
});
