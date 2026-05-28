import { LLMClient } from "./llm_client.js";
import type { MunicipalOdsReport } from "../ods/ods_score_service.js";
import type { AgentQueryInput } from "./schemas.js";

const llmClient = new LLMClient();

function buildOdsContext(report: MunicipalOdsReport): string {
  const lines = report.ods
    .filter((o) => o.score !== null)
    .slice(0, 17)
    .map((o) => `ODS ${o.odsNumber}: score ${o.score}, status ${o.status ?? "n/a"}`);
  return [
    `Município: ${report.municipalityName ?? report.ibgeCode}`,
    `Ano ref.: ${report.referenceYear}`,
    `Score global: ${report.globalScore ?? "n/d"}`,
    lines.join("\n"),
  ].join("\n");
}

/**
 * Tenta resposta via LLM ancorada nos scores reais (P-011 + P-008).
 * Retorna null se LLM indisponível ou resposta vazia.
 */
export async function tryLlmAgentAnswer(
  input: AgentQueryInput,
  report: MunicipalOdsReport,
): Promise<string | null> {
  if (process.env.AGENT_LLM_QA_ENABLED !== "true") {
    return null;
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return null;
  }

  const system = `Você é assistente ESG municipal. Responda APENAS com base nos dados fornecidos.
Se não houver dado suficiente, diga explicitamente. Máximo 4 frases. Português do Brasil.`;

  const user = `Dados:\n${buildOdsContext(report)}\n\nPergunta: ${input.question}`;

  const result = await llmClient.complete({
    task: "qa",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens: 400,
    temperature: 0.2,
  });

  const text = result.text.trim();
  return text.length >= 10 ? text : null;
}
