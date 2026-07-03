import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/data/sisvan_latest.json", () => ({
  default: {
    __meta: { referenceYear: 2023 },
    "4204202": {
      cobertura_acompanhamento: 90.0,
      deficit_nutricional: 3.0,
      sobrepeso_infantil: 8.0,
    },
    "4200101": {
      cobertura_acompanhamento: 55.0,
      deficit_nutricional: 12.0,
      sobrepeso_infantil: 25.0,
    },
    "4200200": {
      cobertura_acompanhamento: 72.0,
      deficit_nutricional: 7.5,
      sobrepeso_infantil: 15.0,
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

import { SisvanCollector } from "../../../backend/agents/sisvan/sisvan_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/sisvan/sisvan_ods_mapper.js";
import type { SisvanMunicipalData } from "../../../shared/types/agents/sisvan.types.js";

describe("SisvanCollector", () => {
  const collector = new SisvanCollector();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna dados válidos para município SC existente", async () => {
    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.referenceYear).toBe(2023);
    expect(result!.indicators.cobertura_acompanhamento).toBe(90.0);
    expect(result!.indicators.deficit_nutricional).toBe(3.0);
    expect(result!.indicators.sobrepeso_infantil).toBe(8.0);
  });

  it("retorna null para município inexistente (não lança erro)", async () => {
    const result = await collector.collect("9999999");

    expect(result).toBeNull();
  });

  it("retorna dados com siconfiCode derivado do ibgeCode", async () => {
    const result = await collector.collect("4200101");

    expect(result).not.toBeNull();
    expect(result!.siconfiCode).toBe("420010");
  });

  it("retorna referenceDate como Date do ano 2023", async () => {
    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.referenceDate).toBeInstanceOf(Date);
    expect(result!.referenceDate.getFullYear()).toBe(2023);
  });

  it("collectBatch retorna Map com municípios com dados", async () => {
    const result = await collector.collectBatch(["4204202", "4200101", "9999999"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.has("4204202")).toBe(true);
    expect(result.has("4200101")).toBe(true);
    expect(result.has("9999999")).toBe(false);
  });

  it("collectBatch com lista vazia retorna Map vazio", async () => {
    const result = await collector.collectBatch([]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});

describe("SISVAN ODS Mapper", () => {
  const mockData: SisvanMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2023,
    referenceDate: new Date("2023-12-31"),
    dataAvailable: true,
    indicators: {
      cobertura_acompanhamento: 90.0,
      deficit_nutricional: 3.0,
      sobrepeso_infantil: 8.0,
    },
  };

  it("gera exatamente 3 indicadores por município", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators).toHaveLength(3);
  });

  it("todos os indicadores são para ODS 2", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.every((i) => i.odsNumber === 2)).toBe(true);
  });

  it("source é sempre 'sisvan'", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.every((i) => i.source === "sisvan")).toBe(true);
  });

  it("cobertura_acompanhamento >= 85% recebe score 100", () => {
    const indicators = mapToOdsIndicators(mockData); // cobertura = 90

    const ind = indicators.find((i) => i.indicatorName === "sisvan_cobertura_acompanhamento")!;
    expect(ind.score).toBe(100);
  });

  it("cobertura_acompanhamento = 60% recebe score 50", () => {
    const data: SisvanMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, cobertura_acompanhamento: 60 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "sisvan_cobertura_acompanhamento")!;
    expect(ind.score).toBe(50);
  });

  it("cobertura_acompanhamento = 0% recebe score 0", () => {
    const data: SisvanMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, cobertura_acompanhamento: 0 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "sisvan_cobertura_acompanhamento")!;
    expect(ind.score).toBe(0);
  });

  it("deficit_nutricional <= 5% recebe score 100 (indicador invertido)", () => {
    const indicators = mapToOdsIndicators(mockData); // deficit = 3.0

    const ind = indicators.find((i) => i.indicatorName === "sisvan_deficit_nutricional")!;
    expect(ind.score).toBe(100);
  });

  it("deficit_nutricional = 10% recebe score 50 (indicador invertido)", () => {
    const data: SisvanMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, deficit_nutricional: 10 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "sisvan_deficit_nutricional")!;
    expect(ind.score).toBe(50);
  });

  it("deficit_nutricional > 20% é clamped a 0 (indicador invertido)", () => {
    const data: SisvanMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, deficit_nutricional: 25 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "sisvan_deficit_nutricional")!;
    expect(ind.score).toBe(0);
  });

  it("sobrepeso_infantil <= 10% recebe score 100 (indicador invertido)", () => {
    const indicators = mapToOdsIndicators(mockData); // sobrepeso = 8.0

    const ind = indicators.find((i) => i.indicatorName === "sisvan_sobrepeso_infantil")!;
    expect(ind.score).toBe(100);
  });

  it("sobrepeso_infantil = 20% recebe score 50 (indicador invertido)", () => {
    const data: SisvanMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, sobrepeso_infantil: 20 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "sisvan_sobrepeso_infantil")!;
    expect(ind.score).toBe(50);
  });

  it("sobrepeso_infantil > 40% é clamped a 0 (indicador invertido)", () => {
    const data: SisvanMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, sobrepeso_infantil: 45 },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "sisvan_sobrepeso_infantil")!;
    expect(ind.score).toBe(0);
  });

  it("status segue regra verde >= 70, amarelo >= 40, vermelho < 40", () => {
    const indicators = mapToOdsIndicators(mockData);

    // cobertura = 90 → score 100 → verde
    const cobertura = indicators.find(
      (i) => i.indicatorName === "sisvan_cobertura_acompanhamento",
    )!;
    expect(cobertura.status).toBe("verde");

    // deficit = 3.0 → score 100 → verde
    const deficit = indicators.find((i) => i.indicatorName === "sisvan_deficit_nutricional")!;
    expect(deficit.status).toBe("verde");

    // sobrepeso = 8.0 → score 100 → verde
    const sobrepeso = indicators.find((i) => i.indicatorName === "sisvan_sobrepeso_infantil")!;
    expect(sobrepeso.status).toBe("verde");
  });

  it("indicadores têm nomes corretos", () => {
    const indicators = mapToOdsIndicators(mockData);
    const names = indicators.map((i) => i.indicatorName);

    expect(names).toContain("sisvan_cobertura_acompanhamento");
    expect(names).toContain("sisvan_deficit_nutricional");
    expect(names).toContain("sisvan_sobrepeso_infantil");
  });

  it("scores ficam entre 0 e 100 para valores extremos", () => {
    const extremeCases: SisvanMunicipalData[] = [
      {
        ...mockData,
        indicators: { cobertura_acompanhamento: 0, deficit_nutricional: 0, sobrepeso_infantil: 0 },
      },
      {
        ...mockData,
        indicators: {
          cobertura_acompanhamento: 100,
          deficit_nutricional: 100,
          sobrepeso_infantil: 100,
        },
      },
      {
        ...mockData,
        indicators: {
          cobertura_acompanhamento: 50,
          deficit_nutricional: 15,
          sobrepeso_infantil: 25,
        },
      },
    ];

    for (const data of extremeCases) {
      const indicators = mapToOdsIndicators(data);
      for (const ind of indicators) {
        expect(ind.score).toBeGreaterThanOrEqual(0);
        expect(ind.score).toBeLessThanOrEqual(100);
      }
    }
  });
});
