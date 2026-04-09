/**
 * LLM Judge para avaliação LongMemEval-ESG.
 * Usa a API Anthropic (Claude) para julgar respostas binariamente.
 * Requer ANTHROPIC_API_KEY no .env.
 */

import { LLMJudgeResponseSchema, type LLMJudgeResponse, type QuestionCategory } from "./types.js";
import { logger } from "../../utils/logger.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// ─── Prompts de sistema por categoria ───────────────────────────────────────

const CATEGORY_PROMPTS: Record<QuestionCategory, string> = {
  extraction: `Você é um avaliador rigoroso de sistemas de memória de IA. Sua tarefa é julgar se a resposta do sistema recuperou corretamente um dado factual específico de uma sessão de coleta passada.

Critérios de avaliação:
- O valor numérico exato deve estar presente na resposta
- A unidade de medida deve ser correta
- O município e ano de referência devem corresponder
- Pequenas diferenças de formatação são aceitáveis (ex: "8,2" vs "8.2")
- Contexto adicional não penaliza, desde que o dado solicitado esteja correto`,

  multi_session: `Você é um avaliador rigoroso de sistemas de memória de IA. Sua tarefa é julgar se a resposta sintetizou corretamente dados de MÚLTIPLAS fontes/sessões.

Critérios de avaliação:
- Os dados de AMBAS as fontes devem ser referenciados
- Os valores numéricos devem estar corretos
- A relação/correlação identificada deve ser coerente com os dados
- Não é necessário citar o nome exato dos agentes, mas os dados devem corresponder
- Inferências razoáveis baseadas nos dados são aceitáveis`,

  temporal: `Você é um avaliador rigoroso de sistemas de memória de IA. Sua tarefa é julgar se a resposta identificou corretamente a tendência temporal de um indicador.

Critérios de avaliação:
- A direção da tendência (alta/baixa/estável) deve estar correta
- Os valores intermediários devem ser referenciados ou a tendência geral coerente
- A variação percentual deve ser aproximadamente correta (margem de ±2pp)
- O período temporal deve corresponder ao perguntado`,

  knowledge_update: `Você é um avaliador rigoroso de sistemas de memória de IA. Sua tarefa é julgar se a resposta priorizou o dado MAIS RECENTE (definitivo) sobre o dado anterior (preliminar).

Critérios de avaliação:
- O valor definitivo/atualizado DEVE ser o valor final na resposta
- Se a resposta menciona apenas o valor preliminar, está INCORRETA
- Mencionar ambos os valores (com distinção temporal) é aceitável
- O sistema deve demonstrar que reconhece a atualização`,

  abstention: `Você é um avaliador rigoroso de sistemas de memória de IA. Sua tarefa é julgar se o sistema CORRETAMENTE se absteve de responder uma pergunta sobre dados indisponíveis.

Critérios de avaliação:
- O sistema DEVE reconhecer que não possui os dados solicitados
- Qualquer resposta que invente/alucine dados é INCORRETA
- Mencionar que o agente/fonte não está integrado é correto
- Sugerir fontes alternativas é aceitável, mas não obrigatório
- Se o sistema fornece um valor numérico para a pergunta, está INCORRETO`,
};

// ─── LLM Judge ──────────────────────────────────────────────────────────────

export class LongMemEvalJudge {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.model = model ?? "claude-haiku-4-5-20251001";
  }

  async judge(
    category: QuestionCategory,
    question: string,
    expectedAnswer: string,
    actualAnswer: string,
  ): Promise<LLMJudgeResponse> {
    if (!this.apiKey) {
      logger.warn("ANTHROPIC_API_KEY not set — using heuristic judge fallback");
      return this.heuristicJudge(expectedAnswer, actualAnswer);
    }

    const systemPrompt = CATEGORY_PROMPTS[category];

    const userPrompt = `Avalie a seguinte resposta do sistema de memória:

**Pergunta:** ${question}

**Resposta Esperada (Ground Truth):** ${expectedAnswer}

**Resposta do Sistema:** ${actualAnswer}

Responda EXCLUSIVAMENTE com um JSON válido no formato:
{"isCorrect": true/false, "reasoning": "explicação breve em 1-2 frases"}`;

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 256,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
      const text = data.content[0]?.text ?? "";

      // Extrair JSON da resposta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON found in LLM response: ${text.slice(0, 200)}`);
      }

      const parsed: unknown = JSON.parse(jsonMatch[0]);
      return LLMJudgeResponseSchema.parse(parsed);
    } catch (err) {
      logger.warn(
        `LLM Judge error: ${err instanceof Error ? err.message : String(err)} — falling back to heuristic`,
      );
      return this.heuristicJudge(expectedAnswer, actualAnswer);
    }
  }

  /**
   * Fallback heurístico quando a API não está disponível.
   * Compara tokens numéricos e palavras-chave entre expected e actual.
   */
  private heuristicJudge(expected: string, actual: string): LLMJudgeResponse {
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
    const normalExpected = normalize(expected);
    const normalActual = normalize(actual);

    // Caso especial: abstenção — detectar negativas
    const abstentionKeywords = [
      "não possuo",
      "não disponível",
      "não está disponível",
      "não tenho",
      "sem dados",
    ];
    const expectedIsAbstention = abstentionKeywords.some((k) => normalExpected.includes(k));
    const actualIsAbstention = abstentionKeywords.some((k) => normalActual.includes(k));

    if (expectedIsAbstention) {
      return {
        isCorrect: actualIsAbstention,
        reasoning: actualIsAbstention
          ? "Heuristic: sistema corretamente se absteve (resposta negativa detectada)."
          : "Heuristic: esperava abstenção mas sistema tentou responder.",
      };
    }

    // Extrair números da resposta esperada
    const expectedNumbers: string[] = normalExpected.match(/\d+[\d.,]*/g) ?? [];
    const actualNumbers: string[] = normalActual.match(/\d+[\d.,]*/g) ?? [];

    // Verificar se números-chave aparecem na resposta
    const numberMatches = expectedNumbers.filter((n) => actualNumbers.includes(n));
    const numberMatchRate =
      expectedNumbers.length > 0 ? numberMatches.length / expectedNumbers.length : 0;

    // Verificar palavras-chave (não-stopwords)
    const stopwords = new Set([
      "de",
      "do",
      "da",
      "em",
      "o",
      "a",
      "e",
      "é",
      "foi",
      "para",
      "com",
      "que",
      "um",
      "uma",
      "no",
      "na",
    ]);
    const expectedWords = normalExpected
      .split(" ")
      .filter((w) => w.length > 2 && !stopwords.has(w));
    const wordMatches = expectedWords.filter((w) => normalActual.includes(w));
    const wordMatchRate = expectedWords.length > 0 ? wordMatches.length / expectedWords.length : 0;

    // Score combinado: números pesam mais
    const score = numberMatchRate * 0.6 + wordMatchRate * 0.4;
    const isCorrect = score >= 0.5;

    return {
      isCorrect,
      reasoning: `Heuristic judge: ${(score * 100).toFixed(0)}% match (${numberMatches.length}/${expectedNumbers.length} números, ${wordMatches.length}/${expectedWords.length} palavras-chave).`,
    };
  }
}
