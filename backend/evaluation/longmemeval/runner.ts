/**
 * Runner que executa o benchmark LongMemEval-ESG.
 *
 * Usa o padrão Adapter (SystemUnderTest) para desacoplar o benchmark
 * do sistema sendo testado. Dois adapters disponíveis:
 * - RealServiceAdapter: testa o pipeline real (requer Redis)
 * - BaselineAdapter: heurística local (para CI sem infra)
 */

import type { EvaluationInstance, EvaluationResult, QuestionCategory } from "./types.js";
import type { SystemUnderTest } from "./adapters.js";
import { BaselineAdapter } from "./adapters.js";
import { LongMemEvalJudge } from "./judge.js";
import { logger } from "../../utils/logger.js";

// ─── Runner principal ───────────────────────────────────────────────────────

export interface RunnerOptions {
  category?: QuestionCategory;
  limit?: number;
  apiKey?: string;
  model?: string;
  /** Adapter que implementa SystemUnderTest. Default: BaselineAdapter */
  adapter?: SystemUnderTest;
}

export async function runEvaluation(
  instances: EvaluationInstance[],
  options: RunnerOptions = {},
): Promise<EvaluationResult[]> {
  const judge = new LongMemEvalJudge(options.apiKey, options.model);
  const adapter = options.adapter ?? new BaselineAdapter();
  let filtered = instances;

  if (options.category) {
    filtered = filtered.filter((i) => i.category === options.category);
  }
  if (options.limit && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  logger.info(
    `LongMemEval: running ${filtered.length} instances with adapter "${adapter.name}"${options.category ? ` (category: ${options.category})` : ""}`,
  );

  const results: EvaluationResult[] = [];

  for (const instance of filtered) {
    const start = Date.now();

    try {
      // 1. Setup: injetar contexto no sistema (ex: popular Redis)
      await adapter.setup(instance);

      // 2. Answer: submeter pergunta ao sistema real
      const actualAnswer = await adapter.answer(instance);

      // 3. Judge: avaliar resposta
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
    } catch (err) {
      const latencyMs = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);

      results.push({
        instanceId: instance.id,
        category: instance.category,
        question: instance.question,
        expectedAnswer: instance.expectedAnswer,
        actualAnswer: `ERROR: ${errorMsg}`,
        isCorrect: false,
        reasoning: `Adapter "${adapter.name}" threw an error: ${errorMsg}`,
        latencyMs,
      });

      logger.error(`  ✗ [${instance.category}] ${instance.id} ERROR: ${errorMsg}`);
    } finally {
      // 4. Teardown: limpar estado injetado
      try {
        await adapter.teardown(instance);
      } catch (cleanupErr) {
        logger.warn(
          `Teardown failed for ${instance.id}: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`,
        );
      }
    }
  }

  return results;
}
