import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/data/snis_2022.json", () => ({
  default: {
    "4204202": {
      atendimentoAgua: 99.1,
      atendimentoEsgoto: 88.7,
      esgotoTratado: 95.2,
      perdaFaturamento: 18.4,
    },
    "4200101": {
      atendimentoAgua: 72.0,
      atendimentoEsgoto: null,
      esgotoTratado: null,
      perdaFaturamento: 42.5,
    },
    "4200051": {
      atendimentoAgua: null,
      atendimentoEsgoto: null,
      esgotoTratado: null,
      perdaFaturamento: null,
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

import { SnisCollector } from "../../../backend/agents/snis/snis_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/snis/snis_ods_mapper.js";
import type { SnisMunicipalData } from "../../../shared/types/agents/snis.types.js";

describe("SnisCollector", () => {
  const collector = new SnisCollector();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna dados para município cadastrado", async () => {
    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.referenceYear).toBe(2022);
    expect(result!.indicators.atendimentoAgua).toBe(99.1);
    expect(result!.indicators.atendimentoEsgoto).toBe(88.7);
    expect(result!.indicators.esgotoTratado).toBe(95.2);
    expect(result!.indicators.perdaFaturamento).toBe(18.4);
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
    expect(result!.indicators.atendimentoAgua).toBe(72.0);
    expect(result!.indicators.atendimentoEsgoto).toBeNull();
    expect(result!.indicators.esgotoTratado).toBeNull();
    expect(result!.indicators.perdaFaturamento).toBe(42.5);
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

describe("SNIS ODS Mapper", () => {
  const mockData: SnisMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2022,
    referenceDate: new Date("2022-12-31"),
    dataAvailable: true,
    indicators: {
      atendimentoAgua: 99.1,
      atendimentoEsgoto: 88.7,
      esgotoTratado: 95.2,
      perdaFaturamento: 18.4,
    },
  };

  it("gera indicadores apenas para ODS 6", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.length).toBe(4);
    expect(indicators.every((i) => i.odsNumber === 6)).toBe(true);
  });

  it("source é sempre 'snis'", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.every((i) => i.source === "snis")).toBe(true);
  });

  it("atendimentoAgua >= 95% recebe score 100", () => {
    const indicators = mapToOdsIndicators(mockData); // atendimentoAgua = 99.1

    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_agua")!;
    expect(ind.score).toBe(100);
  });

  it("perdaFaturamento <= 15% recebe score 100", () => {
    const data: SnisMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, perdaFaturamento: 10 },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_perda_faturamento")!;
    expect(ind.score).toBe(100);
  });

  it("perdaFaturamento alto resulta em score baixo (indicador invertido)", () => {
    const data: SnisMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, perdaFaturamento: 55 },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_perda_faturamento")!;
    expect(ind.score).toBeLessThan(40);
  });

  it("perdaFaturamento muito alto é clamped a 0", () => {
    const data: SnisMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, perdaFaturamento: 80 },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_perda_faturamento")!;
    expect(ind.score).toBe(0);
  });

  it("não gera indicador para campo null", () => {
    const data: SnisMunicipalData = {
      ...mockData,
      indicators: {
        atendimentoAgua: null,
        atendimentoEsgoto: null,
        esgotoTratado: null,
        perdaFaturamento: null,
      },
    };

    const indicators = mapToOdsIndicators(data);
    expect(indicators).toHaveLength(0);
  });

  it("status segue regra verde >= 70, amarelo >= 40, vermelho < 40", () => {
    const indicators = mapToOdsIndicators(mockData);

    // atendimentoAgua 99.1 → score 100 → verde
    const agua = indicators.find((i) => i.indicatorName === "snis_atendimento_agua")!;
    expect(agua.status).toBe("verde");

    // perdaFaturamento 18.4% → score entre 50-100 → verde
    const perda = indicators.find((i) => i.indicatorName === "snis_perda_faturamento")!;
    expect(perda.score).toBeGreaterThanOrEqual(40);

    // esgotoTratado 95.2 → score 100 → verde
    const esgoto = indicators.find((i) => i.indicatorName === "snis_esgoto_tratado")!;
    expect(esgoto.status).toBe("verde");
  });

  it("scores ficam entre 0 e 100", () => {
    const indicators = mapToOdsIndicators(mockData);

    for (const ind of indicators) {
      expect(ind.score).toBeGreaterThanOrEqual(0);
      expect(ind.score).toBeLessThanOrEqual(100);
    }
  });

  it("indicadores têm nomes corretos", () => {
    const indicators = mapToOdsIndicators(mockData);
    const names = indicators.map((i) => i.indicatorName);

    expect(names).toContain("snis_atendimento_agua");
    expect(names).toContain("snis_atendimento_esgoto");
    expect(names).toContain("snis_esgoto_tratado");
    expect(names).toContain("snis_perda_faturamento");
  });
});
