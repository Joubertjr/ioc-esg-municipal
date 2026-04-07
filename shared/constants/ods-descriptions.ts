/**
 * Descrições completas dos 17 ODS, metas 2030 e metadados de indicadores.
 * Fonte: ONU Brasil (nacoesunidas.org/pos2015/ods) + fontes governamentais brasileiras.
 *
 * Usado por: OdsTooltip, IndicatorRow, OdsDetailDrawer, ReportsPage
 */

export interface OdsIndicatorMeta {
  /** Nome legível do indicador em pt-BR */
  label: string;
  /** Unidade de medida (%, R$, por 1.000 hab, etc.) */
  unit: string;
  /** Explicação de 1 linha sobre o que o indicador mede */
  explanation: string;
  /** Fonte original dos dados */
  source: string;
  /** "up" = maior é melhor, "down" = menor é melhor */
  goodDirection: "up" | "down";
}

export interface OdsDescription {
  /** Descrição oficial do ODS */
  description: string;
  /** Meta principal da Agenda 2030 para este ODS */
  meta2030: string;
  /** Metadados dos indicadores usados no cálculo do score */
  indicators: Record<string, OdsIndicatorMeta>;
}

export const ODS_DESCRIPTIONS: Record<number, OdsDescription> = {
  1: {
    description: "Acabar com a pobreza em todas as suas formas, em todos os lugares.",
    meta2030:
      "Até 2030, erradicar a pobreza extrema e reduzir pela metade a proporção de pessoas vivendo em pobreza.",
    indicators: {
      populacao_baixa_renda: {
        label: "População em Baixa Renda",
        unit: "%",
        explanation:
          "Percentual da população com renda domiciliar per capita inferior a 1/2 salário mínimo.",
        source: "IBGE Censo 2022",
        goodDirection: "down",
      },
      bolsa_familia_cobertura: {
        label: "Cobertura Bolsa Família",
        unit: "%",
        explanation:
          "Percentual de famílias elegíveis atendidas pelo programa de transferência de renda.",
        source: "MDS / CadÚnico",
        goodDirection: "up",
      },
      taxa_desemprego: {
        label: "Taxa de Desemprego",
        unit: "%",
        explanation: "Percentual da população economicamente ativa sem ocupação.",
        source: "IBGE PNAD",
        goodDirection: "down",
      },
    },
  },
  2: {
    description:
      "Acabar com a fome, alcançar a segurança alimentar e melhoria da nutrição e promover a agricultura sustentável.",
    meta2030:
      "Até 2030, acabar com a fome e garantir acesso de todas as pessoas a alimentos seguros, nutritivos e suficientes.",
    indicators: {
      desnutricao_infantil: {
        label: "Desnutrição Infantil",
        unit: "%",
        explanation: "Percentual de crianças menores de 5 anos com déficit de peso para idade.",
        source: "SISVAN / DATASUS",
        goodDirection: "down",
      },
      seguranca_alimentar: {
        label: "Segurança Alimentar",
        unit: "%",
        explanation: "Percentual de domicílios em situação de segurança alimentar.",
        source: "IBGE POF",
        goodDirection: "up",
      },
      agricultura_familiar: {
        label: "Agricultura Familiar",
        unit: "estabelecimentos",
        explanation: "Número de estabelecimentos de agricultura familiar no município.",
        source: "IBGE Censo Agropecuário",
        goodDirection: "up",
      },
    },
  },
  3: {
    description:
      "Assegurar uma vida saudável e promover o bem-estar para todas e todos, em todas as idades.",
    meta2030:
      "Até 2030, reduzir a taxa de mortalidade materna, acabar com mortes evitáveis de recém-nascidos e crianças menores de 5 anos.",
    indicators: {
      mortalidade_infantil: {
        label: "Mortalidade Infantil",
        unit: "por 1.000 nascidos vivos",
        explanation: "Número de óbitos de crianças menores de 1 ano por mil nascidos vivos.",
        source: "DATASUS / SIM",
        goodDirection: "down",
      },
      cobertura_vacinal: {
        label: "Cobertura Vacinal",
        unit: "%",
        explanation: "Percentual de crianças com vacinação completa para a idade.",
        source: "DATASUS / PNI",
        goodDirection: "up",
      },
      leitos_sus: {
        label: "Leitos SUS",
        unit: "por 1.000 hab",
        explanation: "Número de leitos hospitalares do SUS disponíveis por mil habitantes.",
        source: "DATASUS / CNES",
        goodDirection: "up",
      },
      cobertura_atencao_basica: {
        label: "Cobertura Atenção Básica",
        unit: "%",
        explanation: "Percentual da população coberta por equipes de Saúde da Família.",
        source: "DATASUS / e-Gestor AB",
        goodDirection: "up",
      },
    },
  },
  4: {
    description:
      "Assegurar a educação inclusiva e equitativa de qualidade e promover oportunidades de aprendizagem ao longo da vida para todas e todos.",
    meta2030:
      "Até 2030, garantir que todas as meninas e meninos completem o ensino fundamental e médio de qualidade.",
    indicators: {
      ideb_anos_iniciais: {
        label: "IDEB Anos Iniciais",
        unit: "nota (0-10)",
        explanation:
          "Índice de Desenvolvimento da Educação Básica para anos iniciais (1º ao 5º ano).",
        source: "INEP / MEC",
        goodDirection: "up",
      },
      ideb_anos_finais: {
        label: "IDEB Anos Finais",
        unit: "nota (0-10)",
        explanation:
          "Índice de Desenvolvimento da Educação Básica para anos finais (6º ao 9º ano).",
        source: "INEP / MEC",
        goodDirection: "up",
      },
      taxa_abandono: {
        label: "Taxa de Abandono Escolar",
        unit: "%",
        explanation: "Percentual de alunos que abandonaram a escola durante o ano letivo.",
        source: "INEP / Censo Escolar",
        goodDirection: "down",
      },
      taxa_alfabetizacao: {
        label: "Taxa de Alfabetização",
        unit: "%",
        explanation: "Percentual da população de 15 anos ou mais que sabe ler e escrever.",
        source: "IBGE Censo 2022",
        goodDirection: "up",
      },
    },
  },
  5: {
    description: "Alcançar a igualdade de gênero e empoderar todas as mulheres e meninas.",
    meta2030: "Acabar com todas as formas de discriminação e violência contra mulheres e meninas.",
    indicators: {
      violencia_mulher: {
        label: "Violência contra Mulher",
        unit: "por 100.000 hab",
        explanation: "Taxa de ocorrências de violência doméstica contra mulheres.",
        source: "SSP / IBGE",
        goodDirection: "down",
      },
      participacao_politica: {
        label: "Participação Política Feminina",
        unit: "%",
        explanation: "Percentual de cadeiras ocupadas por mulheres na câmara municipal.",
        source: "TSE",
        goodDirection: "up",
      },
    },
  },
  6: {
    description:
      "Assegurar a disponibilidade e gestão sustentável da água e saneamento para todas e todos.",
    meta2030:
      "Até 2030, alcançar acesso universal e equitativo a água potável segura e saneamento adequado.",
    indicators: {
      agua_tratada: {
        label: "Acesso à Água Tratada",
        unit: "%",
        explanation: "Percentual da população com acesso a rede de água tratada.",
        source: "SNIS",
        goodDirection: "up",
      },
      esgoto_tratado: {
        label: "Coleta de Esgoto",
        unit: "%",
        explanation: "Percentual da população com coleta de esgotamento sanitário.",
        source: "SNIS",
        goodDirection: "up",
      },
      perdas_distribuicao: {
        label: "Perdas na Distribuição",
        unit: "%",
        explanation:
          "Percentual de água tratada perdida na distribuição (vazamentos, ligações irregulares).",
        source: "SNIS",
        goodDirection: "down",
      },
    },
  },
  7: {
    description:
      "Assegurar o acesso confiável, sustentável, moderno e a preço acessível à energia para todas e todos.",
    meta2030:
      "Até 2030, assegurar acesso universal a serviços de energia confiáveis e modernos, aumentar a participação de energias renováveis.",
    indicators: {
      acesso_energia: {
        label: "Acesso à Energia Elétrica",
        unit: "%",
        explanation: "Percentual de domicílios com acesso à rede elétrica.",
        source: "ANEEL / IBGE",
        goodDirection: "up",
      },
      energia_renovavel: {
        label: "Energia Renovável",
        unit: "%",
        explanation: "Percentual de energia consumida proveniente de fontes renováveis.",
        source: "ANEEL",
        goodDirection: "up",
      },
    },
  },
  8: {
    description:
      "Promover o crescimento econômico sustentado, inclusivo e sustentável, emprego pleno e produtivo e trabalho decente para todas e todos.",
    meta2030:
      "Sustentar o crescimento econômico per capita, alcançar emprego pleno e produtivo e trabalho decente.",
    indicators: {
      pib_per_capita: {
        label: "PIB per Capita",
        unit: "R$",
        explanation: "Produto Interno Bruto dividido pela população do município.",
        source: "IBGE",
        goodDirection: "up",
      },
      taxa_desemprego: {
        label: "Taxa de Desemprego",
        unit: "%",
        explanation: "Percentual da população economicamente ativa sem ocupação.",
        source: "IBGE PNAD",
        goodDirection: "down",
      },
      trabalho_informal: {
        label: "Trabalho Informal",
        unit: "%",
        explanation: "Percentual de trabalhadores sem carteira assinada ou vínculo formal.",
        source: "IBGE PNAD",
        goodDirection: "down",
      },
    },
  },
  9: {
    description:
      "Construir infraestruturas resilientes, promover a industrialização inclusiva e sustentável e fomentar a inovação.",
    meta2030:
      "Desenvolver infraestrutura de qualidade, confiável e sustentável, apoiar a industrialização e fomentar a inovação.",
    indicators: {
      acesso_internet: {
        label: "Acesso à Internet",
        unit: "%",
        explanation: "Percentual de domicílios com acesso à internet banda larga.",
        source: "ANATEL / IBGE",
        goodDirection: "up",
      },
      empresas_ativas: {
        label: "Empresas Ativas",
        unit: "por 1.000 hab",
        explanation: "Número de empresas com CNPJ ativo por mil habitantes.",
        source: "IBGE CEMPRE",
        goodDirection: "up",
      },
    },
  },
  10: {
    description: "Reduzir a desigualdade dentro dos países e entre eles.",
    meta2030:
      "Até 2030, progressivamente alcançar e sustentar o crescimento da renda dos 40% mais pobres da população.",
    indicators: {
      indice_gini: {
        label: "Índice de Gini",
        unit: "0 a 1",
        explanation:
          "Medida de desigualdade de renda (0 = igualdade perfeita, 1 = desigualdade máxima).",
        source: "IBGE Censo 2022",
        goodDirection: "down",
      },
      razao_renda: {
        label: "Razão de Renda 20/20",
        unit: "vezes",
        explanation: "Razão entre a renda dos 20% mais ricos e dos 20% mais pobres.",
        source: "IBGE",
        goodDirection: "down",
      },
    },
  },
  11: {
    description:
      "Tornar as cidades e os assentamentos humanos inclusivos, seguros, resilientes e sustentáveis.",
    meta2030:
      "Até 2030, garantir acesso a habitação segura, serviços básicos e transporte sustentável para todos.",
    indicators: {
      deficit_habitacional: {
        label: "Déficit Habitacional",
        unit: "%",
        explanation: "Percentual de domicílios em situação de déficit habitacional.",
        source: "FJP / IBGE",
        goodDirection: "down",
      },
      coleta_residuos: {
        label: "Coleta de Resíduos",
        unit: "%",
        explanation: "Percentual de domicílios com coleta regular de resíduos sólidos.",
        source: "SNIS / IBGE",
        goodDirection: "up",
      },
      areas_verdes: {
        label: "Áreas Verdes Urbanas",
        unit: "m² por hab",
        explanation: "Metros quadrados de área verde urbana por habitante.",
        source: "IBGE / Prefeitura",
        goodDirection: "up",
      },
    },
  },
  12: {
    description: "Assegurar padrões de produção e de consumo sustentáveis.",
    meta2030: "Até 2030, alcançar a gestão sustentável e o uso eficiente dos recursos naturais.",
    indicators: {
      reciclagem: {
        label: "Taxa de Reciclagem",
        unit: "%",
        explanation: "Percentual de resíduos sólidos encaminhados para reciclagem.",
        source: "SNIS",
        goodDirection: "up",
      },
      coleta_seletiva: {
        label: "Coleta Seletiva",
        unit: "sim/não",
        explanation: "Município possui programa de coleta seletiva implantado.",
        source: "SNIS",
        goodDirection: "up",
      },
    },
  },
  13: {
    description: "Tomar medidas urgentes para combater a mudança climática e seus impactos.",
    meta2030:
      "Reforçar a resiliência e a capacidade de adaptação a riscos relacionados ao clima e desastres naturais.",
    indicators: {
      emissoes_co2: {
        label: "Emissões de CO₂",
        unit: "tCO₂/hab",
        explanation: "Toneladas de CO₂ equivalente emitidas por habitante ao ano.",
        source: "SEEG / INPE",
        goodDirection: "down",
      },
      desmatamento: {
        label: "Desmatamento",
        unit: "km²/ano",
        explanation: "Área desmatada no município durante o período de referência.",
        source: "INPE / PRODES",
        goodDirection: "down",
      },
      plano_climatico: {
        label: "Plano de Adaptação Climática",
        unit: "sim/não",
        explanation: "Município possui plano municipal de adaptação às mudanças climáticas.",
        source: "IBGE MUNIC",
        goodDirection: "up",
      },
    },
  },
  14: {
    description:
      "Conservação e uso sustentável dos oceanos, dos mares e dos recursos marinhos para o desenvolvimento sustentável.",
    meta2030: "Até 2030, conservar e usar sustentavelmente os oceanos e recursos marinhos.",
    indicators: {
      qualidade_agua: {
        label: "Qualidade da Água",
        unit: "IQA (0-100)",
        explanation: "Índice de Qualidade da Água dos corpos hídricos do município.",
        source: "ANA",
        goodDirection: "up",
      },
      areas_protegidas_marinhas: {
        label: "Áreas Protegidas",
        unit: "%",
        explanation:
          "Percentual do território costeiro/marinho do município em unidades de conservação.",
        source: "ICMBio / MMA",
        goodDirection: "up",
      },
    },
  },
  15: {
    description:
      "Proteger, recuperar e promover o uso sustentável dos ecossistemas terrestres, gerir de forma sustentável as florestas, combater a desertificação, deter e reverter a degradação da terra e deter a perda de biodiversidade.",
    meta2030:
      "Até 2030, combater a desertificação, restaurar a terra degradada e alcançar a neutralidade na degradação do solo.",
    indicators: {
      cobertura_vegetal: {
        label: "Cobertura Vegetal",
        unit: "%",
        explanation: "Percentual do território municipal com cobertura vegetal nativa.",
        source: "INPE / MapBiomas",
        goodDirection: "up",
      },
      desmatamento: {
        label: "Desmatamento",
        unit: "km²/ano",
        explanation: "Área desmatada no município durante o período de referência.",
        source: "INPE / PRODES",
        goodDirection: "down",
      },
      areas_protegidas: {
        label: "Áreas de Proteção",
        unit: "%",
        explanation: "Percentual do território em unidades de conservação.",
        source: "ICMBio / MMA",
        goodDirection: "up",
      },
    },
  },
  16: {
    description:
      "Promover sociedades pacíficas e inclusivas para o desenvolvimento sustentável, proporcionar o acesso à justiça para todos e construir instituições eficazes, responsáveis e inclusivas em todos os níveis.",
    meta2030:
      "Reduzir significativamente todas as formas de violência e as taxas de mortalidade relacionada.",
    indicators: {
      taxa_homicidio: {
        label: "Taxa de Homicídios",
        unit: "por 100.000 hab",
        explanation: "Número de homicídios dolosos por cem mil habitantes ao ano.",
        source: "SSP / DATASUS",
        goodDirection: "down",
      },
      transparencia: {
        label: "Índice de Transparência",
        unit: "nota (0-10)",
        explanation: "Nota do município no ranking de transparência pública.",
        source: "CGU / MPF",
        goodDirection: "up",
      },
      participacao_cidada: {
        label: "Participação Cidadã",
        unit: "%",
        explanation: "Percentual de eleitores que votaram na última eleição municipal.",
        source: "TSE",
        goodDirection: "up",
      },
    },
  },
  17: {
    description:
      "Fortalecer os meios de implementação e revitalizar a parceria global para o desenvolvimento sustentável.",
    meta2030:
      "Fortalecer a mobilização de recursos internos e a cooperação internacional para o desenvolvimento sustentável.",
    indicators: {
      receita_propria: {
        label: "Receita Própria",
        unit: "%",
        explanation:
          "Percentual da receita total que é arrecadada pelo próprio município (não dependente de transferências).",
        source: "SICONFI / STN",
        goodDirection: "up",
      },
      investimento_pct: {
        label: "Investimento Público",
        unit: "% da receita",
        explanation: "Percentual da receita municipal destinada a investimentos (não custeio).",
        source: "SICONFI / STN",
        goodDirection: "up",
      },
      convenios_ativos: {
        label: "Convênios Ativos",
        unit: "quantidade",
        explanation: "Número de convênios ativos com governo estadual e federal.",
        source: "SICONV / Plataforma +Brasil",
        goodDirection: "up",
      },
    },
  },
};

/**
 * Helper para buscar metadados de um indicador pelo nome snake_case.
 * Retorna undefined se não encontrado.
 */
export function getIndicatorMeta(
  odsNumber: number,
  indicatorName: string,
): OdsIndicatorMeta | undefined {
  const ods = ODS_DESCRIPTIONS[odsNumber];
  if (!ods) return undefined;
  return ods.indicators[indicatorName];
}

/**
 * Helper para buscar a descrição de um ODS.
 */
export function getOdsDescription(odsNumber: number): OdsDescription | undefined {
  return ODS_DESCRIPTIONS[odsNumber];
}
