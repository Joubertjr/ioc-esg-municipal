import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/data/aneel_latest.json", () => ({
  default: {
    __meta: { referenceYear: 2023 },
    // Município médio com todos os dados
    "4204202": { geracaoDistribuidaKw: 5000.0, unidadesGd: 800, populacao: 220_000 },
    // Município pequeno com GD baixa
    "4200051": { geracaoDistribuidaKw: 80.0, unidadesGd: 15, populacao: 3_500 },
    // Apenas GD, sem unidades
    "4200101": { geracaoDistribuidaKw: 300.0, unidadesGd: null, populacao: 10_000 },
    // Ambos null — sem dados úteis
    "4200200": { geracaoDistribuidaKw: null, unidadesGd: null, populacao: 5_000 },
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

import { AneelCollector } from "../../../backend/agents/aneel/aneel_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/aneel/aneel_ods_mapper.js";
import type { AneelMunicipalData } from "../../../shared/types/agents/aneel.types.js";

// ─── AneelCollector ───────────────────────────────────────────────────────────

describe("AneelCollector", () => {
  const collector = new AneelCollector();

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
    expect(result!.indicators.geracaoDistribuidaKw).toBe(5000.0);
    expect(result!.indicators.unidadesGd).toBe(800);
    expect(result!.indicators.populacao).toBe(220_000);
  });

  it("retorna null para município inexistente (não lança erro)", async () => {
    const result = await collector.collect("9999999");
    expect(result).toBeNull();
  });

  it("retorna null quando geracaoDistribuidaKw e unidadesGd são ambos null", async () => {
    const result = await collector.collect("4200200");
    expect(result).toBeNull();
  });

  it("retorna dados quando apenas unidadesGd é null", async () => {
    const result = await collector.collect("4200101");

    expect(result).not.toBeNull();
    expect(result!.indicators.geracaoDistribuidaKw).toBe(300.0);
    expect(result!.indicators.unidadesGd).toBeNull();
    expect(result!.dataAvailable).toBe(true);
  });

  it("collectBatch retorna Map apenas com municípios encontrados", async () => {
    const result = await collector.collectBatch(["4204202", "4200051", "9999999"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.has("4204202")).toBe(true);
    expect(result.has("4200051")).toBe(true);
    expect(result.has("9999999")).toBe(false);
  });

  it("siconfiCode converte ibgeCode de 7 para 6 dígitos", async () => {
    const result = await collector.collect("4200051");
    expect(result!.siconfiCode).toBe("420005");
  });
});

// ─── ANEEL ODS Mapper ─────────────────────────────────────────────────────────

