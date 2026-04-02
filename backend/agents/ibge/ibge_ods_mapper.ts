import type { IbgeMunicipalData } from "../../../shared/types/agents/ibge.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados brutos do IBGE para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos pelo IBGE:
 * - ODS 1  (Pobreza)     : % população com renda até 1/2 SM (invertido: menor = melhor)
 * - ODS 2  (Fome Zero)   : valor da produção agrícola municipal em R$ mil (PAM tabela 5457)
 * - ODS 8  (Trabalho)    : taxa de ocupação + PIB per capita
 * - ODS 9  (Inovação)    : empresas atuantes por 10k habitantes (CEMPRE tabela 9418)
 * - ODS 10 (Desigualdade): Coeficiente de Gini de renda (Censo IBGE 2022) — invertido: menor = melhor
 * - ODS 11 (Cidades)     : densidade demográfica (hab/km²) — faixa ideal 50-500
 */
export function mapToOdsIndicators(data: IbgeMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 1 — Erradicação da Pobreza (% baixa renda — invertido)
  if (ind.pctBaixaRenda !== null) {
    const score = scorePctBaixaRenda(ind.pctBaixaRenda);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 1,
      indicatorName: "pct_baixa_renda",
      value: ind.pctBaixaRenda,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 2 — Fome Zero e Agricultura Sustentável (produção agrícola municipal)
  if (ind.producaoAgricolaMilReais !== null) {
    const score = scoreProducaoAgricola(ind.producaoAgricolaMilReais);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 2,
      indicatorName: "producao_agricola",
      value: ind.producaoAgricolaMilReais,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 8 — Trabalho Decente (taxa de ocupação)
  if (ind.taxaOcupacao !== null) {
    const score = scoreTaxaOcupacao(ind.taxaOcupacao);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 8,
      indicatorName: "taxa_ocupacao",
      value: ind.taxaOcupacao,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 8 — PIB per capita
  if (ind.pibPerCapita !== null) {
    const score = scorePibPerCapita(ind.pibPerCapita);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 8,
      indicatorName: "pib_per_capita",
      value: ind.pibPerCapita,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 9 — Indústria, Inovação e Infraestrutura
  // Indicador: empresas atuantes por 10k habitantes (CEMPRE tabela 9418, variável 2283)
  if (ind.empresasAtuantes !== null && ind.populacao !== null && ind.populacao > 0) {
    const empresasPor10k = (ind.empresasAtuantes / ind.populacao) * 10_000;
    const score = scoreEmpresasPor10k(empresasPor10k);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 9,
      indicatorName: "empresas_por_10k_hab",
      value: Math.round(empresasPor10k * 100) / 100,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  // ODS 10 — Redução das Desigualdades
  // Coeficiente de Gini de renda domiciliar per capita (Censo IBGE 2022).
  // Menor Gini = menor desigualdade de renda = melhor.
  // Indicador direto de desigualdade econômica — mais alinhado ao ODS 10 que razão de dependência.
  if (ind.coeficienteGini !== null) {
    const score = scoreCoeficienteGini(ind.coeficienteGini);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 10,
      indicatorName: "coeficiente_gini",
      value: ind.coeficienteGini,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear: 2022, // Censo IBGE 2022 — ano fixo para este indicador
      referenceDate: new Date("2022-12-31"),
      dataAvailable: true,
    });
  }

  // ODS 11 — Cidades Sustentáveis (densidade demográfica — faixa ideal 50-500 hab/km²)
  if (ind.populacao !== null && ind.areaterritorial !== null && ind.areaterritorial > 0) {
    const densidade = ind.populacao / ind.areaterritorial;
    const score = scoreDensidadeDemografica(densidade);
    indicators.push({
      id: "",
      municipalityId: ibgeCode,
      odsNumber: 11,
      indicatorName: "densidade_demografica",
      value: Math.round(densidade * 100) / 100,
      score,
      status: getOdsStatus(score),
      source: "ibge",
      referenceYear,
      referenceDate,
      dataAvailable: true,
    });
  }

  return indicators;
}

// ─── Funções de normalização (score 0-100) ──────────────────────────────────

/**
 * % população com rendimento até 1/2 SM → score 0-100 (invertido: menor % = melhor).
 * Benchmarks SC: 20% = excelente (score 100), 70% = péssimo (score 0).
 */
function scorePctBaixaRenda(pct: number): number {
  return clampScore(((70 - pct) / (70 - 20)) * 100);
}

/**
 * Valor da produção agrícola municipal (R$ mil) → score 0-100.
 * Proxy para segurança alimentar e dinâmica rural (ODS 2).
 *
 * Escala:
 * - >= R$ 500.000 mil  → 100 (produção robusta)
 * - >= R$ 100.000 mil  →  70 (produção relevante)
 * - >= R$  10.000 mil  →  40 (produção modesta)
 * - <  R$  10.000 mil  →  20 (produção mínima / municípios não agrícolas)
 *
 * Nota: municípios sem atividade agrícola retornam null, não 20.
 */
function scoreProducaoAgricola(valorMilReais: number): number {
  if (valorMilReais >= 500_000) return 100;
  if (valorMilReais >= 100_000) return 70;
  if (valorMilReais >= 10_000) return 40;
  return 20;
}

/**
 * Taxa de ocupação → score 0-100 (maior = melhor).
 * Benchmarks SC: >= 60% = excelente (score 100), <= 30% = péssimo (score 0).
 */
function scoreTaxaOcupacao(taxa: number): number {
  return clampScore(((taxa - 30) / (60 - 30)) * 100);
}

/**
 * PIB per capita → score 0-100.
 * Benchmarks SC: mediana ~R$35k, top quartil ~R$55k.
 * >= R$60.000 = 100, <= R$10.000 = 0.
 */
function scorePibPerCapita(valor: number): number {
  return clampScore(((valor - 10000) / (60000 - 10000)) * 100);
}

/**
 * Empresas atuantes por 10k habitantes → score 0-100.
 * Fonte: IBGE CEMPRE tabela 9418, variável 2283.
 *
 * Pontos de ancoragem (benchmarks municípios SC):
 * - >= 100 empresas/10k = 100 (alta atividade econômica)
 * - >= 50 empresas/10k  =  70 (atividade moderada)
 * - >= 20 empresas/10k  =  40 (atividade baixa)
 * - <  20 empresas/10k  =  20 (atividade mínima)
 *
 * Interpolação linear entre cada faixa.
 */
export function scoreEmpresasPor10k(empresasPor10k: number): number {
  if (empresasPor10k >= 100) return 100;
  if (empresasPor10k >= 50)
    return clampScore(70 + ((empresasPor10k - 50) / (100 - 50)) * 30);
  if (empresasPor10k >= 20)
    return clampScore(40 + ((empresasPor10k - 20) / (50 - 20)) * 30);
  return 20;
}

/**
 * Coeficiente de Gini → score 0-100 (invertido: menor Gini = melhor).
 * Fonte: IBGE Censo Demográfico 2022.
 *
 * Curva de scoring (benchmarks municípios SC):
 * - Gini <= 0.35 → 100  (excelente igualdade)
 * - Gini 0.35–0.45 → 50–100 (interpolação linear)
 * - Gini 0.45–0.60 → 0–50 (interpolação linear)
 * - Gini >= 0.60 → 0  (desigualdade extrema)
 */
export function scoreCoeficienteGini(gini: number): number {
  if (gini <= 0.35) return 100;
  if (gini <= 0.45) return clampScore(100 - ((gini - 0.35) / (0.45 - 0.35)) * 50);
  if (gini < 0.60) return clampScore(50 - ((gini - 0.45) / (0.60 - 0.45)) * 50);
  return 0;
}

/**
 * Densidade demográfica (hab/km²) → score 0-100.
 * Faixa ideal para municípios SC: 50-500 hab/km² → score 100.
 * - Abaixo de 10 hab/km²: isolamento extremo → score fixo 50 (amarelo)
 * - Acima de 2000 hab/km²: superlotação → score fixo 30 (vermelho)
 * - Demais faixas: interpolação linear até a faixa ideal.
 */
function scoreDensidadeDemografica(densidade: number): number {
  if (densidade >= 50 && densidade <= 500) return 100;
  if (densidade > 2000) return 30;
  if (densidade < 10) return 50;
  if (densidade < 50) return clampScore(50 + ((densidade - 10) / (50 - 10)) * 50);
  // densidade > 500 && <= 2000
  return clampScore(100 - ((densidade - 500) / (2000 - 500)) * 70);
}

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}
