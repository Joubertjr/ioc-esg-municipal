import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/data/snis_rs_2022.json", () => ({
  default: {
    "4204202": {
      coletaSeletivaPct: 85.0,
      taxaReciclagemPct: 42.0,
      residuoPerCapitaKgDia: 0.45,
    },
    "4200101": {
      coletaSeletivaPct: 35.0,
      taxaReciclagemPct: null,
      residuoPerCapitaKgDia: 1.1,
    },
    "4200051": {
      coletaSeletivaPct: null,
      taxaReciclagemPct: null,
      residuoPerCapitaKgDia: null,
    },
  },
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { SnisRsCollector } from "../../../backend/agents/snis_rs/snis_rs_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/snis_rs/snis_rs_ods_mapper.js";
import type { SnisRsMunicipalData } from "../../../shared/types/agents/snis_rs.types.js";

describe("SnisRsCollector", () => {
  const collector = new SnisRsCollector();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna dados válidos para município cadastrado", async () => {
    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.referenceYear).toBe(2022);
    expect(result!.indicators.coletaSeletivaPct).toBe(85.0);
    expect(result!.indicators.taxaReciclagemPct).toBe(42.0);
    expect(result!.indicators.residuoPerCapitaKgDia).toBe(0.45);
  });

  it("retorna null para ibgeCode ausente no JSON", async () => {
    const result = await collector.collect("9999999");

    expect(result).toBeNull();
  });

  it("retorna dados com campos parcialmente null", async () => {
    const result = await collector.collect("4200101");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4200101");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.indicators.coletaSeletivaPct).toBe(35.0);
    expect(result!.indicators.taxaReciclagemPct).toBeNull();
    expect(result!.indicators.residuoPerCapitaKgDia).toBe(1.1);
  });

  it("retorna null quando todos os indicadores são null", async () => {
    const result = await collector.collect("4200051");

    expect(result).toBeNull();
  });

  it("collectBatch retorna Map com municípios com dados", async () => {
    const result = await collector.collectBatch(["4204202", "4200101", "4200051", "9999999"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.has("4204202")).toBe(true);
    expect(result.has("4200101")).toBe(true);
    expect(result.has("4200051")).toBe(false);
    expect(result.has("9999999")).toBe(false);
  });
});

