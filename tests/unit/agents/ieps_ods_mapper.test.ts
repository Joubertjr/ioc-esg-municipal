import { describe, it, expect } from "vitest";
import { mapToOdsIndicators } from "../../../backend/agents/ieps/ieps_ods_mapper.js";
import type { IepsMunicipalData } from "../../../shared/types/agents/ieps.types.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_DATE = new Date("2021-12-31");

function makeData(overrides: Partial<IepsMunicipalData["indicators"]> = {}): IepsMunicipalData {
  return {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2021,
    referenceDate: BASE_DATE,
    dataAvailable: true,
    indicators: {
      mortalidadeInfantil: 9.5,
      coberturaEsf: 82.0,
      coberturaVacinal: 75.0,
      internacoesCsap: 900.0,
      gastoSaudePerCapita: 850.0,
      prenatalAdequado: 72.0,
      ...overrides,
    },
  };
}

// ─── Happy path ──────────────────────────────────────────────────────────────

describe("ieps_ods_mapper — happy path", () => {
  it("deve retornar 6 indicadores quando todos os dados estão presentes", () => {
    const result = mapToOdsIndicators(makeData());
    expect(result).toHaveLength(6);
  });

  it("deve mapear todos os indicadores para ODS 3", () => {
    const result = mapToOdsIndicators(makeData());
    result.forEach((ind) => {
      expect(ind.odsNumber).toBe(3);
    });
  });

  it("deve definir source como 'ieps' em todos os indicadores", () => {
    const result = mapToOdsIndicators(makeData());
    result.forEach((ind) => {
      expect(ind.source).toBe("ieps");
    });
  });

  it("deve retornar scores inteiros entre 0 e 100", () => {
    const result = mapToOdsIndicators(makeData());
    result.forEach((ind) => {
      expect(ind.score).toBeGreaterThanOrEqual(0);
      expect(ind.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(ind.score)).toBe(true);
    });
  });

  it("deve incluir os 6 indicadores IEPS esperados", () => {
    const result = mapToOdsIndicators(makeData());
    const names = result.map((i) => i.indicatorName).sort();
    expect(names).toEqual([
      "ieps_cobertura_esf",
      "ieps_cobertura_vacinal",
      "ieps_gasto_saude_pc",
      "ieps_internacoes_csap",
      "ieps_mortalidade_infantil",
      "ieps_prenatal_adequado",
    ]);
  });
});

// ─── scoreMortalidadeInfantil (invertido: menor = melhor) ────────────────────

describe("ieps_ods_mapper — mortalidade infantil", () => {
  it("score 100 quando taxa <= 8 (excelente)", () => {
    const ind = mapToOdsIndicators(makeData({ mortalidadeInfantil: 5.0 })).find(
      (i) => i.indicatorName === "ieps_mortalidade_infantil",
    )!;
    expect(ind.score).toBe(100);
  });

  it("score 100 quando taxa == 8 (fronteira)", () => {
    const ind = mapToOdsIndicators(makeData({ mortalidadeInfantil: 8.0 })).find(
      (i) => i.indicatorName === "ieps_mortalidade_infantil",
    )!;
    expect(ind.score).toBe(100);
  });

  it("score entre 70 e 100 quando taxa 8-12", () => {
    const ind = mapToOdsIndicators(makeData({ mortalidadeInfantil: 10.0 })).find(
      (i) => i.indicatorName === "ieps_mortalidade_infantil",
    )!;
    expect(ind.score).toBeGreaterThanOrEqual(70);
    expect(ind.score).toBeLessThanOrEqual(100);
  });

  it("score 70 quando taxa == 12 (meta ODS)", () => {
    const ind = mapToOdsIndicators(makeData({ mortalidadeInfantil: 12.0 })).find(
      (i) => i.indicatorName === "ieps_mortalidade_infantil",
    )!;
    expect(ind.score).toBe(70);
  });

  it("score entre 30 e 70 quando taxa 12-25", () => {
    const ind = mapToOdsIndicators(makeData({ mortalidadeInfantil: 18.0 })).find(
      (i) => i.indicatorName === "ieps_mortalidade_infantil",
    )!;
    expect(ind.score).toBeGreaterThanOrEqual(30);
    expect(ind.score).toBeLessThan(70);
  });

  it("score 0 quando taxa >= 50 (crítico)", () => {
    const ind = mapToOdsIndicators(makeData({ mortalidadeInfantil: 55.0 })).find(
      (i) => i.indicatorName === "ieps_mortalidade_infantil",
    )!;
    expect(ind.score).toBe(0);
  });
});

