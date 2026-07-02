import { generateEsgReport } from "../reports/report_service.js";
import { compareAgainstBenchmark } from "../benchmarks/benchmark_service.js";
import { withCache } from "../../utils/cache.js";
import { logger } from "../../utils/logger.js";
import { TransfereGovCollector } from "../../agents/transferegov/transferegov_collector.js";

import { SC_BENCHMARK_CODES } from "../../../shared/constants/sc-benchmark-codes.js";

// ─── Constantes ───────────────────────────────────────────────────────────────

const RECOMMENDATIONS_CACHE_TTL = 3_600; // 1 hora

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SmartRecommendation {
  odsNumber: number;
  odsName: string;
  priority: "critica" | "alta" | "media";
  currentScore: number;
  stateAverage: number | null;
  gap: number | null;
  ranking: string;
  actions: string[];
  investmentArea: string;
  estimatedImpact: string;
}

export interface RecommendationReport {
  ibgeCode: string;
  municipalityName: string | null;
  generatedAt: string;
  totalRecommendations: number;
  criticalCount: number;
  summary: string;
  recommendations: SmartRecommendation[];
  strengths: Array<{ odsNumber: number; odsName: string; score: number }>;
}

// ─── Mapeamento ODS → ações concretas ─────────────────────────────────────────

const ODS_ACTIONS: Record<number, string[]> = {
  1: [
    "Ampliar cobertura do Cadastro Único",
    "Implementar programa de transferência de renda municipal",
    "Criar centro de referência de assistência social (CRAS)",
    "Mapear e atender famílias em situação de extrema pobreza",
  ],
  2: [
    "Criar banco de alimentos municipal",
    "Apoiar agricultura familiar com assistência técnica e crédito",
    "Implementar programa de merenda escolar com alimentos locais",
    "Instalar feiras livres e mercados populares nos bairros",
  ],
  3: [
    "Ampliar cobertura do Previne Brasil (saúde da família)",
    "Construir UBS em áreas com cobertura insuficiente",
    "Contratar agentes comunitários de saúde para áreas descobertas",
    "Implementar programa de saúde preventiva e vacinação",
  ],
  4: [
    "Investir em formação continuada de professores da rede municipal",
    "Ampliar oferta de vagas em creches e pré-escolas",
    "Implementar programa de reforço escolar para defasagem",
    "Garantir transporte escolar para alunos da zona rural",
  ],
  5: [
    "Criar conselho municipal de políticas para mulheres",
    "Implementar programa de combate à violência doméstica",
    "Promover capacitação profissional para mulheres em situação de vulnerabilidade",
    "Garantir equidade de gênero em cargos de gestão municipal",
  ],
  6: [
    "Expandir rede de coleta e tratamento de esgoto",
    "Reduzir perdas na distribuição de água (programa de eficiência hídrica)",
    "Construir ou modernizar estação de tratamento de esgoto (ETE)",
    "Implementar programa de proteção de mananciais e nascentes",
  ],
  7: [
    "Instalar painéis solares em prédios públicos",
    "Substituir iluminação pública por LED",
    "Criar programa de eficiência energética para famílias de baixa renda",
    "Promover uso de energia renovável em contratos de concessão",
  ],
  8: [
    "Criar programa municipal de microcrédito para empreendedores",
    "Instalar espaço de coworking e incubadora de empresas",
    "Firmar convênios com SENAI e SENAC para qualificação profissional",
    "Simplificar processos de abertura e licenciamento de empresas",
  ],
  9: [
    "Investir em pavimentação e manutenção de estradas vicinais",
    "Expandir cobertura de internet banda larga nos bairros",
    "Digitalizar serviços públicos municipais (e-gov)",
    "Modernizar infraestrutura de transporte coletivo",
  ],
  10: [
    "Criar programa de inclusão social para pessoas com deficiência",
    "Garantir acessibilidade nos prédios e espaços públicos",
    "Implementar políticas de inclusão para populações vulneráveis",
    "Monitorar e reduzir disparidades de renda entre bairros",
  ],
  11: [
    "Regularizar áreas de ocupação informal (regularização fundiária)",
    "Implementar programa habitacional para famílias de baixa renda",
    "Criar e manter praças, parques e espaços públicos de lazer",
    "Desenvolver plano diretor participativo e atualizado",
  ],
  12: [
    "Implantar coleta seletiva e programa de reciclagem",
    "Encerrar lixões e implantar aterro sanitário adequado",
    "Criar programa de compostagem de resíduos orgânicos",
    "Promover educação ambiental nas escolas e comunidades",
  ],
  13: [
    "Elaborar plano municipal de adaptação às mudanças climáticas",
    "Implementar sistemas de alerta para eventos climáticos extremos",
    "Recuperar áreas degradadas e replantar vegetação nativa",
    "Reduzir emissões de gases de efeito estufa na frota municipal",
  ],
  14: [
    "Proteger rios, lagos e reservatórios municipais da poluição",
    "Implementar coleta de esgoto para evitar descarte em corpos d'água",
    "Criar comitê local de gestão de recursos hídricos",
    "Monitorar qualidade da água nos mananciais",
  ],
  15: [
    "Criar unidades de conservação ambiental no município",
    "Implementar programa de reflorestamento com espécies nativas",
    "Combater o desmatamento ilegal com fiscalização ambiental",
    "Promover corredores ecológicos entre fragmentos florestais",
  ],
  16: [
    "Publicar todos os contratos e licitações no portal de transparência",
    "Implementar ouvidoria municipal com prazo de resposta garantido",
    "Realizar audiências públicas para o orçamento participativo",
    "Garantir acesso à informação conforme Lei 12.527/2011 (LAI)",
  ],
  17: [
    "Firmar consórcios intermunicipais para serviços compartilhados",
    "Estabelecer parcerias com universidades para pesquisa e inovação",
    "Captar recursos de fundos federais e estaduais para projetos ODS",
    "Articular com setor privado programas de responsabilidade social",
  ],
};