describe("SNIS-RS ODS Mapper", () => {
  const mockData: SnisRsMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2022,
    referenceDate: new Date("2022-12-31"),
    dataAvailable: true,
    indicators: {
      coletaSeletivaPct: 85.0,
      taxaReciclagemPct: 42.0,
      residuoPerCapitaKgDia: 0.45,
    },
  };

  it("gera indicadores apenas para ODS 12", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.length).toBe(3);
    expect(indicators.every((i) => i.odsNumber === 12)).toBe(true);
  });

  it("source é sempre 'snis_rs'", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.every((i) => i.source === "snis_rs")).toBe(true);
  });

  it("coleta seletiva >= 80% recebe score 100", () => {
    const indicators = mapToOdsIndicators(mockData); // coletaSeletivaPct = 85.0

    const ind = indicators.find((i) => i.indicatorName === "snis_rs_coleta_seletiva")!;
    expect(ind.score).toBe(100);
  });

  it("coleta seletiva = 40% recebe score 50", () => {
    const data: SnisRsMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, coletaSeletivaPct: 40 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "snis_rs_coleta_seletiva")!;
    expect(ind.score).toBe(50);
  });

  it("coleta seletiva = 0% recebe score 0", () => {
    const data: SnisRsMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, coletaSeletivaPct: 0 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "snis_rs_coleta_seletiva")!;
    expect(ind.score).toBe(0);
  });

  it("taxa de reciclagem >= 40% recebe score 100", () => {
    const indicators = mapToOdsIndicators(mockData); // taxaReciclagemPct = 42.0

    const ind = indicators.find((i) => i.indicatorName === "snis_rs_taxa_reciclagem")!;
    expect(ind.score).toBe(100);
  });

  it("taxa de reciclagem = 15% recebe score 50", () => {
    const data: SnisRsMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, taxaReciclagemPct: 15 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "snis_rs_taxa_reciclagem")!;
    expect(ind.score).toBe(50);
  });

  it("taxa de reciclagem = 0% recebe score 0", () => {
    const data: SnisRsMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, taxaReciclagemPct: 0 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "snis_rs_taxa_reciclagem")!;
    expect(ind.score).toBe(0);
  });

  it("resíduo per capita <= 0.5 kg/hab/dia recebe score 100 (indicador invertido)", () => {
    const indicators = mapToOdsIndicators(mockData); // residuoPerCapitaKgDia = 0.45

    const ind = indicators.find((i) => i.indicatorName === "snis_rs_residuo_per_capita")!;
    expect(ind.score).toBe(100);
  });

  it("resíduo per capita = 1.0 kg/hab/dia recebe score 50 (indicador invertido)", () => {
    const data: SnisRsMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, residuoPerCapitaKgDia: 1.0 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "snis_rs_residuo_per_capita")!;
    expect(ind.score).toBe(50);
  });

  it("resíduo per capita alto resulta em score baixo", () => {
    const data: SnisRsMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, residuoPerCapitaKgDia: 1.5 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "snis_rs_residuo_per_capita")!;
    expect(ind.score).toBeLessThan(30);
  });

  it("resíduo per capita muito alto é clamped a 0", () => {
    const data: SnisRsMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, residuoPerCapitaKgDia: 2.5 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "snis_rs_residuo_per_capita")!;
    expect(ind.score).toBe(0);
  });

  it("não gera indicador para campo null", () => {
    const data: SnisRsMunicipalData = {
      ...mockData,
      indicators: {
        coletaSeletivaPct: null,
        taxaReciclagemPct: null,
        residuoPerCapitaKgDia: null,
      },
    };
    const indicators = mapToOdsIndicators(data);

    expect(indicators).toHaveLength(0);
  });

  it("não gera indicador para campo individualmente null", () => {
    const data: SnisRsMunicipalData = {
      ...mockData,
      indicators: {
        coletaSeletivaPct: 50,
        taxaReciclagemPct: null,
        residuoPerCapitaKgDia: 0.8,
      },
    };
    const indicators = mapToOdsIndicators(data);

    expect(indicators).toHaveLength(2);
    const names = indicators.map((i) => i.indicatorName);
    expect(names).toContain("snis_rs_coleta_seletiva");
    expect(names).not.toContain("snis_rs_taxa_reciclagem");
    expect(names).toContain("snis_rs_residuo_per_capita");
  });

  it("status segue regra verde >= 70, amarelo >= 40, vermelho < 40", () => {
    const indicators = mapToOdsIndicators(mockData);

    // coletaSeletivaPct = 85 → score 100 → verde
    const coleta = indicators.find((i) => i.indicatorName === "snis_rs_coleta_seletiva")!;
    expect(coleta.status).toBe("verde");

    // taxaReciclagemPct = 42 → score 100 → verde
    const reciclagem = indicators.find((i) => i.indicatorName === "snis_rs_taxa_reciclagem")!;
    expect(reciclagem.status).toBe("verde");

    // residuoPerCapitaKgDia = 0.45 → score 100 → verde
    const residuo = indicators.find((i) => i.indicatorName === "snis_rs_residuo_per_capita")!;
    expect(residuo.status).toBe("verde");
  });

  it("scores ficam entre 0 e 100", () => {
    const values: SnisRsMunicipalData[] = [
      { ...mockData, indicators: { coletaSeletivaPct: 0, taxaReciclagemPct: 0, residuoPerCapitaKgDia: 0 } },
      { ...mockData, indicators: { coletaSeletivaPct: 50, taxaReciclagemPct: 25, residuoPerCapitaKgDia: 0.8 } },
      { ...mockData, indicators: { coletaSeletivaPct: 100, taxaReciclagemPct: 50, residuoPerCapitaKgDia: 3.0 } },
    ];

    for (const data of values) {
      const indicators = mapToOdsIndicators(data);
      for (const ind of indicators) {
        expect(ind.score).toBeGreaterThanOrEqual(0);
        expect(ind.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("indicadores têm nomes corretos", () => {
    const indicators = mapToOdsIndicators(mockData);
    const names = indicators.map((i) => i.indicatorName);

    expect(names).toContain("snis_rs_coleta_seletiva");
    expect(names).toContain("snis_rs_taxa_reciclagem");
    expect(names).toContain("snis_rs_residuo_per_capita");
  });
});
