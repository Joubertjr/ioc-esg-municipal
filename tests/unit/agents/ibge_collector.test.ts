import { describe, it, expect, vi, beforeEach } from "vitest";
import { IbgeCollector } from "../../../backend/agents/ibge/ibge_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/ibge/ibge_ods_mapper.js";
import type { IbgeMunicipalData } from "../../../shared/types/agents/ibge.types.js";

// Mock do http-client e cache
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

const { fetchWithRetry } = await import(
  "../../../backend/utils/http-client.js"
);
const mockFetch = vi.mocked(fetchWithRetry);

// Dados de exemplo da API IBGE (formato real)
const MOCK_IBGE_RESPONSE = [
  {
    id: 29171, // POPULACAO_ESTIMADA
    res: [
      {
        localidade: "420420",
        res: { "2024": "275959", "2025": "282648" },
      },
    ],
  },
  {
    id: 47001, // PIB_PER_CAPITA
    res: [
      {
        localidade: "420420",
        res: { "2022": "61290.53", "2023": "69153.54" },
      },
    ],
  },
  {
    id: 60048, // PCT_BAIXA_RENDA (% pop com renda até 1/2 SM)
    res: [
      {
        localidade: "420420",
        res: { "2023": "57.87", "2024": "57.39" },
      },
    ],
  },
  {
    id: 60036, // TAXA_OCUPACAO (% pop ocupada)
    res: [
      {
        localidade: "420420",
        res: { "2022": "49.63" },
      },
    ],
  },
  {
    id: 28141, // RECEITAS_ORCAMENTARIAS
    res: [
      {
        localidade: "420420",
        res: { "2022": "7500000000.00" },
      },
    ],
  },
  {
    id: 29749, // DESPESAS_ORCAMENTARIAS
    res: [
      {
        localidade: "420420",
        res: { "2022": "7200000000.00" },
      },
    ],
  },
];

describe("IbgeCollector", () => {
  let collector: IbgeCollector;

  beforeEach(() => {
    collector = new IbgeCollector();
    vi.clearAllMocks();
  });

  it("retorna dados válidos para município SC existente", async () => {
    mockFetch.mockResolvedValueOnce(MOCK_IBGE_RESPONSE);

    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.indicators.populacao).toBe(282648);
    expect(result!.indicators.pibPerCapita).toBe(69153.54);
    expect(result!.indicators.pctBaixaRenda).toBe(57.39);
    expect(result!.indicators.taxaOcupacao).toBe(49.63);
  });

  it("retorna null para município inexistente sem lançar erro", async () => {
    mockFetch.mockResolvedValueOnce([
      { id: 29171, res: [] },
      { id: 47001, res: [] },
      { id: 60048, res: [] },
      { id: 60036, res: [] },
      { id: 28141, res: [] },
      { id: 29749, res: [] },
    ]);

    const result = await collector.collect("0000000");
    expect(result).toBeNull();
  });

  it("valida schema Zod antes de retornar", async () => {
    mockFetch.mockResolvedValueOnce([{ invalid: "data" }]);

    const result = await collector.collect("4204202");
    expect(result).toBeNull();
  });

  it("aplica retry em falha transitória", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));

    const result = await collector.collect("4204202");
    expect(result).toBeNull();
  });

  it("converte código IBGE para formato da API corretamente", async () => {
    mockFetch.mockResolvedValueOnce(MOCK_IBGE_RESPONSE);

    const result = await collector.collect("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.siconfiCode).toHaveLength(6);
  });
});

describe("mapToOdsIndicators", () => {
  const mockData: IbgeMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2024,
    referenceDate: new Date("2024-12-31"),
    dataAvailable: true,
    indicators: {
      populacao: 282648,
      pibPerCapita: 69153.54,
      pctBaixaRenda: 35.0, // 35% — score should be 70 (verde)
      taxaOcupacao: 50.0, // 50% — score should be 67 (amarelo)
      receitasOrcamentarias: 7500000000,
      despesasOrcamentarias: 7200000000,
    },
  };

  it("gera indicadores ODS corretos", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.length).toBeGreaterThan(0);
    const odsNumbers = indicators.map((i) => i.odsNumber);
    expect(odsNumbers).toContain(1);
    expect(odsNumbers).toContain(8);
    expect(odsNumbers).toContain(10);
    expect(odsNumbers).toContain(11);
  });

  it("scores estão no range 0-100", () => {
    const indicators = mapToOdsIndicators(mockData);

    for (const ind of indicators) {
      expect(ind.score).toBeGreaterThanOrEqual(0);
      expect(ind.score).toBeLessThanOrEqual(100);
    }
  });

  it("status segue regra Verde/Amarelo/Vermelho", () => {
    const indicators = mapToOdsIndicators(mockData);

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

  it("source é sempre 'ibge'", () => {
    const indicators = mapToOdsIndicators(mockData);
    for (const ind of indicators) {
      expect(ind.source).toBe("ibge");
    }
  });

  it("lida com indicadores null sem crash", () => {
    const partialData: IbgeMunicipalData = {
      ...mockData,
      indicators: {
        populacao: null,
        pibPerCapita: null,
        pctBaixaRenda: 40.0,
        taxaOcupacao: null,
        receitasOrcamentarias: null,
        despesasOrcamentarias: null,
      },
    };

    const indicators = mapToOdsIndicators(partialData);
    // Should have ODS 1 and 10 (pctBaixaRenda), not 8 or 11
    expect(indicators.length).toBe(2);
  });

  it("scoring: baixa renda menor = score maior", () => {
    const lowPoverty: IbgeMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, pctBaixaRenda: 20.0 },
    };
    const highPoverty: IbgeMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, pctBaixaRenda: 65.0 },
    };

    const lowScore = mapToOdsIndicators(lowPoverty).find(
      (i) => i.odsNumber === 1,
    )!.score;
    const highScore = mapToOdsIndicators(highPoverty).find(
      (i) => i.odsNumber === 1,
    )!.score;

    expect(lowScore).toBe(100); // 20% = best possible
    expect(highScore).toBe(10); // 65% = very bad
    expect(lowScore).toBeGreaterThan(highScore);
  });

  it("scoring: taxa ocupação maior = score maior", () => {
    const highOccupation: IbgeMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, taxaOcupacao: 60.0 },
    };
    const lowOccupation: IbgeMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, taxaOcupacao: 35.0 },
    };

    const highScore = mapToOdsIndicators(highOccupation).find(
      (i) => i.indicatorName === "taxa_ocupacao",
    )!.score;
    const lowScore = mapToOdsIndicators(lowOccupation).find(
      (i) => i.indicatorName === "taxa_ocupacao",
    )!.score;

    expect(highScore).toBe(100); // 60% = best
    expect(lowScore).toBe(17); // 35% = poor
    expect(highScore).toBeGreaterThan(lowScore);
  });
});
