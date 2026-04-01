import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../../backend/utils/cache.js", () => ({
  withCache: vi.fn(
    async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
  ),
}));

vi.mock("../../../backend/utils/http-client.js", () => ({
  fetchWithRetry: vi.fn(),
}));

import { PncpCollector } from "../../../backend/agents/pncp/pncp_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/pncp/pncp_ods_mapper.js";
import { fetchWithRetry } from "../../../backend/utils/http-client.js";
import type { PncpMunicipalData } from "../../../shared/types/agents/pncp.types.js";
import { withCache } from "../../../backend/utils/cache.js";

const mockFetch = fetchWithRetry as MockedFunction<typeof fetchWithRetry>;
const mockCache = withCache as MockedFunction<typeof withCache>;

// ─── Fixture: resposta típica do PNCP /contratacoes/publicacao ────────────────

const MOCK_CONTRATACOES_PAGE_1 = {
  data: [
    {
      sequencialCompra: 1001,
      anoCompra: 2025,
      numeroCompra: "001/2025",
      orgaoEntidade: { cnpj: "82893743000166", razaoSocial: "PREFEITURA MUNICIPAL" },
      unidadeOrgao: { codigoMunicipioIbge: "4205407", ufSigla: "SC" },
      objetoCompra: "Aquisição de medicamentos",
      valorTotalEstimado: 100_000.0,
      valorTotalHomologado: 95_000.0,
      dataPublicacaoPncp: "2025-01-15T14:30:00",
      srp: false,
      codigoModalidadeContratacao: 5, // pregão
      modalidadeNome: "Pregão",
    },
    {
      sequencialCompra: 1002,
      anoCompra: 2025,
      numeroCompra: "002/2025",
      orgaoEntidade: { cnpj: "82893743000166", razaoSocial: "PREFEITURA MUNICIPAL" },
      unidadeOrgao: { codigoMunicipioIbge: "4205407", ufSigla: "SC" },
      objetoCompra: "Serviços de manutenção",
      valorTotalEstimado: 50_000.0,
      valorTotalHomologado: 48_000.0,
      dataPublicacaoPncp: "2025-02-10T09:00:00",
      srp: true,
      codigoModalidadeContratacao: 5,
      modalidadeNome: "Pregão",
    },
    {
      sequencialCompra: 1003,
      anoCompra: 2025,
      numeroCompra: "003/2025",
      orgaoEntidade: { cnpj: "82893743000166", razaoSocial: "PREFEITURA MUNICIPAL" },
      unidadeOrgao: { codigoMunicipioIbge: "4205407", ufSigla: "SC" },
      objetoCompra: "Compra de material de escritório",
      valorTotalEstimado: 5_000.0,
      valorTotalHomologado: 4_800.0,
      dataPublicacaoPncp: "2025-03-05T11:00:00",
      srp: false,
      codigoModalidadeContratacao: 7, // dispensa
      modalidadeNome: "Dispensa",
    },
  ],
  totalRegistros: 3,
  totalPaginas: 1,
  numeroPagina: 1,
  paginasRestantes: 0,
};

// ─── Testes do PncpCollector ──────────────────────────────────────────────────

