#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * CLI para executar o benchmark LongMemEval-ESG.
 *
 * Uso:
 *   npx tsx scripts/run-longmemeval.ts
 *   npx tsx scripts/run-longmemeval.ts --category extraction --limit 5
 *   npx tsx scripts/run-longmemeval.ts --category abstention
 *   npx tsx scripts/run-longmemeval.ts --limit 10 --output docs/evaluation
 */

import { generateDataset } from "../backend/evaluation/longmemeval/dataset-generator.js";
import { runEvaluation } from "../backend/evaluation/longmemeval/runner.js";
import {
  aggregateMetrics,
  saveReport,
  generateMarkdownReport,
} from "../backend/evaluation/longmemeval/reporter.js";
import type { QuestionCategory } from "../backend/evaluation/longmemeval/types.js";

// ─── Parse CLI args ─────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    category?: QuestionCategory;
    limit?: number;
    output?: string;
  } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--category" && args[i + 1]) {
      options.category = args[++i] as QuestionCategory;
    } else if (args[i] === "--limit" && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (args[i] === "--output" && args[i + 1]) {
      options.output = args[++i];
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
LongMemEval-ESG — Benchmark de Memória de Longo Prazo

Uso:
  npx tsx scripts/run-longmemeval.ts [opções]

Opções:
  --category <cat>  Filtrar por categoria (extraction, multi_session, temporal, knowledge_update, abstention)
  --limit <n>       Limitar a N instâncias
  --output <dir>    Diretório de saída (default: docs/evaluation)
  --help, -h        Mostrar esta ajuda
`);
      process.exit(0);
    }
  }

  return options;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const options = parseArgs();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  LongMemEval-ESG — Benchmark de Memória de Longo Prazo");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  // Gerar dataset
  const dataset = generateDataset();
  console.log(`Dataset gerado: ${dataset.length} instâncias total`);

  const categories = [...new Set(dataset.map((d) => d.category))];
  for (const cat of categories) {
    const count = dataset.filter((d) => d.category === cat).length;
    console.log(`  - ${cat}: ${count} instâncias`);
  }
  console.log("");

  // Executar avaliação
  const results = await runEvaluation(dataset, {
    category: options.category,
    limit: options.limit,
  });

  // Agregar métricas
  const report = aggregateMetrics(results);

  // Exibir resultado no terminal
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  RESULTADO: ${report.globalAccuracy}% acurácia global`);
  console.log(`  (${results.filter((r) => r.isCorrect).length}/${results.length} corretas)`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  for (const m of report.categoryMetrics) {
    const bar =
      "█".repeat(Math.round(m.accuracy / 5)) + "░".repeat(20 - Math.round(m.accuracy / 5));
    console.log(`  ${m.category.padEnd(20)} ${bar} ${m.accuracy}% (${m.correct}/${m.total})`);
  }
  console.log("");

  // Salvar relatório
  const reportPath = saveReport(report, options.output);
  console.log(`Relatório salvo em: ${reportPath}`);

  // Também gerar markdown no stdout se < 10 instâncias
  if (results.length <= 10) {
    console.log("");
    console.log("─── Relatório Markdown ─────────────────────────────────────");
    console.log(generateMarkdownReport(report));
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
