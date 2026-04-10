/**
 * scripts/smoke-hipporag.ts
 *
 * Smoke test end-to-end do HippoRAG sobre o Knowledge Graph ESG.
 * Executa 5 queries representativas e imprime top-5 resultados de cada uma.
 *
 * Uso: DATABASE_URL=... pnpm tsx scripts/smoke-hipporag.ts
 */

import { semanticSearch } from "../backend/services/graph/hipporag_service.js";
import { prisma } from "../backend/lib/prisma.js";
import { closeRedisClient } from "../backend/utils/cache.js";

const QUERIES = [
  "Como melhorar o saneamento básico em municípios pequenos?",
  "Estratégias contra a mortalidade infantil e gestante",
  "Reduzir desigualdade de renda e inclusão produtiva",
  "Economia circular e reciclagem de resíduos urbanos",
  "Como preservar biodiversidade e combater desmatamento?",
];

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────────────────────────");
  console.log("HippoRAG smoke test — ESG Knowledge Graph");
  console.log("─────────────────────────────────────────────────────────────");

  for (const query of QUERIES) {
    console.log("");
    console.log(`Q: ${query}`);
    console.log("─".repeat(65));

    const start = Date.now();
    const results = await semanticSearch(query, { topK: 5, pprSeeds: 3, alpha: 0.6 });
    const elapsed = Date.now() - start;

    if (results.length === 0) {
      console.log("  (nenhum resultado)");
      continue;
    }

    for (const r of results) {
      const name = (r.props["name"] as string) ?? r.externalId;
      const semF = r.semanticScore.toFixed(3);
      const strF = r.structuralScore.toFixed(3);
      const finF = r.finalScore.toFixed(3);
      console.log(
        `  [ODS ${r.externalId}] ${name.padEnd(42)}  sem=${semF}  str=${strF}  final=${finF}`,
      );
    }

    console.log(`  (${elapsed}ms)`);
  }

  console.log("");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("Smoke test concluído.");

  await prisma.$disconnect();
  await closeRedisClient();
}

main()
  .then(() => {
    // Belt-and-suspenders: o runtime ONNX do @huggingface/transformers cria
    // workers em background que não fecham com o fim de main(). Force-exit
    // garante que o processo termina mesmo assim.
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("Smoke test failed:", err);
    process.exit(1);
  });
