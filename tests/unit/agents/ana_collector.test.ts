import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/data/ana_2022.json", () => ({
  default: {
    // Município com todos os dados presentes
    "4204202": { iqaRios: 75.0, mataCiliarPct: 62.0 },
    // Município com apenas iqaRios
    "4200051": { iqaRios: 45.0, mataCiliarPct: null },
    // Município com apenas mataCiliarPct
    "4200101": { iqaRios: null, mataCiliarPct: 85.0 },
    // Ambos null — sem dados úteis
    "4200200": { iqaRios: null, mataCiliarPct: null },
    // IQA perfeito — score máximo
    "4299901": { iqaRios: 100.0, mataCiliarPct: 100.0 },
    // IQA zero — score mínimo
    "4299902": { iqaRios: 0.0, mataCiliarPct: 0.0 },
    // IQA exato no limite de 80 — deve retornar 100
    "4299903": { iqaRios: 80.0, mataCiliarPct: 80.0 },
    // IQA exato em 50 — deve retornar 50
    "4299904": { iqaRios: 50.0, mataCiliarPct: 40.0 },
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

import { AnaCollector } from "../../../backend/agents/ana/ana_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/ana/ana_ods_mapper.js";
import type { AnaMunicipalData } from "../../../shared/types/agents/ana.types.js";

// ─── AnaCollector ─────────────────────────────────────────────────────────────

describe("AnaCollector", () => {
  const collector = new AnaCollector();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna dados válidos para município SC existente", async () => {
    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.referenceYear).toBe(2022);
    expect(result!.indicators.iqaRios).toBe(75.0);
    expect(result!.indicators.mataCiliarPct).toBe(62.0);
  });

  it("retorna null para município inexistente no dataset", async () => {
    const result = await collector.collect("9999999");

    expect(result).toBeNull();
  });

  it("retorna null quando iqaRios e mataCiliarPct são ambos null", async () => {
    const result = await collector.collect("4200200");

    expect(result).toBeNull();
  });

  it("retorna dados quando apenas iqaRios está presente", async () => {
    const result = await collector.collect("4200051");

    expect(result).not.toBeNull();
    expect(result!.indicators.iqaRios).toBe(45.0);
    expect(result!.indicators.mataCiliarPct).toBeNull();
    expect(result!.dataAvailable).toBe(true);
  });

  it("retorna dados quando apenas mataCiliarPct está presente", async () => {
    const result = await collector.collect("4200101");

    expect(result).not.toBeNull();
    expect(result!.indicators.iqaRios).toBeNull();
    expect(result!.indicators.mataCiliarPct).toBe(85.0);
    expect(result!.dataAvailable).toBe(true);
  });

  it("retorna null para ibgeCode string vazia", async () => {
    const result = await collector.collect("");

    expect(result).toBeNull();
  });

  it("referenceDate é 2022-12-31", async () => {
    const result = await collector.collect("4204202");

    expect(result!.referenceDate).toEqual(new Date("2022-12-31"));
  });

  it("siconfiCode converte ibgeCode de 7 para 6 dígitos", async () => {
    const result = await collector.collect("4200051");

    expect(result!.siconfiCode).toBe("420005");
  });

  it("tipos dos campos retornados são corretos", async () => {
    const result = await collector.collect("4204202");

    expect(typeof result!.ibgeCode).toBe("string");
    expect(typeof result!.siconfiCode).toBe("string");
    expect(typeof result!.referenceYear).toBe("number");
    expect(result!.referenceDate).toBeInstanceOf(Date);
    expect(typeof result!.dataAvailable).toBe("boolean");
    expect(typeof result!.indicators.iqaRios).toBe("number");
    expect(typeof result!.indicators.mataCiliarPct).toBe("number");
  });

  it("collect() retorna uma Promise resolvida", async () => {
    const promise = collector.collect("4204202");

    await expect(promise).resolves.not.toThrow();
  });

  it("collectBatch retorna Map com municípios que têm dados", async () => {
    const result = await collector.collectBatch([
      "4204202",
      "4200051",
      "4200101",
      "4200200",
      "9999999",
    ]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(3);
    expect(result.has("4204202")).toBe(true);
    expect(result.has("4200051")).toBe(true);
    expect(result.has("4200101")).toBe(true);
    expect(result.has("4200200")).toBe(false);
    expect(result.has("9999999")).toBe(false);
  });

  it("collectBatch com lista vazia retorna Map vazio", async () => {
    const result = await collector.collectBatch([]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});

// ─── ANA ODS Mapper ───────────────────────────────────────────────────────────

describe("ANA ODS Mapper — ODS 14", () => {
  const baseData: AnaMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2022,
    referenceDate: new Date("2022-12-31"),
    dataAvailable: true,
    indicators: {
      iqaRios: 75.0,
      mataCiliarPct: 62.0,
    },
  };

  it("gera apenas indicadores ODS 14", () => {
    const indicators = mapToOdsIndicators(baseData);

    expect(indicators.length).toBeGreaterThan(0);
    expect(indicators.every((i) => i.odsNumber === 14)).toBe(true);
  });

  it("gera 2 indicadores quando todos os dados estão presentes", () => {
    const indicators = mapToOdsIndicators(baseData);

    expect(indicators).toHaveLength(2);
    expect(indicators.map((i) => i.indicatorName)).toContain("iqa_rios");
    expect(indicators.map((i) => i.indicatorName)).toContain("mata_ciliar");
  });

  it("source é sempre 'ana'", () => {
    const indicators = mapToOdsIndicators(baseData);

    expect(indicators.every((i) => i.source === "ana")).toBe(true);
  });

  it("não gera iqa_rios quando iqaRios é null", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: null, mataCiliarPct: 62.0 },
    };

    const indicators = mapToOdsIndicators(data);
    const names = indicators.map((i) => i.indicatorName);

    expect(names).not.toContain("iqa_rios");
    expect(names).toContain("mata_ciliar");
  });

  it("não gera mata_ciliar quando mataCiliarPct é null", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: 75.0, mataCiliarPct: null },
    };

    const indicators = mapToOdsIndicators(data);
    const names = indicators.map((i) => i.indicatorName);

    expect(names).toContain("iqa_rios");
    expect(names).not.toContain("mata_ciliar");
  });

  it("retorna array vazio quando ambos os indicadores são null", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: null, mataCiliarPct: null },
    };

    const indicators = mapToOdsIndicators(data);

    expect(indicators).toHaveLength(0);
  });

  // ─── iqa_rios scoring ─────────────────────────────────────────────────────

  it("score iqa_rios: >= 80 (ótimo CETESB) → 100", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: 80, mataCiliarPct: null },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "iqa_rios")!;

    expect(ind.score).toBe(100);
  });

  it("score iqa_rios: 100 (máximo) → 100", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: 100, mataCiliarPct: null },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "iqa_rios")!;

    expect(ind.score).toBe(100);
  });

  it("score iqa_rios: 50 (limite inferior da faixa bom) → 50", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: 50, mataCiliarPct: null },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "iqa_rios")!;

    expect(ind.score).toBe(50);
  });

  it("score iqa_rios: 65 (meio da faixa 50-80) → entre 50 e 100", () => {
    // 50 + ((65-50)/30)*50 = 50 + (15/30)*50 = 50 + 25 = 75
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: 65, mataCiliarPct: null },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "iqa_rios")!;

    expect(ind.score).toBe(75);
  });

  it("score iqa_rios: 0 (mínimo) → 0", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: 0, mataCiliarPct: null },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "iqa_rios")!;

    expect(ind.score).toBe(0);
  });

  it("score iqa_rios: 25 (meio da faixa 0-50) → 25", () => {
    // (25/50)*50 = 25
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: 25, mataCiliarPct: null },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "iqa_rios")!;

    expect(ind.score).toBe(25);
  });

  // ─── mata_ciliar scoring ──────────────────────────────────────────────────

  it("score mata_ciliar: >= 80% (excelente) → 100", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: null, mataCiliarPct: 80 },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "mata_ciliar")!;

    expect(ind.score).toBe(100);
  });

  it("score mata_ciliar: 100% (máximo) → 100", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: null, mataCiliarPct: 100 },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "mata_ciliar")!;

    expect(ind.score).toBe(100);
  });

  it("score mata_ciliar: 40% (limite inferior da faixa boa) → 50", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: null, mataCiliarPct: 40 },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "mata_ciliar")!;

    expect(ind.score).toBe(50);
  });

  it("score mata_ciliar: 60% (meio da faixa 40-80) → entre 50 e 100", () => {
    // 50 + ((60-40)/40)*50 = 50 + (20/40)*50 = 50 + 25 = 75
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: null, mataCiliarPct: 60 },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "mata_ciliar")!;

    expect(ind.score).toBe(75);
  });

  it("score mata_ciliar: 0% (sem cobertura) → 0", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: null, mataCiliarPct: 0 },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "mata_ciliar")!;

    expect(ind.score).toBe(0);
  });

  it("score mata_ciliar: 20% (meio da faixa 0-40) → 25", () => {
    // (20/40)*50 = 25
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: null, mataCiliarPct: 20 },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "mata_ciliar")!;

    expect(ind.score).toBe(25);
  });

  // ─── status verde/amarelo/vermelho ────────────────────────────────────────

  it("status verde para score >= 70", () => {
    // iqaRios 80 → score 100 → verde
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: 80, mataCiliarPct: null },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "iqa_rios")!;

    expect(ind.status).toBe("verde");
  });

  it("status amarelo para score entre 40 e 69", () => {
    // iqaRios 50 → score 50 → amarelo
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: 50, mataCiliarPct: null },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "iqa_rios")!;

    expect(ind.status).toBe("amarelo");
  });

  it("status vermelho para score < 40", () => {
    // iqaRios 25 → score 25 → vermelho
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: 25, mataCiliarPct: null },
    };

    const indicators = mapToOdsIndicators(data);
    const ind = indicators.find((i) => i.indicatorName === "iqa_rios")!;

    expect(ind.status).toBe("vermelho");
  });

  it("scores ficam entre 0 e 100 em todos os casos", () => {
    const indicators = mapToOdsIndicators(baseData);

    for (const ind of indicators) {
      expect(ind.score).toBeGreaterThanOrEqual(0);
      expect(ind.score).toBeLessThanOrEqual(100);
    }
  });

  it("score não excede 100 com valores extremos", () => {
    const data: AnaMunicipalData = {
      ...baseData,
      indicators: { iqaRios: 100, mataCiliarPct: 100 },
    };

    const indicators = mapToOdsIndicators(data);

    for (const ind of indicators) {
      expect(ind.score).toBeLessThanOrEqual(100);
      expect(ind.score).toBeGreaterThanOrEqual(0);
    }
  });

  it("indicadores têm os nomes corretos", () => {
    const indicators = mapToOdsIndicators(baseData);
    const names = indicators.map((i) => i.indicatorName);

    expect(names).toContain("iqa_rios");
    expect(names).toContain("mata_ciliar");
  });

  it("indicadores têm municipalityId correto", () => {
    const indicators = mapToOdsIndicators(baseData);

    expect(indicators.every((i) => i.municipalityId === "4204202")).toBe(true);
  });

  it("indicadores têm referenceYear e referenceDate corretos", () => {
    const indicators = mapToOdsIndicators(baseData);

    expect(indicators.every((i) => i.referenceYear === 2022)).toBe(true);
    expect(indicators.every((i) => i.referenceDate.getFullYear() === 2022)).toBe(true);
  });

  it("dataAvailable é true em todos os indicadores gerados", () => {
    const indicators = mapToOdsIndicators(baseData);

    expect(indicators.every((i) => i.dataAvailable === true)).toBe(true);
  });
});