// ─── scoreCoberturaPercentual (ESF/pré-natal) ───────────────────────────────

describe("ieps_ods_mapper — cobertura ESF", () => {
  it("score 100 quando cobertura >= 90%", () => {
    const ind = mapToOdsIndicators(makeData({ coberturaEsf: 95.0 })).find(
      (i) => i.indicatorName === "ieps_cobertura_esf",
    )!;
    expect(ind.score).toBe(100);
  });

  it("score entre 70 e 100 quando cobertura 70-90%", () => {
    const ind = mapToOdsIndicators(makeData({ coberturaEsf: 80.0 })).find(
      (i) => i.indicatorName === "ieps_cobertura_esf",
    )!;
    expect(ind.score).toBeGreaterThanOrEqual(70);
    expect(ind.score).toBeLessThanOrEqual(100);
  });

  it("score entre 30 e 70 quando cobertura 40-70%", () => {
    const ind = mapToOdsIndicators(makeData({ coberturaEsf: 55.0 })).find(
      (i) => i.indicatorName === "ieps_cobertura_esf",
    )!;
    expect(ind.score).toBeGreaterThanOrEqual(30);
    expect(ind.score).toBeLessThan(70);
  });

  it("score < 30 quando cobertura < 40%", () => {
    const ind = mapToOdsIndicators(makeData({ coberturaEsf: 20.0 })).find(
      (i) => i.indicatorName === "ieps_cobertura_esf",
    )!;
    expect(ind.score).toBeLessThan(30);
  });
});

// ─── scoreCoberturaVacinal ──────────────────────────────────────────────────

describe("ieps_ods_mapper — cobertura vacinal", () => {
  it("score 100 quando cobertura >= 95% (meta OMS)", () => {
    const ind = mapToOdsIndicators(makeData({ coberturaVacinal: 97.0 })).find(
      (i) => i.indicatorName === "ieps_cobertura_vacinal",
    )!;
    expect(ind.score).toBe(100);
  });

  it("score entre 70 e 100 quando cobertura 80-95%", () => {
    const ind = mapToOdsIndicators(makeData({ coberturaVacinal: 88.0 })).find(
      (i) => i.indicatorName === "ieps_cobertura_vacinal",
    )!;
    expect(ind.score).toBeGreaterThanOrEqual(70);
    expect(ind.score).toBeLessThanOrEqual(100);
  });

  it("score < 30 quando cobertura < 50%", () => {
    const ind = mapToOdsIndicators(makeData({ coberturaVacinal: 35.0 })).find(
      (i) => i.indicatorName === "ieps_cobertura_vacinal",
    )!;
    expect(ind.score).toBeLessThan(30);
  });
});

// ─── scoreInternacoesCsap (invertido) ───────────────────────────────────────

describe("ieps_ods_mapper — internações CSAP", () => {
  it("score 100 quando taxa <= 500 (excelente APS)", () => {
    const ind = mapToOdsIndicators(makeData({ internacoesCsap: 300.0 })).find(
      (i) => i.indicatorName === "ieps_internacoes_csap",
    )!;
    expect(ind.score).toBe(100);
  });

  it("score entre 70 e 100 quando taxa 500-1000", () => {
    const ind = mapToOdsIndicators(makeData({ internacoesCsap: 750.0 })).find(
      (i) => i.indicatorName === "ieps_internacoes_csap",
    )!;
    expect(ind.score).toBeGreaterThanOrEqual(70);
    expect(ind.score).toBeLessThanOrEqual(100);
  });

  it("score entre 30 e 70 quando taxa 1000-2000", () => {
    const ind = mapToOdsIndicators(makeData({ internacoesCsap: 1500.0 })).find(
      (i) => i.indicatorName === "ieps_internacoes_csap",
    )!;
    expect(ind.score).toBeGreaterThanOrEqual(30);
    expect(ind.score).toBeLessThan(70);
  });

  it("score 0 quando taxa >= 4000", () => {
    const ind = mapToOdsIndicators(makeData({ internacoesCsap: 5000.0 })).find(
      (i) => i.indicatorName === "ieps_internacoes_csap",
    )!;
    expect(ind.score).toBe(0);
  });
});

