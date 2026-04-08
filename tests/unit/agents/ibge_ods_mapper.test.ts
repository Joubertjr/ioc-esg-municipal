import { describe, it, expect } from "vitest";
import {
  mapToOdsIndicators,
  scoreCoeficienteGini,
  scoreEmpresasPor10k,
  scoreRazao2020,
  scoreUrbanizacaoAdequada,
} from "../../../backend/agents/ibge/ibge_ods_mapper.js";
import type { IbgeMunicipalData } from "../../../shared/types/agents/ibge.types.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_DATE = new Date("2023-12-31");

function makeData(overrides: Partial<IbgeMunicipalData["indicators"]> = {}): IbgeMunicipalData {
  return {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2023,
    referenceDate: BASE_DATE,
    dataAvailable: true,
    indicators: {
      populacao: 50_000,
      pibPerCapita: 35_000,
      pctBaixaRenda: 30,
      taxaOcupacao: 50,
      receitasOrcamentarias: 15_000_000,
      despesasOrcamentarias: 14_000_000,
      razaoDependencia: 55,
      coeficienteGini: 0.4,
      razao2020: 10,
      areaterritorial: 500,
      producaoAgricolaMilReais: 200_000,
      empresasAtuantes: 3_000,
      urbanizacaoAdequada: 80,
      ...overrides,
    },
  };
}

// ─── Happy path ──────────────────────────────────────────────────────────────

