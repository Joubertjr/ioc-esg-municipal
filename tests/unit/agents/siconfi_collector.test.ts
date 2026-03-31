import { describe, it, expect, vi, beforeEach } from "vitest";
import { SiconfiCollector } from "../../../backend/agents/siconfi/siconfi_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/siconfi/siconfi_ods_mapper.js";
import type { SiconfiMunicipalData } from "../../../shared/types/agents/siconfi.types.js";

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

// Mock RREO response (simplified — real responses have ~2700 items)
function makeRreoResponse(ibgeCode: number) {
  return {
    items: [
      // Anexo 01 — Receitas
      {
        exercicio: 2024, demonstrativo: "RREO", periodo: 6, periodicidade: "B",
        instituicao: "Prefeitura Municipal", cod_ibge: ibgeCode, uf: "SC",
        populacao: 250000, anexo: "RREO-Anexo 01", esfera: "M", rotulo: "Padrão",
        coluna: "Até o Bimestre (c)",
        cod_conta: "ReceitasExcetoIntraOrcamentarias",
        conta: "RECEITAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)",
        valor: 1800000000,
      },
      {
        exercicio: 2024, demonstrativo: "RREO", periodo: 6, periodicidade: "B",
        instituicao: "Prefeitura Municipal", cod_ibge: ibgeCode, uf: "SC",
        populacao: 250000, anexo: "RREO-Anexo 01", esfera: "M", rotulo: "Padrão",
        coluna: "Até o Bimestre (c)",
        cod_conta: null,
        conta: "Transferências da União e de suas Entidades",
        valor: 300000000,
      },
      // Anexo 02 — Despesas por função
      {
        exercicio: 2024, demonstrativo: "RREO", periodo: 6, periodicidade: "B",
        instituicao: "Prefeitura Municipal", cod_ibge: ibgeCode, uf: "SC",
        populacao: 250000, anexo: "RREO-Anexo 02", esfera: "M", rotulo: "Padrão",
        coluna: "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)",
        cod_conta: null,
        conta: "DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)",
        valor: 1700000000,
      },
      {
        exercicio: 2024, demonstrativo: "RREO", periodo: 6, periodicidade: "B",
        instituicao: "Prefeitura Municipal", cod_ibge: ibgeCode, uf: "SC",
        populacao: 250000, anexo: "RREO-Anexo 02", esfera: "M", rotulo: "Padrão",
        coluna: "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)",
        cod_conta: null,
        conta: "Saúde",
        valor: 400000000,
      },
      {
        exercicio: 2024, demonstrativo: "RREO", periodo: 6, periodicidade: "B",
        instituicao: "Prefeitura Municipal", cod_ibge: ibgeCode, uf: "SC",
        populacao: 250000, anexo: "RREO-Anexo 02", esfera: "M", rotulo: "Padrão",
        coluna: "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)",
        cod_conta: null,
        conta: "Educação",
        valor: 450000000,
      },
      {
        exercicio: 2024, demonstrativo: "RREO", periodo: 6, periodicidade: "B",
        instituicao: "Prefeitura Municipal", cod_ibge: ibgeCode, uf: "SC",
        populacao: 250000, anexo: "RREO-Anexo 02", esfera: "M", rotulo: "Padrão",
        coluna: "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)",
        cod_conta: null,
        conta: "Urbanismo",
        valor: 250000000,
      },
      {
        exercicio: 2024, demonstrativo: "RREO", periodo: 6, periodicidade: "B",
        instituicao: "Prefeitura Municipal", cod_ibge: ibgeCode, uf: "SC",
        populacao: 250000, anexo: "RREO-Anexo 02", esfera: "M", rotulo: "Padrão",
        coluna: "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)",
        cod_conta: null,
        conta: "Assistência Social",
        valor: 80000000,
      },
      // Anexo 03 — FPM
      {
        exercicio: 2024, demonstrativo: "RREO", periodo: 6, periodicidade: "B",
        instituicao: "Prefeitura Municipal", cod_ibge: ibgeCode, uf: "SC",
        populacao: 250000, anexo: "RREO-Anexo 03", esfera: "M", rotulo: "Padrão",
        coluna: "TOTAL (ÚLTIMOS 12 MESES)",
        cod_conta: null,
        conta: "Cota-Parte do FPM",
        valor: 130000000,
      },
      // FUNDEB
      {
        exercicio: 2024, demonstrativo: "RREO", periodo: 6, periodicidade: "B",
        instituicao: "Prefeitura Municipal", cod_ibge: ibgeCode, uf: "SC",
        populacao: 250000, anexo: "RREO-Anexo 03", esfera: "M", rotulo: "Padrão",
        coluna: "TOTAL (ÚLTIMOS 12 MESES)",
        cod_conta: null,
        conta: "Transferências do FUNDEB",
        valor: 180000000,
      },
    ],
  };
}

