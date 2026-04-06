/**
 * Testes de fronteira (boundary values) para todas as funcoes de scoring ODS.
 *
 * As funcoes de scoring sao privadas — testadas indiretamente via mapToOdsIndicators()
 * de cada mapper, passando dados com os valores exatos das fronteiras.
 *
 * Mappers cobertos:
 * - inep_ods_mapper    → scoreIdeb (anos iniciais + anos finais, null, intermediario)
 * - ibge_ods_mapper    → scorePctBaixaRenda, scoreCoeficienteGini, scoreDensidadeDemografica
 * - siconfi_ods_mapper → scorePctSaude, scorePctEducacao, scoreDependenciaFpm
 * - snis_ods_mapper    → scoreAtendimentoAgua, scoreAtendimentoEsgoto,
 *                        scoreEsgotoTratado, scorePerdaFaturamento
 * - datasus_ods_mapper → scorePrevinePct (todos os 6 indicadores Previne Brasil, ODS 3)
 * - pncp_ods_mapper    → scoreTotalContratacoes, scorePercentualDispensas,
 *                        scoreTaxaHomologacao, scorePercentualSrp (ODS 16)
 */

import { describe, it, expect, vi } from "vitest";

// ─── Mocks obrigatorios ──────────────────────────────────────────────────────

vi.mock("../../../shared/data/ideb_2023.json", () => ({
  default: {},
}));

