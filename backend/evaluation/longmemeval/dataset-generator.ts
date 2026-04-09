/**
 * Gerador de dataset sintético para LongMemEval-ESG.
 * Produz instâncias de teste baseadas em dados realistas de municípios SC.
 * Cada categoria gera >= 10 instâncias para benchmark.
 */

import type { EvaluationInstance, ContextSession } from "./types.js";

// ─── Municípios SC de referência ────────────────────────────────────────────

const MUNICIPALITIES = [
  { name: "Florianópolis", ibgeCode: "4205407" },
  { name: "Joinville", ibgeCode: "4209102" },
  { name: "Blumenau", ibgeCode: "4202404" },
  { name: "Chapecó", ibgeCode: "4204202" },
  { name: "Criciúma", ibgeCode: "4204608" },
  { name: "Itajaí", ibgeCode: "4208203" },
  { name: "Lages", ibgeCode: "4209300" },
  { name: "Jaraguá do Sul", ibgeCode: "4208906" },
  { name: "São José", ibgeCode: "4216602" },
  { name: "Balneário Camboriú", ibgeCode: "4202008" },
  { name: "Tubarão", ibgeCode: "4218707" },
  { name: "Palhoça", ibgeCode: "4211900" },
] as const;

// ─── Dados mockados realistas por agente ────────────────────────────────────

function makeSession(
  agent: string,
  ibgeCode: string,
  year: number,
  data: Record<string, unknown>,
): ContextSession {
  return {
    agentSource: agent,
    ibgeCode,
    referenceYear: year,
    collectedAt: `${year}-12-31T23:59:59Z`,
    data,
  };
}

// ─── Geradores por categoria ────────────────────────────────────────────────

function generateExtractionInstances(): EvaluationInstance[] {
  const instances: EvaluationInstance[] = [];

  // DATASUS — mortalidade infantil
  const mortalidadeData = [
    { mun: MUNICIPALITIES[0], value: 8.2 },
    { mun: MUNICIPALITIES[1], value: 9.5 },
    { mun: MUNICIPALITIES[2], value: 10.1 },
    { mun: MUNICIPALITIES[3], value: 11.8 },
    { mun: MUNICIPALITIES[4], value: 12.3 },
  ];

  for (const { mun, value } of mortalidadeData) {
    instances.push({
      id: `ext-datasus-mort-${mun.ibgeCode}`,
      municipality: mun.name,
      ibgeCode: mun.ibgeCode,
      category: "extraction",
      question: `Qual foi a taxa de mortalidade infantil (DATASUS) reportada para o município de ${mun.name} no ciclo de coleta de 2022?`,
      contextSessions: [
        makeSession("datasus", mun.ibgeCode, 2022, {
          mortalidadeInfantil: value,
          mortalidadeMaterna: value * 3.2,
          leitos: Math.round(value * 15),
        }),
      ],
      expectedAnswer: `A taxa de mortalidade infantil de ${mun.name} em 2022 foi de ${value} por 1.000 nascidos vivos.`,
    });
  }

  // SNIS — cobertura de esgoto
  const snisData = [
    { mun: MUNICIPALITIES[0], agua: 98.2, esgoto: 65.3 },
    { mun: MUNICIPALITIES[1], agua: 99.1, esgoto: 42.8 },
    { mun: MUNICIPALITIES[5], agua: 97.5, esgoto: 38.1 },
    { mun: MUNICIPALITIES[6], agua: 92.4, esgoto: 28.7 },
    { mun: MUNICIPALITIES[7], agua: 99.3, esgoto: 55.2 },
  ];

  for (const { mun, agua, esgoto } of snisData) {
    instances.push({
      id: `ext-snis-esgoto-${mun.ibgeCode}`,
      municipality: mun.name,
      ibgeCode: mun.ibgeCode,
      category: "extraction",
      question: `Qual era a cobertura de esgotamento sanitário (SNIS) em ${mun.name} no ano de 2022?`,
      contextSessions: [
        makeSession("snis", mun.ibgeCode, 2022, {
          atendimentoAgua: agua,
          atendimentoEsgoto: esgoto,
          esgotoTratado: esgoto * 0.85,
        }),
      ],
      expectedAnswer: `A cobertura de esgotamento sanitário de ${mun.name} em 2022 era de ${esgoto}%.`,
    });
  }

  return instances;
}