describe("SiconfiCollector", () => {
  let collector: SiconfiCollector;

  beforeEach(() => {
    collector = new SiconfiCollector();
    vi.clearAllMocks();
  });

  it("retorna dados válidos para município SC existente", async () => {
    mockFetch.mockResolvedValueOnce(makeRreoResponse(4204202));

    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.indicators.fpmAnual).toBe(130000000);
    expect(result!.indicators.receitaTotal).toBe(1800000000);
    expect(result!.indicators.despesaTotal).toBe(1700000000);
    expect(result!.indicators.despesaSaude).toBe(400000000);
    expect(result!.indicators.despesaEducacao).toBe(450000000);
    expect(result!.indicators.despesaUrbanismo).toBe(250000000);
    expect(result!.indicators.fundeb).toBe(180000000);
    expect(result!.indicators.populacao).toBe(250000);
  });

  it("retorna null para município sem dados RREO", async () => {
    // First call (current year) returns empty
    mockFetch.mockResolvedValueOnce({ items: [] });
    // Second call (previous year) also empty
    mockFetch.mockResolvedValueOnce({ items: [] });

    const result = await collector.collect("0000000");
    expect(result).toBeNull();
  });

  it("tenta ano anterior quando ano corrente está vazio", async () => {
    mockFetch.mockResolvedValueOnce({ items: [] });
    mockFetch.mockResolvedValueOnce(makeRreoResponse(4204202));

    const result = await collector.collect("4204202");
    expect(result).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("valida schema Zod antes de retornar", async () => {
    mockFetch.mockResolvedValueOnce({ invalid: "data" });

    const result = await collector.collect("4204202");
    expect(result).toBeNull();
  });

  it("retorna null em falha de rede", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));

    const result = await collector.collect("4204202");
    expect(result).toBeNull();
  });

  it("extrai FPM da soma de MR quando TOTAL não disponível", async () => {
    const response = makeRreoResponse(4204202);
    // Replace TOTAL with monthly MR entries
    response.items = response.items.filter(
      (i) => !(i.conta === "Cota-Parte do FPM" && i.coluna === "TOTAL (ÚLTIMOS 12 MESES)"),
    );
    response.items.push(
      {
        exercicio: 2024, demonstrativo: "RREO", periodo: 6, periodicidade: "B",
        instituicao: "PM", cod_ibge: 4204202, uf: "SC", populacao: 250000,
        anexo: "RREO-Anexo 03", esfera: "M", rotulo: "Padrão",
        coluna: "<MR-1>", cod_conta: null, conta: "Cota-Parte do FPM", valor: 10000000,
      },
      {
        exercicio: 2024, demonstrativo: "RREO", periodo: 6, periodicidade: "B",
        instituicao: "PM", cod_ibge: 4204202, uf: "SC", populacao: 250000,
        anexo: "RREO-Anexo 03", esfera: "M", rotulo: "Padrão",
        coluna: "<MR-2>", cod_conta: null, conta: "Cota-Parte do FPM", valor: 12000000,
      },
    );
    mockFetch.mockResolvedValueOnce(response);

    const result = await collector.collect("4204202");
    expect(result!.indicators.fpmAnual).toBe(22000000); // 10M + 12M
  });
});

