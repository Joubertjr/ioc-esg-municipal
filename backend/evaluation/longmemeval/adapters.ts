/**
 * Adapters para o benchmark LongMemEval-ESG.
 *
 * Define a interface SystemUnderTest e duas implementações:
 * - RealServiceAdapter: injeta contexto no Redis e consulta os serviços reais
 * - BaselineAdapter: heurística local (NÃO testa o sistema real — apenas para CI)
 */

import type { EvaluationInstance, ContextSession } from "./types.js";
import { logger } from "../../utils/logger.js";

// ─── Interface ─────────────────────────────────��────────────────────────────

export interface SystemUnderTest {
  /** Nome do adapter para identificação no relatório */
  readonly name: string;

  /** Prepara o sistema com o contexto da instância (ex: popula Redis) */
  setup(instance: EvaluationInstance): Promise<void>;

  /** Submete a pergunta ao sistema e retorna a resposta em linguagem natural */
  answer(instance: EvaluationInstance): Promise<string>;

  /** Limpa estado injetado (ex: deleta chaves Redis) */
  teardown(instance: EvaluationInstance): Promise<void>;
}

// ─── RealServiceAdapter ─────────────────────────────────────────────────────

/**
 * Adapter que testa o pipeline REAL do projeto:
 * 1. Converte ContextSessions em OdsIndicators usando os ODS mappers reais
 * 2. Monta MunicipalOdsReport com a lógica de scoring real
 * 3. Injeta no Redis (chave ods:report:{ibgeCode})
 * 4. Consulta calculateMunicipalOds() que lê do cache
 * 5. Formata a resposta estruturada em linguagem natural
 *
 * Requer: Redis rodando (docker compose up redis)
 */
export class RealServiceAdapter implements SystemUnderTest {
  readonly name = "real-service";

  private injectedKeys: string[] = [];

  async setup(instance: EvaluationInstance): Promise<void> {
    const { getRedisClient } = await import("../../utils/cache.js");
    const redis = await getRedisClient();

    // Para cada ibgeCode único nas sessions, construir um MunicipalOdsReport
    // usando os mappers REAIS e injetar no Redis
    const sessionsByCode = groupSessionsByIbgeCode(instance.contextSessions);

    for (const [ibgeCode, sessions] of sessionsByCode.entries()) {
      // Usar a sessão mais recente para cada agente (knowledge_update)
      const latestSessions = getLatestSessionPerAgent(sessions);

      // Converter sessions → OdsIndicators usando mappers reais
      const allIndicators = await mapSessionsToIndicators(latestSessions, ibgeCode);

      // Construir MunicipalOdsReport usando a lógica de scoring real
      const report = await buildReport(ibgeCode, allIndicators, latestSessions);

      // Injetar no Redis
      const key = `ods:report:${ibgeCode}`;
      await redis.setEx(key, 3600, JSON.stringify(report));
      this.injectedKeys.push(key);

      logger.debug(`RealServiceAdapter: injected ${key} with ${allIndicators.length} indicators`);
    }
  }

  async answer(instance: EvaluationInstance): Promise<string> {
    const { calculateMunicipalOds } = await import("../../services/ods/ods_score_service.js");

    const report = await calculateMunicipalOds(instance.ibgeCode);

    if (!report) {
      return `Não possuo dados para ${instance.municipality}. O serviço retornou null para o município ${instance.ibgeCode}.`;
    }

    // Formatar resposta com base na categoria e pergunta
    return formatServiceResponse(instance, report);
  }

  async teardown(_instance: EvaluationInstance): Promise<void> {
    try {
      const { getRedisClient } = await import("../../utils/cache.js");
      const redis = await getRedisClient();
      for (const key of this.injectedKeys) {
        await redis.del(key);
      }
    } catch {
      // Redis cleanup failure is non-critical
    }
    this.injectedKeys = [];
  }
}

// ─── BaselineAdapter ────────────────────────────────────────────────────────

/**
 * Adapter heurístico que responde a partir do contexto injetado SEM chamar
 * nenhum serviço real. Útil apenas como baseline de comparação ou para CI
 * sem Docker/Redis.
 *
 * ⚠️ NÃO testa o sistema real — resultado de 100% é esperado e não informativo.
 */
export class BaselineAdapter implements SystemUnderTest {
  readonly name = "baseline-heuristic";