function generateMultiSessionInstances(): EvaluationInstance[] {
  const instances: EvaluationInstance[] = [];

  // Cruzamento SNIS (saneamento) x DATASUS (saúde)
  const crossData = [
    { mun: MUNICIPALITIES[0], esgoto: 65.3, csap: 720, corr: "moderada negativa" },
    { mun: MUNICIPALITIES[1], esgoto: 42.8, csap: 950, corr: "forte negativa" },
    { mun: MUNICIPALITIES[2], esgoto: 38.1, csap: 1100, corr: "forte negativa" },
    { mun: MUNICIPALITIES[3], esgoto: 55.2, csap: 850, corr: "moderada negativa" },
    { mun: MUNICIPALITIES[4], esgoto: 28.7, csap: 1350, corr: "forte negativa" },
  ];

  for (const { mun, esgoto, csap, corr } of crossData) {
    instances.push({
      id: `multi-snis-datasus-${mun.ibgeCode}`,
      municipality: mun.name,
      ibgeCode: mun.ibgeCode,
      category: "multi_session",
      question: `Considerando os dados do SNIS (saneamento) de 2023 e do IEPS (saúde) de 2021, qual é a relação observada entre a cobertura de esgoto e as internações CSAP em ${mun.name}?`,
      contextSessions: [
        makeSession("snis", mun.ibgeCode, 2023, {
          atendimentoEsgoto: esgoto,
          atendimentoAgua: esgoto + 30,
        }),
        makeSession("ieps", mun.ibgeCode, 2021, {
          internacoesCsap: csap,
          coberturaEsf: 78.0,
          mortalidadeInfantil: csap / 100,
        }),
      ],
      expectedAnswer: `${mun.name} possui cobertura de esgoto de ${esgoto}% (SNIS 2023) e taxa de internações CSAP de ${csap} por 100 mil hab (IEPS 2021). A correlação é ${corr}: menor cobertura de saneamento associa-se a mais internações por condições sensíveis à atenção primária.`,
    });
  }

  // Cruzamento IBGE (renda) x INEP (IDEB)
  const rendaIdeb = [
    { mun: MUNICIPALITIES[0], pibPc: 48500, ideb: 6.8 },
    { mun: MUNICIPALITIES[1], pibPc: 52300, ideb: 6.5 },
    { mun: MUNICIPALITIES[8], pibPc: 35200, ideb: 6.1 },
    { mun: MUNICIPALITIES[9], pibPc: 41800, ideb: 5.9 },
    { mun: MUNICIPALITIES[10], pibPc: 38100, ideb: 5.7 },
  ];

  for (const { mun, pibPc, ideb } of rendaIdeb) {
    instances.push({
      id: `multi-ibge-inep-${mun.ibgeCode}`,
      municipality: mun.name,
      ibgeCode: mun.ibgeCode,
      category: "multi_session",
      question: `Considerando o PIB per capita (IBGE 2022) e o IDEB anos finais (INEP 2023) de ${mun.name}, existe correlação entre renda e educação?`,
      contextSessions: [
        makeSession("ibge", mun.ibgeCode, 2022, {
          populacao: 180000,
          pibPerCapita: pibPc,
          idhm: 0.78,
        }),
        makeSession("inep", mun.ibgeCode, 2023, {
          idebAnosIniciais: ideb + 0.8,
          idebAnosFinais: ideb,
        }),
      ],
      expectedAnswer: `${mun.name} tem PIB per capita de R$${pibPc.toLocaleString("pt-BR")} (IBGE 2022) e IDEB anos finais de ${ideb} (INEP 2023). Municípios com maior PIB per capita tendem a apresentar IDEB mais alto, sugerindo correlação positiva entre renda e desempenho educacional.`,
    });
  }

  return instances;
}

