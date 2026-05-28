import { calculateMunicipalOds } from "../ods/ods_score_service.js";
import {
  AgentQueryInputSchema,
  AgentQueryResponseSchema,
  type AgentQueryInput,
  type AgentQueryResponse,
  type SourceCitation,
} from "./schemas.js";
import { getOdsStatus } from "../../../shared/types/domain/ods.js";
import { tryLlmAgentAnswer } from "./agent_query_llm.js";

const STATUS_LABEL = {
  verde: "verde (≥70)",
  amarelo: "amarelo (40–69)",
  vermelho: "vermelho (<40)",
} as const;

function extractOdsNumbers(question: string, filter?: number[]): number[] {
  if (filter && filter.length > 0) return filter;
  const matches = [...question.matchAll(/ods\s*(\d{1,2})/gi)];
  const nums = matches.map((m) => Number.parseInt(m[1] ?? "", 10)).filter((n) => n >= 1 && n <= 17);
  return nums.length > 0 ? [...new Set(nums)] : [];
}

function buildCitations(sources: string[], referenceYear: number): SourceCitation[] {
  if (sources.length === 0) {
    return [{ sourceName: "IOC ESG Municipal", referenceYear }];
  }
  return sources.slice(0, 5).map((sourceName) => ({ sourceName, referenceYear }));
}

function formatGlobalAnswer(
  municipalityName: string | null,
  globalScore: number | null,
  globalStatus: string | null,
  referenceYear: number,
): { answer: string; confidence: number } {
  const name = municipalityName ?? "o município";
  if (globalScore === null) {
    return {
      answer: `${name} ainda não possui score global consolidado. Aguarde a próxima coleta de indicadores públicos (ref. ${referenceYear}).`,
      confidence: 0.55,
    };
  }
  const statusText = globalStatus
    ? STATUS_LABEL[globalStatus as keyof typeof STATUS_LABEL]
    : "sem status";
  return {
    answer: `O score ESG global de ${name} é ${globalScore.toFixed(1)}/100, classificado como ${statusText}, com base em dados de referência ${referenceYear}.`,
    confidence: 0.88,
  };
}

function answerOdsScore(
  municipalityName: string | null,
  odsNumber: number,
  score: number | null,
  status: string | null,
  referenceYear: number,
  sources: string[],
): string {
  const name = municipalityName ?? "o município";
  if (score === null) {
    return `Não há score disponível para o ODS ${odsNumber} em ${name} no momento. Os indicadores podem estar em re-coleta.`;
  }
  const statusText = status
    ? STATUS_LABEL[status as keyof typeof STATUS_LABEL]
    : "sem classificação";
  return `O ODS ${odsNumber} em ${name} está com score ${score.toFixed(1)}/100 (${statusText}), ano de referência ${referenceYear}. Fontes: ${sources.join(", ") || "dados municipais consolidados"}.`;
}

async function buildDeterministicAnswer(
  parsed: AgentQueryInput,
  report: NonNullable<Awaited<ReturnType<typeof calculateMunicipalOds>>>,
): Promise<{ answer: string; confidence: number; citations: SourceCitation[] }> {
  const odsTargets = extractOdsNumbers(parsed.question, parsed.odsFilter);
  const allSources = report.ods.flatMap((o) => o.sources);
  const refYear = report.referenceYear;

  let answer: string;
  let confidence = 0.85;

  if (odsTargets.length === 1) {
    const ods = report.ods.find((o) => o.odsNumber === odsTargets[0]);
    answer = answerOdsScore(
      report.municipalityName,
      odsTargets[0],
      ods?.score ?? null,
      ods?.status ?? null,
      refYear,
      ods?.sources ?? [],
    );
    if (ods?.score === null) confidence = 0.6;
  } else if (odsTargets.length > 1) {
    const parts = odsTargets.map((num) => {
      const ods = report.ods.find((o) => o.odsNumber === num);
      if (!ods || ods.score === null) return `ODS ${num}: sem dado`;
      return `ODS ${num}: ${ods.score.toFixed(1)} (${ods.status ?? getOdsStatus(ods.score)})`;
    });
    answer = `Resumo dos ODS solicitados em ${report.municipalityName ?? "o município"}: ${parts.join("; ")}.`;
  } else if (/global|geral|municipio|município/i.test(parsed.question)) {
    const draft = formatGlobalAnswer(
      report.municipalityName,
      report.globalScore,
      report.globalStatus,
      refYear,
    );
    answer = draft.answer;
    confidence = draft.confidence;
  } else {
    const priority = [3, 4, 6]
      .map((n) => report.ods.find((o) => o.odsNumber === n))
      .filter((o) => o && o.score !== null)
      .map((o) => `ODS ${o!.odsNumber}: ${o!.score!.toFixed(1)}`)
      .join(", ");
    answer = `Com base nos dados atuais de ${report.municipalityName ?? "o município"}, os ODS prioritários do piloto (${priority || "aguardando coleta"}) refletem saúde, educação e saneamento. Reformule citando "ODS N" para detalhe de um objetivo específico.`;
    confidence = 0.75;
  }

  return {
    answer,
    confidence,
    citations: buildCitations(allSources, refYear),
  };
}

export async function answerAgentQuery(input: AgentQueryInput): Promise<AgentQueryResponse | null> {
  const parsed = AgentQueryInputSchema.parse(input);
  const report = await calculateMunicipalOds(parsed.municipalityId);
  if (!report) return null;

  const deterministic = await buildDeterministicAnswer(parsed, report);

  let answer = deterministic.answer;
  let confidence = deterministic.confidence;
  let mode: "deterministic" | "llm" = "deterministic";

  try {
    const llmAnswer = await tryLlmAgentAnswer(parsed, report);
    if (llmAnswer) {
      answer = llmAnswer;
      mode = "llm";
      confidence = Math.min(deterministic.confidence + 0.05, 0.92);
    }
  } catch {
    // fallback silencioso para determinístico (P-011)
  }

  return AgentQueryResponseSchema.parse({
    municipalityId: parsed.municipalityId,
    question: parsed.question,
    answer,
    citations: deterministic.citations,
    confidence,
    answeredAt: new Date().toISOString(),
    mode,
  });
}
