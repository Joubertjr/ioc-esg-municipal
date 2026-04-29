import { ODS_DEFINITIONS } from "../../../shared/constants/ods.js";
import { ODS_DESCRIPTIONS } from "../../../shared/constants/ods-descriptions.js";

export interface FormulaVariable {
  symbol: string;
  meaning: string;
}

export interface IndicatorMethodology {
  name: string;
  label: string;
  unit: string;
  source: string;
  agent: string;
  explanation: string;
  goodDirection: "up" | "down";
  formula: string;
  formulaVariables: FormulaVariable[];
  benchmarks: { min: string; max: string; description: string };
}

export interface OdsMethodology {
  odsNumber: number;
  name: string;
  shortName: string;
  color: string;
  weight: number;
  description: string;
  meta2030: string;
  aggregation: string;
  indicators: IndicatorMethodology[];
}

export interface MethodologyReport {
  version: string;
  lastUpdated: string;
  globalScoreMethod: {
    arithmetic: string;
    geometric: string;
    preferred: string;
  };
  statusThresholds: {
    verde: string;
    amarelo: string;
    vermelho: string;
  };
  ods: OdsMethodology[];
}

/**
 * Indicator benchmark definitions keyed by ODS number then indicator name.
 * Each entry captures the exact scoring logic used in the ODS mapper agents.
 */
const INDICATOR_BENCHMARKS: Record<
  number,
  Record<
    string,
    {
      label: string;
      unit: string;
      source: string;
      agent: string;
      explanation: string;
      goodDirection: "up" | "down";
      formula: string;
      formulaVariables: FormulaVariable[];
      benchmarks: { min: string; max: string; description: string };
    }
  >
