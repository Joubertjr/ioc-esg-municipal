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

// ─── scoreEquilibrioFiscal (via ibge_ods_mapper) ─────────────────────────────

describe("scoreEquilibrioFiscal — fronteiras (IBGE)", () => {
  // Receitas / Despesas = ratio para checar fronteira exata
  // ratio = receitas / despesas → usamos valores que geram ratio exato

  it("ratio_0_7_deve_resultar_em_score_0", () => {
    // Arrange: ratio = 0.7 → fronteira inferior da faixa 0.7-1.0
    const data = makeIbgeData({
      receitasOrcamentarias: 70_000_000,
      despesasOrcamentarias: 100_000_000,
    });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "equilibrio_fiscal")!;

    // Assert: ratio exato 0.7 → score 0
    expect(ind.score).toBe(0);
    expect(ind.status).toBe("vermelho");
  });

  it("ratio_1_0_deve_resultar_em_score_80", () => {
    // Arrange: receitas = despesas → ratio 1.0
    const data = makeIbgeData({
      receitasOrcamentarias: 100_000_000,
      despesasOrcamentarias: 100_000_000,
    });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "equilibrio_fiscal")!;

    // Assert: equilibrio exato → score 80
    expect(ind.score).toBe(80);
    expect(ind.status).toBe("verde");
  });

  it("ratio_1_1_deve_resultar_em_score_100", () => {
    // Arrange: receitas 10% acima das despesas → ratio 1.1
    const data = makeIbgeData({
      receitasOrcamentarias: 110_000_000,
      despesasOrcamentarias: 100_000_000,
    });

    // Act
    const indicators = ibgeMapToOds(data);
    const ind = indicators.find((i) => i.indicatorName === "equilibrio_fiscal")!;

    // Assert: fronteira superior → score maximo 100
    expect(ind.score).toBe(100);
    expect(ind.status).toBe("verde");
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