function generateTemporalInstances(): EvaluationInstance[] {
  const instances: EvaluationInstance[] = [];

  // IDEB evolução bienal
  const idebSeries = [
    {
      mun: MUNICIPALITIES[0],
      years: [
        { y: 2019, v: 6.2 },
        { y: 2021, v: 6.5 },
        { y: 2023, v: 6.8 },
      ],
      trend: "alta",
    },
    {
      mun: MUNICIPALITIES[1],
      years: [
        { y: 2019, v: 6.0 },
        { y: 2021, v: 6.3 },
        { y: 2023, v: 6.5 },
      ],
      trend: "alta",
    },
    {
      mun: MUNICIPALITIES[3],
      years: [
        { y: 2019, v: 5.8 },
        { y: 2021, v: 5.5 },
        { y: 2023, v: 5.3 },
      ],
      trend: "baixa",
    },
    {
      mun: MUNICIPALITIES[6],
      years: [
        { y: 2019, v: 5.2 },
        { y: 2021, v: 5.0 },
        { y: 2023, v: 4.8 },
      ],
      trend: "baixa",
    },
    {
      mun: MUNICIPALITIES[4],
      years: [
        { y: 2019, v: 5.5 },
        { y: 2021, v: 5.7 },
        { y: 2023, v: 5.4 },
      ],
      trend: "estável com oscilação",
    },
  ];

  for (const { mun, years, trend } of idebSeries) {
    const first = years[0].v;
    const last = years[years.length - 1].v;
    const varPct = (((last - first) / first) * 100).toFixed(1);

    instances.push({
      id: `temp-inep-ideb-${mun.ibgeCode}`,
      municipality: mun.name,
      ibgeCode: mun.ibgeCode,
      category: "temporal",
      question: `A nota do IDEB (INEP) de ${mun.name} apresentou tendência de alta ou de baixa entre os ciclos de 2019, 2021 e 2023? Qual foi a variação percentual?`,
      contextSessions: years.map(({ y, v }) =>
        makeSession("inep", mun.ibgeCode, y, {
          idebAnosIniciais: v + 0.8,
          idebAnosFinais: v,
        }),
      ),
      expectedAnswer: `O IDEB anos finais de ${mun.name} apresentou tendência de ${trend}: ${years.map((yv) => `${yv.y}: ${yv.v}`).join(", ")}. Variação de ${varPct}% entre ${years[0].y} e ${years[years.length - 1].y}.`,
    });
  }

  // SICONFI FPM evolução
  const fpmSeries = [
    {
      mun: MUNICIPALITIES[0],
      years: [
        { y: 2020, v: 185 },
        { y: 2021, v: 198 },
        { y: 2022, v: 215 },
        { y: 2023, v: 232 },
      ],
    },
    {
      mun: MUNICIPALITIES[1],
      years: [
        { y: 2020, v: 210 },
        { y: 2021, v: 225 },
        { y: 2022, v: 240 },
        { y: 2023, v: 255 },
      ],
    },
    {
      mun: MUNICIPALITIES[2],
      years: [
        { y: 2020, v: 120 },
        { y: 2021, v: 115 },
        { y: 2022, v: 128 },
        { y: 2023, v: 135 },
      ],
    },
    {
      mun: MUNICIPALITIES[5],
      years: [
        { y: 2020, v: 145 },
        { y: 2021, v: 160 },
        { y: 2022, v: 172 },
        { y: 2023, v: 190 },
      ],
    },
    {
      mun: MUNICIPALITIES[8],
      years: [
        { y: 2020, v: 95 },
        { y: 2021, v: 100 },
        { y: 2022, v: 108 },
        { y: 2023, v: 115 },
      ],
    },
  ];

  for (const { mun, years } of fpmSeries) {
    const first = years[0].v;
    const last = years[years.length - 1].v;
    const varPct = (((last - first) / first) * 100).toFixed(1);

    instances.push({
      id: `temp-siconfi-fpm-${mun.ibgeCode}`,
      municipality: mun.name,
      ibgeCode: mun.ibgeCode,
      category: "temporal",
      question: `Como evoluiu o FPM (SICONFI) de ${mun.name} entre 2020 e 2023? Houve crescimento ou redução?`,
      contextSessions: years.map(({ y, v }) =>
        makeSession("siconfi", mun.ibgeCode, y, {
          fpmAnual: v * 1_000_000,
          receitaTotal: v * 1_000_000 * 2.5,
          despesaPessoal: v * 1_000_000 * 1.1,
        }),
      ),
      expectedAnswer: `O FPM de ${mun.name} cresceu de R$${first}M (2020) para R$${last}M (2023), variação de +${varPct}%. Tendência de crescimento nominal ao longo dos 4 anos.`,
    });
  }

  return instances;
}

