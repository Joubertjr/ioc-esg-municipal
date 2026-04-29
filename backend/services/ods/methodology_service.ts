import { ODS_DEFINITIONS } from "../../../shared/constants/ods.js";
import { ODS_DESCRIPTIONS } from "../../../shared/constants/ods-descriptions.js";

export interface IndicatorMethodology {
  name: string;
  label: string;
  unit: string;
  source: string;
  agent: string;
  explanation: string;
  goodDirection: "up" | "down";
  formula: string;
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
      formula: "score = ((70 - pct) / 50) * 100  [clamped 0–100]",
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
      formula: "≥500k → 100 | ≥100k → 70 | ≥10k → 40 | else → 20",
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