describe("SICONFI mapToOdsIndicators", () => {
  const mockData: SiconfiMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2024,
    referenceDate: new Date("2024-12-31"),
    dataAvailable: true,
    indicators: {
      fpmAnual: 130000000,
      receitaTotal: 1800000000,
      despesaTotal: 1700000000,
      despesaSaude: 400000000, // 23.5% of total
      despesaEducacao: 450000000, // 26.5% of total
      despesaUrbanismo: 250000000, // 14.7% of total
      despesaAssistencia: 80000000,
      transferenciasUniao: 300000000,
      fundeb: 180000000,
      populacao: 250000,
    },
  };

  it("gera indicadores ODS 3, 4, 11, 16, 17", () => {
    const indicators = mapToOdsIndicators(mockData);
    const odsNumbers = indicators.map((i) => i.odsNumber);
    expect(odsNumbers).toContain(3);
    expect(odsNumbers).toContain(4);
    expect(odsNumbers).toContain(11);
    expect(odsNumbers).toContain(16);
    expect(odsNumbers).toContain(17);
    expect(indicators.length).toBe(5);
  });

  it("scores estão no range 0-100", () => {
    const indicators = mapToOdsIndicators(mockData);
    for (const ind of indicators) {
      expect(ind.score).toBeGreaterThanOrEqual(0);
      expect(ind.score).toBeLessThanOrEqual(100);
    }
  });

  it("source é sempre 'siconfi'", () => {
    const indicators = mapToOdsIndicators(mockData);
    for (const ind of indicators) {
      expect(ind.source).toBe("siconfi");
    }
  });

  it("ODS 3 (saúde): 23.5% → score alto (acima do mínimo 15%)", () => {
    const indicators = mapToOdsIndicators(mockData);
    const ods3 = indicators.find((i) => i.odsNumber === 3)!;
    expect(ods3.score).toBeGreaterThanOrEqual(70);
    expect(ods3.status).toBe("verde");
  });

  it("ODS 4 (educação): 26.5% → score bom (acima do mínimo 25%)", () => {
    const indicators = mapToOdsIndicators(mockData);
    const ods4 = indicators.find((i) => i.odsNumber === 4)!;
    expect(ods4.score).toBeGreaterThanOrEqual(70);
  });

  it("ODS 17 (dependência FPM): 7.2% → score alto (baixa dependência)", () => {
    const indicators = mapToOdsIndicators(mockData);
    const ods17 = indicators.find((i) => i.odsNumber === 17)!;
    // 130M/1800M = 7.2% — good autonomy
    expect(ods17.score).toBeGreaterThanOrEqual(70);
  });

  it("município altamente dependente de FPM tem score baixo no ODS 17", () => {
    const highDependency: SiconfiMunicipalData = {
      ...mockData,
      indicators: {
        ...mockData.indicators,
        fpmAnual: 50000000,
        receitaTotal: 80000000, // FPM = 62.5% da receita
      },
    };
    const indicators = mapToOdsIndicators(highDependency);
    const ods17 = indicators.find((i) => i.odsNumber === 17)!;
    expect(ods17.score).toBeLessThan(10); // Very dependent
  });

  it("lida com indicadores null sem crash", () => {
    const partialData: SiconfiMunicipalData = {
      ...mockData,
      indicators: {
        fpmAnual: null,
        receitaTotal: null,
        despesaTotal: null,
        despesaSaude: null,
        despesaEducacao: null,
        despesaUrbanismo: null,
        despesaAssistencia: null,
        transferenciasUniao: null,
        fundeb: null,
        populacao: null,
      },
    };
    const indicators = mapToOdsIndicators(partialData);
    expect(indicators.length).toBe(0);
  });
});