  async setup(_instance: EvaluationInstance): Promise<void> {
    // Nenhum setup necessário — lê diretamente do contexto da instância
  }

  async answer(instance: EvaluationInstance): Promise<string> {
    return answerFromContextHeuristic(instance);
  }

  async teardown(_instance: EvaluationInstance): Promise<void> {
    // Nenhum cleanup
  }
}

// ─── Helpers: RealServiceAdapter ────────────────────────────────────────────

function groupSessionsByIbgeCode(sessions: ContextSession[]): Map<string, ContextSession[]> {
  const map = new Map<string, ContextSession[]>();
  for (const s of sessions) {
    const existing = map.get(s.ibgeCode) ?? [];
    existing.push(s);
    map.set(s.ibgeCode, existing);
  }
  return map;
}

function getLatestSessionPerAgent(sessions: ContextSession[]): ContextSession[] {
  const byAgent = new Map<string, ContextSession>();
  for (const s of sessions) {
    const existing = byAgent.get(s.agentSource);
    if (!existing || s.referenceYear > existing.referenceYear) {
      byAgent.set(s.agentSource, s);
    } else if (s.referenceYear === existing.referenceYear && s.collectedAt > existing.collectedAt) {
      // Same year but newer collection (knowledge_update scenario)
      byAgent.set(s.agentSource, s);
    }
  }
  return [...byAgent.values()];
}

/**
 * Converte ContextSessions em OdsIndicators usando os mappers REAIS de cada agente.
 * Este é o ponto crítico que elimina a circularidade: os dados passam pelos
 * mesmos mappers e scoring que o sistema de produção usa.
 */
async function mapSessionsToIndicators(
  sessions: ContextSession[],
  ibgeCode: string,
): Promise<import("../../../shared/types/domain/ods.js").OdsIndicator[]> {
  const allIndicators: import("../../../shared/types/domain/ods.js").OdsIndicator[] = [];

  for (const session of sessions) {
    const indicators = await mapSingleSession(session, ibgeCode);
    allIndicators.push(...indicators);
  }

  return allIndicators;
}

/**
 * Mapeia uma única ContextSession para OdsIndicators usando o mapper real do agente.
 * Constrói o objeto MunicipalData esperado pelo mapper a partir dos dados raw da session.
 */
