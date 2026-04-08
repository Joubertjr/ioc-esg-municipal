import { describe, it, expect } from "vitest";
import { mapToOdsIndicators } from "../../../backend/agents/siconfi/siconfi_ods_mapper.js";
import type { SiconfiMunicipalData } from "../../../shared/types/agents/siconfi.types.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_DATE = new Date("2023-12-31");

function makeData(
  overrides: Partial<SiconfiMunicipalData["indicators"]> = {},
): SiconfiMunicipalData {
  return {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2023,
    referenceDate: BASE_DATE,
    dataAvailable: true,
    indicators: {
      fpmAnual: 5_000_000,
      receitaTotal: 20_000_000,
      despesaTotal: 18_000_000,
      despesaSaude: 3_600_000, // 20% — within 15-25 band
      despesaEducacao: 5_400_000, // 30% — within 25-35 band
      despesaUrbanismo: 1_800_000, // 10% — lower boundary of 10-20 band
      despesaAssistencia: 900_000,
      transferenciasUniao: 8_000_000,
      fundeb: 2_000_000,
      populacao: 50_000,
      ...overrides,
    },
  };
}

// ─── Happy path ──────────────────────────────────────────────────────────────

describe("siconfi_ods_mapper — happy path", () => {
  it("deve retornar 5 indicadores quando todos os campos estão presentes", () => {
    const result = mapToOdsIndicators(makeData());

    expect(result).toHaveLength(5);
  });

  it("deve retornar indicadores para ODS 3, 4, 11, 16 e 17", () => {
    const result = mapToOdsIndicators(makeData());
    const odsNumbers = result.map((i) => i.odsNumber).sort((a, b) => a - b);

    expect(odsNumbers).toEqual([3, 4, 11, 16, 17]);
  });

  it("deve usar ibgeCode como municipalityId em todos os indicadores", () => {
    const result = mapToOdsIndicators(makeData());

    result.forEach((ind) => {
      expect(ind.municipalityId).toBe("4204202");
    });
  });

  it("deve definir source como 'siconfi' em todos os indicadores", () => {
    const result = mapToOdsIndicators(makeData());

    result.forEach((ind) => {
      expect(ind.source).toBe("siconfi");
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
});

// ─── ODS 3 — scorePctSaude ────────────────────────────────────────────────────

describe("siconfi_ods_mapper — ODS 3 (saúde)", () => {
  function getOds3Score(despesaSaude: number, despesaTotal: number): number {
    const data = makeData({ despesaSaude, despesaTotal });
    const ind = mapToOdsIndicators(data).find((i) => i.odsNumber === 3)!;
    return ind.score as number;
  }

  it("deve retornar score 100 quando pct >= 25%", () => {
    // 25% exato
    expect(getOds3Score(2_500_000, 10_000_000)).toBe(100);
    // Acima de 25%
    expect(getOds3Score(3_000_000, 10_000_000)).toBe(100);
  });

  it("deve retornar score 60 quando pct == 15% (mínimo constitucional)", () => {
    expect(getOds3Score(1_500_000, 10_000_000)).toBe(60);
  });

  it("deve interpolar linearmente entre 15% e 25%", () => {
    // pct = 20% → 60 + ((20-15)/10)*40 = 60 + 20 = 80
    expect(getOds3Score(2_000_000, 10_000_000)).toBe(80);
  });

  it("deve interpolar linearmente entre 10% e 15%", () => {
    // pct = 12.5% → ((12.5-10)/5)*60 = 30
    expect(getOds3Score(1_250_000, 10_000_000)).toBe(30);
  });

  it("deve retornar score 0 quando pct < 10%", () => {
    expect(getOds3Score(900_000, 10_000_000)).toBe(0);
    expect(getOds3Score(0, 10_000_000)).toBe(0);
  });

  it("deve usar o nome de indicador 'pct_despesa_saude'", () => {
    const ind = mapToOdsIndicators(makeData()).find((i) => i.odsNumber === 3)!;
    expect(ind.indicatorName).toBe("pct_despesa_saude");
  });

  it("deve arredondar o valor do percentual para 2 casas decimais", () => {
    // 1/3 → ~33.33%
    const ind = mapToOdsIndicators(makeData({ despesaSaude: 1, despesaTotal: 3 })).find(
      (i) => i.odsNumber === 3,
    )!;
    expect(ind.value).toBe(33.33);
  });
});

// ─── ODS 4 — scorePctEducacao ─────────────────────────────────────────────────

describe("siconfi_ods_mapper — ODS 4 (educação)", () => {
  function getOds4Score(despesaEducacao: number, despesaTotal: number): number {
    const data = makeData({ despesaEducacao, despesaTotal });
    const ind = mapToOdsIndicators(data).find((i) => i.odsNumber === 4)!;
    return ind.score as number;
  }

  it("deve retornar score 100 quando pct >= 35%", () => {
    expect(getOds4Score(3_500_000, 10_000_000)).toBe(100);
    expect(getOds4Score(4_000_000, 10_000_000)).toBe(100);
  });

  it("deve retornar score 70 quando pct == 25% (mínimo constitucional)", () => {
    expect(getOds4Score(2_500_000, 10_000_000)).toBe(70);
  });

  it("deve interpolar linearmente entre 25% e 35%", () => {
    // pct = 30% → 70 + ((30-25)/10)*30 = 70 + 15 = 85
    expect(getOds4Score(3_000_000, 10_000_000)).toBe(85);
  });

  it("deve interpolar linearmente entre 15% e 25%", () => {
    // pct = 20% → ((20-15)/10)*70 = 35
    expect(getOds4Score(2_000_000, 10_000_000)).toBe(35);
  });

  it("deve retornar score 0 quando pct < 15%", () => {
    expect(getOds4Score(1_400_000, 10_000_000)).toBe(0);
    expect(getOds4Score(0, 10_000_000)).toBe(0);
  });

  it("deve usar o nome de indicador 'pct_despesa_educacao'", () => {
    const ind = mapToOdsIndicators(makeData()).find((i) => i.odsNumber === 4)!;
    expect(ind.indicatorName).toBe("pct_despesa_educacao");
  });
});

// ─── ODS 11 — scorePctUrbanismo ───────────────────────────────────────────────

describe("siconfi_ods_mapper — ODS 11 (urbanismo)", () => {
  function getOds11Score(despesaUrbanismo: number, despesaTotal: number): number {
    const data = makeData({ despesaUrbanismo, despesaTotal });
    const ind = mapToOdsIndicators(data).find((i) => i.odsNumber === 11)!;
    return ind.score as number;
  }

  it("deve retornar score 100 quando pct >= 20%", () => {
    expect(getOds11Score(2_000_000, 10_000_000)).toBe(100);
    expect(getOds11Score(3_000_000, 10_000_000)).toBe(100);
  });

  it("deve retornar score 60 quando pct == 10%", () => {
    expect(getOds11Score(1_000_000, 10_000_000)).toBe(60);
  });

  it("deve interpolar linearmente entre 10% e 20%", () => {
    // pct = 15% → 60 + ((15-10)/10)*40 = 60 + 20 = 80
    expect(getOds11Score(1_500_000, 10_000_000)).toBe(80);
  });

  it("deve interpolar linearmente entre 3% e 10%", () => {
    // pct = 6.5% → ((6.5-3)/7)*60 = 30
    expect(getOds11Score(650_000, 10_000_000)).toBe(30);
  });

  it("deve retornar score 0 quando pct < 3%", () => {
    expect(getOds11Score(200_000, 10_000_000)).toBe(0);
    expect(getOds11Score(0, 10_000_000)).toBe(0);
  });

  it("deve usar o nome de indicador 'pct_despesa_urbanismo'", () => {
    const ind = mapToOdsIndicators(makeData()).find((i) => i.odsNumber === 11)!;
    expect(ind.indicatorName).toBe("pct_despesa_urbanismo");
  });
});

// ─── ODS 16 — scoreEquilibrioFiscal ──────────────────────────────────────────

describe("siconfi_ods_mapper — ODS 16 (equilíbrio fiscal)", () => {
  function getOds16Score(receitaTotal: number, despesaTotal: number): number {
    const data = makeData({ receitaTotal, despesaTotal });
    const ind = mapToOdsIndicators(data).find((i) => i.odsNumber === 16)!;
    return ind.score as number;
  }

  it("deve retornar score 100 quando ratio >= 1.1", () => {
    // ratio = 1.2
    expect(getOds16Score(12_000_000, 10_000_000)).toBe(100);
  });

  it("deve retornar score 80 quando ratio == 1.0", () => {
    expect(getOds16Score(10_000_000, 10_000_000)).toBe(80);
  });

  it("deve interpolar linearmente entre 1.0 e 1.1", () => {
    // ratio = 1.05 → 80 + ((1.05-1.0)/0.1)*20 = 80 + 10 = 90
    expect(getOds16Score(10_500_000, 10_000_000)).toBe(90);
  });

  it("deve interpolar linearmente entre 0.7 e 1.0", () => {
    // ratio = 0.85 → ((0.85-0.7)/0.3)*80 = 40
    expect(getOds16Score(8_500_000, 10_000_000)).toBe(40);
  });

  it("deve retornar score 0 quando ratio < 0.7", () => {
    expect(getOds16Score(6_000_000, 10_000_000)).toBe(0);
    expect(getOds16Score(0, 10_000_000)).toBe(0);
  });

  it("deve usar o nome de indicador 'equilibrio_fiscal_siconfi'", () => {
    const ind = mapToOdsIndicators(makeData()).find((i) => i.odsNumber === 16)!;
    expect(ind.indicatorName).toBe("equilibrio_fiscal_siconfi");
  });

  it("deve arredondar o valor do ratio para 2 casas decimais", () => {
    // ratio = 10/3 = 3.333...
    const ind = mapToOdsIndicators(makeData({ receitaTotal: 10, despesaTotal: 3 })).find(
      (i) => i.odsNumber === 16,
    )!;
    expect(ind.value).toBe(3.33);
  });
});

// ─── ODS 17 — scoreDependenciaFpm ────────────────────────────────────────────

describe("siconfi_ods_mapper — ODS 17 (dependência FPM)", () => {
  function getOds17Score(fpmAnual: number, receitaTotal: number): number {
    const data = makeData({ fpmAnual, receitaTotal });
    const ind = mapToOdsIndicators(data).find((i) => i.odsNumber === 17)!;
    return ind.score as number;
  }

  it("deve retornar score 100 quando dependência <= 5%", () => {
    // 5% exato
    expect(getOds17Score(500_000, 10_000_000)).toBe(100);
    // Abaixo de 5%
    expect(getOds17Score(100_000, 10_000_000)).toBe(100);
  });

  it("deve retornar score 50 quando dependência == 30%", () => {
    expect(getOds17Score(3_000_000, 10_000_000)).toBe(50);
  });

  it("deve interpolar linearmente entre 5% e 30%", () => {
    // pct = 17.5% → 50 + ((30-17.5)/25)*50 = 50 + 25 = 75
    expect(getOds17Score(1_750_000, 10_000_000)).toBe(75);
  });

  it("deve interpolar linearmente entre 30% e 60%", () => {
    // pct = 45% → ((60-45)/30)*50 = 25
    expect(getOds17Score(4_500_000, 10_000_000)).toBe(25);
  });

  it("deve retornar score 0 quando dependência >= 60%", () => {
    expect(getOds17Score(6_000_000, 10_000_000)).toBe(0);
    expect(getOds17Score(9_000_000, 10_000_000)).toBe(0);
  });

  it("deve usar o nome de indicador 'dependencia_fpm'", () => {
    const ind = mapToOdsIndicators(makeData()).find((i) => i.odsNumber === 17)!;
    expect(ind.indicatorName).toBe("dependencia_fpm");
  });
});

// ─── Null / zero guards ───────────────────────────────────────────────────────

describe("siconfi_ods_mapper — null e zero guards", () => {
  it("deve omitir ODS 3 quando despesaSaude é null", () => {
    const result = mapToOdsIndicators(makeData({ despesaSaude: null }));
    expect(result.find((i) => i.odsNumber === 3)).toBeUndefined();
  });

  it("deve omitir ODS 3 quando despesaTotal é null", () => {
    const result = mapToOdsIndicators(makeData({ despesaTotal: null }));
    expect(result.find((i) => i.odsNumber === 3)).toBeUndefined();
  });

  it("deve omitir ODS 3 quando despesaTotal == 0 (evitar divisão por zero)", () => {
    const result = mapToOdsIndicators(makeData({ despesaTotal: 0 }));
    expect(result.find((i) => i.odsNumber === 3)).toBeUndefined();
  });

  it("deve omitir ODS 4 quando despesaEducacao é null", () => {
    const result = mapToOdsIndicators(makeData({ despesaEducacao: null }));
    expect(result.find((i) => i.odsNumber === 4)).toBeUndefined();
  });

  it("deve omitir ODS 11 quando despesaUrbanismo é null", () => {
    const result = mapToOdsIndicators(makeData({ despesaUrbanismo: null }));
    expect(result.find((i) => i.odsNumber === 11)).toBeUndefined();
  });

  it("deve omitir ODS 16 quando receitaTotal é null", () => {
    const result = mapToOdsIndicators(makeData({ receitaTotal: null }));
    expect(result.find((i) => i.odsNumber === 16)).toBeUndefined();
  });

  it("deve omitir ODS 16 quando despesaTotal == 0", () => {
    const result = mapToOdsIndicators(makeData({ despesaTotal: 0 }));
    expect(result.find((i) => i.odsNumber === 16)).toBeUndefined();
  });

  it("deve omitir ODS 17 quando fpmAnual é null", () => {
    const result = mapToOdsIndicators(makeData({ fpmAnual: null }));
    expect(result.find((i) => i.odsNumber === 17)).toBeUndefined();
  });

  it("deve omitir ODS 17 quando receitaTotal == 0 (evitar divisão por zero)", () => {
    const result = mapToOdsIndicators(makeData({ receitaTotal: 0 }));
    expect(result.find((i) => i.odsNumber === 17)).toBeUndefined();
  });

  it("deve retornar lista vazia quando todos os indicadores são null", () => {
    const data = makeData({
      despesaSaude: null,
      despesaEducacao: null,
      despesaUrbanismo: null,
      receitaTotal: null,
      fpmAnual: null,
    });
    expect(mapToOdsIndicators(data)).toHaveLength(0);
  });
});

// ─── Status derivado do score ─────────────────────────────────────────────────

describe("siconfi_ods_mapper — status ODS", () => {
  it("deve retornar status 'verde' quando score >= 70", () => {
    // despesaSaude = 25% → score 100
    const ind = mapToOdsIndicators(
      makeData({ despesaSaude: 2_500_000, despesaTotal: 10_000_000 }),
    ).find((i) => i.odsNumber === 3)!;
    expect(ind.status).toBe("verde");
  });

  it("deve retornar status 'amarelo' quando 40 <= score < 70", () => {
    // despesaSaude = 17.5% → 60 + ((17.5-15)/10)*40 = 70... exactly 70
    // Use 16.5% → 60 + ((16.5-15)/10)*40 = 60+6 = 66
    const ind = mapToOdsIndicators(
      makeData({ despesaSaude: 1_650_000, despesaTotal: 10_000_000 }),
    ).find((i) => i.odsNumber === 3)!;
    expect(ind.status).toBe("amarelo");
  });

  it("deve retornar status 'vermelho' quando score < 40", () => {
    // despesaSaude = 0% → score 0
    const ind = mapToOdsIndicators(makeData({ despesaSaude: 0, despesaTotal: 10_000_000 })).find(
      (i) => i.odsNumber === 3,
    )!;
    expect(ind.status).toBe("vermelho");
  });
});
