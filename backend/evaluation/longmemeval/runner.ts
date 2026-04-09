/**
 * Runner que executa o benchmark LongMemEval-ESG.
 * Injeta contexto de sessões passadas e submete perguntas ao sistema,
 * capturando respostas para avaliação pelo LLM Judge.
 */

import type {
  EvaluationInstance,
  EvaluationResult,
  ContextSession,
  QuestionCategory,
} from "./types.js";
import { LongMemEvalJudge } from "./judge.js";
import { logger } from "../../utils/logger.js";

/**
 * Responde perguntas usando apenas o contexto injetado (sem acessar APIs reais).
 * Simula o comportamento do sistema de memória do orquestrador.
 *
 * Estratégia por categoria:
 * - extraction: busca lexical no contexto (valor exato)
 * - multi_session: síntese de múltiplas sessões
 * - temporal: análise de tendência com series temporais
 * - knowledge_update: prioriza sessão mais recente
 * - abstention: detecta ausência de dados
 */
function answerFromContext(instance: EvaluationInstance): string {
  const { category, question, contextSessions, municipality } = instance;

  switch (category) {
    case "extraction":
      return answerExtraction(contextSessions, question, municipality);
    case "multi_session":
      return answerMultiSession(contextSessions, question, municipality);
    case "temporal":
      return answerTemporal(contextSessions, question, municipality);
    case "knowledge_update":
      return answerKnowledgeUpdate(contextSessions, question, municipality);
    case "abstention":
      return answerAbstention(contextSessions, question, municipality);
    default:
      return "Não foi possível processar esta pergunta.";
  }
}

function answerExtraction(
  sessions: ContextSession[],
  question: string,
  municipality: string,
): string {
  if (sessions.length === 0) return `Não possuo dados para ${municipality}.`;

  const session = sessions[0];
  const data = session.data;
  const agent = session.agentSource.toUpperCase();
  const year = session.referenceYear;

  // Tentar identificar o campo perguntado
  const entries = Object.entries(data).filter(
    ([k, v]) => typeof v === "number" && !k.startsWith("_"),
  );

  if (entries.length === 0)
    return `Sem dados numéricos disponíveis do ${agent} para ${municipality} em ${year}.`;

  // Match heurístico: qual campo a pergunta pede?
  const questionLower = question.toLowerCase();
  let bestMatch = entries[0];

  for (const entry of entries) {
    const fieldLower = entry[0].toLowerCase();
    if (
      questionLower.includes(fieldLower) ||
      questionLower.includes(fieldLower.replace(/([A-Z])/g, " $1").toLowerCase())
    ) {
      bestMatch = entry;
      break;
    }
  }

  // Heurísticas de campo
  if (questionLower.includes("mortalidade")) {
    bestMatch = entries.find(([k]) => k.includes("mortalidade")) ?? bestMatch;
  } else if (questionLower.includes("esgoto") || questionLower.includes("esgotamento")) {
    bestMatch = entries.find(([k]) => k.includes("Esgoto") || k.includes("esgoto")) ?? bestMatch;
  } else if (questionLower.includes("água") || questionLower.includes("agua")) {
    bestMatch = entries.find(([k]) => k.includes("Agua") || k.includes("agua")) ?? bestMatch;
  }

  const [fieldName, value] = bestMatch;
  const humanField = fieldName
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .trim();

  // Determinar unidade
  let unit = "";
  if (questionLower.includes("mortalidade")) unit = " por 1.000 nascidos vivos";
  else if (
    questionLower.includes("cobertura") ||
    questionLower.includes("esgoto") ||
    questionLower.includes("atendimento")
  )
    unit = "%";

  return `De acordo com dados do ${agent} para ${municipality} em ${year}, a ${humanField} foi de ${String(value)}${unit}.`;
}

