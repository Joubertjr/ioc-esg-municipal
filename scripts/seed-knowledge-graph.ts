/**
 * scripts/seed-knowledge-graph.ts
 *
 * Seed do Knowledge Graph ESG — 17 entidades ODS + 48 relacionamentos
 * (24 pares bidirecionais: SINERGIA e TRADE_OFF).
 *
 * Idempotente: faz upsert nas entidades e recria os relacionamentos ODS–ODS
 * a cada execução, deletando os anteriores antes de inserir.
 *
 * Referências:
 *   - Nilsson 2016 (Nature)
 *   - Pradhan 2017 (Nature Sustainability)
 *   - Weitz 2018 (Sustainability Science)
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { ODS_DEFINITIONS } from "../shared/constants/ods.js";

// ─── Tipos internos ────────────────────────────────────────────────────────────

interface RelationshipProps {
  weight: number;
  confidence: number;
  source: string;
  notes?: string;
}

interface EdgeDefinition {
  from: number; // ODS number 1..17
  to: number; // ODS number 1..17
  type: "SINERGIA" | "TRADE_OFF";
  props: RelationshipProps;
}

// ─── Matriz autoritativa SDG Interlinkages ─────────────────────────────────────
// Cada par aqui gera duas arestas (A→B e B→A) com o mesmo weight.

const EDGE_PAIRS: EdgeDefinition[] = [
  // ── SINERGIAS (14 pares) ──────────────────────────────────────────────────
  {
    from: 1,
    to: 3,
    type: "SINERGIA",
    props: { weight: 0.78, confidence: 0.9, source: "Pradhan 2017" },
  },
  {
    from: 1,
    to: 4,
    type: "SINERGIA",
    props: { weight: 0.77, confidence: 0.9, source: "Pradhan 2017" },
  },
  {
    from: 1,
    to: 5,
    type: "SINERGIA",
    props: { weight: 0.76, confidence: 0.88, source: "Pradhan 2017" },
  },
  {
    from: 1,
    to: 6,
    type: "SINERGIA",
    props: { weight: 0.75, confidence: 0.85, source: "Pradhan 2017" },
  },
  {
    from: 1,
    to: 8,
    type: "SINERGIA",
    props: { weight: 0.7, confidence: 0.85, source: "Pradhan 2017" },
  },
  {
    from: 1,
    to: 10,
    type: "SINERGIA",
    props: { weight: 0.75, confidence: 0.88, source: "Pradhan 2017" },
  },
  {
    from: 3,
    to: 4,
    type: "SINERGIA",
    props: { weight: 0.74, confidence: 0.9, source: "Pradhan 2017" },
  },
  {
    from: 3,
    to: 5,
    type: "SINERGIA",
    props: { weight: 0.73, confidence: 0.85, source: "Pradhan 2017" },
  },
  {
    from: 3,
    to: 6,
    type: "SINERGIA",
    props: { weight: 0.72, confidence: 0.9, source: "Pradhan 2017" },
  },
  {
    from: 4,
    to: 8,
    type: "SINERGIA",
    props: { weight: 0.71, confidence: 0.88, source: "Pradhan 2017" },
  },
  {
    from: 7,
    to: 9,
    type: "SINERGIA",
    props: {
      weight: 1.0,
      confidence: 0.95,
      source: "Nilsson 2016",
      notes: "Indivisible +3",
    },
  },
  {
    from: 7,
    to: 3,
    type: "SINERGIA",
    props: {
      weight: 0.67,
      confidence: 0.8,
      source: "Nilsson 2016",
      notes: "Reinforcing +2",
    },
  },
  {
    from: 7,
    to: 4,
    type: "SINERGIA",
    props: {
      weight: 0.33,
      confidence: 0.75,
      source: "Nilsson 2016",
      notes: "Enabling +1",
    },
  },
  {
    from: 13,
    to: 15,
    type: "SINERGIA",
    props: { weight: 0.95, confidence: 0.92, source: "Pradhan 2017" },
  },

  // ── TRADE-OFFS (10 pares) ─────────────────────────────────────────────────
  {
    from: 3,
    to: 12,
    type: "TRADE_OFF",
    props: {
      weight: -0.53,
      confidence: 0.85,
      source: "Pradhan 2017, Nilsson 2016",
      notes: "Nilsson -2",
    },
  },
  {
    from: 12,
    to: 1,
    type: "TRADE_OFF",
    props: { weight: -0.45, confidence: 0.8, source: "Pradhan 2017" },
  },
  {
    from: 12,
    to: 2,
    type: "TRADE_OFF",
    props: { weight: -0.45, confidence: 0.8, source: "Pradhan 2017" },
  },
  {
    from: 12,
    to: 6,
    type: "TRADE_OFF",
    props: { weight: -0.4, confidence: 0.78, source: "Pradhan 2017" },
  },
  {
    from: 12,
    to: 7,
    type: "TRADE_OFF",
    props: { weight: -0.4, confidence: 0.8, source: "Pradhan 2017" },
  },
  {
    from: 15,
    to: 1,
    type: "TRADE_OFF",
    props: { weight: -0.42, confidence: 0.78, source: "Pradhan 2017" },
  },
  {
    from: 15,
    to: 2,
    type: "TRADE_OFF",
    props: { weight: -0.5, confidence: 0.82, source: "Pradhan 2017" },
  },
  {
    from: 15,
    to: 8,
    type: "TRADE_OFF",
    props: { weight: -0.38, confidence: 0.75, source: "Pradhan 2017" },
  },
  {
    from: 2,
    to: 15,
    type: "TRADE_OFF",
    props: { weight: -0.45, confidence: 0.8, source: "Pradhan 2017" },
  },
  {
    from: 9,
    to: 13,
    type: "TRADE_OFF",
    props: { weight: -0.35, confidence: 0.72, source: "Weitz 2018" },
  },
];

// Data conservadora cobrindo as publicações base
const VALID_FROM = new Date("2024-01-01T00:00:00Z");

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
  });

  const startTime = Date.now();

  try {
    // ── Fase 1: Seed das 17 entidades ODS ────────────────────────────────────
    console.log("Fase 1 — Seeding 17 ODS entities...");

    let entitiesUpserted = 0;

    for (const ods of ODS_DEFINITIONS) {
      await prisma.entity.upsert({
        where: {
          type_externalId: {
            type: "ods",
            externalId: String(ods.number),
          },
        },
        create: {
          type: "ods",
          externalId: String(ods.number),
          props: {
            number: ods.number,
            name: ods.name,
            shortName: ods.shortName,
            color: ods.color,
            weight: ods.weight,
          },
        },
        update: {
          props: {
            number: ods.number,
            name: ods.name,
            shortName: ods.shortName,
            color: ods.color,
            weight: ods.weight,
          },
        },
      });
      entitiesUpserted++;
    }

    console.log(`✓ Seeded ${entitiesUpserted} ODS entities`);

    // ── Fase 2: Seed dos relacionamentos ODS–ODS ──────────────────────────────
    console.log("Fase 2 — Seeding ODS relationships...");

    // Carregar IDs das entidades ODS para lookups O(1)
    const odsEntities = await prisma.entity.findMany({
      where: { type: "ods" },
      select: { id: true, externalId: true },
    });

    const odsIdByNumber = new Map<number, string>();
    for (const entity of odsEntities) {
      if (entity.externalId !== null) {
        odsIdByNumber.set(Number(entity.externalId), entity.id);
      }
    }

    // Deletar relacionamentos ODS–ODS existentes (idempotência)
    const deletedCount = await deleteOdsRelationships(prisma, odsIdByNumber);
    if (deletedCount > 0) {
      console.log(`  → Removed ${deletedCount} existing ODS relationships`);
    }

    // Expandir cada par em duas arestas bidirecionais
    const edgeData = buildEdgeData(EDGE_PAIRS, odsIdByNumber);

    if (edgeData.length > 0) {
      await prisma.relationship.createMany({ data: edgeData });
    }

    const relationshipsCreated = edgeData.length;
    console.log(
      `✓ Seeded ${relationshipsCreated} ODS relationships (${EDGE_PAIRS.length} pairs × 2)`,
    );

    // ── Fase 3: Resumo final ──────────────────────────────────────────────────
    const [totalEntities, totalRelationships] = await Promise.all([
      prisma.entity.count({ where: { type: "ods" } }),
      prisma.relationship.count({
        where: { type: { in: ["SINERGIA", "TRADE_OFF"] } },
      }),
    ]);

    const elapsed = Date.now() - startTime;

    console.log("");
    console.log("─────────────────────────────────────────");
    console.log("Knowledge Graph ESG — seed concluído");
    console.log(`  ODS entities  : ${totalEntities}`);
    console.log(`  Relationships : ${totalRelationships} (SINERGIA + TRADE_OFF)`);
    console.log(`  Tempo total   : ${elapsed}ms`);
    console.log("─────────────────────────────────────────");
  } finally {
    await prisma.$disconnect();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Deleta todos os relacionamentos SINERGIA | TRADE_OFF entre entidades ODS.
 * Retorna o número de registros removidos.
 */
