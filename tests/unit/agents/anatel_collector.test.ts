import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/data/anatel_2023.json", () => ({
  default: {
    // Município grande com excelente infraestrutura digital
    "4204202": { acessosBandaLargaPor100hab: 32.5, cobertura4gPercentual: 96.0 },
    // Município pequeno com conectividade média
    "4200051": { acessosBandaLargaPor100hab: 8.2, cobertura4gPercentual: 71.5 },
    // Município com banda larga no limiar e 4G alto
    "4200101": { acessosBandaLargaPor100hab: 15.0, cobertura4gPercentual: 80.0 },
    // Município com métricas intermediárias
    "4200200": { acessosBandaLargaPor100hab: 22.5, cobertura4gPercentual: 87.5 },
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

import { AnatelCollector } from "../../../backend/agents/anatel/anatel_collector.js";
import {
  mapToOdsIndicators,
  scoreBandaLarga,
  scoreCobertura4g,
} from "../../../backend/agents/anatel/anatel_ods_mapper.js";
import type { AnatelMunicipalData } from "../../../shared/types/agents/anatel.types.js";

// ─── AnatelCollector ──────────────────────────────────────────────────────────

describe("AnatelCollector", () => {
  const collector = new AnatelCollector();

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
    expect(result!.indicators.acessosBandaLargaPor100hab).toBe(32.5);
    expect(result!.indicators.cobertura4gPercentual).toBe(96.0);
  });

  it("retorna null para município inexistente (não lança erro)", async () => {
    const result = await collector.collect("9999999");
    expect(result).toBeNull();
  });

  it("siconfiCode converte ibgeCode de 7 para 6 dígitos", async () => {
    const result = await collector.collect("4200051");
    expect(result!.siconfiCode).toBe("420005");
  });

  it("referenceDate é 2023-12-31", async () => {
    const result = await collector.collect("4204202");
    expect(result!.referenceDate).toEqual(new Date("2023-12-31"));
  });

  it("collectBatch retorna Map apenas com municípios encontrados", async () => {
    const result = await collector.collectBatch(["4204202", "4200051", "9999999"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.has("4204202")).toBe(true);
    expect(result.has("4200051")).toBe(true);
    expect(result.has("9999999")).toBe(false);
  });

  it("collectBatch com lista vazia retorna Map vazio", async () => {
    const result = await collector.collectBatch([]);
    expect(result.size).toBe(0);
  });
});

// ─── ANATEL ODS Mapper ────────────────────────────────────────────────────────

describe("ANATEL ODS Mapper — ODS 9", () => {
  const baseData: AnatelMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2023,
    referenceDate: new Date("2023-12-31"),
    dataAvailable: true,
    indicators: {
      acessosBandaLargaPor100hab: 32.5,
      cobertura4gPercentual: 96.0,
    },
  };

  it("gera exatamente 2 indicadores para município com todos os dados", () => {
    const indicators = mapToOdsIndicators(baseData);
    expect(indicators).toHaveLength(2);
  });

  it("todos os indicadores pertencem ao ODS 9", () => {
    const indicators = mapToOdsIndicators(baseData);
    expect(indicators.every((i) => i.odsNumber === 9)).toBe(true);
  });

  it("gera indicadores banda_larga_por_100hab e cobertura_4g", () => {
    const indicators = mapToOdsIndicators(baseData);
    const names = indicators.map((i) => i.indicatorName);
    expect(names).toContain("banda_larga_por_100hab");
    expect(names).toContain("cobertura_4g");
  });

  it("source é sempre 'anatel'", () => {
    const indicators = mapToOdsIndicators(baseData);
    expect(indicators.every((i) => i.source === "anatel")).toBe(true);
  });

  it("status segue verde/amarelo/vermelho conforme score", () => {
    const indicators = mapToOdsIndicators(baseData);
    // 32.5 >= 30 → score 100 → verde
    // 96.0 >= 95 → score 100 → verde
    for (const ind of indicators) {
      expect(ind.status).toBe("verde");
    }
  });
});

// ─── scoreBandaLarga ──────────────────────────────────────────────────────────

describe("scoreBandaLarga", () => {
  it(">= 30/100hab → score 100", () => {
    expect(scoreBandaLarga(30)).toBe(100);
    expect(scoreBandaLarga(40)).toBe(100);
  });

  it("15/100hab → score 50 (limiar inferior da faixa alta)", () => {
    expect(scoreBandaLarga(15)).toBe(50);
  });

  it("22.5/100hab → score 75 (meio da faixa 15-30)", () => {
    // 50 + ((22.5 - 15) / 15) * 50 = 50 + 25 = 75
    expect(scoreBandaLarga(22.5)).toBe(75);
  });

  it("0/100hab → score 0", () => {
    expect(scoreBandaLarga(0)).toBe(0);
  });

  it("7.5/100hab → score 25 (meio da faixa 0-15)", () => {
    // (7.5 / 15) * 50 = 25
    expect(scoreBandaLarga(7.5)).toBe(25);
  });

  it("score nunca excede 100 com valor extremo", () => {
    expect(scoreBandaLarga(9999)).toBe(100);
  });

  it("score nunca fica negativo", () => {
    expect(scoreBandaLarga(-1)).toBe(0);
  });
});

// ─── scoreCobertura4g ─────────────────────────────────────────────────────────

describe("scoreCobertura4g", () => {
  it(">= 95% → score 100", () => {
    expect(scoreCobertura4g(95)).toBe(100);
    expect(scoreCobertura4g(100)).toBe(100);
  });

  it("80% → score 50 (limiar inferior da faixa alta)", () => {
    expect(scoreCobertura4g(80)).toBe(50);
  });

  it("87.5% → score 75 (meio da faixa 80-95)", () => {
    // 50 + ((87.5 - 80) / 15) * 50 = 50 + 25 = 75
    expect(scoreCobertura4g(87.5)).toBe(75);
  });

  it("0% → score 0", () => {
    expect(scoreCobertura4g(0)).toBe(0);
  });

  it("40% → score 25 (meio da faixa 0-80)", () => {
    // (40 / 80) * 50 = 25
    expect(scoreCobertura4g(40)).toBe(25);
  });

  it("score nunca excede 100 com valor extremo", () => {
    expect(scoreCobertura4g(200)).toBe(100);
  });
});