describe("ibge_ods_mapper — happy path", () => {
  it("deve retornar 8 indicadores quando todos os campos estão presentes", () => {
    const result = mapToOdsIndicators(makeData());
    // ODS 1, 2, 8 (taxa_ocupacao), 8 (pib_per_capita), 9, 10 (gini), 10 (razao_20_20), 11
    expect(result).toHaveLength(8);
  });

  it("deve cobrir ODS 1, 2, 8, 9, 10 e 11", () => {
    const result = mapToOdsIndicators(makeData());
    const odsNumbers = [...new Set(result.map((i) => i.odsNumber))].sort((a, b) => a - b);
    expect(odsNumbers).toEqual([1, 2, 8, 9, 10, 11]);
  });

  it("deve retornar 2 indicadores para ODS 8", () => {
    const result = mapToOdsIndicators(makeData());
    const ods8 = result.filter((i) => i.odsNumber === 8);
    expect(ods8).toHaveLength(2);
  });

  it("deve retornar 2 indicadores para ODS 10", () => {
    const result = mapToOdsIndicators(makeData());
    const ods10 = result.filter((i) => i.odsNumber === 10);
    expect(ods10).toHaveLength(2);
  });

  it("deve definir source como 'ibge' em todos os indicadores", () => {
    const result = mapToOdsIndicators(makeData());
    result.forEach((ind) => {
      expect(ind.source).toBe("ibge");
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
});

// ─── ODS 1 — scorePctBaixaRenda ──────────────────────────────────────────────

describe("ibge_ods_mapper — ODS 1 (pobreza)", () => {
  function getOds1Score(pctBaixaRenda: number): number {
    return mapToOdsIndicators(makeData({ pctBaixaRenda })).find((i) => i.odsNumber === 1)!
      .score as number;
  }

  it("deve retornar score 100 quando pct == 20% (benchmark excelente)", () => {
    // ((70-20)/(70-20))*100 = 100
    expect(getOds1Score(20)).toBe(100);
  });

  it("deve retornar score 0 quando pct == 70% (benchmark péssimo)", () => {
    // ((70-70)/(70-20))*100 = 0
    expect(getOds1Score(70)).toBe(0);
  });

  it("deve retornar score 50 quando pct == 45% (ponto médio)", () => {
    // ((70-45)/50)*100 = 50
    expect(getOds1Score(45)).toBe(50);
  });

  it("deve retornar score 100 quando pct < 20% (clamp superior)", () => {
    expect(getOds1Score(10)).toBe(100);
    expect(getOds1Score(0)).toBe(100);
  });

  it("deve retornar score 0 quando pct > 70% (clamp inferior)", () => {
    expect(getOds1Score(80)).toBe(0);
    expect(getOds1Score(100)).toBe(0);
  });

  it("deve usar o nome de indicador 'pct_baixa_renda'", () => {
    const ind = mapToOdsIndicators(makeData()).find((i) => i.odsNumber === 1)!;
    expect(ind.indicatorName).toBe("pct_baixa_renda");
  });

  it("deve omitir ODS 1 quando pctBaixaRenda é null", () => {
    const result = mapToOdsIndicators(makeData({ pctBaixaRenda: null }));
    expect(result.find((i) => i.odsNumber === 1)).toBeUndefined();
  });
});

// ─── ODS 2 — scoreProducaoAgricola ───────────────────────────────────────────

describe("ibge_ods_mapper — ODS 2 (produção agrícola)", () => {
  function getOds2Score(producaoAgricolaMilReais: number): number {
    return mapToOdsIndicators(makeData({ producaoAgricolaMilReais })).find(
      (i) => i.odsNumber === 2,
    )!.score as number;
  }

  it("deve retornar score 100 quando produção >= R$ 500.000 mil", () => {
    expect(getOds2Score(500_000)).toBe(100);
    expect(getOds2Score(1_000_000)).toBe(100);
  });

  it("deve retornar score 70 quando produção está entre R$ 100.000 e R$ 500.000 mil", () => {
    expect(getOds2Score(100_000)).toBe(70);
    expect(getOds2Score(300_000)).toBe(70);
    expect(getOds2Score(499_999)).toBe(70);
  });

  it("deve retornar score 40 quando produção está entre R$ 10.000 e R$ 100.000 mil", () => {
    expect(getOds2Score(10_000)).toBe(40);
    expect(getOds2Score(50_000)).toBe(40);
    expect(getOds2Score(99_999)).toBe(40);
  });

  it("deve retornar score 20 (floor) quando produção < R$ 10.000 mil", () => {
    expect(getOds2Score(9_999)).toBe(20);
    expect(getOds2Score(0)).toBe(20);
    expect(getOds2Score(1)).toBe(20);
  });

  it("deve usar o nome de indicador 'producao_agricola'", () => {
    const ind = mapToOdsIndicators(makeData()).find((i) => i.odsNumber === 2)!;
    expect(ind.indicatorName).toBe("producao_agricola");
  });

  it("deve omitir ODS 2 quando producaoAgricolaMilReais é null", () => {
    const result = mapToOdsIndicators(makeData({ producaoAgricolaMilReais: null }));
    expect(result.find((i) => i.odsNumber === 2)).toBeUndefined();
  });
});

// ─── ODS 8 — taxaOcupacao ────────────────────────────────────────────────────

describe("ibge_ods_mapper — ODS 8 (taxa de ocupação)", () => {
  function getOds8OcupacaoScore(taxaOcupacao: number): number {
    return mapToOdsIndicators(makeData({ taxaOcupacao })).find(
      (i) => i.odsNumber === 8 && i.indicatorName === "taxa_ocupacao",
    )!.score as number;
  }

  it("deve retornar score 100 quando taxa >= 60%", () => {
    expect(getOds8OcupacaoScore(60)).toBe(100);
    expect(getOds8OcupacaoScore(75)).toBe(100);
  });

  it("deve retornar score 0 quando taxa <= 30%", () => {
    expect(getOds8OcupacaoScore(30)).toBe(0);
    expect(getOds8OcupacaoScore(10)).toBe(0);
  });

  it("deve retornar score 50 quando taxa == 45% (ponto médio)", () => {
    // ((45-30)/(60-30))*100 = 50
    expect(getOds8OcupacaoScore(45)).toBe(50);
  });

  it("deve usar o nome de indicador 'taxa_ocupacao'", () => {
    const ind = mapToOdsIndicators(makeData()).find(
      (i) => i.odsNumber === 8 && i.indicatorName === "taxa_ocupacao",
    )!;
    expect(ind.indicatorName).toBe("taxa_ocupacao");
  });

  it("deve omitir indicador taxa_ocupacao quando taxaOcupacao é null", () => {
    const result = mapToOdsIndicators(makeData({ taxaOcupacao: null }));
    expect(
      result.find((i) => i.odsNumber === 8 && i.indicatorName === "taxa_ocupacao"),
    ).toBeUndefined();
  });
});

// ─── ODS 8 — pibPerCapita ────────────────────────────────────────────────────

describe("ibge_ods_mapper — ODS 8 (PIB per capita)", () => {
  function getOds8PibScore(pibPerCapita: number): number {
    return mapToOdsIndicators(makeData({ pibPerCapita })).find(
      (i) => i.odsNumber === 8 && i.indicatorName === "pib_per_capita",
    )!.score as number;
  }

  it("deve retornar score 100 quando PIB >= R$ 60.000", () => {
    expect(getOds8PibScore(60_000)).toBe(100);
    expect(getOds8PibScore(80_000)).toBe(100);
  });

  it("deve retornar score 0 quando PIB <= R$ 10.000", () => {
    expect(getOds8PibScore(10_000)).toBe(0);
    expect(getOds8PibScore(5_000)).toBe(0);
  });

  it("deve retornar score 50 quando PIB == R$ 35.000 (mediana SC)", () => {
    // ((35000-10000)/(60000-10000))*100 = 50
    expect(getOds8PibScore(35_000)).toBe(50);
  });

  it("deve usar o nome de indicador 'pib_per_capita'", () => {
    const ind = mapToOdsIndicators(makeData()).find(
      (i) => i.odsNumber === 8 && i.indicatorName === "pib_per_capita",
    )!;
    expect(ind.indicatorName).toBe("pib_per_capita");
  });

  it("deve omitir indicador pib_per_capita quando pibPerCapita é null", () => {
    const result = mapToOdsIndicators(makeData({ pibPerCapita: null }));
    expect(
      result.find((i) => i.odsNumber === 8 && i.indicatorName === "pib_per_capita"),
    ).toBeUndefined();
  });
});

// ─── ODS 9 — scoreEmpresasPor10k ─────────────────────────────────────────────

describe("ibge_ods_mapper — ODS 9 (empresas / 10k hab)", () => {
  function getOds9Score(empresasAtuantes: number, populacao: number): number {
    return mapToOdsIndicators(makeData({ empresasAtuantes, populacao })).find(
      (i) => i.odsNumber === 9,
    )!.score as number;
  }

  it("deve retornar score 100 quando empresas/10k >= 100", () => {
    // 100 empresas com 10k pop → 100/10k*10k = 100 por 10k
    expect(getOds9Score(100, 10_000)).toBe(100);
    expect(getOds9Score(200, 10_000)).toBe(100);
  });

  it("deve retornar score 70 quando empresas/10k == 50", () => {
    expect(getOds9Score(50, 10_000)).toBe(70);
  });

  it("deve interpolar entre 50 e 100", () => {
    // 75 por 10k → 70 + ((75-50)/(100-50))*30 = 70+15 = 85
    expect(getOds9Score(75, 10_000)).toBe(85);
  });

  it("deve retornar score 40 quando empresas/10k == 20", () => {
    expect(getOds9Score(20, 10_000)).toBe(40);
  });

  it("deve interpolar entre 20 e 50", () => {
    // 35 por 10k → 40 + ((35-20)/(50-20))*30 = 40+15 = 55
    expect(getOds9Score(35, 10_000)).toBe(55);
  });

  it("deve retornar score 20 (floor) quando empresas/10k < 20", () => {
    expect(getOds9Score(10, 10_000)).toBe(20);
    expect(getOds9Score(0, 10_000)).toBe(20);
  });

  it("deve omitir ODS 9 quando empresasAtuantes é null", () => {
    const result = mapToOdsIndicators(makeData({ empresasAtuantes: null }));
    expect(result.find((i) => i.odsNumber === 9)).toBeUndefined();
  });

  it("deve omitir ODS 9 quando populacao é null", () => {
    const result = mapToOdsIndicators(makeData({ populacao: null }));
    expect(result.find((i) => i.odsNumber === 9)).toBeUndefined();
  });

  it("deve omitir ODS 9 quando populacao == 0 (evitar divisão por zero)", () => {
    const result = mapToOdsIndicators(makeData({ populacao: 0 }));
    expect(result.find((i) => i.odsNumber === 9)).toBeUndefined();
  });

  it("deve calcular valor em empresas/10k com 2 casas decimais", () => {
    // 333 empresas, 100k pop → 33.3 por 10k
    const ind = mapToOdsIndicators(makeData({ empresasAtuantes: 333, populacao: 100_000 })).find(
      (i) => i.odsNumber === 9,
    )!;
    expect(ind.value).toBe(33.3);
  });
});

// ─── ODS 10 — scoreCoeficienteGini ───────────────────────────────────────────

describe("ibge_ods_mapper — ODS 10 (Gini)", () => {
  it("deve retornar score 100 quando Gini <= 0.35", () => {
    expect(scoreCoeficienteGini(0.35)).toBe(100);
    expect(scoreCoeficienteGini(0.2)).toBe(100);
  });

  it("deve retornar score 50 quando Gini == 0.45", () => {
    // 100 - ((0.45-0.35)/(0.45-0.35))*50 = 100-50 = 50
    expect(scoreCoeficienteGini(0.45)).toBe(50);
  });

  it("deve interpolar entre 0.35 e 0.45", () => {
    // Gini = 0.40 → 100 - ((0.40-0.35)/0.10)*50 = 100-25 = 75
    expect(scoreCoeficienteGini(0.4)).toBe(75);
  });

  it("deve retornar score 0 quando Gini == 0.60 (fronteira exata)", () => {
    // gini < 0.60 aplica formula, gini >= 0.60 retorna 0
    expect(scoreCoeficienteGini(0.6)).toBe(0);
  });

  it("deve retornar score > 0 quando Gini < 0.60", () => {
    // Gini = 0.59 → 50 - ((0.59-0.45)/0.15)*50 ≈ 50 - 46.67 ≈ 3
    const score = scoreCoeficienteGini(0.59);
    expect(score).toBeGreaterThan(0);
  });

  it("deve interpolar entre 0.45 e 0.60", () => {
    // Gini = 0.525 → 50 - ((0.525-0.45)/0.15)*50 = 50-25 = 25
    expect(scoreCoeficienteGini(0.525)).toBe(25);
  });

  it("deve retornar score 0 quando Gini > 0.60", () => {
    expect(scoreCoeficienteGini(0.7)).toBe(0);
    expect(scoreCoeficienteGini(1.0)).toBe(0);
  });

  it("deve usar referenceYear 2022 fixo para coeficienteGini", () => {
    const ind = mapToOdsIndicators(makeData()).find(
      (i) => i.odsNumber === 10 && i.indicatorName === "coeficiente_gini",
    )!;
    expect(ind.referenceYear).toBe(2022);
  });

  it("deve omitir indicador coeficiente_gini quando coeficienteGini é null", () => {
    const result = mapToOdsIndicators(makeData({ coeficienteGini: null }));
    expect(result.find((i) => i.indicatorName === "coeficiente_gini")).toBeUndefined();
  });
});

// ─── ODS 10 — scoreRazao2020 ──────────────────────────────────────────────────

describe("ibge_ods_mapper — ODS 10 (razão 20/20)", () => {
  it("deve retornar score 100 quando razão <= 8", () => {
    expect(scoreRazao2020(8)).toBe(100);
    expect(scoreRazao2020(5)).toBe(100);
  });

  it("deve interpolar entre 8 e 15", () => {
    // razão = 11.5 → 100 - ((11.5-8)/7)*50 = 100-25 = 75
    expect(scoreRazao2020(11.5)).toBe(75);
  });

  it("deve retornar score 50 quando razão == 15", () => {
    // 100 - ((15-8)/7)*50 = 100-50 = 50
    expect(scoreRazao2020(15)).toBe(50);
  });

  it("deve interpolar entre 15 e 25", () => {
    // razão = 20 → 50 - ((20-15)/10)*50 = 50-25 = 25
    expect(scoreRazao2020(20)).toBe(25);
  });

  it("deve retornar score 0 quando razão >= 25", () => {
    expect(scoreRazao2020(25)).toBe(0);
    expect(scoreRazao2020(30)).toBe(0);
  });

  it("deve usar referenceYear 2022 fixo para razao_20_20", () => {
    const ind = mapToOdsIndicators(makeData()).find(
      (i) => i.odsNumber === 10 && i.indicatorName === "razao_20_20",
    )!;
    expect(ind.referenceYear).toBe(2022);
  });

  it("deve omitir indicador razao_20_20 quando razao2020 é null", () => {
    const result = mapToOdsIndicators(makeData({ razao2020: null }));
    expect(result.find((i) => i.indicatorName === "razao_20_20")).toBeUndefined();
  });
});

// ─── ODS 11 — scoreUrbanizacaoAdequada ───────────────────────────────────────

describe("ibge_ods_mapper — ODS 11 (urbanização adequada)", () => {
  it("deve retornar score 100 quando pct >= 90%", () => {
    expect(scoreUrbanizacaoAdequada(90)).toBe(100);
    expect(scoreUrbanizacaoAdequada(95)).toBe(100);
  });

  it("deve interpolar entre 70% e 90%", () => {
    // pct = 80% → 50 + ((80-70)/20)*50 = 50+25 = 75
    expect(scoreUrbanizacaoAdequada(80)).toBe(75);
  });

  it("deve retornar score 50 quando pct == 70%", () => {
    // 50 + ((70-70)/20)*50 = 50
    expect(scoreUrbanizacaoAdequada(70)).toBe(50);
  });

  it("deve interpolar entre 20% e 70%", () => {
    // pct = 45% → ((45-20)/50)*50 = 25
    expect(scoreUrbanizacaoAdequada(45)).toBe(25);
  });

  it("deve retornar score 0 quando pct < 20%", () => {
    expect(scoreUrbanizacaoAdequada(19)).toBe(0);
    expect(scoreUrbanizacaoAdequada(0)).toBe(0);
  });

  it("deve usar o nome de indicador 'urbanizacao_adequada'", () => {
    const ind = mapToOdsIndicators(makeData()).find((i) => i.odsNumber === 11)!;
    expect(ind.indicatorName).toBe("urbanizacao_adequada");
  });

  it("deve omitir ODS 11 quando urbanizacaoAdequada é null", () => {
    const result = mapToOdsIndicators(makeData({ urbanizacaoAdequada: null }));
    expect(result.find((i) => i.odsNumber === 11)).toBeUndefined();
  });

  it("deve usar referenceYear 2022 fixo para urbanizacao_adequada", () => {
    const ind = mapToOdsIndicators(makeData()).find((i) => i.odsNumber === 11)!;
    expect(ind.referenceYear).toBe(2022);
  });
});

// ─── Null guards globais ──────────────────────────────────────────────────────

describe("ibge_ods_mapper — lista vazia quando todos null", () => {
  it("deve retornar lista vazia quando todos os indicadores são null", () => {
    const data = makeData({
      pctBaixaRenda: null,
      producaoAgricolaMilReais: null,
      taxaOcupacao: null,
      pibPerCapita: null,
      empresasAtuantes: null,
      coeficienteGini: null,
      razao2020: null,
      urbanizacaoAdequada: null,
    });
    expect(mapToOdsIndicators(data)).toHaveLength(0);
  });
});

// ─── scoreEmpresasPor10k exportado ───────────────────────────────────────────

describe("scoreEmpresasPor10k (exportado diretamente)", () => {
  it("deve retornar 100 para >= 100", () => {
    expect(scoreEmpresasPor10k(100)).toBe(100);
    expect(scoreEmpresasPor10k(150)).toBe(100);
  });

  it("deve retornar 20 para valores abaixo de 20", () => {
    expect(scoreEmpresasPor10k(0)).toBe(20);
    expect(scoreEmpresasPor10k(19.9)).toBe(20);
  });
});