// ─── Mapeamento ODS → área de investimento ───────────────────────────────────

const ODS_INVESTMENT_AREA: Record<number, string> = {
  1: "assistência social",
  2: "agricultura e segurança alimentar",
  3: "saúde",
  4: "educação",
  5: "políticas de gênero",
  6: "saneamento básico",
  7: "energia",
  8: "desenvolvimento econômico",
  9: "infraestrutura e tecnologia",
  10: "políticas de inclusão",
  11: "urbanismo e habitação",
  12: "gestão de resíduos",
  13: "meio ambiente e clima",
  14: "recursos hídricos",
  15: "preservação ambiental",
  16: "governança e transparência",
  17: "parcerias institucionais",
};

// ─── Serviço ──────────────────────────────────────────────────────────────────

export async function generateRecommendations(
  ibgeCode: string,
): Promise<RecommendationReport | null> {
  const cacheKey = `recommendations:${ibgeCode}`;
  logger.info("[recommendations] gerando recomendações inteligentes", { ibgeCode });

  return withCache(cacheKey, RECOMMENDATIONS_CACHE_TTL, () => _computeRecommendations(ibgeCode));
}

async function _computeRecommendations(ibgeCode: string): Promise<RecommendationReport | null> {
  // 1. Relatório ESG + Benchmark em paralelo (são independentes)
  const peerCodes = SC_BENCHMARK_CODES.filter((c) => c !== ibgeCode);

  const [report, comparisonResult] = await Promise.all([
    generateEsgReport(ibgeCode),
    compareAgainstBenchmark(ibgeCode, [...peerCodes]).catch((err) => {
      logger.warn(
        "[recommendations] falha ao obter benchmark estadual, continuando sem comparação",
        {
          ibgeCode,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      return null;
    }),
  ]);

  if (!report) {
    logger.warn("[recommendations] sem dados ESG para município", { ibgeCode });
    return null;
  }

  // Indexar comparações por ODS para acesso O(1)
  const comparisonByOds = new Map<
    number,
    { benchmarkAverage: number | null; delta: number | null; aboveAverage: boolean | null }
  >();

  if (comparisonResult) {
    for (const c of comparisonResult.comparison) {
      comparisonByOds.set(c.odsNumber, {
        benchmarkAverage: c.benchmarkAverage,
        delta: c.delta,
        aboveAverage: c.aboveAverage,
      });
    }
  }

  // 2.5. Enriquecer ações ODS 17 com oportunidades reais do TransfereGov
  const transfereGov = new TransfereGovCollector();
  const openPrograms = transfereGov.getOpenPrograms({
    naturezaJuridica: "Administração Pública Municipal",
  });
  const ods17Actions: string[] = [];
  if (openPrograms.length > 0) {
    for (const p of openPrograms.slice(0, 5)) {
      const prazo = p.fimJanela ? ` — prazo ${p.fimJanela}` : "";
      ods17Actions.push(`[OPORTUNIDADE ABERTA] ${p.nome} (${p.orgaoSuperior})${prazo}`);
    }
  }
  ods17Actions.push(...(ODS_ACTIONS[17] ?? []));

  // 3. Gerar recomendações com análise enriquecida
  const recommendations: SmartRecommendation[] = [];
  const strengths: Array<{ odsNumber: number; odsName: string; score: number }> = [];

  for (const ods of report.odsDetails) {
    if (ods.score === null) continue;

    const comp = comparisonByOds.get(ods.odsNumber);
    const stateAverage = comp?.benchmarkAverage ?? null;
    const gap = comp?.delta ?? null; // positivo = acima da média
    const aboveAverage = comp?.aboveAverage ?? null;

    // Pontos fortes: score >= 70
    if (ods.score >= 70) {
      strengths.push({ odsNumber: ods.odsNumber, odsName: ods.name, score: ods.score });
      continue;
    }

    // Prioridade: score < 40 E abaixo da média = crítica | score < 40 = alta | demais = media
    let priority: SmartRecommendation["priority"];
    if (ods.score < 40 && aboveAverage === false) {
      priority = "critica";
    } else if (ods.score < 40) {
      priority = "alta";
    } else {
      priority = "media";
    }

    // Impacto estimado baseado no gap vs benchmark
    // gap é negativo quando abaixo da média, então usamos valor absoluto
    const gapAbs = gap !== null ? Math.abs(gap) : null;
    let estimatedImpact: string;
    if (gapAbs === null) {
      estimatedImpact = "Médio";
    } else if (gapAbs > 20) {
      estimatedImpact = "Alto";
    } else if (gapAbs > 10) {
      estimatedImpact = "Médio";
    } else {
      estimatedImpact = "Baixo";
    }

    const ranking =
      aboveAverage === null
        ? "sem dados de comparação estadual"
        : aboveAverage
          ? "acima da média estadual"
          : "abaixo da média estadual";

    recommendations.push({
      odsNumber: ods.odsNumber,
      odsName: ods.name,
      priority,
      currentScore: ods.score,
      stateAverage,
      gap,
      ranking,
      actions: ods.odsNumber === 17 ? ods17Actions : (ODS_ACTIONS[ods.odsNumber] ?? []),
      investmentArea: ODS_INVESTMENT_AREA[ods.odsNumber] ?? "desenvolvimento geral",
      estimatedImpact,
    });
  }

  // Ordenar: crítica → alta → media; dentro da prioridade, menor score primeiro
  const priorityOrder: Record<SmartRecommendation["priority"], number> = {
    critica: 0,
    alta: 1,
    media: 2,
  };

  recommendations.sort((a, b) => {
    const po = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (po !== 0) return po;
    return a.currentScore - b.currentScore;
  });

  const criticalCount = recommendations.filter((r) => r.priority === "critica").length;

  const summary = buildSummary(report.municipalityName, recommendations, criticalCount);

  return {
    ibgeCode,
    municipalityName: report.municipalityName,
    generatedAt: new Date().toISOString(),
    totalRecommendations: recommendations.length,
    criticalCount,
    summary,
    recommendations,
    strengths: strengths.sort((a, b) => b.score - a.score),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSummary(
  municipalityName: string | null,
  recommendations: SmartRecommendation[],
  criticalCount: number,
): string {
  const name = municipalityName ?? "O município";
  const total = recommendations.length;

  if (total === 0) {
    return `${name} apresenta desempenho satisfatório em todos os ODS avaliados. Foque em manutenção dos indicadores.`;
  }

  const belowAverage = recommendations.filter(
    (r) => r.ranking === "abaixo da média estadual",
  ).length;

  const parts: string[] = [];

  if (criticalCount > 0) {
    parts.push(
      `${name} tem ${criticalCount} ODS em situação crítica (score < 40 e abaixo da média estadual).`,
    );
  } else {
    parts.push(`${name} tem ${total} ODS abaixo de 70 que requerem atenção.`);
  }

  if (belowAverage > 0) {
    parts.push(
      `${belowAverage} ${belowAverage === 1 ? "indicador está" : "indicadores estão"} abaixo da média estadual.`,
    );
  }

  // Destacar as 2 prioridades mais urgentes
  const top2 = recommendations.slice(0, 2);
  if (top2.length > 0) {
    const topNames = top2.map((r) => `${r.odsName} (ODS ${r.odsNumber})`).join(" e ");
    parts.push(`Prioridade imediata: ${topNames}.`);
  }

  return parts.join(" ");
}