describe("ANEEL ODS Mapper — ODS 7", () => {
  const baseData: AneelMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2023,
    referenceDate: new Date("2023-12-31"),
    dataAvailable: true,
    indicators: {
      geracaoDistribuidaKw: 5000.0,
      unidadesGd: 800,
      populacao: 220_000,
    },
  };

  it("gera apenas indicadores ODS 7", () => {
    const indicators = mapToOdsIndicators(baseData);

    expect(indicators.length).toBeGreaterThan(0);
    expect(indicators.every((i) => i.odsNumber === 7)).toBe(true);
  });

  it("gera 2 indicadores quando todos os dados estão presentes", () => {
    const indicators = mapToOdsIndicators(baseData);

    expect(indicators).toHaveLength(2);
    expect(indicators.map((i) => i.indicatorName)).toContain("gd_per_capita_w");
    expect(indicators.map((i) => i.indicatorName)).toContain("penetracao_gd");
  });

  it("source é sempre 'aneel'", () => {
    const indicators = mapToOdsIndicators(baseData);
    expect(indicators.every((i) => i.source === "aneel")).toBe(true);
  });

  // ─── gd_per_capita_w scoring ─────────────────────────────────────────────

  it("score gd_per_capita_w: >= 500 W/hab → 100", () => {
    // 500 kW * 1000 / 1000 hab = 500 W/hab
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: 500, unidadesGd: null, populacao: 1_000 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "gd_per_capita_w")!;

    expect(ind.score).toBe(100);
  });

  it("score gd_per_capita_w: 100 W/hab → 50", () => {
    // 100 kW * 1000 / 1000 hab = 100 W/hab
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: 100, unidadesGd: null, populacao: 1_000 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "gd_per_capita_w")!;

    expect(ind.score).toBe(50);
  });

  it("score gd_per_capita_w: 0 W/hab → 0", () => {
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: 0, unidadesGd: null, populacao: 1_000 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "gd_per_capita_w")!;

    expect(ind.score).toBe(0);
  });

  it("score gd_per_capita_w: 300 W/hab → entre 50 e 100", () => {
    // 300 kW * 1000 / 1000 hab = 300 W/hab → 50 + ((300-100)/400)*50 = 75
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: 300, unidadesGd: null, populacao: 1_000 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "gd_per_capita_w")!;

    expect(ind.score).toBe(75);
  });

  // ─── penetracao_gd scoring ────────────────────────────────────────────────

  it("score penetracao_gd: >= 50/1000 → 100", () => {
    // 50 unidades / 1000 hab * 1000 = 50/1000
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: null, unidadesGd: 50, populacao: 1_000 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "penetracao_gd")!;

    expect(ind.score).toBe(100);
  });

  it("score penetracao_gd: 10/1000 → 50", () => {
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: null, unidadesGd: 10, populacao: 1_000 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "penetracao_gd")!;

    expect(ind.score).toBe(50);
  });

  it("score penetracao_gd: 0/1000 → 0", () => {
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: null, unidadesGd: 0, populacao: 1_000 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "penetracao_gd")!;

    expect(ind.score).toBe(0);
  });

  it("score penetracao_gd: 30/1000 → entre 50 e 100", () => {
    // 30 unidades / 1000 hab → 50 + ((30-10)/40)*50 = 75
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: null, unidadesGd: 30, populacao: 1_000 },
    };
    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "penetracao_gd")!;

    expect(ind.score).toBe(75);
  });

  // ─── nulls e edge cases ───────────────────────────────────────────────────

  it("não gera gd_per_capita_w quando geracaoDistribuidaKw é null", () => {
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: null, unidadesGd: 100, populacao: 5_000 },
    };
    const indicators = mapToOdsIndicators(data);
    const names = indicators.map((i) => i.indicatorName);

    expect(names).not.toContain("gd_per_capita_w");
    expect(names).toContain("penetracao_gd");
  });

  it("não gera penetracao_gd quando unidadesGd é null", () => {
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: 500, unidadesGd: null, populacao: 5_000 },
    };
    const indicators = mapToOdsIndicators(data);
    const names = indicators.map((i) => i.indicatorName);

    expect(names).toContain("gd_per_capita_w");
    expect(names).not.toContain("penetracao_gd");
  });

  it("não gera indicadores quando populacao é null", () => {
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: 500, unidadesGd: 100, populacao: null },
    };
    const indicators = mapToOdsIndicators(data);

    expect(indicators).toHaveLength(0);
  });

  it("status segue verde/amarelo/vermelho conforme score", () => {
    // 500 W/hab → score 100 → verde
    // 1 unidade / 10000 hab = 0.1/1000 → score ~1 → vermelho
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: 500, unidadesGd: 1, populacao: 1_000 },
    };
    const indicators = mapToOdsIndicators(data);

    const perCapita = indicators.find((i) => i.indicatorName === "gd_per_capita_w")!;
    const penetracao = indicators.find((i) => i.indicatorName === "penetracao_gd")!;

    expect(perCapita.status).toBe("verde"); // score 100
    expect(penetracao.status).toBe("vermelho"); // score < 40
  });

  it("score nunca excede 100 com valor muito alto", () => {
    const data: AneelMunicipalData = {
      ...baseData,
      indicators: { geracaoDistribuidaKw: 999_999, unidadesGd: 999_999, populacao: 1_000 },
    };
    const indicators = mapToOdsIndicators(data);

    for (const ind of indicators) {
      expect(ind.score).toBeLessThanOrEqual(100);
      expect(ind.score).toBeGreaterThanOrEqual(0);
    }
  });
});