vi.mock("../../../shared/data/gini_2022.json", () => ({
  default: {},
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Importacoes apos mocks ──────────────────────────────────────────────────

import { mapToOdsIndicators as inepMapToOds } from "../../../backend/agents/inep/inep_ods_mapper.js";
import { mapToOdsIndicators as ibgeMapToOds } from "../../../backend/agents/ibge/ibge_ods_mapper.js";
import { mapToOdsIndicators as siconfiMapToOds } from "../../../backend/agents/siconfi/siconfi_ods_mapper.js";
import { mapToOdsIndicators as snisMapToOds } from "../../../backend/agents/snis/snis_ods_mapper.js";
import { mapToOdsIndicators as datasusMapToOds } from "../../../backend/agents/datasus/datasus_ods_mapper.js";
import { mapToOdsIndicators as pncpMapToOds } from "../../../backend/agents/pncp/pncp_ods_mapper.js";

import type { InepMunicipalData } from "../../../shared/types/agents/inep.types.js";
import type { IbgeMunicipalData } from "../../../shared/types/agents/ibge.types.js";
import type { SiconfiMunicipalData } from "../../../shared/types/agents/siconfi.types.js";
import type { SnisMunicipalData } from "../../../shared/types/agents/snis.types.js";
import type { DatasusMunicipalData } from "../../../shared/types/agents/datasus.types.js";
import type { PncpMunicipalData } from "../../../shared/types/agents/pncp.types.js";

// ─── Factories de dados de teste ─────────────────────────────────────────────

const REF_DATE = new Date("2023-12-31");
const IBGE_CODE = "4204202";
const SICONFI_CODE = "420420";

function makeInepData(
  idebAnosIniciais: number | null,
  idebAnosFinais: number | null = null,
): InepMunicipalData {
  return {
    ibgeCode: IBGE_CODE,
    siconfiCode: SICONFI_CODE,
    referenceYear: 2023,
    referenceDate: REF_DATE,
    dataAvailable: true,
    indicators: { idebAnosIniciais, idebAnosFinais },
  };
}

function makeIbgeData(overrides: Partial<IbgeMunicipalData["indicators"]>): IbgeMunicipalData {
  return {
    ibgeCode: IBGE_CODE,
    siconfiCode: SICONFI_CODE,
    referenceYear: 2023,
    referenceDate: REF_DATE,
    dataAvailable: true,
    indicators: {
      populacao: 50000,
      pibPerCapita: null,
      pctBaixaRenda: null,
      taxaOcupacao: null,
      receitasOrcamentarias: null,
      despesasOrcamentarias: null,
      razaoDependencia: null,
      areaterritorial: null,
      producaoAgricolaMilReais: null,
      empresasAtuantes: null,
      coeficienteGini: null,
      razao2020: null,
      urbanizacaoAdequada: null,
      ...overrides,
    },
  };
}

function makeSiconfiData(overrides: Partial<SiconfiMunicipalData["indicators"]>): SiconfiMunicipalData {
  return {
    ibgeCode: IBGE_CODE,
    siconfiCode: SICONFI_CODE,
    referenceYear: 2023,
    referenceDate: REF_DATE,
    dataAvailable: true,
    indicators: {
      fpmAnual: null,
      receitaTotal: null,
      despesaTotal: null,
      despesaSaude: null,
      despesaEducacao: null,
      despesaUrbanismo: null,
      despesaAssistencia: null,
      transferenciasUniao: null,
      fundeb: null,
      populacao: 50000,
      ...overrides,
    },
  };
}

function makeSnisData(overrides: Partial<SnisMunicipalData["indicators"]>): SnisMunicipalData {
  return {
    ibgeCode: IBGE_CODE,
    siconfiCode: SICONFI_CODE,
    referenceYear: 2023,
    referenceDate: REF_DATE,
    dataAvailable: true,
    indicators: {
      atendimentoAgua: null,
      atendimentoEsgoto: null,
      esgotoTratado: null,
      perdaFaturamento: null,
      ...overrides,
    },
  };
}

// ─── scoreIdeb (via inep_ods_mapper) ─────────────────────────────────────────

describe("scoreIdeb — fronteiras", () => {
  it("ideb_0_deve_resultar_em_score_0", () => {
    // Arrange
    const data = makeInepData(0);

    // Act
    const indicators = inepMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_iniciais")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("ideb_4_deve_resultar_em_score_50", () => {
    // Arrange
    const data = makeInepData(4.0);

    // Act
    const indicators = inepMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_iniciais")!;

    // Assert: fronteira inferior da faixa 4.0-7.0 → exatamente 50
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("ideb_7_deve_resultar_em_score_100", () => {
    // Arrange
    const data = makeInepData(7.0);

    // Act
    const indicators = inepMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_iniciais")!;

    // Assert: fronteira superior → score maximo
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("ideb_10_deve_resultar_em_score_100_clamped", () => {
    // Arrange
    const data = makeInepData(10.0);

    // Act
    const indicators = inepMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_iniciais")!;

    // Assert: acima do maximo → clamped em 100
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });
});

// ─── scorePctBaixaRenda (via ibge_ods_mapper) ────────────────────────────────

describe("scorePctBaixaRenda — fronteiras", () => {
  it("pct_20_deve_resultar_em_score_100", () => {
    // Arrange: 20% e o minimo excellente (fronteira superior do score)
    const data = makeIbgeData({ pctBaixaRenda: 20 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "pct_baixa_renda")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("pct_70_deve_resultar_em_score_0", () => {
    // Arrange: 70% e o maximo pessimo (fronteira inferior do score)
    const data = makeIbgeData({ pctBaixaRenda: 70 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "pct_baixa_renda")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("pct_acima_70_deve_resultar_em_score_0_clamped", () => {
    // Arrange: acima de 70% → deve ser clamped em 0
    const data = makeIbgeData({ pctBaixaRenda: 80 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "pct_baixa_renda")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });
});

// ─── scoreCoeficienteGini (via ibge_ods_mapper — ODS 10) ─────────────────────

describe("scoreCoeficienteGini — fronteiras (ODS 10)", () => {
  it("gini_035_deve_resultar_em_score_100", () => {
    // Arrange: 0.35 = fronteira excelente (Gini baixissimo — alta igualdade)
    const data = makeIbgeData({ coeficienteGini: 0.35 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "coeficiente_gini")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("gini_abaixo_035_deve_resultar_em_score_100_clamped", () => {
    // Arrange: 0.30 → abaixo do minimo excelente → score = 100
    const data = makeIbgeData({ coeficienteGini: 0.30 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "coeficiente_gini")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("gini_045_deve_resultar_em_score_50", () => {
    // Arrange: 0.45 = ponto de inflexao — score 50
    const data = makeIbgeData({ coeficienteGini: 0.45 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "coeficiente_gini")!;

    // Assert: 100 - ((0.45 - 0.35) / 0.10) * 50 = 50
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("gini_060_deve_resultar_em_score_0", () => {
    // Arrange: 0.60 = fronteira pessima (desigualdade extrema)
    const data = makeIbgeData({ coeficienteGini: 0.60 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "coeficiente_gini")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("gini_acima_060_deve_resultar_em_score_0_clamped", () => {
    // Arrange: 0.65 → acima do teto pessimo → clamped em 0
    const data = makeIbgeData({ coeficienteGini: 0.65 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "coeficiente_gini")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("ODS_10_nao_duplica_ODS_1_indicadores_distintos", () => {
    // Arrange: somente coeficienteGini disponível (razao2020 null → factory default)
    const data = makeIbgeData({ pctBaixaRenda: 40, coeficienteGini: 0.42 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ods1 = indicators.filter((i) => i.odsNumber === 1);
    const ods10 = indicators.filter((i) => i.odsNumber === 10);

    // Assert: ODS 1 tem pct_baixa_renda; ODS 10 tem coeficiente_gini (razao2020 null)
    expect(ods1).toHaveLength(1);
    expect(ods10).toHaveLength(1);
    expect(ods1[0]!.indicatorName).toBe("pct_baixa_renda");
    expect(ods10[0]!.indicatorName).toBe("coeficiente_gini");
  });

  it("ODS_10_dois_indicadores_quando_ambos_disponiveis", () => {
    // Arrange: ambos coeficienteGini e razao2020 disponíveis
    const data = makeIbgeData({ coeficienteGini: 0.42, razao2020: 11.0 });

    // Act
    const ods10 = ibgeMapToOds(data).filter((i) => i.odsNumber === 10);
    const names = ods10.map((i) => i.indicatorName);

    // Assert: dois indicadores distintos para ODS 10
    expect(ods10).toHaveLength(2);
    expect(names).toContain("coeficiente_gini");
    expect(names).toContain("razao_20_20");
  });
});

// ─── scoreRazao2020 (via ibge_ods_mapper — ODS 10) ───────────────────────────

describe("scoreRazao2020 — fronteiras (ODS 10)", () => {
  it("razao_8_deve_resultar_em_score_100_fronteira_superior", () => {
    // Arrange: razão = 8 → fronteira excelente (muito igualitário)
    const data = makeIbgeData({ razao2020: 8 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "razao_20_20")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("razao_abaixo_8_deve_resultar_em_score_100_clamped", () => {
    // Arrange: razão = 5 → abaixo do teto excelente → score 100
    const data = makeIbgeData({ razao2020: 5 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "razao_20_20")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("razao_15_deve_resultar_em_score_50_ponto_inflexao", () => {
    // Arrange: razão = 15 → ponto de inflexão entre faixas
    const data = makeIbgeData({ razao2020: 15 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "razao_20_20")!;

    // Assert: score = 100 - ((15 - 8) / 7) * 50 = 50
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("razao_25_deve_resultar_em_score_0_desigualdade_extrema", () => {
    // Arrange: razão = 25 → desigualdade extrema
    const data = makeIbgeData({ razao2020: 25 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "razao_20_20")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("razao_acima_25_deve_resultar_em_score_0_clamped", () => {
    // Arrange: razão = 30 → acima do teto → clamped em 0
    const data = makeIbgeData({ razao2020: 30 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "razao_20_20")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("sem_razao2020_nao_gera_indicador_razao_20_20", () => {
    // Arrange: razao2020 null → indicador não gerado
    const data = makeIbgeData({ razao2020: null });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "razao_20_20");

    // Assert
    expect(ind).toBeUndefined();
  });
});

// ─── scoreUrbanizacaoAdequada (via ibge_ods_mapper — ODS 11) ─────────────────

describe("scoreUrbanizacaoAdequada — fronteiras (ODS 11)", () => {
  it("urbanizacao_90pct_deve_resultar_em_score_100", () => {
    // Arrange: 90% → fronteira superior excelente
    const data = makeIbgeData({ urbanizacaoAdequada: 90 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "urbanizacao_adequada")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("urbanizacao_acima_90_deve_resultar_em_score_100_clamped", () => {
    // Arrange: 95% → acima do teto → clamped em 100
    const data = makeIbgeData({ urbanizacaoAdequada: 95 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "urbanizacao_adequada")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("urbanizacao_70pct_deve_resultar_em_score_50_fronteira_moderada", () => {
    // Arrange: 70% → ponto de inflexão inferior
    const data = makeIbgeData({ urbanizacaoAdequada: 70 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "urbanizacao_adequada")!;

    // Assert: score = 50 + ((70 - 70) / 20) * 50 = 50
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("urbanizacao_20pct_deve_resultar_em_score_0_fronteira_inferior", () => {
    // Arrange: 20% → fronteira inferior do range linear
    const data = makeIbgeData({ urbanizacaoAdequada: 20 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "urbanizacao_adequada")!;

    // Assert: score = ((20 - 20) / 50) * 50 = 0
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("urbanizacao_abaixo_20_deve_resultar_em_score_0_clamped", () => {
    // Arrange: 10% → abaixo do mínimo → score 0
    const data = makeIbgeData({ urbanizacaoAdequada: 10 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "urbanizacao_adequada")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("sem_urbanizacaoAdequada_nao_gera_indicador_ODS11", () => {
    // Arrange: urbanizacaoAdequada null → sem indicador
    const data = makeIbgeData({ urbanizacaoAdequada: null });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "urbanizacao_adequada");

    // Assert: ausencia gracosa sem crash
    expect(ind).toBeUndefined();
  });
});

// ─── scorePctSaude (via siconfi_ods_mapper) ──────────────────────────────────

describe("scorePctSaude — fronteiras", () => {
  it("pct_saude_10_deve_resultar_em_score_0", () => {
    // Arrange: 10% de saude → fronteira inferior (abaixo do minimo constitucional)
    const data = makeSiconfiData({
      despesaSaude: 10_000_000,
      despesaTotal: 100_000_000,
    });

    // Act
    const indicators = siconfiMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "pct_despesa_saude")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("pct_saude_15_deve_resultar_em_score_60", () => {
    // Arrange: 15% = minimo constitucional → score 60 (adequado)
    const data = makeSiconfiData({
      despesaSaude: 15_000_000,
      despesaTotal: 100_000_000,
    });

    // Act
    const indicators = siconfiMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "pct_despesa_saude")!;

    // Assert
    expect(ind.score).toBe(60);
    expect(ind.status).toBe("amarelo");
  });

  it("pct_saude_25_deve_resultar_em_score_100", () => {
    // Arrange: 25% = excelente → score maximo
    const data = makeSiconfiData({
      despesaSaude: 25_000_000,
      despesaTotal: 100_000_000,
    });

    // Act
    const indicators = siconfiMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "pct_despesa_saude")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });
});

// ─── scorePctEducacao (via siconfi_ods_mapper) ───────────────────────────────

describe("scorePctEducacao — fronteiras", () => {
  it("pct_educacao_15_deve_resultar_em_score_0", () => {
    // Arrange: 15% → abaixo do minimo constitucional (25%)
    const data = makeSiconfiData({
      despesaEducacao: 15_000_000,
      despesaTotal: 100_000_000,
    });

    // Act
    const indicators = siconfiMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "pct_despesa_educacao")!;

    // Assert: fronteira inferior da faixa 15-25%
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("pct_educacao_25_deve_resultar_em_score_70", () => {
    // Arrange: 25% = minimo constitucional → score 70 (adequado)
    const data = makeSiconfiData({
      despesaEducacao: 25_000_000,
      despesaTotal: 100_000_000,
    });

    // Act
    const indicators = siconfiMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "pct_despesa_educacao")!;

    // Assert
    expect(ind.score).toBe(70);
    expect(ind.status).toBe("verde");
  });

  it("pct_educacao_35_deve_resultar_em_score_100", () => {
    // Arrange: 35% = excelente → score maximo
    const data = makeSiconfiData({
      despesaEducacao: 35_000_000,
      despesaTotal: 100_000_000,
    });

    // Act
    const indicators = siconfiMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "pct_despesa_educacao")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });
});

// ─── scoreDependenciaFpm (via siconfi_ods_mapper) ────────────────────────────

describe("scoreDependenciaFpm — fronteiras", () => {
  it("dependencia_5pct_deve_resultar_em_score_100", () => {
    // Arrange: 5% FPM/receita → excelente autonomia fiscal
    const data = makeSiconfiData({
      fpmAnual: 5_000_000,
      receitaTotal: 100_000_000,
    });

    // Act
    const indicators = siconfiMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "dependencia_fpm")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("dependencia_30pct_deve_resultar_em_score_50", () => {
    // Arrange: 30% FPM/receita → medio
    const data = makeSiconfiData({
      fpmAnual: 30_000_000,
      receitaTotal: 100_000_000,
    });

    // Act
    const indicators = siconfiMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "dependencia_fpm")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("dependencia_60pct_deve_resultar_em_score_0", () => {
    // Arrange: 60% FPM/receita → pessimo
    const data = makeSiconfiData({
      fpmAnual: 60_000_000,
      receitaTotal: 100_000_000,
    });

    // Act
    const indicators = siconfiMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "dependencia_fpm")!;

    // Assert: fronteira inferior → score 0
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("dependencia_acima_60pct_deve_resultar_em_score_0_clamped", () => {
    // Arrange: 80% → acima do teto pessimo → clamped em 0
    const data = makeSiconfiData({
      fpmAnual: 80_000_000,
      receitaTotal: 100_000_000,
    });

    // Act
    const indicators = siconfiMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "dependencia_fpm")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });
});

// ─── scoreIdeb anos finais (via inep_ods_mapper) ─────────────────────────────

describe("scoreIdeb idebAnosFinais — fronteiras", () => {
  it("ideb_anos_finais_0_deve_resultar_em_score_0", () => {
    // Arrange: pior caso absoluto para anos finais
    const data = makeInepData(null, 0);

    // Act
    const indicators = inepMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_finais")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("ideb_anos_finais_4_deve_resultar_em_score_50", () => {
    // Arrange: fronteira inferior da faixa media
    const data = makeInepData(null, 4.0);

    // Act
    const indicators = inepMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_finais")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("ideb_anos_finais_7_deve_resultar_em_score_100", () => {
    // Arrange: fronteira de excelencia
    const data = makeInepData(null, 7.0);

    // Act
    const indicators = inepMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_finais")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("ideb_anos_finais_10_deve_resultar_em_score_100_clamped", () => {
    // Arrange: acima do maximo → clamped
    const data = makeInepData(null, 10.0);

    // Act
    const indicators = inepMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_finais")!;

    // Assert
    expect(ind.score).toBe(100);
  });
});

// ─── scoreIdeb valores intermediarios (via inep_ods_mapper) ──────────────────

describe("scoreIdeb — valores intermediarios", () => {
  it("ideb_2_deve_resultar_em_score_25", () => {
    // Arrange: nota 2.0 → faixa baixa (0-4): (2.0/4.0)*50 = 25
    const data = makeInepData(2.0);

    // Act
    const indicators = inepMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_iniciais")!;

    // Assert
    expect(ind.score).toBe(25);
    expect(ind.status).toBe("vermelho");
  });

  it("ideb_5_5_deve_resultar_em_score_75", () => {
    // Arrange: nota 5.5 → faixa media (4-7): 50 + ((5.5-4.0)/3.0)*50 = 75
    const data = makeInepData(5.5);

    // Act
    const indicators = inepMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "ideb_anos_iniciais")!;

    // Assert
    expect(ind.score).toBe(75);
    expect(ind.status).toBe("verde");
  });
});

// ─── dados ausentes INEP (via inep_ods_mapper) ───────────────────────────────

describe("inep_ods_mapper — dados ausentes", () => {
  it("ambos_null_nao_retorna_indicadores", () => {
    // Arrange: municipio sem dados IDEB (ex: < 5k hab, dados suprimidos)
    const data = makeInepData(null, null);

    // Act
    const indicators = inepMapToOds(data);

    // Assert: lista vazia sem crash
    expect(indicators).toHaveLength(0);
  });

  it("apenas_anos_iniciais_null_retorna_somente_anos_finais", () => {
    // Arrange: apenas anos finais disponivel
    const data = makeInepData(null, 6.0);

    // Act
    const indicators = inepMapToOds(data);

    // Assert: um unico indicador — anos finais
    expect(indicators).toHaveLength(1);
    expect(indicators[0]!.indicatorName).toBe("ideb_anos_finais");
  });

  it("apenas_anos_finais_null_retorna_somente_anos_iniciais", () => {
    // Arrange: apenas anos iniciais disponivel
    const data = makeInepData(5.0, null);

    // Act
    const indicators = inepMapToOds(data);

    // Assert: um unico indicador — anos iniciais
    expect(indicators).toHaveLength(1);
    expect(indicators[0]!.indicatorName).toBe("ideb_anos_iniciais");
  });

  it("ambos_disponiveis_retorna_dois_indicadores_ODS4", () => {
    // Arrange: municipio com ambos os dados
    const data = makeInepData(5.0, 4.5);

    // Act
    const indicators = inepMapToOds(data);

    // Assert: dois indicadores, ambos ODS 4
    expect(indicators).toHaveLength(2);
    expect(indicators.every((i) => i.odsNumber === 4)).toBe(true);
    expect(indicators.find((i) => i.indicatorName === "ideb_anos_iniciais")).toBeDefined();
    expect(indicators.find((i) => i.indicatorName === "ideb_anos_finais")).toBeDefined();
  });

  it("metadados_do_indicador_preenchidos_corretamente", () => {
    // Arrange
    const data = makeInepData(6.0);

    // Act
    const indicators = inepMapToOds(data);
    const ind = indicators[0]!;

    // Assert: campos de auditoria e rastreabilidade
    expect(ind.municipalityId).toBe(IBGE_CODE);
    expect(ind.source).toBe("inep");
    expect(ind.referenceYear).toBe(2023);
    expect(ind.dataAvailable).toBe(true);
  });
});

// ─── scoreAtendimentoAgua (via snis_ods_mapper) ──────────────────────────────

describe("scoreAtendimentoAgua — fronteiras", () => {
  it("atendimento_agua_70pct_deve_resultar_em_score_50", () => {
    // Arrange: 70% → fronteira inferior da faixa boa
    const data = makeSnisData({ atendimentoAgua: 70 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_agua")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("atendimento_agua_95pct_deve_resultar_em_score_100", () => {
    // Arrange: 95% → fronteira de excelencia
    const data = makeSnisData({ atendimentoAgua: 95 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_agua")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("atendimento_agua_100pct_deve_resultar_em_score_100_clamped", () => {
    // Arrange: cobertura total → clamped em 100
    const data = makeSnisData({ atendimentoAgua: 100 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_agua")!;

    // Assert
    expect(ind.score).toBe(100);
  });

  it("atendimento_agua_50pct_deve_resultar_em_score_abaixo_50", () => {
    // Arrange: 50% → faixa ruim (abaixo de 70%)
    const data = makeSnisData({ atendimentoAgua: 50 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_agua")!;

    // Assert: score < 50, status vermelho
    expect(ind.score).toBe(36);
    expect(ind.status).toBe("vermelho");
  });

  it("atendimento_agua_0pct_deve_resultar_em_score_0", () => {
    // Arrange: pior caso absoluto — sem cobertura de agua
    const data = makeSnisData({ atendimentoAgua: 0 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_agua")!;

    // Assert: (0/70)*50 = 0
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("atendimento_agua_null_nao_retorna_indicador", () => {
    // Arrange: dado ausente (municipio sem coleta SNIS para agua)
    const data = makeSnisData({ atendimentoAgua: null });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_agua");

    // Assert: ausencia gracosa sem crash
    expect(ind).toBeUndefined();
  });
});

// ─── scoreAtendimentoEsgoto (via snis_ods_mapper) ────────────────────────────

describe("scoreAtendimentoEsgoto — fronteiras", () => {
  it("atendimento_esgoto_50pct_deve_resultar_em_score_50", () => {
    // Arrange: 50% → fronteira inferior da faixa regular
    const data = makeSnisData({ atendimentoEsgoto: 50 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_esgoto")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("atendimento_esgoto_90pct_deve_resultar_em_score_100", () => {
    // Arrange: 90% → fronteira de excelencia
    const data = makeSnisData({ atendimentoEsgoto: 90 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_esgoto")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("atendimento_esgoto_100pct_deve_resultar_em_score_100_clamped", () => {
    // Arrange: cobertura total → clamped em 100
    const data = makeSnisData({ atendimentoEsgoto: 100 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_esgoto")!;

    // Assert
    expect(ind.score).toBe(100);
  });

  it("atendimento_esgoto_25pct_deve_resultar_em_score_25", () => {
    // Arrange: 25% → faixa ruim (abaixo de 50%)
    const data = makeSnisData({ atendimentoEsgoto: 25 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_esgoto")!;

    // Assert
    expect(ind.score).toBe(25);
    expect(ind.status).toBe("vermelho");
  });

  it("atendimento_esgoto_0pct_deve_resultar_em_score_0", () => {
    // Arrange: pior caso absoluto — sem coleta de esgoto
    const data = makeSnisData({ atendimentoEsgoto: 0 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_esgoto")!;

    // Assert: (0/50)*50 = 0
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("atendimento_esgoto_null_nao_retorna_indicador", () => {
    // Arrange: dado ausente (municipio sem coleta SNIS para esgoto)
    const data = makeSnisData({ atendimentoEsgoto: null });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_esgoto");

    // Assert: ausencia gracosa sem crash
    expect(ind).toBeUndefined();
  });
});

// ─── scorePerdaFaturamento (via snis_ods_mapper) ─────────────────────────────

describe("scorePerdaFaturamento — fronteiras", () => {
  it("perda_15pct_deve_resultar_em_score_100", () => {
    // Arrange: 15% → fronteira superior excelente (invertido: menor perda = melhor)
    const data = makeSnisData({ perdaFaturamento: 15 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_perda_faturamento")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("perda_10pct_deve_resultar_em_score_100_clamped", () => {
    // Arrange: 10% → abaixo da fronteira excelente → clamped em 100
    const data = makeSnisData({ perdaFaturamento: 10 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_perda_faturamento")!;

    // Assert
    expect(ind.score).toBe(100);
  });

  it("perda_35pct_deve_resultar_em_score_50", () => {
    // Arrange: 35% → fronteira de aceitabilidade (score 50)
    const data = makeSnisData({ perdaFaturamento: 35 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_perda_faturamento")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("perda_60pct_deve_resultar_em_score_0", () => {
    // Arrange: 60% → fronteira pessima (score 0)
    const data = makeSnisData({ perdaFaturamento: 60 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_perda_faturamento")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("perda_acima_60pct_deve_resultar_em_score_0_clamped", () => {
    // Arrange: 90% → acima do teto pessimo → clamped em 0
    const data = makeSnisData({ perdaFaturamento: 90 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_perda_faturamento")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("perda_null_nao_retorna_indicador", () => {
    // Arrange: dado ausente (municipio sem coleta SNIS para perdas)
    const data = makeSnisData({ perdaFaturamento: null });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_perda_faturamento");

    // Assert: ausencia gracosa sem crash
    expect(ind).toBeUndefined();
  });
});

// ─── scoreEsgotoTratado (via snis_ods_mapper) — indicador ausente dos testes ──

describe("scoreEsgotoTratado — fronteiras", () => {
  it("esgoto_tratado_0pct_deve_resultar_em_score_0", () => {
    // Arrange: pior caso — nenhum esgoto coletado e tratado
    const data = makeSnisData({ esgotoTratado: 0 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_esgoto_tratado")!;

    // Assert: (0/50)*50 = 0
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("esgoto_tratado_25pct_deve_resultar_em_score_25", () => {
    // Arrange: 25% → faixa ruim (abaixo de 50%): (25/50)*50 = 25
    const data = makeSnisData({ esgotoTratado: 25 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_esgoto_tratado")!;

    // Assert
    expect(ind.score).toBe(25);
    expect(ind.status).toBe("vermelho");
  });

  it("esgoto_tratado_50pct_deve_resultar_em_score_50", () => {
    // Arrange: 50% → fronteira inferior da faixa regular: 50 + ((50-50)/40)*50 = 50
    const data = makeSnisData({ esgotoTratado: 50 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_esgoto_tratado")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("esgoto_tratado_70pct_deve_resultar_em_score_75", () => {
    // Arrange: 70% → faixa regular: 50 + ((70-50)/40)*50 = 75
    const data = makeSnisData({ esgotoTratado: 70 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_esgoto_tratado")!;

    // Assert
    expect(ind.score).toBe(75);
    expect(ind.status).toBe("verde");
  });

  it("esgoto_tratado_90pct_deve_resultar_em_score_100", () => {
    // Arrange: 90% → fronteira de excelencia
    const data = makeSnisData({ esgotoTratado: 90 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_esgoto_tratado")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("esgoto_tratado_100pct_deve_resultar_em_score_100_clamped", () => {
    // Arrange: tratamento total → clamped em 100
    const data = makeSnisData({ esgotoTratado: 100 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_esgoto_tratado")!;

    // Assert
    expect(ind.score).toBe(100);
  });

  it("esgoto_tratado_null_nao_retorna_indicador", () => {
    // Arrange: dado ausente — municipio sem tratamento informado no SNIS
    const data = makeSnisData({ esgotoTratado: null });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_esgoto_tratado");

    // Assert: ausencia gracosa sem crash
    expect(ind).toBeUndefined();
  });
});

// ─── snis_ods_mapper — integridade e metadados ───────────────────────────────

describe("snis_ods_mapper — integridade e metadados", () => {
  it("todos_os_4_indicadores_presentes_retorna_lista_com_4_elementos", () => {
    // Arrange: municipio com todos os dados SNIS disponiveis
    const data = makeSnisData({
      atendimentoAgua: 85,
      atendimentoEsgoto: 60,
      esgotoTratado: 75,
      perdaFaturamento: 20,
    });

    // Act
    const indicators = snisMapToOds(data);

    // Assert: quatro indicadores, todos ODS 6
    expect(indicators).toHaveLength(4);
    expect(indicators.every((i) => i.odsNumber === 6)).toBe(true);
  });

  it("todos_null_retorna_lista_vazia", () => {
    // Arrange: municipio sem nenhum dado SNIS (ex: < 5k hab, sem concessionaria)
    const data = makeSnisData({
      atendimentoAgua: null,
      atendimentoEsgoto: null,
      esgotoTratado: null,
      perdaFaturamento: null,
    });

    // Act
    const indicators = snisMapToOds(data);

    // Assert: lista vazia sem crash
    expect(indicators).toHaveLength(0);
  });

  it("metadados_do_indicador_preenchidos_corretamente", () => {
    // Arrange
    const data = makeSnisData({ atendimentoAgua: 80 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators[0]!;

    // Assert: campos de auditoria e rastreabilidade
    expect(ind.municipalityId).toBe(IBGE_CODE);
    expect(ind.source).toBe("snis");
    expect(ind.referenceYear).toBe(2023);
    expect(ind.dataAvailable).toBe(true);
  });

  it("indicador_intermediario_agua_82pct_deve_resultar_em_score_correto", () => {
    // Arrange: 82% → faixa regular (70-95%): 50 + ((82-70)/25)*50 = 50 + 24 = 74
    const data = makeSnisData({ atendimentoAgua: 82 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_agua")!;

    // Assert
    expect(ind.score).toBe(74);
    expect(ind.status).toBe("verde");
  });

  it("indicador_intermediario_esgoto_70pct_deve_resultar_em_score_correto", () => {
    // Arrange: 70% → faixa regular (50-90%): 50 + ((70-50)/40)*50 = 50 + 25 = 75
    const data = makeSnisData({ atendimentoEsgoto: 70 });

    // Act
    const indicators = snisMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "snis_atendimento_esgoto")!;

    // Assert
    expect(ind.score).toBe(75);
    expect(ind.status).toBe("verde");
  });
});

// ─── Factories — DATASUS e PNCP ──────────────────────────────────────────────

function makeDatasusData(
  overrides: Partial<DatasusMunicipalData["indicators"]>,
): DatasusMunicipalData {
  return {
    ibgeCode: IBGE_CODE,
    siconfiCode: SICONFI_CODE,
    referenceYear: 2023,
    referenceDate: REF_DATE,
    dataAvailable: true,
    indicators: {
      prenatal: null,
      diabetes: null,
      hipertensao: null,
      crescimentoInfantil: null,
      cancerColoUterino: null,
      saudeBucal: null,
      mediaGeral: null,
      ...overrides,
    },
  };
}

function makePncpData(
  overrides: Partial<PncpMunicipalData["indicators"]>,
): PncpMunicipalData {
  return {
    ibgeCode: IBGE_CODE,
    referenceYear: 2023,
    referenceDate: REF_DATE,
    dataAvailable: true,
    indicators: {
      totalContratacoes: 0,
      percentualDispensas: null,
      taxaHomologacao: null,
      percentualSrp: null,
      anoReferencia: 2023,
      ...overrides,
    },
  };
}

// ─── scorePrevinePct (via datasus_ods_mapper — ODS 3) ────────────────────────
//
// Escala nao-linear:
//   >= 80% → 100
//   >= 60% → 70 + ((pct - 60) / 20) * 30
//   >= 30% → 30 + ((pct - 30) / 30) * 40
//   <  30% → (pct / 30) * 30

describe("scorePrevinePct prenatal — fronteiras (ODS 3)", () => {
  it("prenatal_0pct_deve_resultar_em_score_0", () => {
    // Arrange: pior caso absoluto — sem nenhum atendimento pre-natal registrado
    const data = makeDatasusData({ prenatal: 0 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_prenatal")!;

    // Assert: (0/30)*30 = 0
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("prenatal_30pct_deve_resultar_em_score_30", () => {
    // Arrange: 30% → fronteira inferior da faixa regular: 30 + ((30-30)/30)*40 = 30
    const data = makeDatasusData({ prenatal: 30 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_prenatal")!;

    // Assert
    expect(ind.score).toBe(30);
    expect(ind.status).toBe("vermelho");
  });

  it("prenatal_45pct_deve_resultar_em_score_50", () => {
    // Arrange: 45% → meio da faixa regular (30-60%): 30 + ((45-30)/30)*40 = 50
    const data = makeDatasusData({ prenatal: 45 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_prenatal")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("prenatal_60pct_deve_resultar_em_score_70", () => {
    // Arrange: 60% → fronteira inferior da faixa boa: 70 + ((60-60)/20)*30 = 70
    const data = makeDatasusData({ prenatal: 60 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_prenatal")!;

    // Assert
    expect(ind.score).toBe(70);
    expect(ind.status).toBe("verde");
  });

  it("prenatal_80pct_deve_resultar_em_score_100", () => {
    // Arrange: 80% → fronteira de excelencia (benchmark nacional SC)
    const data = makeDatasusData({ prenatal: 80 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_prenatal")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("prenatal_100pct_deve_resultar_em_score_100_clamped", () => {
    // Arrange: 100% → acima do teto excelente → clamped em 100
    const data = makeDatasusData({ prenatal: 100 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_prenatal")!;

    // Assert: clampScore garante que nao ultrapassa 100
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("prenatal_null_nao_retorna_indicador", () => {
    // Arrange: dado ausente — municipio sem registro Previne Brasil para pre-natal
    const data = makeDatasusData({ prenatal: null });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_prenatal");

    // Assert: ausencia gracosa sem crash
    expect(ind).toBeUndefined();
  });
});

describe("scorePrevinePct diabetes — fronteiras (ODS 3)", () => {
  it("diabetes_0pct_deve_resultar_em_score_0", () => {
    // Arrange: ausencia total de monitoramento de diabeticos
    const data = makeDatasusData({ diabetes: 0 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_diabetes")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("diabetes_60pct_deve_resultar_em_score_70", () => {
    // Arrange: 60% → fronteira inferior da faixa boa
    const data = makeDatasusData({ diabetes: 60 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_diabetes")!;

    // Assert
    expect(ind.score).toBe(70);
    expect(ind.status).toBe("verde");
  });

  it("diabetes_80pct_deve_resultar_em_score_100", () => {
    // Arrange: 80% → excelencia
    const data = makeDatasusData({ diabetes: 80 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_diabetes")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });
});

describe("scorePrevinePct hipertensao — fronteiras (ODS 3)", () => {
  it("hipertensao_0pct_deve_resultar_em_score_0", () => {
    // Arrange: pior caso — sem monitoramento de hipertensos
    const data = makeDatasusData({ hipertensao: 0 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_hipertensao")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("hipertensao_30pct_deve_resultar_em_score_30", () => {
    // Arrange: 30% → fronteira inferior da faixa regular
    const data = makeDatasusData({ hipertensao: 30 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_hipertensao")!;

    // Assert
    expect(ind.score).toBe(30);
    expect(ind.status).toBe("vermelho");
  });

  it("hipertensao_80pct_deve_resultar_em_score_100", () => {
    // Arrange: 80% → excelencia
    const data = makeDatasusData({ hipertensao: 80 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_hipertensao")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });
});

describe("scorePrevinePct crescimento_infantil — fronteiras (ODS 3)", () => {
  it("crescimento_infantil_0pct_deve_resultar_em_score_0", () => {
    // Arrange: pior caso — sem acompanhamento de crescimento de criancas
    const data = makeDatasusData({ crescimentoInfantil: 0 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_crescimento_infantil")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("crescimento_infantil_45pct_deve_resultar_em_score_50", () => {
    // Arrange: 45% → ponto medio da faixa regular: 30 + ((45-30)/30)*40 = 50
    const data = makeDatasusData({ crescimentoInfantil: 45 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_crescimento_infantil")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("crescimento_infantil_80pct_deve_resultar_em_score_100", () => {
    // Arrange: 80% → excelencia
    const data = makeDatasusData({ crescimentoInfantil: 80 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_crescimento_infantil")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });
});

describe("scorePrevinePct cancer_colo_uterino — fronteiras (ODS 3)", () => {
  it("cancer_colo_0pct_deve_resultar_em_score_0", () => {
    // Arrange: pior caso — sem rastreamento de cancer de colo uterino
    const data = makeDatasusData({ cancerColoUterino: 0 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_cancer_colo")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("cancer_colo_60pct_deve_resultar_em_score_70", () => {
    // Arrange: 60% → fronteira inferior da faixa boa
    const data = makeDatasusData({ cancerColoUterino: 60 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_cancer_colo")!;

    // Assert
    expect(ind.score).toBe(70);
    expect(ind.status).toBe("verde");
  });

  it("cancer_colo_80pct_deve_resultar_em_score_100", () => {
    // Arrange: 80% → excelencia
    const data = makeDatasusData({ cancerColoUterino: 80 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_cancer_colo")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });
});

describe("scorePrevinePct saude_bucal — fronteiras (ODS 3)", () => {
  it("saude_bucal_0pct_deve_resultar_em_score_0", () => {
    // Arrange: pior caso — sem atendimento odontologico registrado no Previne
    const data = makeDatasusData({ saudeBucal: 0 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_saude_bucal")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("saude_bucal_30pct_deve_resultar_em_score_30", () => {
    // Arrange: 30% → fronteira inferior da faixa regular
    const data = makeDatasusData({ saudeBucal: 30 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_saude_bucal")!;

    // Assert
    expect(ind.score).toBe(30);
    expect(ind.status).toBe("vermelho");
  });

  it("saude_bucal_80pct_deve_resultar_em_score_100", () => {
    // Arrange: 80% → excelencia
    const data = makeDatasusData({ saudeBucal: 80 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_saude_bucal")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });
});

describe("datasus_ods_mapper — integridade e metadados (ODS 3)", () => {
  it("todos_6_indicadores_presentes_retorna_lista_com_6_elementos", () => {
    // Arrange: municipio com todos os dados Previne Brasil disponiveis
    const data = makeDatasusData({
      prenatal: 75,
      diabetes: 65,
      hipertensao: 55,
      crescimentoInfantil: 80,
      cancerColoUterino: 70,
      saudeBucal: 60,
    });

    // Act
    const indicators = datasusMapToOds(data);

    // Assert: seis indicadores, todos ODS 3
    expect(indicators).toHaveLength(6);
    expect(indicators.every((i) => i.odsNumber === 3)).toBe(true);
  });

  it("todos_null_retorna_lista_vazia", () => {
    // Arrange: municipio sem dados Previne Brasil (ex: sem ESF cadastrada)
    const data = makeDatasusData({});

    // Act
    const indicators = datasusMapToOds(data);

    // Assert: lista vazia sem crash
    expect(indicators).toHaveLength(0);
  });

  it("score_sempre_entre_0_e_100_para_qualquer_percentual_Previne", () => {
    // Arrange: valor negativo (dado corrompido) — clamp deve proteger
    const data = makeDatasusData({ prenatal: -10 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_prenatal")!;

    // Assert: clampScore garante fronteira inferior em 0
    expect(ind.score).toBeGreaterThanOrEqual(0);
    expect(ind.score).toBeLessThanOrEqual(100);
  });

  it("metadados_do_indicador_preenchidos_corretamente", () => {
    // Arrange
    const data = makeDatasusData({ prenatal: 70 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators[0]!;

    // Assert: campos de auditoria e rastreabilidade
    expect(ind.municipalityId).toBe(IBGE_CODE);
    expect(ind.source).toBe("datasus");
    expect(ind.referenceYear).toBe(2023);
    expect(ind.dataAvailable).toBe(true);
    expect(ind.odsNumber).toBe(3);
  });

  it("intermediario_previne_15pct_deve_resultar_em_score_15", () => {
    // Arrange: 15% → faixa ruim (0-30%): (15/30)*30 = 15
    const data = makeDatasusData({ prenatal: 15 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_prenatal")!;

    // Assert
    expect(ind.score).toBe(15);
    expect(ind.status).toBe("vermelho");
  });

  it("intermediario_previne_70pct_deve_resultar_em_score_85", () => {
    // Arrange: 70% → faixa boa (60-80%): 70 + ((70-60)/20)*30 = 70 + 15 = 85
    const data = makeDatasusData({ prenatal: 70 });

    // Act
    const indicators = datasusMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "previne_prenatal")!;

    // Assert
    expect(ind.score).toBe(85);
    expect(ind.status).toBe("verde");
  });
});

// ─── scoreTotalContratacoes (via pncp_ods_mapper — ODS 16) ───────────────────
//
// Interpolacao linear: 0 → score 0 | >= 50 → score 100

describe("scoreTotalContratacoes — fronteiras (ODS 16)", () => {
  it("total_0_contratacoes_deve_resultar_em_score_0", () => {
    // Arrange: municipio sem nenhuma publicacao no PNCP — ausencia total de transparencia
    const data = makePncpData({ totalContratacoes: 0 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "total_contratacoes_publicadas")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("total_25_contratacoes_deve_resultar_em_score_50", () => {
    // Arrange: 25 publicacoes → ponto medio linear (25/50)*100 = 50
    const data = makePncpData({ totalContratacoes: 25 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "total_contratacoes_publicadas")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("total_50_contratacoes_deve_resultar_em_score_100", () => {
    // Arrange: 50 publicacoes → fronteira de excelencia (benchmark SC 2024)
    const data = makePncpData({ totalContratacoes: 50 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "total_contratacoes_publicadas")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("total_100_contratacoes_deve_resultar_em_score_100_clamped", () => {
    // Arrange: 100 publicacoes → acima do benchmark → clamped em 100
    const data = makePncpData({ totalContratacoes: 100 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "total_contratacoes_publicadas")!;

    // Assert: clampScore impede ultrapassar 100
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });
});

// ─── scorePercentualDispensas (via pncp_ods_mapper — ODS 16) ─────────────────
//
// Indicador invertido: menor percentual de dispensas = melhor score.
// <= 20% → 100 | >= 40% → 0 | linear entre 20-40

describe("scorePercentualDispensas — fronteiras (ODS 16)", () => {
  it("dispensas_0pct_deve_resultar_em_score_100", () => {
    // Arrange: todas via processo competitivo — sem dispensa direta
    const data = makePncpData({ percentualDispensas: 0 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_dispensas")!;

    // Assert: abaixo de 20% → score maximo
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("dispensas_20pct_deve_resultar_em_score_100", () => {
    // Arrange: 20% → fronteira do excelente (limite aceitavel de dispensas)
    const data = makePncpData({ percentualDispensas: 20 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_dispensas")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("dispensas_30pct_deve_resultar_em_score_50", () => {
    // Arrange: 30% → ponto medio da faixa ruim (20-40%): ((40-30)/(40-20))*100 = 50
    const data = makePncpData({ percentualDispensas: 30 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_dispensas")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("dispensas_40pct_deve_resultar_em_score_0", () => {
    // Arrange: 40% → fronteira pessima (excesso de contratacao direta)
    const data = makePncpData({ percentualDispensas: 40 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_dispensas")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("dispensas_60pct_deve_resultar_em_score_0_clamped", () => {
    // Arrange: 60% → acima do teto pessimo → clamped em 0
    const data = makePncpData({ percentualDispensas: 60 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_dispensas")!;

    // Assert: clampScore garante que nao vai abaixo de 0
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("dispensas_null_nao_retorna_indicador", () => {
    // Arrange: dado ausente — municipio sem contratacoes suficientes para calcular
    const data = makePncpData({ percentualDispensas: null });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_dispensas");

    // Assert: ausencia gracosa sem crash
    expect(ind).toBeUndefined();
  });
});

// ─── scoreTaxaHomologacao (via pncp_ods_mapper — ODS 16) ─────────────────────
//
// >= 1.0 (aditivos) → 70 (neutro)
// >= 0.9            → 100
// < 0.5             → 0
// linear entre 0.5 e 0.9

describe("scoreTaxaHomologacao — fronteiras (ODS 16)", () => {
  it("taxa_homologacao_0pct_deve_resultar_em_score_0", () => {
    // Arrange: 0.0 → sem homologacao — todos os contratos cancelados
    const data = makePncpData({ taxaHomologacao: 0 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "taxa_homologacao")!;

    // Assert: abaixo de 0.5 → score 0
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("taxa_homologacao_50pct_deve_resultar_em_score_0", () => {
    // Arrange: 0.5 → fronteira inferior da faixa aceitavel
    const data = makePncpData({ taxaHomologacao: 0.5 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "taxa_homologacao")!;

    // Assert: ((0.5-0.5)/(0.9-0.5))*100 = 0
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("taxa_homologacao_70pct_deve_resultar_em_score_50", () => {
    // Arrange: 0.7 → ponto medio da faixa: ((0.7-0.5)/(0.9-0.5))*100 = 50
    const data = makePncpData({ taxaHomologacao: 0.7 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "taxa_homologacao")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("taxa_homologacao_90pct_deve_resultar_em_score_100", () => {
    // Arrange: 0.9 → fronteira de excelencia (contratos executados conforme planejado)
    const data = makePncpData({ taxaHomologacao: 0.9 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "taxa_homologacao")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("taxa_homologacao_acima_100pct_deve_resultar_em_score_70_neutro", () => {
    // Arrange: 1.1 → aditivos de acrescimo — situacao neutra (nao positivo nem negativo)
    const data = makePncpData({ taxaHomologacao: 1.1 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "taxa_homologacao")!;

    // Assert: regra especial — score fixo 70 para aditivos
    expect(ind.score).toBe(70);
    expect(ind.status).toBe("verde");
  });

  it("taxa_homologacao_null_nao_retorna_indicador", () => {
    // Arrange: dado ausente — municipio sem contratacoes com valor homologado
    const data = makePncpData({ taxaHomologacao: null });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "taxa_homologacao");

    // Assert: ausencia gracosa sem crash
    expect(ind).toBeUndefined();
  });
});

// ─── scorePercentualSrp (via pncp_ods_mapper — ODS 16) ───────────────────────
//
// Interpolacao linear: 0% → score 0 | >= 30% → score 100

describe("scorePercentualSrp — fronteiras (ODS 16)", () => {
  it("srp_0pct_deve_resultar_em_score_0", () => {
    // Arrange: municipio sem nenhuma contratacao via SRP — baixa eficiencia
    const data = makePncpData({ percentualSrp: 0 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_srp")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("srp_15pct_deve_resultar_em_score_50", () => {
    // Arrange: 15% → ponto medio linear (15/30)*100 = 50
    const data = makePncpData({ percentualSrp: 15 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_srp")!;

    // Assert
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("srp_30pct_deve_resultar_em_score_100", () => {
    // Arrange: 30% → fronteira de excelencia (benchmark SC 2024)
    const data = makePncpData({ percentualSrp: 30 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_srp")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("srp_50pct_deve_resultar_em_score_100_clamped", () => {
    // Arrange: 50% → acima do benchmark → clamped em 100
    const data = makePncpData({ percentualSrp: 50 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_srp")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("srp_null_nao_retorna_indicador", () => {
    // Arrange: dado ausente — municipio sem contratacoes com campo srp informado
    const data = makePncpData({ percentualSrp: null });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "percentual_srp");

    // Assert: ausencia gracosa sem crash
    expect(ind).toBeUndefined();
  });
});

// ─── pncp_ods_mapper — integridade e metadados (ODS 16) ──────────────────────

describe("pncp_ods_mapper — integridade e metadados", () => {
  it("todos_4_indicadores_presentes_retorna_lista_com_4_elementos", () => {
    // Arrange: municipio com todos os dados PNCP disponiveis
    const data = makePncpData({
      totalContratacoes: 40,
      percentualDispensas: 25,
      taxaHomologacao: 0.85,
      percentualSrp: 20,
    });

    // Act
    const indicators = pncpMapToOds(data);

    // Assert: quatro indicadores, todos ODS 16
    expect(indicators).toHaveLength(4);
    expect(indicators.every((i) => i.odsNumber === 16)).toBe(true);
  });

  it("apenas_total_contratacoes_sempre_retornado_mesmo_sem_outros_dados", () => {
    // Arrange: totalContratacoes nao e nullable — sempre gera indicador
    const data = makePncpData({
      totalContratacoes: 10,
      percentualDispensas: null,
      taxaHomologacao: null,
      percentualSrp: null,
    });

    // Act
    const indicators = pncpMapToOds(data);

    // Assert: apenas o indicador de volume de contratacoes
    expect(indicators).toHaveLength(1);
    expect(indicators[0]!.indicatorName).toBe("total_contratacoes_publicadas");
  });

  it("score_sempre_entre_0_e_100_para_qualquer_entrada", () => {
    // Arrange: valores extremos em todos os indicadores
    const data = makePncpData({
      totalContratacoes: 999,
      percentualDispensas: 100,
      taxaHomologacao: 2.5,
      percentualSrp: 100,
    });

    // Act
    const indicators = pncpMapToOds(data);

    // Assert: todos os scores dentro do intervalo valido
    for (const ind of indicators) {
      expect(ind.score).toBeGreaterThanOrEqual(0);
      expect(ind.score).toBeLessThanOrEqual(100);
    }
  });

  it("metadados_do_indicador_preenchidos_corretamente", () => {
    // Arrange
    const data = makePncpData({ totalContratacoes: 30 });

    // Act
    const indicators = pncpMapToOds(data);
    const ind = indicators[0]!;

    // Assert: campos de auditoria e rastreabilidade
    expect(ind.municipalityId).toBe(IBGE_CODE);
    expect(ind.source).toBe("pncp");
    expect(ind.referenceYear).toBe(2023);
    expect(ind.dataAvailable).toBe(true);
    expect(ind.odsNumber).toBe(16);
  });

  it("status_thresholds_verde_amarelo_vermelho_aplicados_corretamente", () => {
    // Arrange: valores calibrados para cada status
    // verde >= 70: totalContratacoes = 50 → score 100
    // amarelo 40-69: totalContratacoes = 20 → score 40
    // vermelho < 40: totalContratacoes = 5 → score 10
    const dadosVerde = makePncpData({ totalContratacoes: 50 });
    const dadosAmarelo = makePncpData({ totalContratacoes: 20 });
    const dadosVermelho = makePncpData({ totalContratacoes: 5 });

    // Act
    const indVerde = pncpMapToOds(dadosVerde).find((i) => i.indicatorName === "total_contratacoes_publicadas")!;
    const indAmarelo = pncpMapToOds(dadosAmarelo).find((i) => i.indicatorName === "total_contratacoes_publicadas")!;
    const indVermelho = pncpMapToOds(dadosVermelho).find((i) => i.indicatorName === "total_contratacoes_publicadas")!;

    // Assert
    expect(indVerde.status).toBe("verde");
    expect(indAmarelo.status).toBe("amarelo");
    expect(indVermelho.status).toBe("vermelho");
  });
});
