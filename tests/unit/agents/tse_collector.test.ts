import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/data/tse_2024.json", () => ({
  default: {
    // Município com todos os dados presentes
    "4204202": { pctMulheresEleitas: 40.0, pctCandidatasMulheres: 41.5 },
    // Apenas pctCandidatasMulheres presente
    "4200051": { pctMulheresEleitas: null, pctCandidatasMulheres: 34.7 },
    // Apenas pctMulheresEleitas presente
    "4200101": { pctMulheresEleitas: 50.0, pctCandidatasMulheres: null },
    // Ambos null — sem dados úteis
    "4200200": { pctMulheresEleitas: null, pctCandidatasMulheres: null },
    // Paridade plena em ambos
    "4200309": { pctMulheresEleitas: 100.0, pctCandidatasMulheres: 100.0 },
    // Valores zero
    "4200408": { pctMulheresEleitas: 0.0, pctCandidatasMulheres: 0.0 },
    // Exatamente nos limiares de transição de score
    "4200507": { pctMulheresEleitas: 30.0, pctCandidatasMulheres: 33.0 },
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

import { TseCollector } from "../../../backend/agents/tse/tse_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/tse/tse_ods_mapper.js";
import type { TseMunicipalData } from "../../../shared/types/agents/tse.types.js";

// ─── TseCollector ─────────────────────────────────────────────────────────────

describe("TseCollector", () => {
  const collector = new TseCollector();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna dados válidos para município existente com ambos os indicadores", async () => {
    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.referenceYear).toBe(2024);
    expect(result!.indicators.pctMulheresEleitas).toBe(40.0);
    expect(result!.indicators.pctCandidatasMulheres).toBe(41.5);
  });

  it("retorna null para município inexistente (não lança erro)", async () => {
    const result = await collector.collect("9999999");
    expect(result).toBeNull();
  });

  it("retorna null quando pctMulheresEleitas e pctCandidatasMulheres são ambos null", async () => {
    const result = await collector.collect("4200200");
    expect(result).toBeNull();
  });

  it("retorna dados quando apenas pctCandidatasMulheres está presente", async () => {
    const result = await collector.collect("4200051");

    expect(result).not.toBeNull();
    expect(result!.indicators.pctMulheresEleitas).toBeNull();
    expect(result!.indicators.pctCandidatasMulheres).toBe(34.7);
    expect(result!.dataAvailable).toBe(true);
  });

  it("retorna dados quando apenas pctMulheresEleitas está presente", async () => {
    const result = await collector.collect("4200101");

    expect(result).not.toBeNull();
    expect(result!.indicators.pctMulheresEleitas).toBe(50.0);
    expect(result!.indicators.pctCandidatasMulheres).toBeNull();
    expect(result!.dataAvailable).toBe(true);
  });

  it("siconfiCode converte ibgeCode de 7 para 6 dígitos (remove dígito verificador)", async () => {
    const result = await collector.collect("4200051");
    expect(result!.siconfiCode).toBe("420005");
  });

  it("referenceDate corresponde ao 1º turno das eleições municipais 2024", async () => {
    const result = await collector.collect("4204202");

    const expectedDate = new Date("2024-10-06");
    expect(result!.referenceDate).toEqual(expectedDate);
  });

  it("collectBatch retorna Map apenas com municípios encontrados", async () => {
    const result = await collector.collectBatch(["4204202", "4200051", "9999999"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.has("4204202")).toBe(true);
    expect(result.has("4200051")).toBe(true);
    expect(result.has("9999999")).toBe(false);
  });

  it("collectBatch exclui municípios com ambos os indicadores null", async () => {
    const result = await collector.collectBatch(["4204202", "4200200"]);

    expect(result.size).toBe(1);
    expect(result.has("4204202")).toBe(true);
    expect(result.has("4200200")).toBe(false);
  });

  it("collectBatch com lista vazia retorna Map vazio", async () => {
    const result = await collector.collectBatch([]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});

// ─── TSE ODS Mapper — ODS 5 ───────────────────────────────────────────────────

describe("TSE ODS Mapper — ODS 5", () => {
  const baseData: TseMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2024,
    referenceDate: new Date("2024-10-06"),
    dataAvailable: true,
    indicators: {
      pctMulheresEleitas: 40.0,
      pctCandidatasMulheres: 41.5,
    },
  };

  it("gera apenas indicadores ODS 5", () => {
    const indicators = mapToOdsIndicators(baseData);

    expect(indicators.length).toBeGreaterThan(0);
    expect(indicators.every((i) => i.odsNumber === 5)).toBe(true);
  });

  it("gera 2 indicadores quando ambos os dados estão presentes", () => {
    const indicators = mapToOdsIndicators(baseData);

    expect(indicators).toHaveLength(2);
    expect(indicators.map((i) => i.indicatorName)).toContain("pct_mulheres_eleitas");
    expect(indicators.map((i) => i.indicatorName)).toContain("pct_candidatas_mulheres");
  });

  it("source é sempre 'tse'", () => {
    const indicators = mapToOdsIndicators(baseData);
    expect(indicators.every((i) => i.source === "tse")).toBe(true);
  });

  it("dataAvailable é true em todos os indicadores gerados", () => {
    const indicators = mapToOdsIndicators(baseData);
    expect(indicators.every((i) => i.dataAvailable === true)).toBe(true);
  });

  it("municipalityId corresponde ao ibgeCode do dado de entrada", () => {
    const indicators = mapToOdsIndicators(baseData);
    expect(indicators.every((i) => i.municipalityId === "4204202")).toBe(true);
  });

  // ─── pct_mulheres_eleitas scoring ─────────────────────────────────────────

  it("score pct_mulheres_eleitas: 0% → 0", () => {
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 0, pctCandidatasMulheres: null },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_mulheres_eleitas")!;

    expect(ind.score).toBe(0);
  });

  it("score pct_mulheres_eleitas: 15% → 25 (interpolação abaixo de 30%)", () => {
    // (15/30) * 50 = 25
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 15, pctCandidatasMulheres: null },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_mulheres_eleitas")!;

    expect(ind.score).toBe(25);
  });

  it("score pct_mulheres_eleitas: 30% → 50 (limiar da cota legal)", () => {
    // Exatamente no limiar: (30/30)*50 = 50 ou 50+((30-30)/20)*50 = 50
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 30, pctCandidatasMulheres: null },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_mulheres_eleitas")!;

    expect(ind.score).toBe(50);
  });

  it("score pct_mulheres_eleitas: 40% → 75 (interpolação entre 30% e 50%)", () => {
    // 50 + ((40-30)/20)*50 = 50 + 25 = 75
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 40, pctCandidatasMulheres: null },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_mulheres_eleitas")!;

    expect(ind.score).toBe(75);
  });

  it("score pct_mulheres_eleitas: >= 50% → 100 (paridade plena)", () => {
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 50, pctCandidatasMulheres: null },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_mulheres_eleitas")!;

    expect(ind.score).toBe(100);
  });

  it("score pct_mulheres_eleitas: 100% → 100 (clampado, não excede máximo)", () => {
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 100, pctCandidatasMulheres: null },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_mulheres_eleitas")!;

    expect(ind.score).toBe(100);
  });

  // ─── pct_candidatas_mulheres scoring ──────────────────────────────────────

  it("score pct_candidatas_mulheres: 0% → 0", () => {
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: null, pctCandidatasMulheres: 0 },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_candidatas_mulheres")!;

    expect(ind.score).toBe(0);
  });

  it("score pct_candidatas_mulheres: 33% → 50 (limiar da cota legal)", () => {
    // (33/33)*50 = 50 ou 50+((33-33)/17)*50 = 50
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: null, pctCandidatasMulheres: 33 },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_candidatas_mulheres")!;

    expect(ind.score).toBe(50);
  });

  it("score pct_candidatas_mulheres: 41.5% → 75 (interpolação entre 33% e 50%)", () => {
    // 50 + ((41.5-33)/17)*50 = 50 + (8.5/17)*50 = 50 + 25 = 75
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: null, pctCandidatasMulheres: 41.5 },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_candidatas_mulheres")!;

    expect(ind.score).toBe(75);
  });

  it("score pct_candidatas_mulheres: >= 50% → 100 (paridade nas candidaturas)", () => {
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: null, pctCandidatasMulheres: 50 },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_candidatas_mulheres")!;

    expect(ind.score).toBe(100);
  });

  it("score pct_candidatas_mulheres: 100% → 100 (clampado, não excede máximo)", () => {
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: null, pctCandidatasMulheres: 100 },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_candidatas_mulheres")!;

    expect(ind.score).toBe(100);
  });

  // ─── Status verde/amarelo/vermelho ────────────────────────────────────────

  it("status 'verde' quando score >= 70", () => {
    // pct=40% → score 75 → verde
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 40, pctCandidatasMulheres: null },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_mulheres_eleitas")!;

    expect(ind.status).toBe("verde");
  });

  it("status 'amarelo' quando score está entre 40 e 69", () => {
    // pct=30% → score 50 → amarelo
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 30, pctCandidatasMulheres: null },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_mulheres_eleitas")!;

    expect(ind.status).toBe("amarelo");
  });

  it("status 'vermelho' quando score < 40", () => {
    // pct=15% → score 25 → vermelho
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 15, pctCandidatasMulheres: null },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "pct_mulheres_eleitas")!;

    expect(ind.status).toBe("vermelho");
  });

  // ─── Indicadores condicionais (null) ──────────────────────────────────────

  it("não gera pct_mulheres_eleitas quando o indicador é null", () => {
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: null, pctCandidatasMulheres: 41.5 },
    };
    const names = mapToOdsIndicators(data).map((i) => i.indicatorName);

    expect(names).not.toContain("pct_mulheres_eleitas");
    expect(names).toContain("pct_candidatas_mulheres");
  });

  it("não gera pct_candidatas_mulheres quando o indicador é null", () => {
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 40.0, pctCandidatasMulheres: null },
    };
    const names = mapToOdsIndicators(data).map((i) => i.indicatorName);

    expect(names).toContain("pct_mulheres_eleitas");
    expect(names).not.toContain("pct_candidatas_mulheres");
  });

  it("retorna lista vazia quando ambos os indicadores são null", () => {
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: null, pctCandidatasMulheres: null },
    };
    const indicators = mapToOdsIndicators(data);

    expect(indicators).toHaveLength(0);
  });

  it("score nunca excede 100 com valores extremamente altos", () => {
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 100, pctCandidatasMulheres: 100 },
    };
    const indicators = mapToOdsIndicators(data);

    for (const ind of indicators) {
      expect(ind.score).toBeLessThanOrEqual(100);
      expect(ind.score).toBeGreaterThanOrEqual(0);
    }
  });

  it("score nunca é negativo com valor zero", () => {
    const data: TseMunicipalData = {
      ...baseData,
      indicators: { pctMulheresEleitas: 0, pctCandidatasMulheres: 0 },
    };
    const indicators = mapToOdsIndicators(data);

    for (const ind of indicators) {
      expect(ind.score).toBeGreaterThanOrEqual(0);
    }
  });
});
