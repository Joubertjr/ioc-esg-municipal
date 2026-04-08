import { describe, it, expect } from "vitest";
import { mapToOdsIndicators } from "../../../backend/agents/datasus/datasus_ods_mapper.js";
import type { DatasusMunicipalData } from "../../../shared/types/agents/datasus.types.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_DATE = new Date("2023-12-31");

function makeData(
  overrides: Partial<DatasusMunicipalData["indicators"]> = {},
): DatasusMunicipalData {
  return {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2023,
    referenceDate: BASE_DATE,
    dataAvailable: true,
    indicators: {
      prenatal: 75,
      diabetes: 65,
      hipertensao: 55,
      crescimentoInfantil: 85,
      cancerColoUterino: 45,
      saudeBucal: 25,
      mediaGeral: 58,
      ...overrides,
    },
  };
}

// ─── Happy path ──────────────────────────────────────────────────────────────

describe("datasus_ods_mapper — happy path", () => {
  it("deve retornar 6 indicadores quando todos os campos Previne estão presentes", () => {
    const result = mapToOdsIndicators(makeData());
    expect(result).toHaveLength(6);
  });

  it("deve mapear todos os indicadores para ODS 3", () => {
    const result = mapToOdsIndicators(makeData());
    result.forEach((ind) => {
      expect(ind.odsNumber).toBe(3);
    });
  });

  it("deve retornar os 6 nomes de indicadores Previne Brasil", () => {
    const result = mapToOdsIndicators(makeData());
    const names = result.map((i) => i.indicatorName).sort();
    expect(names).toEqual([
      "previne_cancer_colo",
      "previne_crescimento_infantil",
      "previne_diabetes",
      "previne_hipertensao",
      "previne_prenatal",
      "previne_saude_bucal",
    ]);
  });

  it("deve definir source como 'datasus' em todos os indicadores", () => {
    const result = mapToOdsIndicators(makeData());
    result.forEach((ind) => {
      expect(ind.source).toBe("datasus");
    });
  });

  it("deve definir dataAvailable como true em todos os indicadores", () => {
    const result = mapToOdsIndicators(makeData());
    result.forEach((ind) => {
      expect(ind.dataAvailable).toBe(true);
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

  it("deve usar ibgeCode como municipalityId", () => {
    const result = mapToOdsIndicators(makeData());
    result.forEach((ind) => {
      expect(ind.municipalityId).toBe("4204202");
    });
  });

  it("deve preservar o valor bruto de percentual no campo value", () => {
    const result = mapToOdsIndicators(makeData());
    const prenatal = result.find((i) => i.indicatorName === "previne_prenatal")!;
    expect(prenatal.value).toBe(75);
  });
});

// ─── scorePrevinePct — faixa >= 80% ──────────────────────────────────────────

describe("datasus_ods_mapper — scorePrevinePct faixa >= 80%", () => {
  it("deve retornar score 100 quando pct == 80% (fronteira inferior excelente)", () => {
    const ind = mapToOdsIndicators(makeData({ prenatal: 80 })).find(
      (i) => i.indicatorName === "previne_prenatal",
    )!;
    expect(ind.score).toBe(100);
  });

  it("deve retornar score 100 quando pct == 100%", () => {
    const ind = mapToOdsIndicators(makeData({ prenatal: 100 })).find(
      (i) => i.indicatorName === "previne_prenatal",
    )!;
    expect(ind.score).toBe(100);
  });

  it("deve retornar score 100 quando pct == 95%", () => {
    const ind = mapToOdsIndicators(makeData({ prenatal: 95 })).find(
      (i) => i.indicatorName === "previne_prenatal",
    )!;
    expect(ind.score).toBe(100);
  });
});

// ─── scorePrevinePct — faixa 60-80% ──────────────────────────────────────────

describe("datasus_ods_mapper — scorePrevinePct faixa 60-80%", () => {
  it("deve retornar score 70 quando pct == 60% (fronteira inferior da faixa boa)", () => {
    // 70 + ((60-60)/20)*30 = 70
    const ind = mapToOdsIndicators(makeData({ diabetes: 60 })).find(
      (i) => i.indicatorName === "previne_diabetes",
    )!;
    expect(ind.score).toBe(70);
  });

  it("deve retornar score 85 quando pct == 70%", () => {
    // 70 + ((70-60)/20)*30 = 70+15 = 85
    const ind = mapToOdsIndicators(makeData({ diabetes: 70 })).find(
      (i) => i.indicatorName === "previne_diabetes",
    )!;
    expect(ind.score).toBe(85);
  });

  it("deve retornar score < 100 quando pct == 79% (abaixo de 80%)", () => {
    // 70 + ((79-60)/20)*30 = 70 + 28.5 = 98 → round = 99 (clampScore rounds)
    const ind = mapToOdsIndicators(makeData({ diabetes: 79 })).find(
      (i) => i.indicatorName === "previne_diabetes",
    )!;
    expect(ind.score).toBeLessThan(100);
    expect(ind.score).toBeGreaterThanOrEqual(70);
  });
});

// ─── scorePrevinePct — faixa 30-60% ──────────────────────────────────────────

describe("datasus_ods_mapper — scorePrevinePct faixa 30-60%", () => {
  it("deve retornar score 30 quando pct == 30% (fronteira inferior da faixa regular)", () => {
    // 30 + ((30-30)/30)*40 = 30
    const ind = mapToOdsIndicators(makeData({ hipertensao: 30 })).find(
      (i) => i.indicatorName === "previne_hipertensao",
    )!;
    expect(ind.score).toBe(30);
  });

  it("deve retornar score 50 quando pct == 45%", () => {
    // 30 + ((45-30)/30)*40 = 30+20 = 50
    const ind = mapToOdsIndicators(makeData({ hipertensao: 45 })).find(
      (i) => i.indicatorName === "previne_hipertensao",
    )!;
    expect(ind.score).toBe(50);
  });

  it("deve retornar score < 70 quando pct == 59% (abaixo de 60%)", () => {
    // 30 + ((59-30)/30)*40 = 30 + 38.67 ≈ 69 → round = 69
    const ind = mapToOdsIndicators(makeData({ hipertensao: 59 })).find(
      (i) => i.indicatorName === "previne_hipertensao",
    )!;
    expect(ind.score).toBeLessThan(70);
    expect(ind.score).toBeGreaterThanOrEqual(30);
  });
});

// ─── scorePrevinePct — faixa < 30% ───────────────────────────────────────────

describe("datasus_ods_mapper — scorePrevinePct faixa < 30%", () => {
  it("deve retornar score 0 quando pct == 0%", () => {
    // (0/30)*30 = 0
    const ind = mapToOdsIndicators(makeData({ saudeBucal: 0 })).find(
      (i) => i.indicatorName === "previne_saude_bucal",
    )!;
    expect(ind.score).toBe(0);
  });

  it("deve retornar score 15 quando pct == 15%", () => {
    // (15/30)*30 = 15
    const ind = mapToOdsIndicators(makeData({ saudeBucal: 15 })).find(
      (i) => i.indicatorName === "previne_saude_bucal",
    )!;
    expect(ind.score).toBe(15);
  });

  it("deve retornar score < 30 quando pct == 29% (abaixo de 30%)", () => {
    // (29/30)*30 = 29
    const ind = mapToOdsIndicators(makeData({ saudeBucal: 29 })).find(
      (i) => i.indicatorName === "previne_saude_bucal",
    )!;
    expect(ind.score).toBeLessThan(30);
    expect(ind.score).toBeGreaterThan(0);
  });
});

// ─── Null guards ──────────────────────────────────────────────────────────────

describe("datasus_ods_mapper — null guards por indicador", () => {
  it("deve omitir previne_prenatal quando prenatal é null", () => {
    const result = mapToOdsIndicators(makeData({ prenatal: null }));
    expect(result.find((i) => i.indicatorName === "previne_prenatal")).toBeUndefined();
  });

  it("deve omitir previne_diabetes quando diabetes é null", () => {
    const result = mapToOdsIndicators(makeData({ diabetes: null }));
    expect(result.find((i) => i.indicatorName === "previne_diabetes")).toBeUndefined();
  });

  it("deve omitir previne_hipertensao quando hipertensao é null", () => {
    const result = mapToOdsIndicators(makeData({ hipertensao: null }));
    expect(result.find((i) => i.indicatorName === "previne_hipertensao")).toBeUndefined();
  });

  it("deve omitir previne_crescimento_infantil quando crescimentoInfantil é null", () => {
    const result = mapToOdsIndicators(makeData({ crescimentoInfantil: null }));
    expect(result.find((i) => i.indicatorName === "previne_crescimento_infantil")).toBeUndefined();
  });

  it("deve omitir previne_cancer_colo quando cancerColoUterino é null", () => {
    const result = mapToOdsIndicators(makeData({ cancerColoUterino: null }));
    expect(result.find((i) => i.indicatorName === "previne_cancer_colo")).toBeUndefined();
  });

  it("deve omitir previne_saude_bucal quando saudeBucal é null", () => {
    const result = mapToOdsIndicators(makeData({ saudeBucal: null }));
    expect(result.find((i) => i.indicatorName === "previne_saude_bucal")).toBeUndefined();
  });

  it("deve retornar lista vazia quando todos os indicadores Previne são null", () => {
    const data = makeData({
      prenatal: null,
      diabetes: null,
      hipertensao: null,
      crescimentoInfantil: null,
      cancerColoUterino: null,
      saudeBucal: null,
    });
    expect(mapToOdsIndicators(data)).toHaveLength(0);
  });

  it("deve retornar apenas os indicadores não-null quando alguns são null", () => {
    const data = makeData({
      prenatal: 70,
      diabetes: null,
      hipertensao: null,
      crescimentoInfantil: 80,
      cancerColoUterino: null,
      saudeBucal: null,
    });
    const result = mapToOdsIndicators(data);
    expect(result).toHaveLength(2);
    const names = result.map((i) => i.indicatorName);
    expect(names).toContain("previne_prenatal");
    expect(names).toContain("previne_crescimento_infantil");
  });
});

// ─── Status derivado do score ─────────────────────────────────────────────────

describe("datasus_ods_mapper — status ODS derivado do score", () => {
  it("deve retornar status 'verde' quando score >= 70 (pct >= 80%)", () => {
    const ind = mapToOdsIndicators(makeData({ prenatal: 80 })).find(
      (i) => i.indicatorName === "previne_prenatal",
    )!;
    expect(ind.status).toBe("verde");
  });

  it("deve retornar status 'amarelo' quando 40 <= score < 70 (pct aprox 37%)", () => {
    // pct = 37% → 30 + ((37-30)/30)*40 = 30 + 9.33 ≈ 39 → score 39 → vermelho
    // pct = 40% → 30 + ((40-30)/30)*40 = 30 + 13.33 ≈ 43 → score 43 → amarelo
    const ind = mapToOdsIndicators(makeData({ prenatal: 40 })).find(
      (i) => i.indicatorName === "previne_prenatal",
    )!;
    expect(ind.status).toBe("amarelo");
  });

  it("deve retornar status 'vermelho' quando score < 40 (pct == 0%)", () => {
    const ind = mapToOdsIndicators(makeData({ prenatal: 0 })).find(
      (i) => i.indicatorName === "previne_prenatal",
    )!;
    expect(ind.status).toBe("vermelho");
  });
});