function generateKnowledgeUpdateInstances(): EvaluationInstance[] {
  const instances: EvaluationInstance[] = [];

  // Dados preliminares vs definitivos
  const updates = [
    {
      mun: MUNICIPALITIES[0],
      agent: "siconfi",
      field: "despesaPessoal",
      prelim: 48.2,
      final: 45.8,
      unit: "%",
    },
    {
      mun: MUNICIPALITIES[1],
      agent: "siconfi",
      field: "despesaPessoal",
      prelim: 51.3,
      final: 49.7,
      unit: "%",
    },
    {
      mun: MUNICIPALITIES[2],
      agent: "datasus",
      field: "mortalidadeInfantil",
      prelim: 11.5,
      final: 10.1,
      unit: "por 1.000 NV",
    },
    {
      mun: MUNICIPALITIES[3],
      agent: "snis",
      field: "atendimentoEsgoto",
      prelim: 35.2,
      final: 38.7,
      unit: "%",
    },
    {
      mun: MUNICIPALITIES[4],
      agent: "datasus",
      field: "mortalidadeInfantil",
      prelim: 13.8,
      final: 12.3,
      unit: "por 1.000 NV",
    },
    {
      mun: MUNICIPALITIES[5],
      agent: "inpe",
      field: "desmatamento",
      prelim: 1250,
      final: 980,
      unit: "hectares",
    },
    {
      mun: MUNICIPALITIES[6],
      agent: "snis",
      field: "atendimentoAgua",
      prelim: 89.5,
      final: 92.4,
      unit: "%",
    },
    {
      mun: MUNICIPALITIES[7],
      agent: "siconfi",
      field: "receitaTotal",
      prelim: 850,
      final: 892,
      unit: "R$ milhões",
    },
    {
      mun: MUNICIPALITIES[8],
      agent: "datasus",
      field: "coberturaVacinal",
      prelim: 72.0,
      final: 78.5,
      unit: "%",
    },
    {
      mun: MUNICIPALITIES[9],
      agent: "snis",
      field: "perdaFaturamento",
      prelim: 42.1,
      final: 38.5,
      unit: "%",
    },
  ];

  for (const { mun, agent, field, prelim, final: finalVal, unit } of updates) {
    instances.push({
      id: `update-${agent}-${field}-${mun.ibgeCode}`,
      municipality: mun.name,
      ibgeCode: mun.ibgeCode,
      category: "knowledge_update",
      question: `O agente ${agent.toUpperCase()} reportou inicialmente ${field} de ${prelim}${unit.startsWith("%") ? unit : " " + unit} para ${mun.name} em 2023. Após revisão no segundo semestre, qual é o valor atualizado?`,
      contextSessions: [
        makeSession(agent, mun.ibgeCode, 2023, {
          [field]: prelim,
          _version: "preliminar",
          _collectedAt: "2023-06-15",
        }),
        makeSession(agent, mun.ibgeCode, 2023, {
          [field]: finalVal,
          _version: "definitivo",
          _collectedAt: "2023-12-20",
        }),
      ],
      expectedAnswer: `O valor atualizado (definitivo) de ${field} para ${mun.name} em 2023 é ${finalVal}${unit.startsWith("%") ? unit : " " + unit}, substituindo o valor preliminar de ${prelim}${unit.startsWith("%") ? unit : " " + unit}.`,
    });
  }

  return instances;
}

function generateAbstentionInstances(): EvaluationInstance[] {
  const instances: EvaluationInstance[] = [];

  // Perguntas sobre dados que NÃO existem
  const missingData = [
    {
      mun: MUNICIPALITIES[0],
      agent: "SEEG",
      indicator: "emissão de GEE do setor industrial",
      year: 2024,
    },
    {
      mun: MUNICIPALITIES[1],
      agent: "TCE-SC",
      indicator: "parecer de contas do exercício",
      year: 2025,
    },
    {
      mun: MUNICIPALITIES[2],
      agent: "CAPES",
      indicator: "índice de pós-graduação municipal",
      year: 2023,
    },
    {
      mun: MUNICIPALITIES[3],
      agent: "IPEA",
      indicator: "índice de vulnerabilidade social",
      year: 2024,
    },
    { mun: MUNICIPALITIES[4], agent: "MTE", indicator: "taxa de trabalho infantil", year: 2024 },
    {
      mun: MUNICIPALITIES[5],
      agent: "IBAMA",
      indicator: "autos de infração ambiental",
      year: 2024,
    },
    { mun: MUNICIPALITIES[6], agent: "SEEG", indicator: "emissão de GEE agropecuária", year: 2024 },
    {
      mun: MUNICIPALITIES[7],
      agent: "RAIS",
      indicator: "salário médio do setor de TI",
      year: 2024,
    },
    {
      mun: MUNICIPALITIES[8],
      agent: "CAGED",
      indicator: "saldo de empregos formais acumulado",
      year: 2025,
    },
    {
      mun: MUNICIPALITIES[9],
      agent: "MCTI",
      indicator: "registro de patentes municipais",
      year: 2024,
    },
  ];

  for (const { mun, agent, indicator, year } of missingData) {
    instances.push({
      id: `abs-${agent.toLowerCase()}-${mun.ibgeCode}`,
      municipality: mun.name,
      ibgeCode: mun.ibgeCode,
      category: "abstention",
      question: `Qual é a ${indicator} para o município de ${mun.name} em ${year}?`,
      contextSessions: [],
      expectedAnswer: `Não possuo dados do agente ${agent} para ${mun.name} no ano de ${year}. Este indicador não está disponível nos coletores atualmente integrados ao sistema.`,
    });
  }

  return instances;
}

// ─── Gerador principal ──────────────────────────────────────────────────────

export function generateDataset(): EvaluationInstance[] {
  return [
    ...generateExtractionInstances(),
    ...generateMultiSessionInstances(),
    ...generateTemporalInstances(),
    ...generateKnowledgeUpdateInstances(),
    ...generateAbstentionInstances(),
  ];
}

export function generateDatasetByCategory(category: string): EvaluationInstance[] {
  return generateDataset().filter((i) => i.category === category);
}