// ─── scoreGastoSaudePerCapita ───────────────────────────────────────────────

describe("ieps_ods_mapper — gasto saúde per capita", () => {
  it("score 100 quando gasto >= R$1500", () => {
    const ind = mapToOdsIndicators(makeData({ gastoSaudePerCapita: 2000.0 })).find(
      (i) => i.indicatorName === "ieps_gasto_saude_pc",
    )!;
    expect(ind.score).toBe(100);
  });

  it("score entre 70 e 100 quando gasto R$800-1500", () => {
    const ind = mapToOdsIndicators(makeData({ gastoSaudePerCapita: 1100.0 })).find(
      (i) => i.indicatorName === "ieps_gasto_saude_pc",
    )!;
    expect(ind.score).toBeGreaterThanOrEqual(70);
    expect(ind.score).toBeLessThanOrEqual(100);
  });

  it("score < 30 quando gasto < R$400", () => {
    const ind = mapToOdsIndicators(makeData({ gastoSaudePerCapita: 200.0 })).find(
      (i) => i.indicatorName === "ieps_gasto_saude_pc",
    )!;
    expect(ind.score).toBeLessThan(30);
  });
});

// ─── Null guards ─────────────────────────────────────────────────────────────

describe("ieps_ods_mapper — null guards", () => {
  it("deve omitir mortalidade infantil quando null", () => {
    const result = mapToOdsIndicators(makeData({ mortalidadeInfantil: null }));
    expect(result.find((i) => i.indicatorName === "ieps_mortalidade_infantil")).toBeUndefined();
    expect(result).toHaveLength(5);
  });

  it("deve omitir cobertura ESF quando null", () => {
    const result = mapToOdsIndicators(makeData({ coberturaEsf: null }));
    expect(result.find((i) => i.indicatorName === "ieps_cobertura_esf")).toBeUndefined();
  });

  it("deve retornar lista vazia quando todos são null", () => {
    const data = makeData({
      mortalidadeInfantil: null,
      coberturaEsf: null,
      coberturaVacinal: null,
      internacoesCsap: null,
      gastoSaudePerCapita: null,
      prenatalAdequado: null,
    });
    expect(mapToOdsIndicators(data)).toHaveLength(0);
  });
});

// ─── Status derivado do score ───────────────────────────────────────────────

describe("ieps_ods_mapper — status ODS derivado", () => {
  it("verde quando score >= 70", () => {
    // mortalidade 5.0 → score 100 → verde
    const ind = mapToOdsIndicators(makeData({ mortalidadeInfantil: 5.0 })).find(
      (i) => i.indicatorName === "ieps_mortalidade_infantil",
    )!;
    expect(ind.status).toBe("verde");
  });

  it("amarelo quando score 40-69", () => {
    // cobertura ESF 55% → score ~50 → amarelo
    const ind = mapToOdsIndicators(makeData({ coberturaEsf: 55.0 })).find(
      (i) => i.indicatorName === "ieps_cobertura_esf",
    )!;
    expect(ind.status).toBe("amarelo");
  });

  it("vermelho quando score < 40", () => {
    // cobertura vacinal 30% → score < 30 → vermelho
    const ind = mapToOdsIndicators(makeData({ coberturaVacinal: 30.0 })).find(
      (i) => i.indicatorName === "ieps_cobertura_vacinal",
    )!;
    expect(ind.status).toBe("vermelho");
  });
});