> = {
  1: {
    pct_baixa_renda: {
      label: "População em Baixa Renda",
      unit: "%",
      source: "IBGE Censo 2022",
      agent: "ibge",
      explanation:
        "Percentual da população com renda domiciliar per capita inferior a 1/2 salário mínimo.",
      goodDirection: "down",
      formula: "score = ((70 - pct) / 50) × 100  [clamped 0–100]",
      formulaVariables: [
        {
          symbol: "pct",
          meaning: "Percentual da população com renda inferior a ½ salário mínimo no município",
        },
        { symbol: "70", meaning: "Pior cenário (70% da população em baixa renda = score 0)" },
        { symbol: "50", meaning: "Amplitude da faixa (70% − 20% = 50 pontos percentuais)" },
        { symbol: "100", meaning: "Escala final do score (0 a 100)" },
        {
          symbol: "clamped 0–100",
          meaning: "Resultado limitado entre 0 e 100, sem negativos nem excedentes",
        },
      ],
      benchmarks: {
        min: "70% da população = score 0",
        max: "20% da população = score 100",
        description:
          "Indicador invertido. Quanto menor o percentual de baixa renda, maior o score. Patamar mínimo aceitável: 70%; ideal: ≤20%.",
      },
    },
  },

  2: {
    producao_agricola: {
      label: "Produção Agrícola",
      unit: "R$ (valor de produção)",
      source: "IBGE PAM",
      agent: "ibge",
      explanation: "Valor total da produção agrícola municipal (Pesquisa Agrícola Municipal).",
      goodDirection: "up",
      formula: "≥500k → 100 | ≥100k → 70 | ≥10k → 40 | <10k → 20",
      formulaVariables: [
        {
          symbol: "500k, 100k, 10k",
          meaning: "Valor de produção agrícola municipal em reais (R$)",
        },
        { symbol: "100, 70, 40, 20", meaning: "Score atribuído em cada faixa de produção" },
        {
          symbol: "→",
          meaning: "Se o valor é igual ou maior que o limiar, atribui o score correspondente",
        },
      ],
      benchmarks: {
        min: "<10k = score 20",
        max: "≥500k = score 100",
        description:
          "Função degrau baseada no valor de produção. Municípios sem atividade agrícola expressiva recebem score mínimo de 20.",
      },
    },
    sisvan_cobertura_acompanhamento: {
      label: "Cobertura SISVAN — Acompanhamento Nutricional",
      unit: "%",
      source: "SISVAN / DATASUS",
      agent: "sisvan",
      explanation:
        "Percentual da população em acompanhamento nutricional pelo SISVAN (Sistema de Vigilância Alimentar e Nutricional).",
      goodDirection: "up",
      formula: "≥85% → 100 | ≥60% → interpolação linear 50–100 | <60% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥85%",
          meaning: "Se a cobertura de acompanhamento nutricional é 85% ou mais, score máximo (100)",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a cobertura sobe de 60% a 85%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning: "Score cresce proporcionalmente de 0 a 50 conforme a cobertura sobe de 0% a 60%",
        },
      ],
      benchmarks: {
        min: "0% = score 0",
        max: "≥85% = score 100",
        description:
          "Meta nacional de cobertura: 85%. Abaixo de 60% indica cobertura insuficiente.",
      },
    },
    sisvan_deficit_nutricional: {
      label: "Déficit Nutricional Infantil",
      unit: "%",
      source: "SISVAN / DATASUS",
      agent: "sisvan",
      explanation:
        "Percentual de crianças menores de 5 anos com déficit de peso para a idade (desnutrição).",
      goodDirection: "down",
      formula:
        "≤5% → 100 | ≤10% → interpolação linear 50–100 | >10% → interpolação linear 0–50 [invertido]",
      formulaVariables: [
        {
          symbol: "≤5%",
          meaning:
            "Se o déficit nutricional infantil é 5% ou menos, score máximo (100) — referência OMS",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score decresce proporcionalmente de 100 a 50 conforme o déficit sobe de 5% a 10%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score decresce proporcionalmente de 50 a 0 conforme o déficit sobe acima de 10%",
        },
        {
          symbol: "invertido",
          meaning: "Indicador invertido: quanto maior o déficit nutricional, menor o score",
        },
      ],
      benchmarks: {
        min: ">10% = score 0–50 (inversamente proporcional)",
        max: "≤5% = score 100",
        description: "Indicador invertido. Referência OMS: ≤5% aceitável; >10% é situação crítica.",
      },
    },
    sisvan_sobrepeso_infantil: {
      label: "Sobrepeso Infantil",
      unit: "%",
      source: "SISVAN / DATASUS",
      agent: "sisvan",
      explanation:
        "Percentual de crianças menores de 5 anos com sobrepeso (IMC acima do padrão OMS).",
      goodDirection: "down",
      formula:
        "≤10% → 100 | ≤20% → interpolação linear 50–100 | >20% → interpolação linear 0–50 [invertido]",
      formulaVariables: [
        {
          symbol: "≤10%",
          meaning: "Se o sobrepeso infantil é 10% ou menos, score máximo (100) — referência OMS",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score decresce proporcionalmente de 100 a 50 conforme o sobrepeso sobe de 10% a 20%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning: "Score decresce proporcionalmente de 50 a 0 conforme o sobrepeso ultrapassa 20%",
        },
        {
          symbol: "invertido",
          meaning: "Indicador invertido: quanto maior o percentual de sobrepeso, menor o score",
        },
      ],
      benchmarks: {
        min: ">20% = score 0–50 (inversamente proporcional)",
        max: "≤10% = score 100",
        description:
          "Indicador invertido. Referência OMS: ≤10% aceitável; >20% indica problema de saúde pública.",
      },
    },
  },

  3: {
    pct_despesa_saude: {
      label: "Despesa com Saúde (% receita)",
      unit: "%",
      source: "SICONFI / STN",
      agent: "siconfi",
      explanation:
        "Percentual da receita corrente líquida municipal destinado à função Saúde (função 10 SICONFI).",
      goodDirection: "up",
      formula: "≥25% → 100 | ≥15% → interpolação linear 60–100 | ≥10% → interpolação linear 0–60",
      formulaVariables: [
        {
          symbol: "≥25%",
          meaning: "Se o município destina 25% ou mais da receita à saúde, score máximo (100)",
        },
        {
          symbol: "interpolação linear 60–100",
          meaning:
            "Score cresce proporcionalmente de 60 a 100 conforme o gasto sobe de 15% a 25% — faixa acima do mínimo constitucional",
        },
        {
          symbol: "interpolação linear 0–60",
          meaning:
            "Score cresce proporcionalmente de 0 a 60 conforme o gasto sobe de 10% a 15% — faixa abaixo do mínimo constitucional",
        },
        {
          symbol: "15%",
          meaning:
            "Mínimo constitucional obrigatório (EC 29/2000) — abaixo disso o município está em não conformidade",
        },
      ],
      benchmarks: {
        min: "<10% = score 0",
        max: "≥25% = score 100",
        description:
          "Mínimo constitucional (EC 29/2000): 15%. Municípios acima de 25% demonstram priorização da saúde.",
      },
    },
    previne_prenatal: {
      label: "Pré-natal Adequado (Previne Brasil)",
      unit: "%",
      source: "DATASUS / e-Gestor AB",
      agent: "datasus",
      explanation:
        "Percentual de gestantes com pelo menos 6 consultas de pré-natal e testagem para sífilis e HIV (indicador Previne Brasil).",
      goodDirection: "up",
      formula:
        "≥80% → 100 | ≥60% → interpolação linear 70–100 | ≥30% → interpolação linear 30–70 | <30% → interpolação linear 0–30",
      formulaVariables: [
        {
          symbol: "≥80%",
          meaning: "Se 80% ou mais das gestantes têm pré-natal adequado, score máximo (100)",
        },
        {
          symbol: "interpolação linear 70–100",
          meaning:
            "Score cresce proporcionalmente de 70 a 100 conforme a cobertura sobe de 60% a 80% — acima da meta nacional",
        },
        {
          symbol: "interpolação linear 30–70",
          meaning:
            "Score cresce proporcionalmente de 30 a 70 conforme a cobertura sobe de 30% a 60% — faixa intermediária",
        },
        {
          symbol: "interpolação linear 0–30",
          meaning:
            "Score cresce proporcionalmente de 0 a 30 conforme a cobertura sobe de 0% a 30% — cobertura insuficiente",
        },
        {
          symbol: "60%",
          meaning: "Meta Previne Brasil — limiar que separa desempenho adequado do intermediário",
        },
      ],
      benchmarks: {
        min: "<30% = score 0–30",
        max: "≥80% = score 100",
        description:
          "Meta Previne Brasil: 60%. Abaixo de 30% indica falha grave na atenção pré-natal.",
      },
    },
    previne_diabetes: {
      label: "Controle de Diabetes (Previne Brasil)",
      unit: "%",
      source: "DATASUS / e-Gestor AB",
      agent: "datasus",
      explanation:
        "Percentual de diabéticos cadastrados com hemoglobina glicada solicitada no período (indicador Previne Brasil).",
      goodDirection: "up",
      formula:
        "≥80% → 100 | ≥60% → interpolação linear 70–100 | ≥30% → interpolação linear 30–70 | <30% → interpolação linear 0–30",
      formulaVariables: [
        {
          symbol: "≥80%",
          meaning:
            "Se 80% ou mais dos diabéticos têm hemoglobina glicada solicitada, score máximo (100)",
        },
        {
          symbol: "interpolação linear 70–100",
          meaning:
            "Score cresce proporcionalmente de 70 a 100 conforme o controle sobe de 60% a 80% — acima da meta nacional",
        },
        {
          symbol: "interpolação linear 30–70",
          meaning:
            "Score cresce proporcionalmente de 30 a 70 conforme o controle sobe de 30% a 60%",
        },
        {
          symbol: "interpolação linear 0–30",
          meaning:
            "Score cresce proporcionalmente de 0 a 30 conforme o controle sobe de 0% a 30% — monitoramento insuficiente",
        },
        {
          symbol: "60%",
          meaning: "Meta Previne Brasil — limiar que separa desempenho adequado do intermediário",
        },
      ],
      benchmarks: {
        min: "<30% = score 0–30",
        max: "≥80% = score 100",
        description: "Meta Previne Brasil: 60%. Monitoramento regular evita complicações graves.",
      },
    },
    previne_hipertensao: {
      label: "Controle de Hipertensão (Previne Brasil)",
      unit: "%",
      source: "DATASUS / e-Gestor AB",
      agent: "datasus",
      explanation:
        "Percentual de hipertensos cadastrados com pressão arterial aferida nos últimos 6 meses (indicador Previne Brasil).",
      goodDirection: "up",
      formula:
        "≥80% → 100 | ≥60% → interpolação linear 70–100 | ≥30% → interpolação linear 30–70 | <30% → interpolação linear 0–30",
      formulaVariables: [
        {
          symbol: "≥80%",
          meaning:
            "Se 80% ou mais dos hipertensos tiveram pressão arterial aferida, score máximo (100)",
        },
        {
          symbol: "interpolação linear 70–100",
          meaning:
            "Score cresce proporcionalmente de 70 a 100 conforme o acompanhamento sobe de 60% a 80%",
        },
        {
          symbol: "interpolação linear 30–70",
          meaning:
            "Score cresce proporcionalmente de 30 a 70 conforme o acompanhamento sobe de 30% a 60%",
        },
        {
          symbol: "interpolação linear 0–30",
          meaning:
            "Score cresce proporcionalmente de 0 a 30 conforme o acompanhamento sobe de 0% a 30% — controle insuficiente",
        },
        {
          symbol: "60%",
          meaning: "Meta Previne Brasil — limiar que separa desempenho adequado do intermediário",
        },
      ],
      benchmarks: {
        min: "<30% = score 0–30",
        max: "≥80% = score 100",
        description:
          "Meta Previne Brasil: 60%. Hipertensão controlada reduz mortes por doenças cardiovasculares.",
      },
    },
    previne_crescimento_infantil: {
      label: "Acompanhamento Crescimento Infantil (Previne Brasil)",
      unit: "%",
      source: "DATASUS / e-Gestor AB",
      agent: "datasus",
      explanation:
        "Percentual de crianças menores de 2 anos com pelo menos 2 consultas de puericultura no período (indicador Previne Brasil).",
      goodDirection: "up",
      formula:
        "≥80% → 100 | ≥60% → interpolação linear 70–100 | ≥30% → interpolação linear 30–70 | <30% → interpolação linear 0–30",
      formulaVariables: [
        {
          symbol: "≥80%",
          meaning:
            "Se 80% ou mais das crianças menores de 2 anos têm puericultura em dia, score máximo (100)",
        },
        {
          symbol: "interpolação linear 70–100",
          meaning:
            "Score cresce proporcionalmente de 70 a 100 conforme a cobertura sobe de 60% a 80%",
        },
        {
          symbol: "interpolação linear 30–70",
          meaning:
            "Score cresce proporcionalmente de 30 a 70 conforme a cobertura sobe de 30% a 60%",
        },
        {
          symbol: "interpolação linear 0–30",
          meaning:
            "Score cresce proporcionalmente de 0 a 30 conforme a cobertura sobe de 0% a 30% — acompanhamento insuficiente",
        },
        {
          symbol: "60%",
          meaning: "Meta Previne Brasil — limiar que separa desempenho adequado do intermediário",
        },
      ],
      benchmarks: {
        min: "<30% = score 0–30",
        max: "≥80% = score 100",
        description:
          "Acompanhamento precoce reduz mortalidade infantil e desnutrição nos primeiros anos de vida.",
      },
    },
    previne_cancer_colo: {
      label: "Rastreamento Câncer Colo do Útero (Previne Brasil)",
      unit: "%",
      source: "DATASUS / e-Gestor AB",
      agent: "datasus",
      explanation:
        "Percentual de mulheres de 25 a 64 anos com exame citopatológico realizado nos últimos 3 anos (indicador Previne Brasil).",
      goodDirection: "up",
      formula:
        "≥80% → 100 | ≥60% → interpolação linear 70–100 | ≥30% → interpolação linear 30–70 | <30% → interpolação linear 0–30",
      formulaVariables: [
        {
          symbol: "≥80%",
          meaning:
            "Se 80% ou mais das mulheres elegíveis têm citopatológico em dia, score máximo (100)",
        },
        {
          symbol: "interpolação linear 70–100",
          meaning:
            "Score cresce proporcionalmente de 70 a 100 conforme a cobertura sobe de 60% a 80%",
        },
        {
          symbol: "interpolação linear 30–70",
          meaning:
            "Score cresce proporcionalmente de 30 a 70 conforme a cobertura sobe de 30% a 60%",
        },
        {
          symbol: "interpolação linear 0–30",
          meaning:
            "Score cresce proporcionalmente de 0 a 30 conforme a cobertura sobe de 0% a 30% — rastreamento insuficiente",
        },
        {
          symbol: "60%",
          meaning: "Meta Previne Brasil — limiar que separa desempenho adequado do intermediário",
        },
      ],
      benchmarks: {
        min: "<30% = score 0–30",
        max: "≥80% = score 100",
        description:
          "Meta Previne Brasil: 60%. Rastreamento precoce é a principal estratégia de redução de mortalidade.",
      },
    },
    previne_saude_bucal: {
      label: "Atendimentos Saúde Bucal (Previne Brasil)",
      unit: "%",
      source: "DATASUS / e-Gestor AB",
      agent: "datasus",
      explanation:
        "Percentual de pessoas com atendimento odontológico realizado em pelo menos um período do ano (indicador Previne Brasil).",
      goodDirection: "up",
      formula:
        "≥80% → 100 | ≥60% → interpolação linear 70–100 | ≥30% → interpolação linear 30–70 | <30% → interpolação linear 0–30",
      formulaVariables: [
        {
          symbol: "≥80%",
          meaning:
            "Se 80% ou mais da população cadastrada tem atendimento odontológico no período, score máximo (100)",
        },
        {
          symbol: "interpolação linear 70–100",
          meaning:
            "Score cresce proporcionalmente de 70 a 100 conforme a cobertura odontológica sobe de 60% a 80%",
        },
        {
          symbol: "interpolação linear 30–70",
          meaning:
            "Score cresce proporcionalmente de 30 a 70 conforme a cobertura sobe de 30% a 60%",
        },
        {
          symbol: "interpolação linear 0–30",
          meaning:
            "Score cresce proporcionalmente de 0 a 30 conforme a cobertura sobe de 0% a 30% — acesso odontológico insuficiente",
        },
        {
          symbol: "60%",
          meaning: "Meta Previne Brasil — limiar que separa desempenho adequado do intermediário",
        },
      ],
      benchmarks: {
        min: "<30% = score 0–30",
        max: "≥80% = score 100",
        description:
          "Saúde bucal é componente da saúde integral — frequentemente negligenciada em municípios menores.",
      },
    },
    ieps_mortalidade_infantil: {
      label: "Mortalidade Infantil",
      unit: "óbitos por 1.000 nascidos vivos",
      source: "IEPS / DATASUS SIM",
      agent: "ieps",
      explanation: "Número de óbitos de crianças menores de 1 ano por mil nascidos vivos.",
      goodDirection: "down",
      formula:
        "≤8/1000 → 100 | ≤15 → interpolação linear 50–100 | ≤30 → interpolação linear 0–50 [invertido]",
      formulaVariables: [
        {
          symbol: "≤8/1000",
          meaning:
            "Se a mortalidade infantil é 8 ou menos óbitos por mil nascidos vivos, score máximo (100) — referência ODS 3.2",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score decresce proporcionalmente de 100 a 50 conforme a mortalidade sobe de 8 a 15 por mil",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score decresce proporcionalmente de 50 a 0 conforme a mortalidade sobe de 15 a 30 por mil",
        },
        {
          symbol: "invertido",
          meaning: "Indicador invertido: quanto maior a mortalidade infantil, menor o score",
        },
      ],
      benchmarks: {
        min: ">30/1000 = score próximo de 0",
        max: "≤8/1000 = score 100",
        description:
          "Meta ODS 3.2: ≤12/1000 até 2030. Brasil 2022: ~13/1000. SC geralmente abaixo de 10.",
      },
    },
    ieps_cobertura_esf: {
      label: "Cobertura Estratégia Saúde da Família",
      unit: "%",
      source: "IEPS / e-Gestor AB",
      agent: "ieps",
      explanation:
        "Percentual da população coberta por equipes de Saúde da Família (ESF) cadastradas.",
      goodDirection: "up",
      formula:
        "≥100% → 100 | ≥80% → interpolação linear 70–100 | ≥50% → interpolação linear 40–70 | <50% → interpolação linear 0–40",
      formulaVariables: [
        {
          symbol: "≥100%",
          meaning:
            "Cobertura universal (100% ou mais da população coberta por equipes ESF) = score máximo (100)",
        },
        {
          symbol: "interpolação linear 70–100",
          meaning:
            "Score cresce proporcionalmente de 70 a 100 conforme a cobertura ESF sobe de 80% a 100%",
        },
        {
          symbol: "interpolação linear 40–70",
          meaning:
            "Score cresce proporcionalmente de 40 a 70 conforme a cobertura sobe de 50% a 80% — faixa intermediária",
        },
        {
          symbol: "interpolação linear 0–40",
          meaning:
            "Score cresce proporcionalmente de 0 a 40 conforme a cobertura sobe de 0% a 50% — cobertura insuficiente",
        },
      ],
      benchmarks: {
        min: "<50% = score 0–40",
        max: "≥100% = score 100",
        description:
          "Meta nacional: cobertura universal. Municípios com >100% em alguns indicadores por sobreposição de territórios são normalizados em 100.",
      },
    },
    ieps_cobertura_vacinal: {
      label: "Cobertura Vacinal Infantil",
      unit: "%",
      source: "IEPS / PNI DATASUS",
      agent: "ieps",
      explanation:
        "Percentual de crianças menores de 1 ano com esquema vacinal completo conforme Calendário Nacional.",
      goodDirection: "up",
      formula: "≥95% → 100 | ≥80% → interpolação linear 50–100 | ≥60% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥95%",
          meaning:
            "Se 95% ou mais das crianças têm esquema vacinal completo, score máximo (100) — limiar de imunidade de rebanho (OMS)",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a cobertura vacinal sobe de 80% a 95%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a cobertura sobe de 60% a 80% — abaixo da meta mínima",
        },
        {
          symbol: "80%",
          meaning:
            "Limiar de risco epidemiológico — abaixo de 80% há risco de ressurgimento de doenças imunopreveníveis",
        },
      ],
      benchmarks: {
        min: "<60% = score 0–50 (abaixo do limiar de imunidade coletiva)",
        max: "≥95% = score 100",
        description:
          "Meta OMS: ≥95% para imunidade de rebanho. Queda abaixo de 80% representa risco epidemiológico.",
      },
    },
    ieps_internacoes_csap: {
      label: "Internações por Condições Sensíveis à Atenção Primária",
      unit: "por 100.000 hab",
      source: "IEPS / SIH DATASUS",
      agent: "ieps",
      explanation:
        "Taxa de internações hospitalares por condições que poderiam ser evitadas com atenção primária de qualidade (CSAP).",
      goodDirection: "down",
      formula:
        "≤500/100k → 100 | ≤1000 → interpolação linear 50–100 | ≤2000 → interpolação linear 0–50 [invertido]",
      formulaVariables: [
        {
          symbol: "≤500/100k",
          meaning:
            "Se há 500 ou menos internações CSAP por 100 mil habitantes, score máximo (100) — referência de atenção básica consolidada",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score decresce proporcionalmente de 100 a 50 conforme a taxa sobe de 500 a 1.000 por 100k",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score decresce proporcionalmente de 50 a 0 conforme a taxa sobe de 1.000 a 2.000 por 100k",
        },
        {
          symbol: "invertido",
          meaning:
            "Indicador invertido: quanto maior a taxa de internações evitáveis, menor o score",
        },
      ],
      benchmarks: {
        min: ">2000/100k = score próximo de 0",
        max: "≤500/100k = score 100",
        description:
          "Alta taxa de CSAP indica falha da atenção básica. Referência: municípios com ESF consolidada têm taxas abaixo de 500.",
      },
    },
    ieps_gasto_saude_pc: {
      label: "Gasto Municipal em Saúde Per Capita",
      unit: "R$/hab",
      source: "IEPS / SIOPS",
      agent: "ieps",
      explanation:
        "Valor total de despesas municipais com saúde dividido pela população do município.",
      goodDirection: "up",
      formula:
        "≥R$1.500 → 100 | ≥R$800 → interpolação linear 50–100 | ≥R$300 → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥R$1.500",
          meaning:
            "Se o gasto per capita em saúde é R$1.500 ou mais por habitante/ano, score máximo (100)",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme o gasto sobe de R$800 a R$1.500 por habitante",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme o gasto sobe de R$300 a R$800 por habitante",
        },
        {
          symbol: "R$300",
          meaning:
            "Gasto mínimo — abaixo desse valor o investimento em saúde é considerado insuficiente",
        },
      ],
      benchmarks: {
        min: "<R$300/hab = score 0",
        max: "≥R$1.500/hab = score 100",
        description:
          "Referência: gasto per capita adequado varia por porte. Municípios de SC com SUS pleno: média acima de R$1.200.",
      },
    },
    ieps_prenatal_adequado: {
      label: "Pré-natal Adequado (IEPS)",
      unit: "%",
      source: "IEPS / SIM SINASC",
      agent: "ieps",
      explanation:
        "Percentual de partos com pré-natal considerado adequado (≥7 consultas, início no 1º trimestre).",
      goodDirection: "up",
      formula: "≥90% → 100 | ≥70% → interpolação linear 50–100 | ≥40% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥90%",
          meaning:
            "Se 90% ou mais dos partos têm pré-natal adequado (≥7 consultas com início no 1º trimestre), score máximo (100)",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a cobertura sobe de 70% a 90%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a cobertura sobe de 40% a 70%",
        },
        {
          symbol: "7 consultas",
          meaning:
            "Critério IEPS — mais rigoroso que o Previne Brasil (≥6), exige início no 1º trimestre",
        },
      ],
      benchmarks: {
        min: "<40% = score 0",
        max: "≥90% = score 100",
        description:
          "Critério mais rigoroso que o Previne Brasil (≥7 consultas vs ≥6). Indica qualidade superior da atenção pré-natal.",
      },
    },
  },

  4: {
    pct_despesa_educacao: {
      label: "Despesa com Educação (% receita)",
      unit: "%",
      source: "SICONFI / STN",
      agent: "siconfi",
      explanation:
        "Percentual da receita corrente líquida municipal destinado à função Educação (função 12 SICONFI).",
      goodDirection: "up",
      formula: "≥35% → 100 | ≥25% → interpolação linear 70–100 | ≥15% → interpolação linear 0–70",
      formulaVariables: [
        {
          symbol: "≥35%",
          meaning: "Se o município destina 35% ou mais da receita à educação, score máximo (100)",
        },
        {
          symbol: "interpolação linear 70–100",
          meaning:
            "Score cresce proporcionalmente de 70 a 100 conforme o gasto sobe de 25% a 35% — acima do mínimo constitucional",
        },
        {
          symbol: "interpolação linear 0–70",
          meaning:
            "Score cresce proporcionalmente de 0 a 70 conforme o gasto sobe de 15% a 25% — faixa de não conformidade",
        },
        {
          symbol: "25%",
          meaning:
            "Mínimo constitucional obrigatório (art. 212 CF) — abaixo disso o município está em não conformidade",
        },
      ],
      benchmarks: {
        min: "<15% = score 0",
        max: "≥35% = score 100",
        description:
          "Mínimo constitucional (art. 212 CF): 25% da receita líquida. Abaixo de 15% é inconstitucional.",
      },
    },
    ideb_anos_iniciais: {
      label: "IDEB Anos Iniciais (1º ao 5º ano)",
      unit: "nota (0–10)",
      source: "INEP / MEC",
      agent: "inep",
      explanation:
        "Índice de Desenvolvimento da Educação Básica para os anos iniciais do ensino fundamental, calculado com fluxo escolar e desempenho na Prova Brasil.",
      goodDirection: "up",
      formula: "≥7.0 → 100 | ≥4.0 → interpolação linear 50–100 | <4.0 → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥7.0",
          meaning:
            "Se o IDEB dos anos iniciais é 7.0 ou mais (escala 0–10), score máximo (100) — excelência educacional",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning: "Score cresce proporcionalmente de 50 a 100 conforme o IDEB sobe de 4.0 a 7.0",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme o IDEB sobe de 0 a 4.0 — desempenho insuficiente",
        },
        {
          symbol: "4.0",
          meaning: "Limiar crítico — abaixo de 4.0 indica desempenho educacional muito baixo",
        },
        {
          symbol: "IDEB bienal",
          meaning:
            "O IDEB é medido a cada dois anos (anos pares); anos intermediários são estimados por interpolação linear entre as medições",
        },
      ],
      benchmarks: {
        min: "<4.0 = score 0–50",
        max: "≥7.0 = score 100",
        description:
          "Meta INEP 2022: 6.0 para anos iniciais. IDEB bienal (anos pares); anos intermediários são interpolados linearmente.",
      },
    },
    ideb_anos_finais: {
      label: "IDEB Anos Finais (6º ao 9º ano)",
      unit: "nota (0–10)",
      source: "INEP / MEC",
      agent: "inep",
      explanation:
        "Índice de Desenvolvimento da Educação Básica para os anos finais do ensino fundamental.",
      goodDirection: "up",
      formula: "≥7.0 → 100 | ≥4.0 → interpolação linear 50–100 | <4.0 → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥7.0",
          meaning:
            "Se o IDEB dos anos finais é 7.0 ou mais (escala 0–10), score máximo (100) — excelência educacional",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning: "Score cresce proporcionalmente de 50 a 100 conforme o IDEB sobe de 4.0 a 7.0",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme o IDEB sobe de 0 a 4.0 — desempenho insuficiente",
        },
        {
          symbol: "4.0",
          meaning: "Limiar crítico — abaixo de 4.0 indica desempenho educacional muito baixo",
        },
        {
          symbol: "IDEB bienal",
          meaning:
            "O IDEB é medido a cada dois anos (anos pares); anos intermediários são estimados por interpolação linear entre as medições",
        },
      ],
      benchmarks: {
        min: "<4.0 = score 0–50",
        max: "≥7.0 = score 100",
        description:
          "Meta INEP 2022: 5.5 para anos finais. Anos finais historicamente apresentam desempenho menor que iniciais.",
      },
    },
  },

  5: {
    pct_mulheres_eleitas: {
      label: "Mulheres Eleitas na Câmara Municipal",
      unit: "%",
      source: "TSE — Repositório de Dados Eleitorais",
      agent: "tse",
      explanation: "Percentual de vereadores eleitos que são mulheres na última eleição municipal.",
      goodDirection: "up",
      formula: "≥50% → 100 | ≥30% → interpolação linear 50–100 | <30% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥50%",
          meaning:
            "Se 50% ou mais dos vereadores eleitos são mulheres, score máximo (100) — paridade de gênero real",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a representação feminina sobe de 30% a 50%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a representação sobe de 0% a 30% — abaixo da cota legal",
        },
        {
          symbol: "30%",
          meaning:
            "Cota legal mínima (Lei 9.504/1997) — municípios abaixo de 30% descumprem a legislação eleitoral",
        },
      ],
      benchmarks: {
        min: "0% = score 0",
        max: "≥50% = score 100 (paridade)",
        description:
          "Cota legal mínima (Lei 9.504/1997): 30% de candidatas. Paridade real (50%) é o ideal ODS 5.5.",
      },
    },
    pct_candidatas_mulheres: {
      label: "Candidatas Mulheres (%)",
      unit: "%",
      source: "TSE — Repositório de Dados Eleitorais",
      agent: "tse",
      explanation: "Percentual de candidatos registrados para câmara municipal que são mulheres.",
      goodDirection: "up",
      formula: "≥50% → 100 | ≥33% → interpolação linear 50–100 | <33% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥50%",
          meaning:
            "Se 50% ou mais dos candidatos registrados são mulheres, score máximo (100) — paridade de gênero plena",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a participação feminina sobe de 33% a 50%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a participação sobe de 0% a 33% — abaixo da cota legal",
        },
        {
          symbol: "33%",
          meaning:
            "Limiar de compliance com a cota eleitoral (mínimo legal de 30%, arredondado para 33% como referência prática)",
        },
      ],
      benchmarks: {
        min: "<33% = score 0–50 (abaixo da cota legal)",
        max: "≥50% = score 100",
        description:
          "Cota legal: mínimo 30% (arredondado para 33% como limiar de compliance). Abaixo de 33% indica descumprimento da legislação eleitoral.",
      },
    },
  },

  6: {
    snis_atendimento_agua: {
      label: "Cobertura de Abastecimento de Água",
      unit: "%",
      source: "SNIS — Sistema Nacional de Informações sobre Saneamento",
      agent: "snis",
      explanation:
        "Percentual da população urbana atendida com abastecimento de água tratada pela rede pública.",
      goodDirection: "up",
      formula: "≥95% → 100 | ≥70% → interpolação linear 50–100 | <70% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥95%",
          meaning:
            "Se 95% ou mais da população urbana tem acesso à água tratada, score máximo (100)",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a cobertura sobe de 70% a 95%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a cobertura sobe de 0% a 70% — cobertura insatisfatória",
        },
        {
          symbol: "99%",
          meaning:
            "Meta do Marco do Saneamento (Lei 14.026/2020) até 2033 — limiar de universalização",
        },
      ],
      benchmarks: {
        min: "<70% = score 0–50",
        max: "≥95% = score 100",
        description:
          "Meta Marco do Saneamento (Lei 14.026/2020): 99% até 2033. SC já tem média acima de 90%.",
      },
    },
    snis_atendimento_esgoto: {
      label: "Cobertura de Esgotamento Sanitário",
      unit: "%",
      source: "SNIS — Sistema Nacional de Informações sobre Saneamento",
      agent: "snis",
      explanation:
        "Percentual da população urbana atendida com coleta de esgoto pela rede pública.",
      goodDirection: "up",
      formula: "≥90% → 100 | ≥50% → interpolação linear 50–100 | <50% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥90%",
          meaning:
            "Se 90% ou mais da população urbana tem coleta de esgoto, score máximo (100) — meta do Marco do Saneamento",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a cobertura de esgoto sobe de 50% a 90%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a cobertura sobe de 0% a 50% — situação crítica de saneamento",
        },
        {
          symbol: "50%",
          meaning:
            "Limiar inferior — abaixo de 50% de cobertura de esgoto o impacto sobre saúde pública é severo",
        },
      ],
      benchmarks: {
        min: "<50% = score 0–50",
        max: "≥90% = score 100",
        description:
          "Meta Marco do Saneamento: 90% até 2033. Esgoto é o maior gargalo de saneamento em SC: média ~70%.",
      },
    },
    snis_esgoto_tratado: {
      label: "Esgoto Tratado (% do coletado)",
      unit: "%",
      source: "SNIS — Sistema Nacional de Informações sobre Saneamento",
      agent: "snis",
      explanation:
        "Percentual do esgoto coletado que é efetivamente tratado antes do lançamento nos corpos hídricos.",
      goodDirection: "up",
      formula: "≥90% → 100 | ≥50% → interpolação linear 50–100 | <50% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥90%",
          meaning:
            "Se 90% ou mais do esgoto coletado é tratado antes do descarte, score máximo (100)",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme o percentual de esgoto tratado sobe de 50% a 90%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme o tratamento sobe de 0% a 50% — lançamento de esgoto bruto nos rios",
        },
        {
          symbol: "90%",
          meaning:
            "Meta do Marco do Saneamento (Lei 14.026/2020) até 2033 — percentual de esgoto coletado que deve ser tratado",
        },
      ],
      benchmarks: {
        min: "<50% = score 0–50",
        max: "≥90% = score 100",
        description:
          "Coletar sem tratar é insuficiente. Meta: 90% do esgoto coletado tratado até 2033.",
      },
    },
    snis_perda_faturamento: {
      label: "Índice de Perdas de Faturamento",
      unit: "%",
      source: "SNIS — Sistema Nacional de Informações sobre Saneamento",
      agent: "snis",
      explanation:
        "Percentual de água tratada e distribuída que não é faturada (perdas reais + aparentes na rede).",
      goodDirection: "down",
      formula: "≤15% → 100 | ≤35% → interpolação linear 50–100 | >35% → score 0 [invertido]",
      formulaVariables: [
        {
          symbol: "≤15%",
          meaning:
            "Se as perdas de faturamento são 15% ou menos, score máximo (100) — nível de eficiência internacional",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score decresce proporcionalmente de 100 a 50 conforme as perdas sobem de 15% a 35%",
        },
        {
          symbol: ">35%",
          meaning:
            "Perdas acima de 35% = score 0 — desperdício excessivo de água tratada, indicando infraestrutura precária",
        },
        {
          symbol: "invertido",
          meaning: "Indicador invertido: quanto maior o percentual de perdas, menor o score",
        },
      ],
      benchmarks: {
        min: ">35% = score 0 (perdas excessivas)",
        max: "≤15% = score 100 (nível internacional de eficiência)",
        description:
          "Perdas abaixo de 20% são consideradas nível de eficiência. Brasil tem média de ~38%; SC ~28%.",
      },
    },
  },

  7: {
    gd_per_capita_w: {
      label: "Geração Distribuída Per Capita",
      unit: "Watts por habitante",
      source: "ANEEL — SIGR / SIGA",
      agent: "aneel",
      explanation:
        "Potência instalada de microgeração e minigeração distribuída (solar, eólica, etc.) dividida pela população do município.",
      goodDirection: "up",
      formula:
        "≥500W/hab → 100 | ≥100W → interpolação linear 50–100 | <100W → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥500W/hab",
          meaning:
            "Se a potência instalada de energia renovável local é 500 Watts ou mais por habitante, score máximo (100)",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a potência per capita sobe de 100W a 500W por habitante",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a potência sobe de 0 a 100W por habitante — adoção incipiente",
        },
        {
          symbol: "W/hab",
          meaning:
            "Watts por habitante — mede a potência total de geração distribuída instalada dividida pela população do município",
        },
      ],
      benchmarks: {
        min: "<100W/hab = score 0–50",
        max: "≥500W/hab = score 100",
        description:
          "GD per capita reflete adoção de energia renovável local. Municípios líderes em SC: acima de 300W/hab.",
      },
    },
    penetracao_gd: {
      label: "Penetração de Geração Distribuída",
      unit: "conexões por 1.000 habitantes",
      source: "ANEEL — SIGR / SIGA",
      agent: "aneel",
      explanation:
        "Número de conexões de geração distribuída ativas (micro e minigeração) por mil habitantes.",
      goodDirection: "up",
      formula:
        "≥50/1000hab → 100 | ≥10 → interpolação linear 50–100 | <10 → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥50/1000hab",
          meaning:
            "Se há 50 ou mais conexões de geração distribuída por mil habitantes, score máximo (100) — alto nível de adoção",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme as conexões sobem de 10 a 50 por mil habitantes",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme as conexões sobem de 0 a 10 por mil habitantes — adoção incipiente",
        },
        {
          symbol: "conexões/1000hab",
          meaning:
            "Número de instalações de micro ou minigeração ativas dividido pela população em milhares — mede a disseminação da energia renovável entre os cidadãos",
        },
      ],
      benchmarks: {
        min: "<10/1000hab = score 0–50",
        max: "≥50/1000hab = score 100",
        description:
          "Indica disseminação da energia renovável entre a população. SC tem penetração acima da média nacional.",
      },
    },
  },

  8: {
    taxa_ocupacao: {
      label: "Taxa de Ocupação",
      unit: "%",
      source: "IBGE Censo 2022 / CAGED",
      agent: "ibge",
      explanation:
        "Percentual da população em idade ativa (15–64 anos) que está ocupada (empregada ou autônoma).",
      goodDirection: "up",
      formula: "≥60% → 100 | ≥30% → interpolação linear 0–100",
      formulaVariables: [
        {
          symbol: "≥60%",
          meaning:
            "Se 60% ou mais da população em idade ativa está ocupada, score máximo (100) — mercado de trabalho aquecido",
        },
        {
          symbol: "interpolação linear 0–100",
          meaning:
            "Score cresce proporcionalmente de 0 a 100 conforme a taxa de ocupação sobe de 30% a 60%",
        },
        {
          symbol: "30%",
          meaning:
            "Limite inferior — taxa de ocupação abaixo de 30% indica desemprego estrutural severo ou população inativa muito alta",
        },
        {
          symbol: "15–64 anos",
          meaning:
            "Faixa etária da população em idade ativa (PIA) — base do denominador do cálculo",
        },
      ],
      benchmarks: {
        min: "<30% = score 0",
        max: "≥60% = score 100",
        description:
          "Taxa de ocupação de 60% indica mercado de trabalho aquecido. Abaixo de 30% sinaliza alto desemprego estrutural.",
      },
    },
    pib_per_capita: {
      label: "PIB Per Capita",
      unit: "R$",
      source: "IBGE Contas Municipais",
      agent: "ibge",
      explanation: "Produto Interno Bruto municipal dividido pela população estimada.",
      goodDirection: "up",
      formula: "≥R$60.000 → 100 | ≥R$10.000 → interpolação linear 0–100",
      formulaVariables: [
        {
          symbol: "≥R$60.000",
          meaning:
            "Se o PIB per capita municipal é R$60.000 ou mais por habitante/ano, score máximo (100)",
        },
        {
          symbol: "interpolação linear 0–100",
          meaning:
            "Score cresce proporcionalmente de 0 a 100 conforme o PIB per capita sobe de R$10.000 a R$60.000",
        },
        {
          symbol: "R$10.000",
          meaning:
            "Limite inferior — PIB per capita abaixo de R$10.000 indica economia municipal muito frágil",
        },
        {
          symbol: "PIB per capita",
          meaning:
            "Produto Interno Bruto total do município dividido pela população estimada no mesmo ano",
        },
      ],
      benchmarks: {
        min: "<R$10.000/hab = score 0",
        max: "≥R$60.000/hab = score 100",
        description:
          "PIB per capita médio de SC 2021: ~R$43k. Municípios com PIB baixo geralmente dependem do FPM para >70% da receita.",
      },
    },
  },

  9: {
    empresas_por_10k_hab: {
      label: "Empresas Ativas por 10.000 Habitantes",
      unit: "empresas/10k hab",
      source: "IBGE CEMPRE",
      agent: "ibge",
      explanation:
        "Número de empresas com CNPJ ativo e funcionários formais por 10 mil habitantes (Cadastro Central de Empresas).",
      goodDirection: "up",
      formula:
        "≥100 → 100 | ≥50 → interpolação linear 70–100 | ≥20 → interpolação linear 40–100 | <20 → interpolação linear 0–40",
      formulaVariables: [
        {
          symbol: "≥100 empresas/10k hab",
          meaning:
            "Se há 100 ou mais empresas ativas por 10 mil habitantes, score máximo (100) — alta densidade empresarial",
        },
        {
          symbol: "interpolação linear 70–100",
          meaning:
            "Score cresce proporcionalmente de 70 a 100 conforme a densidade sobe de 50 a 100 empresas por 10k hab",
        },
        {
          symbol: "interpolação linear 40–100",
          meaning:
            "Score cresce proporcionalmente de 40 a 100 conforme a densidade sobe de 20 a 50 empresas por 10k hab",
        },
        {
          symbol: "interpolação linear 0–40",
          meaning:
            "Score cresce proporcionalmente de 0 a 40 conforme a densidade sobe de 0 a 20 empresas por 10k hab — economia pouco diversificada",
        },
      ],
      benchmarks: {
        min: "<20 empresas/10k = score 0–40",
        max: "≥100 empresas/10k = score 100",
        description:
          "Densidade empresarial indica dinamismo econômico e infraestrutura de inovação local.",
      },
    },
    banda_larga_por_100hab: {
      label: "Banda Larga Fixa por 100 Habitantes",
      unit: "acessos/100 hab",
      source: "ANATEL — Painéis de Dados",
      agent: "anatel",
      explanation:
        "Número de acessos de banda larga fixa (>512 kbps) por 100 habitantes no município.",
      goodDirection: "up",
      formula:
        "≥30/100hab → 100 | ≥15 → interpolação linear 50–100 | <15 → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥30/100hab",
          meaning:
            "Se há 30 ou mais acessos de banda larga fixa por 100 habitantes, score máximo (100) — referência de conectividade avançada (UIT)",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme os acessos sobem de 15 a 30 por 100 hab",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme os acessos sobem de 0 a 15 por 100 hab — conectividade insuficiente",
        },
        {
          symbol: "acessos/100hab",
          meaning:
            "Número de contratos de banda larga fixa ativos dividido pela população e multiplicado por 100",
        },
      ],
      benchmarks: {
        min: "<15/100hab = score 0–50",
        max: "≥30/100hab = score 100",
        description:
          "30 acessos/100hab é referência de conectividade avançada (UIT). SC tem média ~22/100hab.",
      },
    },
    cobertura_4g: {
      label: "Cobertura 4G / LTE",
      unit: "%",
      source: "ANATEL — Painéis de Dados",
      agent: "anatel",
      explanation:
        "Percentual da área territorial do município coberta por sinal de telefonia móvel 4G ou superior.",
      goodDirection: "up",
      formula: "≥95% → 100 | ≥80% → interpolação linear 50–100 | <80% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥95%",
          meaning:
            "Se 95% ou mais da área territorial tem cobertura 4G, score máximo (100) — cobertura praticamente universal",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a cobertura 4G sobe de 80% a 95% da área",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a cobertura sobe de 0% a 80% — zonas rurais frequentemente sem sinal",
        },
        {
          symbol: "área territorial",
          meaning:
            "O indicador mede cobertura por área geográfica, não por população — municípios com área rural extensa são penalizados",
        },
      ],
      benchmarks: {
        min: "<80% = score 0–50",
        max: "≥95% = score 100",
        description:
          "Cobertura 4G é infraestrutura básica para serviços digitais. Municípios rurais de SC têm menor cobertura.",
      },
    },
  },

  10: {
    coeficiente_gini: {
      label: "Coeficiente de Gini",
      unit: "0 a 1",
      source: "IBGE Censo 2022",
      agent: "ibge",
      explanation:
        "Medida de concentração de renda: 0 = igualdade perfeita, 1 = desigualdade máxima.",
      goodDirection: "down",
      formula:
        "≤0.35 → 100 | ≤0.45 → interpolação linear 50–100 | <0.60 → interpolação linear 0–50 [invertido]",
      formulaVariables: [
        {
          symbol: "≤0.35",
          meaning:
            "Se o Gini é 0.35 ou menos, score máximo (100) — distribuição de renda muito equânime",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score decresce proporcionalmente de 100 a 50 conforme o Gini sobe de 0.35 a 0.45",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning: "Score decresce proporcionalmente de 50 a 0 conforme o Gini sobe de 0.45 a 0.60",
        },
        {
          symbol: "invertido",
          meaning: "Indicador invertido: quanto maior o Gini (mais desigual), menor o score",
        },
        {
          symbol: "Gini 0–1",
          meaning:
            "Escala do coeficiente: 0 = igualdade absoluta (todos com a mesma renda); 1 = desigualdade absoluta (uma pessoa tem toda a renda)",
        },
      ],
      benchmarks: {
        min: "≥0.60 = score 0 (desigualdade extrema)",
        max: "≤0.35 = score 100 (distribuição equânime)",
        description:
          "Gini do Brasil: ~0.53. SC tem Gini médio ~0.43. Municípios com Gini <0.40 são raros e muito bem distribuídos.",
      },
    },
    razao_20_20: {
      label: "Razão de Renda 20/20",
      unit: "vezes",
      source: "IBGE Censo 2022",
      agent: "ibge",
      explanation:
        "Razão entre a renda média dos 20% mais ricos e a renda média dos 20% mais pobres do município.",
      goodDirection: "down",
      formula:
        "≤8x → 100 | ≤15x → interpolação linear 50–100 | <25x → interpolação linear 0–50 [invertido]",
      formulaVariables: [
        {
          symbol: "≤8x",
          meaning:
            "Se os 20% mais ricos ganham até 8 vezes mais que os 20% mais pobres, score máximo (100) — referência de países com baixa desigualdade",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning: "Score decresce proporcionalmente de 100 a 50 conforme a razão sobe de 8x a 15x",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning: "Score decresce proporcionalmente de 50 a 0 conforme a razão sobe de 15x a 25x",
        },
        {
          symbol: "invertido",
          meaning:
            "Indicador invertido: quanto maior a razão (mais desigual a distribuição de renda), menor o score",
        },
        {
          symbol: "razão 20/20",
          meaning:
            "Renda média do quintil superior (20% mais ricos) dividida pela renda média do quintil inferior (20% mais pobres)",
        },
      ],
      benchmarks: {
        min: "≥25x = score 0",
        max: "≤8x = score 100",
        description:
          "Quanto menor a razão, mais equânime a distribuição. Países nórdicos: ~6x. Brasil: ~16x. Ideal ODS: ≤8x.",
      },
    },
  },

  11: {
    urbanizacao_adequada: {
      label: "Domicílios com Urbanização Adequada",
      unit: "%",
      source: "IBGE Censo 2022",
      agent: "ibge",
      explanation:
        "Percentual de domicílios urbanos com acesso a pelo menos 4 de 5 serviços básicos: água, esgoto, coleta de lixo, energia e calçada/pavimentação.",
      goodDirection: "up",
      formula: "≥90% → 100 | ≥70% → interpolação linear 50–100 | ≥20% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥90%",
          meaning:
            "Se 90% ou mais dos domicílios urbanos têm pelo menos 4 dos 5 serviços básicos, score máximo (100)",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a urbanização adequada sobe de 70% a 90% dos domicílios",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a urbanização sobe de 20% a 70% dos domicílios",
        },
        {
          symbol: "4 de 5 serviços",
          meaning:
            "Critério de adequação: o domicílio deve ter pelo menos 4 dos seguintes serviços — água tratada, esgoto, coleta de lixo, energia elétrica e calçada/pavimentação",
        },
      ],
      benchmarks: {
        min: "<20% = score 0",
        max: "≥90% = score 100",
        description:
          "Proxy de qualidade de vida urbana. Dados do Censo 2022 (variável V0010 dos setores censitários).",
      },
    },
    pct_despesa_urbanismo: {
      label: "Despesa com Urbanismo (% receita)",
      unit: "%",
      source: "SICONFI / STN",
      agent: "siconfi",
      explanation:
        "Percentual da receita corrente líquida destinado à função Urbanismo (função 15 SICONFI: habitação, transporte, saneamento urbano).",
      goodDirection: "up",
      formula: "≥20% → 100 | ≥10% → interpolação linear 60–100 | ≥3% → interpolação linear 0–60",
      formulaVariables: [
        {
          symbol: "≥20%",
          meaning:
            "Se o município destina 20% ou mais da receita a urbanismo, score máximo (100) — alto investimento em cidades sustentáveis",
        },
        {
          symbol: "interpolação linear 60–100",
          meaning:
            "Score cresce proporcionalmente de 60 a 100 conforme o gasto sobe de 10% a 20% da receita",
        },
        {
          symbol: "interpolação linear 0–60",
          meaning:
            "Score cresce proporcionalmente de 0 a 60 conforme o gasto sobe de 3% a 10% da receita — subinvestimento",
        },
        {
          symbol: "3%",
          meaning:
            "Piso mínimo — abaixo de 3% o investimento em urbanismo é considerado insuficiente para manutenção básica da infraestrutura urbana",
        },
      ],
      benchmarks: {
        min: "<3% = score 0 (subinvestimento crítico)",
        max: "≥20% = score 100",
        description:
          "Investimento em urbanismo reflete comprometimento com cidades sustentáveis. Média SC: ~8% da receita.",
      },
    },
  },

  12: {
    snis_rs_coleta_seletiva: {
      label: "Abrangência da Coleta Seletiva",
      unit: "%",
      source: "SNIS-RS — Resíduos Sólidos",
      agent: "snis_rs",
      explanation:
        "Percentual da população urbana atendida por programa de coleta seletiva (separação na origem).",
      goodDirection: "up",
      formula: "≥80% → 100 | ≥40% → interpolação linear 50–100 | <40% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥80%",
          meaning:
            "Se 80% ou mais da população urbana é atendida pela coleta seletiva, score máximo (100)",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a cobertura de coleta seletiva sobe de 40% a 80%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a cobertura sobe de 0% a 40% — coleta seletiva incipiente",
        },
        {
          symbol: "80%",
          meaning:
            "Meta de cobertura de alta eficiência — municípios com menos de 40% de cobertura ainda não universalizaram a coleta seletiva",
        },
      ],
      benchmarks: {
        min: "<40% = score 0–50",
        max: "≥80% = score 100",
        description:
          "Política Nacional de Resíduos Sólidos (Lei 12.305/2010) exige coleta seletiva municipal. SC tem índices acima da média nacional.",
      },
    },
    snis_rs_taxa_reciclagem: {
      label: "Taxa de Reciclagem de Resíduos",
      unit: "%",
      source: "SNIS-RS — Resíduos Sólidos",
      agent: "snis_rs",
      explanation:
        "Percentual do total de resíduos sólidos coletados que é encaminhado para reciclagem ou compostagem.",
      goodDirection: "up",
      formula: "≥40% → 100 | ≥15% → interpolação linear 50–100 | <15% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥40%",
          meaning:
            "Se 40% ou mais dos resíduos coletados são reciclados ou compostados, score máximo (100) — referência de excelência em gestão de resíduos",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a taxa de reciclagem sobe de 15% a 40%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a taxa sobe de 0% a 15% — reciclagem ainda incipiente",
        },
        {
          symbol: "15%",
          meaning:
            "Limiar intermediário — abaixo de 15% a reciclagem é considerada insuficiente e a maioria dos resíduos vai para aterros",
        },
      ],
      benchmarks: {
        min: "<15% = score 0–50",
        max: "≥40% = score 100",
        description:
          "Meta PNRS: aumentar reciclagem progressivamente. SC tem municípios com taxas acima de 30% (destaque nacional).",
      },
    },
    snis_rs_residuo_per_capita: {
      label: "Geração de Resíduos Per Capita",
      unit: "kg/hab/dia",
      source: "SNIS-RS — Resíduos Sólidos",
      agent: "snis_rs",
      explanation: "Quantidade de resíduos sólidos coletados por habitante por dia no município.",
      goodDirection: "down",
      formula:
        "≤0.5 kg/hab/dia → 100 | ≤1.0 → interpolação linear 50–100 | >1.0 → interpolação linear 0–50 [invertido]",
      formulaVariables: [
        {
          symbol: "≤0.5 kg/hab/dia",
          meaning:
            "Se a geração de resíduos é 0.5 kg ou menos por habitante por dia, score máximo (100) — consumo consciente e baixo desperdício",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score decresce proporcionalmente de 100 a 50 conforme a geração sobe de 0.5 a 1.0 kg/hab/dia",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score decresce proporcionalmente de 50 a 0 conforme a geração ultrapassa 1.0 kg/hab/dia",
        },
        {
          symbol: "invertido",
          meaning:
            "Indicador invertido: quanto maior a geração de resíduos per capita, menor o score",
        },
        {
          symbol: "kg/hab/dia",
          meaning:
            "Quilogramas de resíduo coletado por habitante por dia — medida padrão do SNIS para comparação entre municípios",
        },
      ],
      benchmarks: {
        min: ">1.0 kg/hab/dia = score 0–50",
        max: "≤0.5 kg/hab/dia = score 100",
        description:
          "Geração de resíduos correlaciona com consumo e renda. Média brasileira: ~1.0 kg/hab/dia. Ideal (ONU): ≤0.5.",
      },
    },
  },

  13: {
    desmatamento_anual_km2: {
      label: "Desmatamento Anual",
      unit: "km²/ano",
      source: "INPE / PRODES",
      agent: "inpe",
      explanation:
        "Área de vegetação nativa suprimida no município durante o último ano de referência (PRODES/INPE).",
      goodDirection: "down",
      formula: "≤0.1 km² → 100 | ≥5 km² → 0 | entre 0.1 e 5 → interpolação linear [invertido]",
      formulaVariables: [
        {
          symbol: "≤0.1 km²",
          meaning:
            "Se o desmatamento anual é 0.1 km² ou menos, score máximo (100) — impacto mínimo sobre a vegetação nativa",
        },
        {
          symbol: "≥5 km²",
          meaning:
            "Desmatamento igual ou superior a 5 km²/ano = score 0 — supressão severa de vegetação nativa",
        },
        {
          symbol: "interpolação linear",
          meaning:
            "Score decresce proporcionalmente de 100 a 0 conforme o desmatamento sobe de 0.1 km² a 5 km²/ano",
        },
        {
          symbol: "invertido",
          meaning: "Indicador invertido: quanto maior a área desmatada, menor o score",
        },
      ],
      benchmarks: {
        min: "≥5 km²/ano = score 0",
        max: "≤0.1 km²/ano = score 100",
        description:
          "Municípios de SC em bioma Mata Atlântica têm proteção adicional (Lei 11.428/2006). Desmatamento acima de 1 km² é inaceitável para SC.",
      },
    },
    tendencia_desmatamento_pct: {
      label: "Tendência de Desmatamento",
      unit: "% de variação anual",
      source: "INPE / PRODES",
      agent: "inpe",
      explanation:
        "Variação percentual do desmatamento anual em relação ao ano anterior (positivo = piora; negativo = melhora).",
      goodDirection: "down",
      formula:
        "≤-50% (redução de 50%) → 100 | ≥+100% (dobrou) → 0 | interpolação linear [invertido]",
      formulaVariables: [
        {
          symbol: "≤-50%",
          meaning:
            "Se o desmatamento reduziu 50% ou mais em relação ao ano anterior, score máximo (100) — trajetória de melhora significativa",
        },
        {
          symbol: "≥+100%",
          meaning:
            "Se o desmatamento dobrou ou mais em relação ao ano anterior, score 0 — trajetória de piora crítica",
        },
        {
          symbol: "interpolação linear",
          meaning:
            "Score varia proporcionalmente entre 0 e 100 conforme a variação percentual vai de +100% a -50%",
        },
        {
          symbol: "invertido",
          meaning:
            "Indicador invertido: variação positiva (mais desmatamento) reduz o score; variação negativa (menos desmatamento) aumenta o score",
        },
        {
          symbol: "variação anual",
          meaning:
            "Comparação entre o desmatamento do ano atual e o do ano anterior — captura a trajetória independente do valor absoluto",
        },
      ],
      benchmarks: {
        min: "+100% ou mais = score 0 (desmatamento dobrou)",
        max: "-50% ou mais = score 100 (redução significativa)",
        description:
          "Tendência captura a trajetória. Um município com baixo desmatamento que aumenta recebe penalização.",
      },
    },
  },

  14: {
    iqa_rios: {
      label: "Índice de Qualidade da Água dos Rios",
      unit: "IQA (0–100)",
      source: "ANA — Agência Nacional de Águas",
      agent: "ana",
      explanation:
        "Índice de Qualidade da Água (IQA) calculado a partir de 9 parâmetros físico-químicos e biológicos nos corpos hídricos do município.",
      goodDirection: "up",
      formula: "≥80 → 100 | ≥50 → interpolação linear 50–100 | <50 → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥80",
          meaning:
            "Se o IQA é 80 ou mais (escala ANA de 0 a 100), score máximo (100) — qualidade boa a ótima da água dos rios",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme o IQA sobe de 50 a 80 — qualidade regular a boa",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme o IQA sobe de 0 a 50 — qualidade ruim a regular",
        },
        {
          symbol: "IQA ANA",
          meaning:
            "Índice calculado com 9 parâmetros: coliformes fecais, pH, DBO, nitrogênio, fósforo, temperatura, turbidez, resíduo total e OD — escala 0 (péssima) a 100 (ótima)",
        },
      ],
      benchmarks: {
        min: "<50 = score 0–50 (qualidade ruim a péssima)",
        max: "≥80 = score 100 (boa qualidade)",
        description:
          "IQA ANA: >79 = Ótima | 52–79 = Boa | 37–52 = Regular | 20–37 = Ruim | <20 = Péssima. Meta: ≥52 (Boa).",
      },
    },
    mata_ciliar: {
      label: "Preservação de Mata Ciliar",
      unit: "%",
      source: "ANA / MapBiomas",
      agent: "ana",
      explanation:
        "Percentual de faixa de preservação permanente (APP) ao longo dos rios do município com cobertura vegetal nativa mantida.",
      goodDirection: "up",
      formula: "≥80% → 100 | ≥40% → interpolação linear 50–100 | <40% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥80%",
          meaning:
            "Se 80% ou mais das APPs ripárias têm vegetação nativa preservada, score máximo (100)",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a preservação de mata ciliar sobe de 40% a 80%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a preservação sobe de 0% a 40% — passivo ambiental elevado",
        },
        {
          symbol: "APP ripária",
          meaning:
            "Área de Preservação Permanente ao longo de corpos d'água — protege os rios de assoreamento e poluição difusa",
        },
      ],
      benchmarks: {
        min: "<40% = score 0–50",
        max: "≥80% = score 100",
        description:
          "Código Florestal (Lei 12.651/2012) exige 100% de preservação em APPs. Abaixo de 40% indica passivo ambiental severo.",
      },
    },
  },

  15: {
    desmatamento_acumulado_km2: {
      label: "Desmatamento Acumulado",
      unit: "km²",
      source: "INPE / PRODES",
      agent: "inpe",
      explanation:
        "Área total de vegetação nativa suprimida historicamente no município (estoque acumulado de degradação).",
      goodDirection: "down",
      formula: "≤1 km² → 100 | ≥100 km² → 0 | escala logarítmica entre 1 e 100 [invertido]",
      formulaVariables: [
        {
          symbol: "≤1 km²",
          meaning:
            "Se o desmatamento acumulado histórico é 1 km² ou menos, score máximo (100) — vegetação nativa praticamente intacta",
        },
        {
          symbol: "≥100 km²",
          meaning:
            "Desmatamento acumulado de 100 km² ou mais = score 0 — degradação histórica severa do território",
        },
        {
          symbol: "escala logarítmica",
          meaning:
            "O score não decresce linearmente, mas em escala logarítmica — captura diferenças relevantes entre municípios pequenos (1–10 km²) sem achatar municípios médios",
        },
        {
          symbol: "invertido",
          meaning: "Indicador invertido: quanto maior a área desmatada acumulada, menor o score",
        },
      ],
      benchmarks: {
        min: "≥100 km² acumulado = score 0",
        max: "≤1 km² acumulado = score 100",
        description:
          "Escala logarítmica captura diferenças relevantes em municípios pequenos. Municípios costeiros de SC geralmente têm menos de 10 km².",
      },
    },
    tendencia_desmatamento_vida_terrestre_pct: {
      label: "Tendência de Desmatamento (Vida Terrestre)",
      unit: "% de variação anual",
      source: "INPE / PRODES",
      agent: "inpe",
      explanation:
        "Variação percentual do desmatamento anual em relação ao ano anterior, aplicado ao contexto de biodiversidade terrestre.",
      goodDirection: "down",
      formula: "≤-50% → 100 | ≥+100% → 0 | interpolação linear [invertido]",
      formulaVariables: [
        {
          symbol: "≤-50%",
          meaning:
            "Se o desmatamento reduziu 50% ou mais em relação ao ano anterior, score máximo (100) — trajetória positiva para a biodiversidade",
        },
        {
          symbol: "≥+100%",
          meaning:
            "Se o desmatamento dobrou ou mais em relação ao ano anterior, score 0 — impacto severo sobre ecossistemas terrestres e biodiversidade",
        },
        {
          symbol: "interpolação linear",
          meaning:
            "Score varia proporcionalmente entre 0 e 100 conforme a variação percentual vai de +100% a -50%",
        },
        {
          symbol: "invertido",
          meaning:
            "Indicador invertido: aumento do desmatamento reduz o score; redução do desmatamento aumenta o score",
        },
        {
          symbol: "vida terrestre",
          meaning:
            "Mesmo método do ODS 13 (ação climática), mas aqui aplicado ao impacto sobre habitats e biodiversidade terrestre",
        },
      ],
      benchmarks: {
        min: "+100% ou mais = score 0",
        max: "-50% ou menos = score 100",
        description:
          "Mesmo método do ODS 13. Reflete impacto do desmatamento sobre ecossistemas terrestres e biodiversidade.",
      },
    },
  },

  16: {
    equilibrio_fiscal_siconfi: {
      label: "Equilíbrio Fiscal (Receitas/Despesas)",
      unit: "razão",
      source: "SICONFI / STN",
      agent: "siconfi",
      explanation:
        "Razão entre receitas correntes e despesas correntes do município (>1 = superávit corrente; <1 = déficit).",
      goodDirection: "up",
      formula: "≥1.1 → 100 | ≥1.0 → interpolação linear 80–100 | ≥0.7 → interpolação linear 0–80",
      formulaVariables: [
        {
          symbol: "≥1.1",
          meaning:
            "Se receitas correntes são pelo menos 10% maiores que despesas (razão ≥ 1.1), score máximo (100) — superávit corrente saudável",
        },
        {
          symbol: "interpolação linear 80–100",
          meaning:
            "Score cresce proporcionalmente de 80 a 100 conforme a razão sobe de 1.0 a 1.1 — equilíbrio fiscal a superávit",
        },
        {
          symbol: "interpolação linear 0–80",
          meaning:
            "Score cresce proporcionalmente de 0 a 80 conforme a razão sobe de 0.7 a 1.0 — déficit a equilíbrio",
        },
        {
          symbol: "razão receitas/despesas",
          meaning:
            "Receitas correntes totais divididas pelas despesas correntes totais — razão = 1.0 é o ponto de equilíbrio fiscal",
        },
        {
          symbol: "0.7",
          meaning:
            "Limite crítico — razão abaixo de 0.7 indica déficit fiscal grave com risco de violação da Lei de Responsabilidade Fiscal",
        },
      ],
      benchmarks: {
        min: "<0.7 = score 0 (déficit grave, risco LRF)",
        max: "≥1.1 = score 100 (superávit saudável)",
        description:
          "Lei de Responsabilidade Fiscal (LC 101/2000): equilíbrio fiscal é obrigatório. Razão 1.0 = ponto de equilíbrio.",
      },
    },
    total_contratacoes_publicadas: {
      label: "Contratações Publicadas no PNCP",
      unit: "quantidade",
      source: "PNCP — Portal Nacional de Contratações Públicas",
      agent: "pncp",
      explanation:
        "Número total de contratações publicadas pelo município no Portal Nacional de Contratações Públicas (Lei 14.133/2021).",
      goodDirection: "up",
      formula: "≥50 → 100 | <50 → interpolação linear 0–100",
      formulaVariables: [
        {
          symbol: "≥50",
          meaning:
            "Se o município publicou 50 ou mais contratações no PNCP, score máximo (100) — boa aderência à transparência licitatória",
        },
        {
          symbol: "interpolação linear 0–100",
          meaning:
            "Score cresce proporcionalmente de 0 a 100 conforme o número de contratações publicadas sobe de 0 a 50",
        },
        {
          symbol: "0 publicações",
          meaning:
            "Município que não publicou nenhuma contratação no PNCP = score 0 — descumprimento da Lei 14.133/2021",
        },
        {
          symbol: "50",
          meaning:
            "Referência de volume adequado de contratações publicadas por ano — varia com o porte do município",
        },
      ],
      benchmarks: {
        min: "0 = score 0 (não publica no PNCP)",
        max: "≥50 = score 100",
        description:
          "Lei 14.133/2021 (Nova Lei de Licitações) exige publicação obrigatória no PNCP. Municípios sem publicações estão em não conformidade.",
      },
    },
    percentual_dispensas: {
      label: "Percentual de Dispensas de Licitação",
      unit: "%",
      source: "PNCP — Portal Nacional de Contratações Públicas",
      agent: "pncp",
      explanation:
        "Percentual de contratações realizadas por dispensa ou inexigibilidade de licitação em relação ao total.",
      goodDirection: "down",
      formula: "≤20% → 100 | ≥40% → 0 | interpolação linear [invertido]",
      formulaVariables: [
        {
          symbol: "≤20%",
          meaning:
            "Se 20% ou menos das contratações são dispensas de licitação, score máximo (100) — uso proporcional e justificado da dispensa",
        },
        {
          symbol: "≥40%",
          meaning:
            "Se 40% ou mais das contratações são dispensas = score 0 — concentração excessiva de dispensas, risco de irregularidade",
        },
        {
          symbol: "interpolação linear",
          meaning:
            "Score decresce proporcionalmente de 100 a 0 conforme o percentual de dispensas sobe de 20% a 40%",
        },
        {
          symbol: "invertido",
          meaning:
            "Indicador invertido: quanto maior o uso de dispensas, menor o score (mais dispensas = menos competição = risco de ineficiência)",
        },
      ],
      benchmarks: {
        min: "≥40% = score 0 (alta concentração de dispensas = risco de irregularidade)",
        max: "≤20% = score 100",
        description:
          "Dispensas excessivas indicam possível desvio das regras licitatórias. TCE/SC recomenda controle rígido de dispensas.",
      },
    },
    taxa_homologacao: {
      label: "Taxa de Homologação de Licitações",
      unit: "%",
      source: "PNCP — Portal Nacional de Contratações Públicas",
      agent: "pncp",
      explanation:
        "Percentual de licitações publicadas que foram concluídas com homologação (contrato assinado).",
      goodDirection: "up",
      formula: "≥90% → 100 | >100% → 70 (erro de dado) | <50% → 0",
      formulaVariables: [
        {
          symbol: "≥90%",
          meaning:
            "Se 90% ou mais das licitações publicadas foram homologadas (contrato assinado), score máximo (100)",
        },
        {
          symbol: ">100%",
          meaning:
            "Taxa acima de 100% indica inconsistência nos dados do PNCP — recebe score neutro de 70 para não penalizar o município por erro de dado",
        },
        {
          symbol: "<50%",
          meaning:
            "Taxa de homologação abaixo de 50% = score 0 — muitos processos licitatórios fracassados ou desertos",
        },
        {
          symbol: "homologação",
          meaning:
            "Ato formal que encerra o processo licitatório com a adjudicação ao vencedor e assinatura do contrato",
        },
      ],
      benchmarks: {
        min: "<50% = score 0 (muitas licitações fracassadas ou desertas)",
        max: "≥90% = score 100",
        description:
          "Taxa de homologação elevada indica boa elaboração dos editais e capacidade institucional de finalizar processos.",
      },
    },
    percentual_srp: {
      label: "Percentual de Sistema de Registro de Preços",
      unit: "%",
      source: "PNCP — Portal Nacional de Contratações Públicas",
      agent: "pncp",
      explanation:
        "Percentual de contratações realizadas via Sistema de Registro de Preços (SRP) — modalidade mais eficiente da Nova Lei de Licitações.",
      goodDirection: "up",
      formula: "≥30% → 100 | <30% → interpolação linear 0–100",
      formulaVariables: [
        {
          symbol: "≥30%",
          meaning:
            "Se 30% ou mais das contratações são feitas via SRP, score máximo (100) — uso maduro do registro de preços",
        },
        {
          symbol: "interpolação linear 0–100",
          meaning:
            "Score cresce proporcionalmente de 0 a 100 conforme o percentual de SRP sobe de 0% a 30%",
        },
        {
          symbol: "SRP",
          meaning:
            "Sistema de Registro de Preços — modalidade que permite contratar sem licitação imediata, mantendo preços registrados para uso futuro, gerando economia e agilidade",
        },
        {
          symbol: "30%",
          meaning:
            "Limiar de referência — acima de 30% indica que o município usa SRP de forma sistemática e eficiente",
        },
      ],
      benchmarks: {
        min: "0% = score 0",
        max: "≥30% = score 100",
        description:
          "SRP permite compras mais eficientes e economias de escala. Municípios que adotam SRP demonstram maturidade em gestão pública.",
      },
    },
  },

  17: {
    dependencia_fpm: {
      label: "Dependência do FPM",
      unit: "%",
      source: "SICONFI / STN",
      agent: "siconfi",
      explanation:
        "Percentual do FPM (Fundo de Participação dos Municípios) em relação à receita corrente líquida total do município.",
      goodDirection: "down",
      formula:
        "≤5% → 100 | ≤30% → interpolação linear 50–100 | ≤60% → interpolação linear 0–50 [invertido]",
      formulaVariables: [
        {
          symbol: "≤5%",
          meaning:
            "Se o FPM representa 5% ou menos da receita, score máximo (100) — município com alta autonomia fiscal e arrecadação própria forte",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score decresce proporcionalmente de 100 a 50 conforme a dependência do FPM sobe de 5% a 30%",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score decresce proporcionalmente de 50 a 0 conforme a dependência sobe de 30% a 60%",
        },
        {
          symbol: "invertido",
          meaning:
            "Indicador invertido: quanto maior a dependência do FPM, menor o score (mais FPM = menos autonomia fiscal)",
        },
        {
          symbol: "FPM",
          meaning:
            "Fundo de Participação dos Municípios — transferência constitucional da União; municípios pequenos de SC podem ter >80% de dependência",
        },
      ],
      benchmarks: {
        min: ">60% = score 0–50 (dependência crítica de transferências)",
        max: "≤5% = score 100 (alta autonomia fiscal)",
        description:
          "Municípios pequenos de SC podem ter mais de 80% de dependência do FPM. Reduzir dependência indica capacidade de arrecadação própria.",
      },
    },
    convenios_federais: {
      label: "Convênios Federais Ativos",
      unit: "quantidade",
      source: "Plataforma +Brasil / SICONV",
      agent: "convenios",
      explanation:
        "Número de convênios e transferências voluntárias federais ativos no município no período de referência.",
      goodDirection: "up",
      formula: "≥10 → 100 | ≥5 → interpolação linear 50–100 | <5 → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥10",
          meaning:
            "Se o município tem 10 ou mais convênios federais ativos, score máximo (100) — boa capacidade de captação de recursos externos",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme os convênios ativos sobem de 5 a 10",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme os convênios sobem de 0 a 5 — baixa captação de recursos federais",
        },
        {
          symbol: "convênio ativo",
          meaning:
            "Convênio ou transferência voluntária federal em execução no período de referência, registrado na Plataforma +Brasil (SICONV)",
        },
      ],
      benchmarks: {
        min: "0 = score 0 (sem acesso a recursos federais)",
        max: "≥10 = score 100",
        description:
          "Convênios federais ampliam a capacidade de investimento municipal além do FPM. Gestão eficiente = mais convênios aprovados.",
      },
    },
    pct_orcamento_convenios: {
      label: "Convênios como % do Orçamento",
      unit: "%",
      source: "Plataforma +Brasil / SICONV",
      agent: "convenios",
      explanation:
        "Percentual do orçamento total municipal financiado por convênios e transferências voluntárias federais.",
      goodDirection: "up",
      formula: "≥15% → 100 | ≥5% → interpolação linear 50–100 | <5% → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥15%",
          meaning:
            "Se convênios federais financiam 15% ou mais do orçamento municipal, score máximo (100) — alta capacidade de captação",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme a participação de convênios sobe de 5% a 15% do orçamento",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme a participação sobe de 0% a 5% do orçamento — captação baixa",
        },
        {
          symbol: "% do orçamento",
          meaning:
            "Valor total de convênios ativos dividido pelo orçamento total aprovado do município no mesmo período",
        },
      ],
      benchmarks: {
        min: "<5% = score 0–50",
        max: "≥15% = score 100",
        description:
          "Alta participação de convênios indica capacidade de captação e gestão de recursos externos.",
      },
    },
    consorcios_intermunicipais: {
      label: "Consórcios Intermunicipais Ativos",
      unit: "quantidade",
      source: "Plataforma +Brasil / SICONV",
      agent: "convenios",
      explanation:
        "Número de consórcios públicos intermunicipais que o município participa ativamente (saúde, saneamento, resíduos, etc.).",
      goodDirection: "up",
      formula: "≥5 → 100 | ≥2 → interpolação linear 50–100 | <2 → interpolação linear 0–50",
      formulaVariables: [
        {
          symbol: "≥5",
          meaning:
            "Se o município participa de 5 ou mais consórcios intermunicipais ativos, score máximo (100) — alto nível de cooperação regional",
        },
        {
          symbol: "interpolação linear 50–100",
          meaning:
            "Score cresce proporcionalmente de 50 a 100 conforme o número de consórcios sobe de 2 a 5",
        },
        {
          symbol: "interpolação linear 0–50",
          meaning:
            "Score cresce proporcionalmente de 0 a 50 conforme o número de consórcios sobe de 0 a 2 — cooperação intermunicipal incipiente",
        },
        {
          symbol: "consórcio público",
          meaning:
            "Associação entre municípios para prestação compartilhada de serviços públicos (saúde, saneamento, resíduos, etc.) — instrumento da Lei 11.107/2005",
        },
      ],
      benchmarks: {
        min: "0 = score 0 (sem cooperação intermunicipal)",
        max: "≥5 = score 100",
        description:
          "Consórcios intermunicipais aumentam eficiência (escala) em serviços públicos. SC tem tradição forte em consórcios de saúde.",
      },
    },
  },
};

