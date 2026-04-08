import { describe, it, expect } from "vitest";
import { mapToOdsIndicators } from "../../../backend/agents/inep/inep_ods_mapper.js";
import type { InepMunicipalData } from "../../../shared/types/agents/inep.types.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_DATE = new Date("2023-12-31");

function makeData(overrides: Partial<InepMunicipalData["indicators"]> = {}): InepMunicipalData {
  return {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2023,
    referenceDate: BASE_DATE,
    dataAvailable: true,
    indicators: {
      idebAnosIniciais: 5.5,
      idebAnosFinais: 4.5,
      ...overrides,
    },
  };
}

// ─── Happy path ──────────────────────────────────────────────────────────────

describe("inep_ods_mapper — happy path", () => {
  it("deve retornar 2 indicadores quando ambos os IDEB estão presentes", () => {
    const result = mapToOdsIndicators(makeData());
    expect(result).toHaveLength(2);
  });

  it("deve mapear ambos os indicadores para ODS 4", () => {
    const result = mapToOdsIndicators(makeData());
    result.forEach((ind) => {
      expect(ind.odsNumber).toBe(4);
    });
  });

  it("deve retornar indicadores com nomes 'ideb_anos_iniciais' e 'ideb_anos_finais'", () => {
    const result = mapToOdsIndicators(makeData());
    const names = result.map((i) => i.indicatorName).sort();
    expect(names).toEqual(["ideb_anos_finais", "ideb_anos_iniciais"]);
  });

  it("deve definir source como 'inep' em todos os indicadores", () => {
    const result = mapToOdsIndicators(makeData());
    result.forEach((ind) => {
      expect(ind.source).toBe("inep");
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

  it("deve preservar a nota IDEB no campo value", () => {
    const result = mapToOdsIndicators(makeData());
    const iniciais = result.find((i) => i.indicatorName === "ideb_anos_iniciais")!;
    expect(iniciais.value).toBe(5.5);
  });
});

// ─── scoreIdeb — faixa >= 7.0 (excelente) ────────────────────────────────────

describe("inep_ods_mapper — scoreIdeb faixa >= 7.0", () => {
  it("deve retornar score 100 quando IDEB == 7.0 (fronteira inferior excelente)", () => {
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 7.0 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.score).toBe(100);
  });

  it("deve retornar score 100 quando IDEB == 8.0", () => {
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 8.0 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.score).toBe(100);
  });

  it("deve retornar score 100 quando IDEB == 10.0 (máximo)", () => {
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 10.0 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.score).toBe(100);
  });
});

// ─── scoreIdeb — faixa 4.0–7.0 (médio-alto) ──────────────────────────────────

describe("inep_ods_mapper — scoreIdeb faixa 4.0–7.0", () => {
  it("deve retornar score 50 quando IDEB == 4.0 (fronteira inferior da faixa)", () => {
    // 50 + ((4.0-4.0)/3.0)*50 = 50
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 4.0 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.score).toBe(50);
  });

  it("deve retornar score 75 quando IDEB == 5.5 (ponto médio da faixa)", () => {
    // 50 + ((5.5-4.0)/3.0)*50 = 50 + 25 = 75
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 5.5 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.score).toBe(75);
  });

  it("deve interpolar linearmente entre 4.0 e 7.0 para anos finais", () => {
    // IDEB = 6.0 → 50 + ((6.0-4.0)/3.0)*50 = 50 + 33.33 ≈ 83
    const ind = mapToOdsIndicators(makeData({ idebAnosFinais: 6.0 })).find(
      (i) => i.indicatorName === "ideb_anos_finais",
    )!;
    expect(ind.score).toBe(83);
  });

  it("deve retornar score < 100 quando IDEB == 6.9 (imediatamente abaixo de 7.0)", () => {
    // 50 + ((6.9-4.0)/3.0)*50 = 50 + 48.33 ≈ 98
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 6.9 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.score).toBeLessThan(100);
    expect(ind.score).toBeGreaterThanOrEqual(50);
  });
});

// ─── scoreIdeb — faixa < 4.0 (abaixo do mínimo) ─────────────────────────────