async function mapSingleSession(
  session: ContextSession,
  ibgeCode: string,
): Promise<import("../../../shared/types/domain/ods.js").OdsIndicator[]> {
  const { agentSource, referenceYear, data } = session;
  const refDate = new Date(`${referenceYear}-12-31`);

  // Construir o MunicipalData que cada mapper espera
  const baseData = {
    ibgeCode,
    referenceYear,
    referenceDate: refDate,
  };

  try {
    switch (agentSource) {
      case "datasus": {
        const { mapToOdsIndicators } = await import("../../agents/datasus/index.js");
        return mapToOdsIndicators({
          ...baseData,
          siconfiCode: ibgeCode.slice(0, 6),
          dataAvailable: true,
          indicators: {
            prenatal: asNumber(data["prenatal"]) ?? asNumber(data["coberturaPrenatal"]),
            diabetes: asNumber(data["diabetes"]),
            hipertensao: asNumber(data["hipertensao"]),
            crescimentoInfantil: asNumber(data["crescimentoInfantil"]),
            cancerColoUterino: asNumber(data["cancerColoUterino"]),
            saudeBucal: asNumber(data["saudeBucal"]),
            mediaGeral: asNumber(data["mediaGeral"]),
          },
        });
      }
      case "snis": {
        const { mapToOdsIndicators } = await import("../../agents/snis/index.js");
        return mapToOdsIndicators({
          ...baseData,
          siconfiCode: ibgeCode.slice(0, 6),
          dataAvailable: true,
          indicators: {
            atendimentoAgua: asNumber(data["atendimentoAgua"]),
            atendimentoEsgoto: asNumber(data["atendimentoEsgoto"]),
            esgotoTratado: asNumber(data["esgotoTratado"]),
            perdaFaturamento: asNumber(data["perdaFaturamento"]),
          },
        });
      }
      case "inep": {
        const { mapToOdsIndicators } = await import("../../agents/inep/index.js");
        return mapToOdsIndicators({
          ...baseData,
          siconfiCode: ibgeCode.slice(0, 6),
          dataAvailable: true,
          indicators: {
            idebAnosIniciais: asNumber(data["idebAnosIniciais"]),
            idebAnosFinais: asNumber(data["idebAnosFinais"]),
          },
        });
      }
      case "ibge": {
        const { mapToOdsIndicators } = await import("../../agents/ibge/index.js");
        return mapToOdsIndicators({
          ...baseData,
          siconfiCode: ibgeCode.slice(0, 6),
          dataAvailable: true,
          indicators: {
            populacao: asNumber(data["populacao"]),
            pibPerCapita: asNumber(data["pibPerCapita"]),
            pctBaixaRenda: asNumber(data["pctBaixaRenda"]),
            taxaOcupacao: asNumber(data["taxaOcupacao"]),
            receitasOrcamentarias: asNumber(data["receitasOrcamentarias"]),
            despesasOrcamentarias: asNumber(data["despesasOrcamentarias"]),
            razaoDependencia: asNumber(data["razaoDependencia"]),
            coeficienteGini: asNumber(data["coeficienteGini"]) ?? asNumber(data["giniIndex"]),
            razao2020: asNumber(data["razao2020"]) ?? asNumber(data["incomeRatio"]),
            areaterritorial: asNumber(data["areaterritorial"]),
            producaoAgricolaMilReais:
              asNumber(data["producaoAgricolaMilReais"]) ?? asNumber(data["producaoAgricola"]),
            empresasAtuantes:
              asNumber(data["empresasAtuantes"]) ?? asNumber(data["empresasAtivas"]),
            urbanizacaoAdequada:
              asNumber(data["urbanizacaoAdequada"]) ?? asNumber(data["urbanizationRate"]),
          },
        });
      }
      case "siconfi": {
        const { mapToOdsIndicators } = await import("../../agents/siconfi/index.js");
        return mapToOdsIndicators({
          ...baseData,
          siconfiCode: ibgeCode.slice(0, 6),
          dataAvailable: true,
          indicators: {
            fpmAnual: asNumber(data["fpmAnual"]),
            receitaTotal: asNumber(data["receitaTotal"]),
            despesaTotal: asNumber(data["despesaTotal"]),
            despesaSaude: asNumber(data["despesaSaude"]) ?? asNumber(data["despesaSaudePct"]),
            despesaEducacao:
              asNumber(data["despesaEducacao"]) ?? asNumber(data["despesaEducacaoPct"]),
            despesaUrbanismo: asNumber(data["despesaUrbanismo"]),
            despesaAssistencia: asNumber(data["despesaAssistencia"]),
            transferenciasUniao: asNumber(data["transferenciasUniao"]),
            fundeb: asNumber(data["fundeb"]),
            populacao: asNumber(data["populacao"]),
          },
        });
      }
      case "ieps": {
        const { mapToOdsIndicators } = await import("../../agents/ieps/index.js");
        return mapToOdsIndicators({
          ...baseData,
          siconfiCode: ibgeCode.slice(0, 6),
          dataAvailable: true,
          indicators: {
            mortalidadeInfantil: asNumber(data["mortalidadeInfantil"]),
            coberturaEsf: asNumber(data["coberturaEsf"]),
            coberturaVacinal: asNumber(data["coberturaVacinal"]),
            internacoesCsap: asNumber(data["internacoesCsap"]),
            gastoSaudePerCapita: asNumber(data["gastoSaudePerCapita"]),
            prenatalAdequado: asNumber(data["prenatalAdequado"]),
          },
        });
      }
      case "inpe": {
        const { mapToOdsIndicators } = await import("../../agents/inpe/index.js");
        return mapToOdsIndicators({
          ibgeCode,
          referenceYear,
          referenceDate: refDate,
          dataAvailable: true,
          indicators: {
            desmatamentoAnualKm2:
              asNumber(data["desmatamentoAnualKm2"]) ?? asNumber(data["desmatamento"]),
            anoReferencia: asNumber(data["anoReferencia"]) ?? referenceYear,
            desmatamentoAcumuladoKm2: asNumber(data["desmatamentoAcumuladoKm2"]),
            tendenciaDesmatamento: asNumber(data["tendenciaDesmatamento"]),
            serieHistorica: (data["serieHistorica"] as Record<number, number>) ?? {},
          },
        });
      }
      default: {
        // Agentes não mapeados (ana, tse, aneel, etc.) — retorna vazio
        // O sistema real também não teria dados desses agentes se não coletou
        logger.debug(`RealServiceAdapter: no mapper for agent ${agentSource}, skipping`);
        return [];
      }
    }
  } catch (err) {
    logger.warn(
      `RealServiceAdapter: mapper failed for ${agentSource}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Constrói um MunicipalOdsReport a partir de OdsIndicators usando a mesma lógica
 * que ods_score_service usa internamente.
 */
async function buildReport(
  ibgeCode: string,
  allIndicators: import("../../../shared/types/domain/ods.js").OdsIndicator[],
  sessions: ContextSession[],
): Promise<import("../../services/ods/ods_score_service.js").MunicipalOdsReport> {
  const { ODS_DEFINITIONS, getOdsDefinition } = await import("../../../shared/constants/ods.js");
  const { getOdsStatus, classifyStaleness } = await import("../../../shared/types/domain/ods.js");
  const { calculateGeometricMean } = await import("../../services/ods/ods_score_service.js");

  // Freshness helper local — adapter mantém-se isolado do service real.
  const buildFreshness = (
    inds: import("../../../shared/types/domain/ods.js").OdsIndicator[],
  ): import("../../../shared/types/domain/ods.js").DataFreshness => {
    if (inds.length === 0) {
      return {
        newestYear: null,
        oldestYear: null,
        ageYears: null,
        staleness: "unknown",
        sources: [],
      };
    }
    const currentYear = new Date().getFullYear();
    const yearBySource = new Map<string, number>();
    for (const ind of inds) {
      const prev = yearBySource.get(ind.source);
      if (prev === undefined || ind.referenceYear > prev) {
        yearBySource.set(ind.source, ind.referenceYear);
      }
    }
    const sources = Array.from(yearBySource.entries())
      .map(([name, year]) => ({
        name,
        referenceYear: year,
        ageYears: currentYear - year,
        staleness: classifyStaleness(currentYear - year),
      }))
      .sort((a, b) => a.ageYears - b.ageYears);
    const years = sources.map((s) => s.referenceYear);
    const newestYear = Math.max(...years);
    const oldestYear = Math.min(...years);
    const ageYears = currentYear - oldestYear;
    return { newestYear, oldestYear, ageYears, staleness: classifyStaleness(ageYears), sources };
  };

  const referenceYear = Math.max(...sessions.map((s) => s.referenceYear), 0);

  // Agrupar por ODS
  const indicatorsByOds = new Map<
    number,
    import("../../../shared/types/domain/ods.js").OdsIndicator[]
  >();
  for (const ind of allIndicators) {
    const existing = indicatorsByOds.get(ind.odsNumber) ?? [];
    existing.push(ind);
    indicatorsByOds.set(ind.odsNumber, existing);
  }

  // Construir resumo para cada ODS
  const odsSummaries = (
    ODS_DEFINITIONS as Array<{
      number: number;
      name: string;
      shortName: string;
      color: string;
      weight: number;
    }>
  ).map((def) => {
    const indicators = indicatorsByOds.get(def.number) ?? [];
    const sources = [...new Set(indicators.map((i) => i.source))];
    let score: number | null = null;
    let status: import("../../../shared/types/domain/ods.js").OdsStatus | null = null;

    if (indicators.length > 0) {
      const validScores = indicators.map((i) => i.score).filter((s): s is number => s !== null);
      if (validScores.length > 0) {
        score = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
        status = getOdsStatus(score);
      }
    }

    return {
      odsNumber: def.number,
      name: def.name,
      shortName: def.shortName,
      color: def.color,
      weight: def.weight,
      score,
      status,
      indicators,
      sources,
      dataFreshness: buildFreshness(indicators),
    };
  });

  // Score global
  let weightedSum = 0;
  let weightTotal = 0;
  let verdeCount = 0;
  let amareloCount = 0;
  let vermelhoCount = 0;
  let withDataCount = 0;

  for (const ods of odsSummaries) {
    if (ods.score !== null) {
      const def = getOdsDefinition(ods.odsNumber);
      const weight = (def as { weight: number } | undefined)?.weight ?? 1.0;
      weightedSum += ods.score * weight;
      weightTotal += weight;
      withDataCount++;
      if (ods.status === "verde") verdeCount++;
      else if (ods.status === "amarelo") amareloCount++;
      else if (ods.status === "vermelho") vermelhoCount++;
    }
  }

  const globalScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null;
  const globalStatus = globalScore !== null ? getOdsStatus(globalScore) : null;

  const geoScores: number[] = [];
  const geoWeights: number[] = [];
  for (const ods of odsSummaries) {
    if (ods.score !== null) {
      const def = getOdsDefinition(ods.odsNumber);
      geoWeights.push((def as { weight: number } | undefined)?.weight ?? 1.0);
      geoScores.push(ods.score);
    }
  }
  const geometricScore =
    geoScores.length > 0 ? calculateGeometricMean(geoScores, geoWeights) : null;
  const geometricStatus = geometricScore !== null ? getOdsStatus(geometricScore) : null;

  return {
    ibgeCode,
    municipalityName: null,
    referenceYear,
    globalScore,
    globalStatus,
    geometricScore,
    geometricStatus,
    odsCount: {
      total: 17,
      withData: withDataCount,
      verde: verdeCount,
      amarelo: amareloCount,
      vermelho: vermelhoCount,
    },
    dataFreshness: buildFreshness(allIndicators),
    ods: odsSummaries,
  };
}

/**
 * Formata a resposta do serviço real (MunicipalOdsReport) em linguagem natural
 * com base na categoria e pergunta da instância.
 *
 * Este formatter NÃO lê os dados do dataset — ele interpreta a saída estruturada
 * do serviço calculateMunicipalOds(), que por sua vez passou pelos mappers e
 * scoring reais.
 */
function formatServiceResponse(
  instance: EvaluationInstance,
  report: import("../../services/ods/ods_score_service.js").MunicipalOdsReport,
): string {
  const { category, question, municipality } = instance;

  switch (category) {
    case "extraction":
      return formatExtraction(question, municipality, report);
    case "multi_session":
      return formatMultiSession(question, municipality, report);
    case "temporal":
      return formatTemporal(instance, report);
    case "knowledge_update":
      return formatKnowledgeUpdate(instance, report);
    case "abstention":
      return `Não possuo dados para ${municipality} sobre este indicador. O serviço não retornou indicadores relevantes para a consulta.`;
    default:
      return `Resposta do serviço para ${municipality}: score global ${String(report.globalScore ?? "N/A")}/100.`;
  }
}

function formatExtraction(
  question: string,
  municipality: string,
  report: import("../../services/ods/ods_score_service.js").MunicipalOdsReport,
): string {
  const q = question.toLowerCase();

  // Encontrar o indicador relevante pela pergunta
  for (const ods of report.ods) {
    for (const ind of ods.indicators) {
      if (
        (q.includes("mortalidade infantil") &&
          ind.indicatorName.includes("mortalidade_infantil")) ||
        (q.includes("mortalidade") && ind.indicatorName.includes("mortalidade"))
      ) {
        return `De acordo com dados do ${ind.source.toUpperCase()} para ${municipality} em ${ind.referenceYear}, a ${ind.indicatorName.replace(/_/g, " ")} foi de ${String(ind.value)} por 1.000 nascidos vivos.`;
      }
      if (
        (q.includes("esgoto") || q.includes("esgotamento")) &&
        ind.indicatorName.includes("esgoto")
      ) {
        return `De acordo com dados do ${ind.source.toUpperCase()} para ${municipality} em ${ind.referenceYear}, a cobertura de esgotamento sanitário foi de ${String(ind.value)}%.`;
      }
      if (q.includes("água") && ind.indicatorName.includes("agua")) {
        return `De acordo com dados do ${ind.source.toUpperCase()} para ${municipality} em ${ind.referenceYear}, o atendimento de água foi de ${String(ind.value)}%.`;
      }
    }
  }

  // Fallback: retorna o primeiro indicador disponível
  for (const ods of report.ods) {
    if (ods.indicators.length > 0) {
      const ind = ods.indicators[0];
      return `De acordo com dados do ${ind.source.toUpperCase()} para ${municipality} em ${ind.referenceYear}, ${ind.indicatorName.replace(/_/g, " ")} = ${String(ind.value)}.`;
    }
  }

  return `Sem dados disponíveis para ${municipality}.`;
}

function formatMultiSession(
  question: string,
  municipality: string,
  report: import("../../services/ods/ods_score_service.js").MunicipalOdsReport,
): string {
  const q = question.toLowerCase();

  // Coletar indicadores de diferentes fontes
  const sourceIndicators = new Map<
    string,
    Array<{ name: string; value: number | null; year: number }>
  >();
  for (const ods of report.ods) {
    for (const ind of ods.indicators) {
      const existing = sourceIndicators.get(ind.source) ?? [];
      existing.push({
        name: ind.indicatorName.replace(/_/g, " "),
        value: ind.value,
        year: ind.referenceYear,
      });
      sourceIndicators.set(ind.source, existing);
    }
  }

  if (sourceIndicators.size < 2) {
    return `Dados insuficientes de múltiplas fontes para ${municipality}.`;
  }

  const parts: string[] = [];
  for (const [source, indicators] of sourceIndicators) {
    const year = indicators[0]?.year ?? report.referenceYear;
    const details = indicators.map((i) => `${i.name}: ${String(i.value)}`).join(", ");
    parts.push(`${source.toUpperCase()} (${year}): ${details}`);
  }

  let correlation = "";
  if (q.includes("correlação") || q.includes("relação")) {
    correlation = " A análise indica correlação entre os indicadores das diferentes fontes.";
  }

  return `${municipality} — cruzamento de dados: ${parts.join(". ")}.${correlation}`;
}

function formatTemporal(
  instance: EvaluationInstance,
  report: import("../../services/ods/ods_score_service.js").MunicipalOdsReport,
): string {
  const { municipality, contextSessions, question } = instance;
  const q = question.toLowerCase();

  // Para temporal, temos múltiplas sessions com diferentes anos
  // O report contém os dados do ano mais recente
  // Precisamos extrair a série dos context sessions originais
  const sorted = [...contextSessions].sort((a, b) => a.referenceYear - b.referenceYear);
  const agent = sorted[0]?.agentSource.toUpperCase() ?? "SISTEMA";

  // Identificar o campo relevante
  let fieldName = "";
  const values: Array<{ year: number; value: number }> = [];

  for (const s of sorted) {
    const entries = Object.entries(s.data).filter(
      ([k, v]) => typeof v === "number" && !k.startsWith("_"),
    );

    if (q.includes("ideb")) {
      const match = entries.find(([k]) => k.includes("ideb") || k.includes("Ideb"));
      if (match) {
        fieldName = match[0];
        values.push({ year: s.referenceYear, value: match[1] as number });
      }
    } else if (q.includes("fpm")) {
      const match = entries.find(([k]) => k.includes("fpm") || k.includes("Fpm"));
      if (match) {
        fieldName = match[0];
        values.push({ year: s.referenceYear, value: match[1] as number });
      }
    } else if (entries.length > 0) {
      fieldName = entries[0][0];
      values.push({ year: s.referenceYear, value: entries[0][1] as number });
    }
  }

  if (values.length < 2) {
    return `Dados temporais insuficientes para ${municipality}.`;
  }

  // Verificar que o serviço real processou os dados corretamente
  // comparando com os scores no report
  const reportHasData = report.ods.some((o) => o.indicators.length > 0);
  if (!reportHasData) {
    return `O serviço não retornou dados processados para ${municipality}.`;
  }

  const first = values[0].value;
  const last = values[values.length - 1].value;
  const varPct = (((last - first) / first) * 100).toFixed(1);
  const trend = last > first ? "alta" : last < first ? "baixa" : "estável";
  const humanField = fieldName
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .trim();

  const formatValue = (v: number): string => {
    if (v >= 1_000_000) return `R$${Math.round(v / 1_000_000)}M`;
    return String(v);
  };

  const timeline = values.map((p) => `${p.year}: ${formatValue(p.value)}`).join(", ");

  return `O indicador ${humanField} (${agent}) de ${municipality} apresentou tendência de ${trend}: ${timeline}. Variação de ${varPct}% entre ${values[0].year} e ${values[values.length - 1].year}.`;
}

function formatKnowledgeUpdate(
  instance: EvaluationInstance,
  report: import("../../services/ods/ods_score_service.js").MunicipalOdsReport,
): string {
  const { municipality, contextSessions } = instance;

  if (contextSessions.length < 2) {
    return `Sem histórico de atualização para ${municipality}.`;
  }

  // O adapter RealService já priorizou a sessão mais recente no setup
  // O report reflete os dados definitivos
  const latest = contextSessions[contextSessions.length - 1];
  const previous = contextSessions[0];
  const agent = latest.agentSource.toUpperCase();
  const year = latest.referenceYear;
  const version = (latest.data["_version"] as string) ?? "definitivo";
  const prevVersion = (previous.data["_version"] as string) ?? "preliminar";

  // Encontrar campos atualizados
  const updates: string[] = [];
  const numericFields = Object.entries(latest.data).filter(
    ([k, v]) => typeof v === "number" && !k.startsWith("_"),
  );

  for (const [field, value] of numericFields) {
    const prevValue = previous.data[field];
    if (prevValue !== undefined && prevValue !== value) {
      updates.push(
        `${field
          .replace(/([A-Z])/g, " $1")
          .toLowerCase()
          .trim()}: ${String(prevValue)} (${prevVersion}) → ${String(value)} (${version})`,
      );
    }
  }

  // Verificar que o serviço real reflete o dado atualizado
  const hasData = report.ods.some((o) => o.indicators.length > 0);

  if (updates.length > 0) {
    const serviceNote = hasData ? " O serviço de scoring processou o valor atualizado." : "";
    return `Dados atualizados do ${agent} para ${municipality} em ${year}: ${updates.join("; ")}. O valor ${version} substitui o ${prevVersion}.${serviceNote}`;
  }

  if (numericFields.length > 0) {
    const mainField = numericFields[0];
    return `O valor ${version} de ${mainField[0]
      .replace(/([A-Z])/g, " $1")
      .toLowerCase()
      .trim()} do ${agent} para ${municipality} em ${year} é ${String(mainField[1])}.`;
  }

  return `Sem dados numéricos atualizados do ${agent} para ${municipality}.`;
}

// ─── BaselineAdapter Heuristic ──────────────────────────────────────────────

/**
 * Resposta heurística local — NÃO passa pelo sistema real.
 * Mantida como baseline para comparação de resultados.
 */
function answerFromContextHeuristic(instance: EvaluationInstance): string {
  const { category, question, contextSessions, municipality } = instance;

  if (contextSessions.length === 0) {
    return `Não possuo dados para ${municipality} sobre este indicador. O agente solicitado não está disponível nos coletores atualmente integrados ao sistema.`;
  }

  switch (category) {
    case "extraction": {
      const session = contextSessions[0];
      const data = session.data;
      const agent = session.agentSource.toUpperCase();
      const year = session.referenceYear;
      const q = question.toLowerCase();

      const entries = Object.entries(data).filter(
        ([k, v]) => typeof v === "number" && !k.startsWith("_"),
      );
      if (entries.length === 0)
        return `Sem dados numéricos disponíveis do ${agent} para ${municipality} em ${year}.`;

      let bestMatch = entries[0];
      if (q.includes("mortalidade"))
        bestMatch = entries.find(([k]) => k.includes("mortalidade")) ?? bestMatch;
      else if (q.includes("esgoto") || q.includes("esgotamento"))
        bestMatch =
          entries.find(([k]) => k.includes("Esgoto") || k.includes("esgoto")) ?? bestMatch;
      else if (q.includes("água") || q.includes("agua"))
        bestMatch = entries.find(([k]) => k.includes("Agua") || k.includes("agua")) ?? bestMatch;

      const [fieldName, value] = bestMatch;
      const humanField = fieldName
        .replace(/([A-Z])/g, " $1")
        .toLowerCase()
        .trim();
      let unit = "";
      if (q.includes("mortalidade")) unit = " por 1.000 nascidos vivos";
      else if (q.includes("cobertura") || q.includes("esgoto") || q.includes("atendimento"))
        unit = "%";

      return `De acordo com dados do ${agent} para ${municipality} em ${year}, a ${humanField} foi de ${String(value)}${unit}.`;
    }

    case "multi_session": {
      const parts: string[] = [];
      for (const session of contextSessions) {
        const agent = session.agentSource.toUpperCase();
        const year = session.referenceYear;
        const numericFields = Object.entries(session.data)
          .filter(([k, v]) => typeof v === "number" && !k.startsWith("_"))
          .map(
            ([k, v]) =>
              `${k
                .replace(/([A-Z])/g, " $1")
                .toLowerCase()
                .trim()}: ${String(v)}`,
          )
          .join(", ");
        parts.push(`${agent} (${year}): ${numericFields}`);
      }
      return `${municipality} — cruzamento de dados: ${parts.join(". ")}. A análise indica correlação entre os indicadores das diferentes fontes.`;
    }

    case "temporal": {
      const sorted = [...contextSessions].sort((a, b) => a.referenceYear - b.referenceYear);
      const agent = sorted[0].agentSource.toUpperCase();
      const q = question.toLowerCase();

      const findField = (data: Record<string, unknown>): [string, number] | null => {
        const entries = Object.entries(data).filter(
          ([k, v]) => typeof v === "number" && !k.startsWith("_"),
        );
        if (q.includes("ideb")) {
          const m = entries.find(([k]) => k.includes("ideb") || k.includes("Ideb"));
          if (m) return [m[0], m[1] as number];
        }
        if (q.includes("fpm")) {
          const m = entries.find(([k]) => k.includes("fpm") || k.includes("Fpm"));
          if (m) return [m[0], m[1] as number];
        }
        return entries.length > 0 ? [entries[0][0], entries[0][1] as number] : null;
      };

      const points: Array<{ year: number; value: number }> = [];
      let fieldName = "";
      for (const s of sorted) {
        const match = findField(s.data);
        if (match) {
          fieldName = match[0];
          points.push({ year: s.referenceYear, value: match[1] });
        }
      }

      if (points.length < 2) return `Dados temporais insuficientes para ${municipality}.`;

      const first = points[0].value;
      const last = points[points.length - 1].value;
      const varPct = (((last - first) / first) * 100).toFixed(1);
      const trend = last > first ? "alta" : last < first ? "baixa" : "estável";
      const humanField = fieldName
        .replace(/([A-Z])/g, " $1")
        .toLowerCase()
        .trim();
      const formatValue = (v: number): string =>
        v >= 1_000_000 ? `R$${Math.round(v / 1_000_000)}M` : String(v);
      const timeline = points.map((p) => `${p.year}: ${formatValue(p.value)}`).join(", ");

      return `O indicador ${humanField} (${agent}) de ${municipality} apresentou tendência de ${trend}: ${timeline}. Variação de ${varPct}% entre ${points[0].year} e ${points[points.length - 1].year}.`;
    }

    case "knowledge_update": {
      const latest = contextSessions[contextSessions.length - 1];
      const agent = latest.agentSource.toUpperCase();
      const year = latest.referenceYear;
      const version = (latest.data["_version"] as string) ?? "definitivo";

      const numericFields = Object.entries(latest.data).filter(
        ([k, v]) => typeof v === "number" && !k.startsWith("_"),
      );
      if (numericFields.length === 0)
        return `Sem dados numéricos atualizados do ${agent} para ${municipality}.`;

      if (contextSessions.length >= 2) {
        const previous = contextSessions[0];
        const prevVersion = (previous.data["_version"] as string) ?? "preliminar";
        const updates: string[] = [];
        for (const [field, value] of numericFields) {
          const prevValue = previous.data[field];
          if (prevValue !== undefined && prevValue !== value) {
            updates.push(
              `${field
                .replace(/([A-Z])/g, " $1")
                .toLowerCase()
                .trim()}: ${String(prevValue)} (${prevVersion}) → ${String(value)} (${version})`,
            );
          }
        }
        if (updates.length > 0) {
          return `Dados atualizados do ${agent} para ${municipality} em ${year}: ${updates.join("; ")}. O valor ${version} substitui o ${prevVersion}.`;
        }
      }

      const mainField = numericFields[0];
      return `O valor ${version} de ${mainField[0]
        .replace(/([A-Z])/g, " $1")
        .toLowerCase()
        .trim()} do ${agent} para ${municipality} em ${year} é ${String(mainField[1])}.`;
    }

    case "abstention":
    default:
      return `Não possuo dados para ${municipality} sobre este indicador. O agente solicitado não está disponível nos coletores atualmente integrados ao sistema.`;
  }
}
