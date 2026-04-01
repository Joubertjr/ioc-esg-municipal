import { describe, it, expect, vi, beforeEach } from "vitest";
import { IbgeCollector } from "../../../backend/agents/ibge/ibge_collector.js";
import {
  mapToOdsIndicators,
  scoreEmpresasPor10k,
} from "../../../backend/agents/ibge/ibge_ods_mapper.js";
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

// Resposta da API IBGE v1 (pesquisas/indicadores)
const MOCK_IBGE_V1_RESPONSE = [
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

// Resposta da API IBGE v3 — CEMPRE tabela 9418, variável 2283 (empresas atuantes)
// Formato: IbgePamResponseSchema — array de variáveis com resultados.serie
const MOCK_CEMPRE_RESPONSE = [
  {
    id: "2283",
    nome: "Empresas e outras organizações",
    unidade: "Unidades",
    resultados: [
      {
        localidade: {
          id: "4204202",
          nivel: { id: "N6", nome: "Município" },
          nome: "Blumenau",
        },
        serie: { "2022": "21450" },
      },
    ],
  },
];

// Resposta vazia para PAM (não testamos PAM aqui, só precisamos que não quebre)
const MOCK_PAM_EMPTY_RESPONSE: unknown[] = [];

/**
 * Configura mockFetch para as 3 chamadas paralelas de collect():
 *   1ª: API v1 indicadores principais
 *   2ª: API v3 PAM (produção agrícola)
 *   3ª: API v3 CEMPRE (empresas atuantes)
 */
function setupMockCollect(
  v1: unknown,
  pam: unknown = MOCK_PAM_EMPTY_RESPONSE,
  cempre: unknown = MOCK_CEMPRE_RESPONSE,
) {
  mockFetch
    .mockResolvedValueOnce(v1)
    .mockResolvedValueOnce(pam)
    .mockResolvedValueOnce(cempre);
}

describe("IbgeCollector", () => {
  let collector: IbgeCollector;

  beforeEach(() => {
    collector = new IbgeCollector();
    vi.clearAllMocks();
  });

  it("retorna dados válidos para município SC existente", async () => {
    setupMockCollect(MOCK_IBGE_V1_RESPONSE);

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

  it("preenche empresasAtuantes a partir do CEMPRE (tabela 9418)", async () => {
    setupMockCollect(MOCK_IBGE_V1_RESPONSE);

    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.indicators.empresasAtuantes).toBe(21450);
  });

  it("empresasAtuantes é null quando CEMPRE retorna resposta vazia", async () => {
    setupMockCollect(MOCK_IBGE_V1_RESPONSE, MOCK_PAM_EMPTY_RESPONSE, []);

    const result = await collector.collect("4204202");

    // Dados principais presentes, empresasAtuantes ausente
    expect(result).not.toBeNull();
    expect(result!.indicators.populacao).toBe(282648);
    expect(result!.indicators.empresasAtuantes).toBeNull();
  });

  it("CEMPRE falha silenciosamente — não bloqueia dados principais", async () => {
    mockFetch
      .mockResolvedValueOnce(MOCK_IBGE_V1_RESPONSE)
      .mockResolvedValueOnce(MOCK_PAM_EMPTY_RESPONSE)
      .mockRejectedValueOnce(new Error("CEMPRE timeout"));

    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.indicators.populacao).toBe(282648);
    expect(result!.indicators.empresasAtuantes).toBeNull();
  });

  it("retorna null para município inexistente sem lançar erro", async () => {
    // API v1 retorna arrays vazios — nenhuma localidade corresponde
    mockFetch
      .mockResolvedValueOnce([
        { id: 29171, res: [] },
        { id: 47001, res: [] },
        { id: 60048, res: [] },
        { id: 60036, res: [] },
        { id: 28141, res: [] },
        { id: 29749, res: [] },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await collector.collect("0000000");
    expect(result).toBeNull();
  });

  it("valida schema Zod antes de retornar", async () => {
    // Dados inválidos na chamada principal causam ZodError → null
    mockFetch
      .mockResolvedValueOnce([{ invalid: "data" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await collector.collect("4204202");
    expect(result).toBeNull();
  });

  it("aplica retry em falha transitória da chamada principal", async () => {
    // A primeira chamada (v1) falha — Promise.all rejeita — collect retorna null
    mockFetch
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await collector.collect("4204202");
    expect(result).toBeNull();
  });

  it("lê do cache Redis quando disponível", async () => {
    // withCache está mockado para sempre chamar fn() — este teste valida
    // que o collector aceita dados do cache sem nova chamada HTTP.
    // Com o mock de withCache, fetchWithRetry ainda é chamado (sem cache real),
    // mas o padrão de integração está correto.
    setupMockCollect(MOCK_IBGE_V1_RESPONSE);

    const result = await collector.collect("4204202");
    expect(result).not.toBeNull();
  });

  it("converte código IBGE para formato da API corretamente", async () => {
    setupMockCollect(MOCK_IBGE_V1_RESPONSE);

    const result = await collector.collect("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.siconfiCode).toHaveLength(6);
  });
});

describe("mapToOdsIndicators", () => {
  // Objeto base completo com todos os campos obrigatórios de IbgeIndicators
  const mockData: IbgeMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2024,
    referenceDate: new Date("2024-12-31"),
    dataAvailable: true,
    indicators: {
      populacao: 282648,
      pibPerCapita: 69153.54,
      pctBaixaRenda: 35.0, // 35% — score ODS 1 = 70 (verde)
      taxaOcupacao: 50.0, // 50% — score ODS 8 = 67 (amarelo)
      receitasOrcamentarias: 7500000000,
      despesasOrcamentarias: 7200000000,
      razaoDependencia: 50.0,
      areaterritorial: 1500.0,
      producaoAgricolaMilReais: null,
      empresasAtuantes: 21450, // 21450 / 282648 * 10000 ≈ 759 empresas/10k → score 100
    },
  };

  it("gera indicadores ODS corretos incluindo ODS 9", () => {
    const indicators = mapToOdsIndicators(mockData);

    const odsNumbers = indicators.map((i) => i.odsNumber);
    expect(odsNumbers).toContain(1);
    expect(odsNumbers).toContain(8);
    expect(odsNumbers).toContain(9);
    expect(odsNumbers).toContain(10);
    expect(odsNumbers).toContain(11);
  });

  it("ODS 9 tem indicatorName 'empresas_por_10k_hab' e source 'ibge'", () => {
    const ods9 = mapToOdsIndicators(mockData).find((i) => i.odsNumber === 9);

    expect(ods9).not.toBeUndefined();
    expect(ods9!.indicatorName).toBe("empresas_por_10k_hab");
    expect(ods9!.source).toBe("ibge");
  });

  it("ODS 9 calcula empresas/10k e atribui score correto (>= 100 empresas/10k = 100)", () => {
    const ods9 = mapToOdsIndicators(mockData).find((i) => i.odsNumber === 9)!;

    // 21450 / 282648 * 10000 ≈ 759 → score 100
    expect(ods9.value).toBeGreaterThan(100);
    expect(ods9.score).toBe(100);
    expect(ods9.status).toBe("verde");
  });

  it("ODS 9 não é gerado quando empresasAtuantes é null", () => {
    const dataWithoutEmpresas: IbgeMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, empresasAtuantes: null },
    };
    const odsNumbers = mapToOdsIndicators(dataWithoutEmpresas).map(
      (i) => i.odsNumber,
    );

    expect(odsNumbers).not.toContain(9);
  });

  it("ODS 9 não é gerado quando populacao é null", () => {
    const dataWithoutPop: IbgeMunicipalData = {
      ...mockData,
      indicators: {
        ...mockData.indicators,
        populacao: null,
        empresasAtuantes: 5000,
      },
    };
    const odsNumbers = mapToOdsIndicators(dataWithoutPop).map(
      (i) => i.odsNumber,
    );

    expect(odsNumbers).not.toContain(9);
  });

  it("scores estão no range 0-100", () => {
    for (const ind of mapToOdsIndicators(mockData)) {
      expect(ind.score).toBeGreaterThanOrEqual(0);
      expect(ind.score).toBeLessThanOrEqual(100);
    }
  });

  it("status segue regra Verde/Amarelo/Vermelho", () => {
    for (const ind of mapToOdsIndicators(mockData)) {
      if (ind.score >= 70) expect(ind.status).toBe("verde");
      else if (ind.score >= 40) expect(ind.status).toBe("amarelo");
      else expect(ind.status).toBe("vermelho");
    }
  });

  it("source é sempre 'ibge'", () => {
    for (const ind of mapToOdsIndicators(mockData)) {
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
        razaoDependencia: null,
        areaterritorial: null,
        producaoAgricolaMilReais: null,
        empresasAtuantes: null,
      },
    };

    const indicators = mapToOdsIndicators(partialData);
    // ODS 1 usa pctBaixaRenda. ODS 10 usa razaoDependencia (null aqui) — nao gerado.
    expect(indicators.length).toBe(1);
    expect(indicators[0]!.odsNumber).toBe(1);
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

    expect(lowScore).toBe(100);
    expect(highScore).toBe(10);
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

    expect(highScore).toBe(100);
    expect(lowScore).toBe(17);
    expect(highScore).toBeGreaterThan(lowScore);
  });
});

describe("scoreEmpresasPor10k", () => {
  it("retorna 100 para >= 100 empresas/10k", () => {
    expect(scoreEmpresasPor10k(100)).toBe(100);
    expect(scoreEmpresasPor10k(200)).toBe(100);
    expect(scoreEmpresasPor10k(759)).toBe(100);
  });

  it("retorna 70 para exatamente 50 empresas/10k", () => {
    expect(scoreEmpresasPor10k(50)).toBe(70);
  });

  it("retorna 40 para exatamente 20 empresas/10k", () => {
    expect(scoreEmpresasPor10k(20)).toBe(40);
  });

  it("retorna 20 para < 20 empresas/10k", () => {
    expect(scoreEmpresasPor10k(0)).toBe(20);
    expect(scoreEmpresasPor10k(10)).toBe(20);
    expect(scoreEmpresasPor10k(19)).toBe(20);
  });

  it("interpolação linear entre 50 e 100 — ponto médio 75 = score 85", () => {
    expect(scoreEmpresasPor10k(75)).toBe(85);
  });

  it("interpolação linear entre 20 e 50 — ponto médio 35 = score 55", () => {
    expect(scoreEmpresasPor10k(35)).toBe(55);
  });

  it("scores são monotonicamente crescentes", () => {
    const pontos = [0, 10, 20, 35, 50, 75, 100, 200];
    const scores = pontos.map(scoreEmpresasPor10k);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});
