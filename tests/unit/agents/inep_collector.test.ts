import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/data/ideb_2023.json", () => ({
  default: {
    "4204202": { idebAnosIniciais: 6.5, idebAnosFinais: 5.8 },
    "4200101": { idebAnosIniciais: null, idebAnosFinais: 4.2 },
    "4200051": { idebAnosIniciais: null, idebAnosFinais: null },
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

import { InepCollector } from "../../../backend/agents/inep/inep_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/inep/inep_ods_mapper.js";
import type { InepMunicipalData } from "../../../shared/types/agents/inep.types.js";

describe("InepCollector", () => {
  const collector = new InepCollector();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna dados válidos para município com IDEB", async () => {
    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.referenceYear).toBe(2023);
    expect(result!.indicators.idebAnosIniciais).toBe(6.5);
    expect(result!.indicators.idebAnosFinais).toBe(5.8);
  });

  it("retorna null para ibgeCode ausente", async () => {
    const result = await collector.collect("9999999");
    expect(result).toBeNull();
  });

  it("retorna dados quando apenas um dos índices é null", async () => {
    const result = await collector.collect("4200101");

    expect(result).not.toBeNull();
    expect(result!.indicators.idebAnosIniciais).toBeNull();
    expect(result!.indicators.idebAnosFinais).toBe(4.2);
    expect(result!.dataAvailable).toBe(true);
  });

  it("retorna null quando ambos os índices são null", async () => {
    const result = await collector.collect("4200051");
    expect(result).toBeNull();
  });

  it("collectBatch retorna Map apenas com municípios encontrados", async () => {
    const result = await collector.collectBatch(["4204202", "4200101", "9999999"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.has("4204202")).toBe(true);
    expect(result.has("4200101")).toBe(true);
    expect(result.has("9999999")).toBe(false);
  });
});

describe("INEP ODS Mapper", () => {
  const mockData: InepMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2023,
    referenceDate: new Date("2023-12-31"),
    dataAvailable: true,
    indicators: {
      idebAnosIniciais: 6.5,
      idebAnosFinais: 5.8,
    },
  };

  it("gera indicadores apenas para ODS 4", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.length).toBe(2);
    expect(indicators.every((i) => i.odsNumber === 4)).toBe(true);
  });

  it("score: IDEB 7.0 → 100", () => {
    const data: InepMunicipalData = {
      ...mockData,
      indicators: { idebAnosIniciais: 7.0, idebAnosFinais: null },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_iniciais")!;
    expect(ind.score).toBe(100);
  });

  it("score: IDEB 4.0 → 50", () => {
    const data: InepMunicipalData = {
      ...mockData,
      indicators: { idebAnosIniciais: 4.0, idebAnosFinais: null },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_iniciais")!;
    expect(ind.score).toBe(50);
  });

  it("score: IDEB 0 → 0", () => {
    const data: InepMunicipalData = {
      ...mockData,
      indicators: { idebAnosIniciais: 0, idebAnosFinais: null },
    };
    const indicators = mapToOdsIndicators(data);

    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_iniciais")!;
    expect(ind.score).toBe(0);
  });

  it("não gera indicador quando valor é null", () => {
    const data: InepMunicipalData = {
      ...mockData,
      indicators: { idebAnosIniciais: null, idebAnosFinais: null },
    };
    const indicators = mapToOdsIndicators(data);

    expect(indicators).toHaveLength(0);
  });

  it("source é sempre 'inep'", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.every((i) => i.source === "inep")).toBe(true);
  });

  it("status segue verde/amarelo/vermelho conforme score", () => {
    // 6.5 → score = 50 + ((6.5 - 4.0) / 3.0) * 50 = 50 + 41.67 ≈ 92 → verde
    const data: InepMunicipalData = {
      ...mockData,
      indicators: {
        idebAnosIniciais: 6.5,  // score ~92 → verde
        idebAnosFinais: 3.0,    // score = (3.0 / 4.0) * 50 = 37.5 → vermelho
      },
    };
    const indicators = mapToOdsIndicators(data);

    const iniciais = indicators.find((i) => i.indicatorName === "ideb_anos_iniciais")!;
    const finais = indicators.find((i) => i.indicatorName === "ideb_anos_finais")!;

    expect(iniciais.status).toBe("verde");
    expect(finais.status).toBe("vermelho");
  });
});
