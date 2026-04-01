/**
 * Testes de fronteira (boundary values) para todas as funcoes de scoring ODS.
 *
 * As funcoes de scoring sao privadas — testadas indiretamente via mapToOdsIndicators()
 * de cada mapper, passando dados com os valores exatos das fronteiras.
 *
 * Mappers cobertos:
 * - inep_ods_mapper   → scoreIdeb
 * - ibge_ods_mapper   → scorePctBaixaRenda, scoreEquilibrioFiscal
 * - siconfi_ods_mapper → scorePctSaude, scorePctEducacao, scoreDependenciaFpm, scoreEquilibrioFiscal
 * - snis_ods_mapper   → scoreAtendimentoAgua, scoreAtendimentoEsgoto, scorePerdaFaturamento
 */

import { describe, it, expect, vi } from "vitest";

// ─── Mocks obrigatorios ──────────────────────────────────────────────────────

vi.mock("../../../shared/data/ideb_2023.json", () => ({
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

import type { InepMunicipalData } from "../../../shared/types/agents/inep.types.js";
import type { IbgeMunicipalData } from "../../../shared/types/agents/ibge.types.js";
import type { SiconfiMunicipalData } from "../../../shared/types/agents/siconfi.types.js";
import type { SnisMunicipalData } from "../../../shared/types/agents/snis.types.js";

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

// ─── scoreRazaoDependencia (via ibge_ods_mapper — ODS 10) ────────────────────

describe("scoreRazaoDependencia — fronteiras (ODS 10)", () => {
  it("razao_40pct_deve_resultar_em_score_100", () => {
    // Arrange: 40% = fronteira excelente (menor dependencia demografica)
    const data = makeIbgeData({ razaoDependencia: 40 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "razao_dependencia")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("razao_70pct_deve_resultar_em_score_0", () => {
    // Arrange: 70% = fronteira pessima (alta dependencia demografica)
    const data = makeIbgeData({ razaoDependencia: 70 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "razao_dependencia")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("razao_55pct_deve_resultar_em_score_50", () => {
    // Arrange: 55% = ponto medio entre 40% e 70% → score 50
    const data = makeIbgeData({ razaoDependencia: 55 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "razao_dependencia")!;

    // Assert: (70 - 55) / (70 - 40) * 100 = 50
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("razao_acima_70pct_deve_resultar_em_score_0_clamped", () => {
    // Arrange: 80% → acima do teto pessimo → clamped em 0
    const data = makeIbgeData({ razaoDependencia: 80 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "razao_dependencia")!;

    // Assert
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("razao_abaixo_40pct_deve_resultar_em_score_100_clamped", () => {
    // Arrange: 30% → abaixo do minimo excelente → clamped em 100
    const data = makeIbgeData({ razaoDependencia: 30 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "razao_dependencia")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("ODS_10_nao_duplica_ODS_1_indicadores_distintos", () => {
    // Arrange: ambos os indicadores disponiveis
    const data = makeIbgeData({ pctBaixaRenda: 40, razaoDependencia: 55 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ods1 = indicators.filter((i) => i.odsNumber === 1);
    const ods10 = indicators.filter((i) => i.odsNumber === 10);

    // Assert: indicadores distintos — sem duplicacao de indicador entre ODS 1 e 10
    expect(ods1).toHaveLength(1);
    expect(ods10).toHaveLength(1);
    expect(ods1[0]!.indicatorName).toBe("pct_baixa_renda");
    expect(ods10[0]!.indicatorName).toBe("razao_dependencia");
  });
});

// ─── scoreDensidadeDemografica (via ibge_ods_mapper — ODS 11) ────────────────

describe("scoreDensidadeDemografica — fronteiras (ODS 11)", () => {
  // densidade = populacao / areaterritorial

  it("densidade_ideal_175_deve_resultar_em_score_100", () => {
    // Arrange: 175 hab/km² → faixa ideal 50-500
    const data = makeIbgeData({ populacao: 175_000, areaterritorial: 1_000 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "densidade_demografica")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("densidade_50_deve_resultar_em_score_100_fronteira_inferior_ideal", () => {
    // Arrange: 50 hab/km² → fronteira inferior da faixa ideal
    const data = makeIbgeData({ populacao: 50_000, areaterritorial: 1_000 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "densidade_demografica")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("densidade_500_deve_resultar_em_score_100_fronteira_superior_ideal", () => {
    // Arrange: 500 hab/km² → fronteira superior da faixa ideal
    const data = makeIbgeData({ populacao: 500_000, areaterritorial: 1_000 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "densidade_demografica")!;

    // Assert
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
  });

  it("densidade_acima_2000_deve_resultar_em_score_30_superlotacao", () => {
    // Arrange: 3000 hab/km² → superlotacao
    const data = makeIbgeData({ populacao: 3_000_000, areaterritorial: 1_000 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "densidade_demografica")!;

    // Assert: score fixo 30 para superlotacao
    expect(ind.score).toBe(30);
    expect(ind.status).toBe("vermelho");
  });

  it("densidade_abaixo_10_deve_resultar_em_score_50_isolamento", () => {
    // Arrange: 5 hab/km² → isolamento extremo
    const data = makeIbgeData({ populacao: 5_000, areaterritorial: 1_000 });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "densidade_demografica")!;

    // Assert: score fixo 50 para isolamento extremo
    expect(ind.score).toBe(50);
    expect(ind.status).toBe("amarelo");
  });

  it("sem_area_territorial_nao_gera_indicador_ODS11", () => {
    // Arrange: areaterritorial null → divisao impossivel, sem indicador
    const data = makeIbgeData({ populacao: 50_000, areaterritorial: null });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "densidade_demografica");

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
});
