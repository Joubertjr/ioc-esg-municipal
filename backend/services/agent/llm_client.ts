/**
 * Abstração multi-provedor LLM (MDO Day 0 — P-008).
 * Implementação mínima: Anthropic primário, OpenAI fallback opcional.
 */
import { z } from "zod";

export type LlmTask = "report" | "qa" | "judge";

export interface LlmMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LlmCompletionOptions {
  task: LlmTask;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmCompletionResult {
  text: string;
  provider: "anthropic" | "openai";
  model: string;
}

/** Config externa — não hardcodar modelos no código de negócio */
export const LLM_ROUTING_CONFIG: Record<LlmTask, { primary: string; fallback?: string }> = {
  report: {
    primary: process.env.LLM_MODEL_REPORT ?? "claude-sonnet-4-20250514",
    fallback: process.env.LLM_MODEL_REPORT_FALLBACK,
  },
  qa: {
    primary: process.env.LLM_MODEL_QA ?? "claude-haiku-4-5-20251001",
    fallback: process.env.LLM_MODEL_QA_FALLBACK,
  },
  judge: {
    primary: process.env.LLM_MODEL_JUDGE ?? "claude-haiku-4-5-20251001",
    fallback: process.env.LLM_MODEL_JUDGE_FALLBACK,
  },
};

const AnthropicResponseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

const OpenAIResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })),
});

export class LLMClient {
  constructor(
    private readonly anthropicKey = process.env.ANTHROPIC_API_KEY,
    private readonly openaiKey = process.env.OPENAI_API_KEY,
  ) {}

  async complete(options: LlmCompletionOptions): Promise<LlmCompletionResult> {
    const routing = LLM_ROUTING_CONFIG[options.task];
    try {
      return await this.completeAnthropic(routing.primary, options);
    } catch (primaryErr) {
      if (!routing.fallback || !this.openaiKey) {
        throw primaryErr;
      }
      return await this.completeOpenAI(routing.fallback, options);
    }
  }

  private async completeAnthropic(
    model: string,
    options: LlmCompletionOptions,
  ): Promise<LlmCompletionResult> {
    if (!this.anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }
    const system = options.messages.find((m) => m.role === "system")?.content;
    const userMessages = options.messages.filter((m) => m.role !== "system");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.2,
        system,
        messages: userMessages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    }
    const data = AnthropicResponseSchema.parse(await res.json());
    const text = data.content.find((c) => c.text)?.text ?? "";
    return { text, provider: "anthropic", model };
  }

  private async completeOpenAI(
    model: string,
    options: LlmCompletionOptions,
  ): Promise<LlmCompletionResult> {
    if (!this.openaiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openaiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.2,
        messages: options.messages,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
    }
    const data = OpenAIResponseSchema.parse(await res.json());
    const text = data.choices[0]?.message.content ?? "";
    return { text, provider: "openai", model };
  }
}