async function deleteOdsRelationships(
  prisma: PrismaClient,
  odsIdByNumber: Map<number, string>,
): Promise<number> {
  const odsIds = Array.from(odsIdByNumber.values());
  if (odsIds.length === 0) return 0;

  const result = await prisma.relationship.deleteMany({
    where: {
      type: { in: ["SINERGIA", "TRADE_OFF"] },
      fromId: { in: odsIds },
      toId: { in: odsIds },
    },
  });

  return result.count;
}

/**
 * Expande a lista de EdgeDefinition em registros prontos para createMany,
 * gerando A→B e B→A para cada par.
 */
function buildEdgeData(
  pairs: EdgeDefinition[],
  odsIdByNumber: Map<number, string>,
): Array<{
  type: string;
  fromId: string;
  toId: string;
  props: Prisma.InputJsonValue;
  validFrom: Date;
  validUntil: null;
}> {
  const rows: ReturnType<typeof buildEdgeData> = [];

  for (const edge of pairs) {
    const fromId = odsIdByNumber.get(edge.from);
    const toId = odsIdByNumber.get(edge.to);

    if (fromId === undefined || toId === undefined) {
      console.warn(`  WARN: ODS ${edge.from} ou ${edge.to} não encontrado — aresta ignorada`);
      continue;
    }

    // Cast explícito para InputJsonValue — tipo esperado pelo Prisma createMany
    const props = edge.props as unknown as Prisma.InputJsonValue;

    // Aresta A → B
    rows.push({
      type: edge.type,
      fromId,
      toId,
      props,
      validFrom: VALID_FROM,
      validUntil: null,
    });

    // Aresta B → A (mesmo weight — grafo não-direcionado via duas direcionais)
    rows.push({
      type: edge.type,
      fromId: toId,
      toId: fromId,
      props,
      validFrom: VALID_FROM,
      validUntil: null,
    });
  }

  return rows;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

main().catch((err: unknown) => {
  console.error("Erro no seed do Knowledge Graph:", err);
  process.exit(1);
});