describe("inep_ods_mapper — scoreIdeb faixa < 4.0", () => {
  it("deve retornar score 0 quando IDEB == 0.0 (mínimo absoluto)", () => {
    // (0.0/4.0)*50 = 0
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 0.0 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.score).toBe(0);
  });

  it("deve retornar score 25 quando IDEB == 2.0 (ponto médio abaixo de 4.0)", () => {
    // (2.0/4.0)*50 = 25
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 2.0 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.score).toBe(25);
  });

  it("deve retornar score < 50 para IDEB imediatamente abaixo de 4.0", () => {
    // (3.9/4.0)*50 = 48.75 → round = 49
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 3.9 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.score).toBeLessThan(50);
    expect(ind.score).toBeGreaterThan(0);
  });

  it("deve retornar score 13 quando IDEB == 1.0", () => {
    // (1.0/4.0)*50 = 12.5 → round = 13
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 1.0 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.score).toBe(13);
  });
});

// ─── Null guards ──────────────────────────────────────────────────────────────

describe("inep_ods_mapper — null guards", () => {
  it("deve omitir ideb_anos_iniciais quando idebAnosIniciais é null", () => {
    const result = mapToOdsIndicators(makeData({ idebAnosIniciais: null }));
    expect(result.find((i) => i.indicatorName === "ideb_anos_iniciais")).toBeUndefined();
  });

  it("deve omitir ideb_anos_finais quando idebAnosFinais é null", () => {
    const result = mapToOdsIndicators(makeData({ idebAnosFinais: null }));
    expect(result.find((i) => i.indicatorName === "ideb_anos_finais")).toBeUndefined();
  });

  it("deve retornar apenas anos_iniciais quando anos_finais é null", () => {
    const result = mapToOdsIndicators(makeData({ idebAnosFinais: null }));
    expect(result).toHaveLength(1);
    expect(result[0].indicatorName).toBe("ideb_anos_iniciais");
  });

  it("deve retornar apenas anos_finais quando anos_iniciais é null", () => {
    const result = mapToOdsIndicators(makeData({ idebAnosIniciais: null }));
    expect(result).toHaveLength(1);
    expect(result[0].indicatorName).toBe("ideb_anos_finais");
  });

  it("deve retornar lista vazia quando ambos os IDEB são null", () => {
    const data = makeData({ idebAnosIniciais: null, idebAnosFinais: null });
    expect(mapToOdsIndicators(data)).toHaveLength(0);
  });
});

// ─── Scores independentes por sub-indicador ──────────────────────────────────

describe("inep_ods_mapper — scores independentes por sub-indicador", () => {
  it("deve calcular scores diferentes para notas diferentes de anos_iniciais e anos_finais", () => {
    const result = mapToOdsIndicators(makeData({ idebAnosIniciais: 7.0, idebAnosFinais: 3.0 }));
    const iniciais = result.find((i) => i.indicatorName === "ideb_anos_iniciais")!;
    const finais = result.find((i) => i.indicatorName === "ideb_anos_finais")!;

    // iniciais = 7.0 → score 100; finais = 3.0 → (3.0/4.0)*50 = 37.5 → 38
    expect(iniciais.score).toBe(100);
    expect(finais.score).toBe(38);
  });
});

// ─── Status derivado do score ─────────────────────────────────────────────────

describe("inep_ods_mapper — status ODS derivado do score", () => {
  it("deve retornar status 'verde' quando IDEB >= 7.0 (score 100)", () => {
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 7.0 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.status).toBe("verde");
  });

  it("deve retornar status 'amarelo' quando score está entre 40 e 69", () => {
    // IDEB = 4.8 → 50 + ((4.8-4.0)/3.0)*50 = 50+13.33 ≈ 63 → amarelo
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 4.8 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.status).toBe("amarelo");
  });

  it("deve retornar status 'vermelho' quando IDEB == 0.0 (score 0)", () => {
    const ind = mapToOdsIndicators(makeData({ idebAnosIniciais: 0.0 })).find(
      (i) => i.indicatorName === "ideb_anos_iniciais",
    )!;
    expect(ind.status).toBe("vermelho");
  });
});