/**
 * Returns the full methodology report for all 17 ODS.
 *
 * Combines static ODS definitions and descriptions with the exact benchmark
 * and formula data used by the ODS mapper agents.
 */
export function getMethodology(): MethodologyReport {
  const ods: OdsMethodology[] = ODS_DEFINITIONS.map((def) => {
    const desc = ODS_DESCRIPTIONS[def.number];
    const indicatorBenchmarks = INDICATOR_BENCHMARKS[def.number] ?? {};

    const indicators: IndicatorMethodology[] = Object.entries(indicatorBenchmarks).map(
      ([name, meta]) => ({
        name,
        label: meta.label,
        unit: meta.unit,
        source: meta.source,
        agent: meta.agent,
        explanation: meta.explanation,
        goodDirection: meta.goodDirection,
        formula: meta.formula,
        formulaVariables: meta.formulaVariables,
        benchmarks: meta.benchmarks,
      }),
    );

    return {
      odsNumber: def.number,
      name: def.name,
      shortName: def.shortName,
      color: def.color,
      weight: def.weight,
      description: desc?.description ?? "",
      meta2030: desc?.meta2030 ?? "",
      aggregation:
        "Média aritmética ponderada dos indicadores do ODS. Cada indicador tem peso igual dentro do ODS; pesos diferenciados são aplicados apenas no score global entre ODS.",
      indicators,
    };
  });

  return {
    version: "1.0.0",
    lastUpdated: "2026-04-28",
    globalScoreMethod: {
      arithmetic:
        "score_global = Σ(score_ods_i × weight_i) / Σ(weight_i)  — média aritmética ponderada pelos pesos de relevância municipal.",
      geometric:
        "score_global_geo = exp(Σ(weight_i × ln(max(score_ods_i, 1))) / Σ(weight_i))  — média geométrica ponderada (padrão IDHM/PNUD). Floor em 1 para evitar ln(0).",
      preferred:
        "geometric — a média geométrica é o método preferido por penalizar desequilíbrios: um município com score 100 em 16 ODS e 0 em 1 ODS não atinge score global máximo.",
    },
    statusThresholds: {
      verde: "score ≥ 70 — desempenho adequado ou superior ao esperado para 2030.",
      amarelo: "40 ≤ score < 70 — desempenho intermediário, ação recomendada.",
      vermelho: "score < 40 — desempenho crítico, intervenção urgente necessária.",
    },
    ods,
  };
}