describe("PncpCollector", () => {
  const collector = new PncpCollector();

  beforeEach(() => {
    vi.clearAllMocks();
    // Por padrão, cache passa diretamente para a função
    mockCache.mockImplementation(
      async (_key, _ttl, fn) => fn() as Promise<unknown>,
    );
  });

  it("retorna dados válidos para município com contratações", async () => {
    mockFetch.mockResolvedValueOnce(MOCK_CONTRATACOES_PAGE_1);

    const result = await collector.collect("4205407");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4205407");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.indicators.totalContratacoes).toBe(3);
  });

  it("retorna null para município sem contratações", async () => {
    mockFetch.mockResolvedValueOnce({
      data: [],
      totalRegistros: 0,
      totalPaginas: 0,
      numeroPagina: 1,
      paginasRestantes: 0,
    });

    const result = await collector.collect("4200051");

    expect(result).toBeNull();
  });

  it("calcula percentual de dispensas corretamente", async () => {
    mockFetch.mockResolvedValueOnce(MOCK_CONTRATACOES_PAGE_1);

    const result = await collector.collect("4205407");

    // 1 de 3 contratos é dispensa = 33.33%
    expect(result).not.toBeNull();
    expect(result!.indicators.percentualDispensas).toBeCloseTo(33.33, 1);
  });

  it("calcula taxa de homologação corretamente", async () => {
    mockFetch.mockResolvedValueOnce(MOCK_CONTRATACOES_PAGE_1);

    const result = await collector.collect("4205407");

    // (95000 + 48000 + 4800) / (100000 + 50000 + 5000) = 147800 / 155000 ≈ 0.9535
    expect(result).not.toBeNull();
    expect(result!.indicators.taxaHomologacao).toBeCloseTo(0.9535, 2);
  });

  it("calcula percentual de SRP corretamente", async () => {
    mockFetch.mockResolvedValueOnce(MOCK_CONTRATACOES_PAGE_1);

    const result = await collector.collect("4205407");

    // 1 de 3 com srp=true = 33.33%
    expect(result).not.toBeNull();
    expect(result!.indicators.percentualSrp).toBeCloseTo(33.33, 1);
  });

  it("retorna null em caso de falha na API (não lança erro)", async () => {
    // fetchWithRetry já faz retries internamente — simulamos que ele lança
    // após todos os retries esgotados (usando Once para não contaminar outros testes)
    mockFetch.mockRejectedValueOnce(new Error("Max retries exceeded"));

    const result = await collector.collect("4205407");

    expect(result).toBeNull();
  });

  it("lê do cache Redis quando disponível", async () => {
    const cachedData: PncpMunicipalData = {
      ibgeCode: "4205407",
      referenceYear: 2025,
      referenceDate: new Date("2025-12-31"),
      dataAvailable: true,
      indicators: {
        totalContratacoes: 10,
        percentualDispensas: 20,
        taxaHomologacao: 0.95,
        percentualSrp: 30,
        anoReferencia: 2025,
      },
    };

    mockCache.mockResolvedValueOnce(cachedData);

    const result = await collector.collect("4205407");

    // Cache retornou — fetchWithRetry NÃO deve ter sido chamado
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toEqual(cachedData);
  });

  it("valida schema com Zod — ignora campos inesperados na resposta", async () => {
    const responseComCamposExtras = {
      ...MOCK_CONTRATACOES_PAGE_1,
      campoDesconhecido: "valor_que_nao_existe_no_schema",
      data: MOCK_CONTRATACOES_PAGE_1.data.map((c) => ({
        ...c,
        outroField: 999,
      })),
    };

    mockFetch.mockResolvedValueOnce(responseComCamposExtras);

    // Zod deve parsear sem lançar erro — campos extras são ignorados
    const result = await collector.collect("4205407");
    expect(result).not.toBeNull();
    expect(result!.indicators.totalContratacoes).toBe(3);
  });

  it("retorna null quando schema Zod inválido (data não é array)", async () => {
    mockFetch.mockResolvedValueOnce({
      data: "nao_e_um_array",
      totalRegistros: 1,
    });

    const result = await collector.collect("4205407");

    expect(result).toBeNull();
  });

  it("collectBatch retorna Map apenas com municípios encontrados", async () => {
    // Município 1: tem dados
    mockFetch.mockResolvedValueOnce(MOCK_CONTRATACOES_PAGE_1);
    // Município 2: sem dados
    mockFetch.mockResolvedValueOnce({
      data: [],
      totalRegistros: 0,
      totalPaginas: 0,
      numeroPagina: 1,
      paginasRestantes: 0,
    });

    const result = await collector.collectBatch(["4205407", "9999998"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(1);
    expect(result.has("4205407")).toBe(true);
    expect(result.has("9999998")).toBe(false);
  });

  it("define referenceYear como ano anterior quando antes de abril", async () => {
    // Simular data em fevereiro (antes de abril = ano anterior)
    const fakeDate = new Date("2026-02-15");
    vi.setSystemTime(fakeDate);

    mockFetch.mockResolvedValueOnce(MOCK_CONTRATACOES_PAGE_1);

    const result = await collector.collect("4205407");

    expect(result).not.toBeNull();
    expect(result!.referenceYear).toBe(2025); // ano anterior a 2026

    vi.useRealTimers();
  });
});

// ─── Testes do PncpOdsMapper ──────────────────────────────────────────────────

describe("PNCP ODS Mapper", () => {
  const mockData: PncpMunicipalData = {
    ibgeCode: "4205407",
    referenceYear: 2025,
    referenceDate: new Date("2025-12-31"),
    dataAvailable: true,
    indicators: {
      totalContratacoes: 60,
      percentualDispensas: 15,
      taxaHomologacao: 0.92,
      percentualSrp: 35,
      anoReferencia: 2025,
    },
  };

  it("gera indicadores apenas para ODS 16", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.length).toBeGreaterThan(0);
    expect(indicators.every((i) => i.odsNumber === 16)).toBe(true);
  });

  it("source é sempre pncp", () => {
    const indicators = mapToOdsIndicators(mockData);
    expect(indicators.every((i) => i.source === "pncp")).toBe(true);
  });

  it("score: 60 contratações → 100 (>= benchmark 50)", () => {
    const data: PncpMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, totalContratacoes: 60 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "total_contratacoes_publicadas")!;
    expect(ind.score).toBe(100);
  });

  it("score: 0 contratações → 0", () => {
    const data: PncpMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, totalContratacoes: 0 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "total_contratacoes_publicadas")!;
    expect(ind.score).toBe(0);
  });

  it("score: 15% dispensas → 100 (<= 20% bom)", () => {
    const data: PncpMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, percentualDispensas: 15 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_dispensas")!;
    expect(ind.score).toBe(100);
  });

  it("score: 40% dispensas → 0 (>= 40% ruim)", () => {
    const data: PncpMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, percentualDispensas: 40 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_dispensas")!;
    expect(ind.score).toBe(0);
  });

  it("score: taxa homologação 0.92 → 100 (>= 0.9 ótimo)", () => {
    const data: PncpMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, taxaHomologacao: 0.92 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "taxa_homologacao")!;
    expect(ind.score).toBe(100);
  });

  it("score: taxa homologação 1.2 → 70 (aditivo = neutro)", () => {
    const data: PncpMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, taxaHomologacao: 1.2 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "taxa_homologacao")!;
    expect(ind.score).toBe(70);
  });

  it("não gera indicador de % dispensas quando null", () => {
    const data: PncpMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, percentualDispensas: null },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_dispensas");
    expect(ind).toBeUndefined();
  });

  it("status segue verde/amarelo/vermelho conforme score", () => {
    // 60 contratos → score 100 → verde
    // 0% SRP → score 0 → vermelho
    const data: PncpMunicipalData = {
      ...mockData,
      indicators: {
        ...mockData.indicators,
        totalContratacoes: 60,
        percentualSrp: 0,
      },
    };
    const indicators = mapToOdsIndicators(data);

    const contratacoes = indicators.find(
      (i) => i.indicatorName === "total_contratacoes_publicadas",
    )!;
    const srp = indicators.find((i) => i.indicatorName === "percentual_srp")!;

    expect(contratacoes.status).toBe("verde");
    expect(srp.status).toBe("vermelho");
  });
});