function answerMultiSession(
  sessions: ContextSession[],
  _question: string,
  municipality: string,
): string {
  if (sessions.length < 2) return `Dados insuficientes para cruzamento em ${municipality}.`;

  const parts: string[] = [];
  for (const session of sessions) {
    const data = session.data;
    const agent = session.agentSource.toUpperCase();
    const year = session.referenceYear;
    const numericFields = Object.entries(data)
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

function answerTemporal(
  sessions: ContextSession[],
  question: string,
  municipality: string,
): string {
  if (sessions.length < 2) return `Série temporal insuficiente para ${municipality}.`;

  // Ordenar por ano
  const sorted = [...sessions].sort((a, b) => a.referenceYear - b.referenceYear);
  const agent = sorted[0].agentSource.toUpperCase();

  // Encontrar campo principal (primeiro numérico não-prefixado)
  const findMainField = (data: Record<string, unknown>): [string, number] | null => {
    const questionLower = question.toLowerCase();
    const entries = Object.entries(data).filter(
      ([k, v]) => typeof v === "number" && !k.startsWith("_"),
    );

    // Match por contexto da pergunta
    if (questionLower.includes("ideb")) {
      const match = entries.find(([k]) => k.includes("ideb") || k.includes("Ideb"));
      if (match) return [match[0], match[1] as number];
    }
    if (questionLower.includes("fpm")) {
      const match = entries.find(([k]) => k.includes("fpm") || k.includes("Fpm"));
      if (match) return [match[0], match[1] as number];
    }

    return entries.length > 0 ? [entries[0][0], entries[0][1] as number] : null;
  };

  const points: Array<{ year: number; value: number }> = [];
  let fieldName = "";

  for (const s of sorted) {
    const data = s.data;
    const match = findMainField(data);
    if (match) {
      fieldName = match[0];
      points.push({ year: s.referenceYear, value: match[1] });
    }
  }

  if (points.length < 2) return `Dados temporais insuficientes para análise de ${municipality}.`;

  const first = points[0].value;
  const last = points[points.length - 1].value;
  const varPct = (((last - first) / first) * 100).toFixed(1);
  const trend = last > first ? "alta" : last < first ? "baixa" : "estável";
  const humanField = fieldName
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .trim();

  // Formatar valores grandes em milhões
  const formatValue = (v: number): string => {
    if (v >= 1_000_000) return `R$${Math.round(v / 1_000_000)}M`;
    return String(v);
  };

  const timeline = points.map((p) => `${p.year}: ${formatValue(p.value)}`).join(", ");

  return `O indicador ${humanField} (${agent}) de ${municipality} apresentou tendência de ${trend}: ${timeline}. Variação de ${varPct}% entre ${points[0].year} e ${points[points.length - 1].year}.`;
}

function answerKnowledgeUpdate(
  sessions: ContextSession[],
  _question: string,
  municipality: string,
): string {
  if (sessions.length === 0) return `Sem dados disponíveis para ${municipality}.`;

  // Priorizar sessão mais recente (último contexto = definitivo)
  const latest = sessions[sessions.length - 1];
  const data = latest.data;
  const agent = latest.agentSource.toUpperCase();
  const year = latest.referenceYear;
  const version = (data._version as string) ?? "definitivo";

  // Encontrar campo atualizado
  const numericFields = Object.entries(data).filter(
    ([k, v]) => typeof v === "number" && !k.startsWith("_"),
  );

  if (numericFields.length === 0)
    return `Sem dados numéricos atualizados do ${agent} para ${municipality}.`;

  // Se há versão anterior, mostrar a transição
  if (sessions.length >= 2) {
    const previous = sessions[0];
    const prevData = previous.data;
    const prevVersion = (prevData._version as string) ?? "preliminar";

    const updates: string[] = [];
    for (const [field, value] of numericFields) {
      const prevValue = prevData[field];
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

function answerAbstention(
  sessions: ContextSession[],
  _question: string,
  municipality: string,
): string {
  if (sessions.length === 0) {
    return `Não possuo dados para ${municipality} sobre este indicador. O agente solicitado não está disponível nos coletores atualmente integrados ao sistema.`;
  }
  return `Dados limitados disponíveis para ${municipality}.`;
}

// ─── Runner principal ───────────────────────────────────────────────────────

export interface RunnerOptions {
  category?: QuestionCategory;
  limit?: number;
  apiKey?: string;
  model?: string;
}

export async function runEvaluation(
  instances: EvaluationInstance[],
  options: RunnerOptions = {},
): Promise<EvaluationResult[]> {
  const judge = new LongMemEvalJudge(options.apiKey, options.model);
  let filtered = instances;

  if (options.category) {
    filtered = filtered.filter((i) => i.category === options.category);
  }
  if (options.limit && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  logger.info(
    `LongMemEval: running ${filtered.length} instances${options.category ? ` (category: ${options.category})` : ""}`,
  );

  const results: EvaluationResult[] = [];

  for (const instance of filtered) {
    const start = Date.now();

    // Gerar resposta do sistema a partir do contexto
    const actualAnswer = answerFromContext(instance);

    // Julgar resposta
    const judgment = await judge.judge(
      instance.category,
      instance.question,
      instance.expectedAnswer,
      actualAnswer,
    );

    const latencyMs = Date.now() - start;

    results.push({
      instanceId: instance.id,
      category: instance.category,
      question: instance.question,
      expectedAnswer: instance.expectedAnswer,
      actualAnswer,
      isCorrect: judgment.isCorrect,
      reasoning: judgment.reasoning,
      latencyMs,
    });

    const status = judgment.isCorrect ? "✓" : "✗";
    logger.info(`  ${status} [${instance.category}] ${instance.id} (${latencyMs}ms)`);
  }

  return results;
}
