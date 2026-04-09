/**
 * Agregador de métricas e gerador de relatório Markdown para LongMemEval-ESG.
 */

import { writeFileSync, mkdirSync } from "fs";
import type {
  EvaluationResult,
  EvaluationReport,
  CategoryMetrics,
  QuestionCategory,
} from "./types.js";
import { logger } from "../../utils/logger.js";

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  extraction: "Extração de Informação",
  multi_session: "Raciocínio Multissessão",
  temporal: "Raciocínio Temporal",
  knowledge_update: "Atualização de Conhecimento",
  abstention: "Abstenção",
};

export function aggregateMetrics(results: EvaluationResult[]): EvaluationReport {
  const categories: QuestionCategory[] = [
    "extraction",
    "multi_session",
    "temporal",
    "knowledge_update",
    "abstention",
  ];

  const categoryMetrics: CategoryMetrics[] = categories.map((cat) => {
    const catResults = results.filter((r) => r.category === cat);
    const correct = catResults.filter((r) => r.isCorrect).length;
    return {
      category: cat,
      total: catResults.length,
      correct,
      accuracy: catResults.length > 0 ? Math.round((correct / catResults.length) * 100) : 0,
    };
  });

  const totalCorrect = results.filter((r) => r.isCorrect).length;
  const globalAccuracy = results.length > 0 ? Math.round((totalCorrect / results.length) * 100) : 0;

  return {
    runDate: new Date().toISOString(),
    totalInstances: results.length,
    globalAccuracy,
    categoryMetrics: categoryMetrics.filter((m) => m.total > 0),
    results,
  };
}

export function generateMarkdownReport(report: EvaluationReport): string {
  const date = report.runDate.split("T")[0];
  const lines: string[] = [];

  lines.push(`# LongMemEval-ESG — Relatório ${date}`);
  lines.push("");
  lines.push(`> Benchmark de memória de longo prazo adaptado ao contexto ESG Municipal.`);
  lines.push("");

  // Resumo global
  lines.push("## Resumo Global");
  lines.push("");
  lines.push(`| Métrica | Valor |`);
  lines.push(`| :--- | :--- |`);
  lines.push(`| **Instâncias avaliadas** | ${report.totalInstances} |`);
  lines.push(`| **Acurácia global** | **${report.globalAccuracy}%** |`);
  lines.push(`| **Data de execução** | ${date} |`);
  lines.push("");

  // Métricas por categoria
  lines.push("## Acurácia por Categoria");
  lines.push("");
  lines.push(`| Categoria | Total | Corretas | Acurácia |`);
  lines.push(`| :--- | :---: | :---: | :---: |`);

  for (const m of report.categoryMetrics) {
    const label = CATEGORY_LABELS[m.category] ?? m.category;
    const emoji = m.accuracy >= 80 ? "🟢" : m.accuracy >= 60 ? "🟡" : "🔴";
    lines.push(`| ${label} | ${m.total} | ${m.correct} | ${emoji} **${m.accuracy}%** |`);
  }
  lines.push("");

  // Detalhes dos erros
  const errors = report.results.filter((r) => !r.isCorrect);
  if (errors.length > 0) {
    lines.push("## Erros Detalhados");
    lines.push("");

    for (const err of errors) {
      const label = CATEGORY_LABELS[err.category] ?? err.category;
      lines.push(`### ❌ ${err.instanceId} (${label})`);
      lines.push("");
      lines.push(`**Pergunta:** ${err.question}`);
      lines.push("");
      lines.push(`**Esperado:** ${err.expectedAnswer}`);
      lines.push("");
      lines.push(`**Obtido:** ${err.actualAnswer}`);
      lines.push("");
      lines.push(`**Raciocínio do Judge:** ${err.reasoning}`);
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  }

  // Acertos (resumo)
  const correct = report.results.filter((r) => r.isCorrect);
  if (correct.length > 0) {
    lines.push("## Acertos");
    lines.push("");
    lines.push(`| ID | Categoria | Latência |`);
    lines.push(`| :--- | :--- | :---: |`);
    for (const c of correct) {
      lines.push(
        `| ${c.instanceId} | ${CATEGORY_LABELS[c.category] ?? c.category} | ${c.latencyMs}ms |`,
      );
    }
    lines.push("");
  }

  // Referências
  lines.push("## Metodologia");
  lines.push("");
  lines.push(
    "Benchmark baseado no [LongMemEval](https://arxiv.org/abs/2404.09960) adaptado para o contexto ESG Municipal.",
  );
  lines.push(
    "Avaliação via LLM-as-a-Judge (Claude Haiku) com fallback heurístico quando API não disponível.",
  );
  lines.push("Categorias testadas: Extração, Multissessão, Temporal, Atualização, Abstenção.");
  lines.push("");

  return lines.join("\n");
}

export function saveReport(report: EvaluationReport, outputDir?: string): string {
  const dir = outputDir ?? "docs/evaluation";
  mkdirSync(dir, { recursive: true });

  const date = report.runDate.split("T")[0].replace(/-/g, "");
  const mdPath = `${dir}/longmemeval_report_${date}.md`;
  const jsonPath = `${dir}/longmemeval_results_${date}.json`;

  const markdown = generateMarkdownReport(report);
  writeFileSync(mdPath, markdown + "\n");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");

  logger.info(`Report saved: ${mdPath} + ${jsonPath}`);
  return mdPath;
}
