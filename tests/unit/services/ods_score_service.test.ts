import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockIbgeCollect, mockSiconfiCollect, mockDatasusCollect } = vi.hoisted(() => ({
  mockIbgeCollect: vi.fn(),
  mockSiconfiCollect: vi.fn(),
  mockDatasusCollect: vi.fn(),
}));

vi.mock("../../../backend/agents/ibge/ibge_collector.js", () => ({
  IbgeCollector: vi.fn().mockImplementation(() => ({
    collect: mockIbgeCollect,
    collectBatch: vi.fn(),
  })),
}));

vi.mock("../../../backend/agents/siconfi/siconfi_collector.js", () => ({
  SiconfiCollector: vi.fn().mockImplementation(() => ({
    collect: mockSiconfiCollect,
    collectBatch: vi.fn(),
  })),
}));

vi.mock("../../../backend/agents/datasus/datasus_collector.js", () => ({
  DatasusCollector: vi.fn().mockImplementation(() => ({
    collect: mockDatasusCollect,
    collectBatch: vi.fn(),
  })),
}));

vi.mock("../../../backend/utils/cache.js", () => ({
  withCache: vi.fn(
    async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
  ),
}));

vi.mock("../../../backend/utils/http-client.js", () => ({
  fetchWithRetry: vi.fn(),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { calculateMunicipalOds } from "../../../backend/services/ods/ods_score_service.js";

const MOCK_IBGE_DATA = {
  ibgeCode: "4204202",
  siconfiCode: "420420",
  referenceYear: 2024,
  referenceDate: new Date("2024-12-31"),
  dataAvailable: true,
  indicators: {
    populacao: 250000,
    pibPerCapita: 55000,
    pctBaixaRenda: 35.0,
    taxaOcupacao: 55.0,
    receitasOrcamentarias: 1800000000,
    despesasOrcamentarias: 1700000000,
  },
};

const MOCK_SICONFI_DATA = {
  ibgeCode: "4204202",
  siconfiCode: "420420",
  referenceYear: 2024,
  referenceDate: new Date("2024-12-31"),
  dataAvailable: true,
  indicators: {
    fpmAnual: 130000000,
    receitaTotal: 1800000000,
    despesaTotal: 1700000000,
    despesaSaude: 400000000,
    despesaEducacao: 450000000,
    despesaUrbanismo: 250000000,
    despesaAssistencia: 80000000,
    transferenciasUniao: 300000000,
    fundeb: 180000000,
    populacao: 250000,
  },
};

const MOCK_DATASUS_DATA = {
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

describe("ODS Score Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna null quando nenhuma fonte tem dados", async () => {
    mockIbgeCollect.mockResolvedValueOnce(null);
    mockSiconfiCollect.mockResolvedValueOnce(null);
    mockDatasusCollect.mockResolvedValueOnce(null);

    const result = await calculateMunicipalOds("0000000");
    expect(result).toBeNull();
  });

  it("consolida IBGE + SICONFI + DATASUS em relatório único", async () => {
    mockIbgeCollect.mockResolvedValueOnce(MOCK_IBGE_DATA);
    mockSiconfiCollect.mockResolvedValueOnce(MOCK_SICONFI_DATA);
    mockDatasusCollect.mockResolvedValueOnce(MOCK_DATASUS_DATA);

    const result = await calculateMunicipalOds("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.ods).toHaveLength(17);
    expect(result!.globalScore).not.toBeNull();
    expect(result!.globalScore).toBeGreaterThanOrEqual(0);
    expect(result!.globalScore).toBeLessThanOrEqual(100);
  });

  it("tem 17 ODS no relatório, mesmo sem dados para todos", async () => {
    mockIbgeCollect.mockResolvedValueOnce(MOCK_IBGE_DATA);
    mockSiconfiCollect.mockResolvedValueOnce(MOCK_SICONFI_DATA);
    mockDatasusCollect.mockResolvedValueOnce(MOCK_DATASUS_DATA);

    const result = await calculateMunicipalOds("4204202");
    expect(result!.ods).toHaveLength(17);

    // ODS sem dados devem ter score null
    const ods2 = result!.ods.find((o) => o.odsNumber === 2)!;
    expect(ods2.score).toBeNull();
    expect(ods2.indicators).toHaveLength(0);

    // ODS com dados devem ter score
    const ods1 = result!.ods.find((o) => o.odsNumber === 1)!;
    expect(ods1.score).not.toBeNull();
    expect(ods1.indicators.length).toBeGreaterThan(0);
  });

  it("calcula score global como média ponderada", async () => {
    mockIbgeCollect.mockResolvedValueOnce(MOCK_IBGE_DATA);
    mockSiconfiCollect.mockResolvedValueOnce(MOCK_SICONFI_DATA);
    mockDatasusCollect.mockResolvedValueOnce(MOCK_DATASUS_DATA);

    const result = await calculateMunicipalOds("4204202");

    // With data: ODS 1, 3 (siconfi+datasus), 4, 8, 10, 11, 16, 17 = 8 ODS
    expect(result!.odsCount.withData).toBe(8);
    expect(result!.odsCount.total).toBe(17);
    expect(result!.globalStatus).not.toBeNull();
  });

  it("funciona só com IBGE (sem SICONFI e DATASUS)", async () => {
    mockIbgeCollect.mockResolvedValueOnce(MOCK_IBGE_DATA);
    mockSiconfiCollect.mockResolvedValueOnce(null);
    mockDatasusCollect.mockResolvedValueOnce(null);

    const result = await calculateMunicipalOds("4204202");

    expect(result).not.toBeNull();
    // Only IBGE ODS: 1, 8, 10, 11
    expect(result!.odsCount.withData).toBe(4);
  });

  it("funciona só com SICONFI (sem IBGE e DATASUS)", async () => {
    mockIbgeCollect.mockResolvedValueOnce(null);
    mockSiconfiCollect.mockResolvedValueOnce(MOCK_SICONFI_DATA);
    mockDatasusCollect.mockResolvedValueOnce(null);

    const result = await calculateMunicipalOds("4204202");

    expect(result).not.toBeNull();
    // Only SICONFI ODS: 3, 4, 11, 16, 17
    expect(result!.odsCount.withData).toBe(5);
  });

  it("funciona só com DATASUS (sem IBGE e SICONFI)", async () => {
    mockIbgeCollect.mockResolvedValueOnce(null);
    mockSiconfiCollect.mockResolvedValueOnce(null);
    mockDatasusCollect.mockResolvedValueOnce(MOCK_DATASUS_DATA);

    const result = await calculateMunicipalOds("4204202");

    expect(result).not.toBeNull();
    // Only DATASUS ODS: 3
    expect(result!.odsCount.withData).toBe(1);
    const ods3 = result!.ods.find((o) => o.odsNumber === 3)!;
    expect(ods3.sources).toContain("datasus");
  });

  it("ODS 3 combina indicadores SICONFI + DATASUS", async () => {
    mockIbgeCollect.mockResolvedValueOnce(null);
    mockSiconfiCollect.mockResolvedValueOnce(MOCK_SICONFI_DATA);
    mockDatasusCollect.mockResolvedValueOnce(MOCK_DATASUS_DATA);

    const result = await calculateMunicipalOds("4204202");

    const ods3 = result!.ods.find((o) => o.odsNumber === 3)!;
    expect(ods3.sources).toContain("siconfi");
    expect(ods3.sources).toContain("datasus");
    // SICONFI contributes 1 indicator, DATASUS contributes 6
    expect(ods3.indicators.length).toBe(7);
  });

  it("ODS 11 combina indicadores IBGE e SICONFI", async () => {
    mockIbgeCollect.mockResolvedValueOnce(MOCK_IBGE_DATA);
    mockSiconfiCollect.mockResolvedValueOnce(MOCK_SICONFI_DATA);
    mockDatasusCollect.mockResolvedValueOnce(null);

    const result = await calculateMunicipalOds("4204202");

    const ods11 = result!.ods.find((o) => o.odsNumber === 11)!;
    expect(ods11.sources).toContain("ibge");
    expect(ods11.sources).toContain("siconfi");
    expect(ods11.indicators.length).toBe(2);
  });

  it("contagem verde/amarelo/vermelho está correta", async () => {
    mockIbgeCollect.mockResolvedValueOnce(MOCK_IBGE_DATA);
    mockSiconfiCollect.mockResolvedValueOnce(MOCK_SICONFI_DATA);
    mockDatasusCollect.mockResolvedValueOnce(MOCK_DATASUS_DATA);

    const result = await calculateMunicipalOds("4204202");

    const { verde, amarelo, vermelho, withData } = result!.odsCount;
    expect(verde + amarelo + vermelho).toBe(withData);
  });
});
