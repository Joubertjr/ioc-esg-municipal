import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PprResult = {
  entityId: string;
  score: number;
  type: string;
  externalId: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractWeight(props: unknown): number {
  if (typeof props === "object" && props !== null && !Array.isArray(props) && "weight" in props) {
    const w = (props as Record<string, unknown>).weight;
    return typeof w === "number" ? w : 0;
  }
  return 0;
}

// ─── PPR ──────────────────────────────────────────────────────────────────────

/**
 * PPR simplificado: espalha score a partir de seeds ao longo de arestas ponderadas.
 *
 * Algoritmo:
 *   1. Carrega todas as arestas ativas do tipo desejado
 *   2. Constrói adjacency map from -> [{to, weight}]
 *   3. Inicializa scores: seeds recebem 1/|seeds|, demais 0
 *   4. Itera `iterations` vezes: score[v] = (1-d)*seed[v] + d * Σ(score[u] * w(u,v) / out_sum[u])
 *   5. Retorna top-20 por score descrescente
 *
 * Trade-offs (weight negativo) também propagam sinal — Math.abs garante que
 * relações fortes de qualquer polaridade sejam consideradas relevantes.
 */
export async function personalizedPageRank(
  seedEntityIds: string[],
  opts?: {
    iterations?: number;
    dampingFactor?: number;
    edgeTypes?: string[];
    now?: Date;
  },
): Promise<PprResult[]> {
  const iterations = opts?.iterations ?? 10;
  const dampingFactor = opts?.dampingFactor ?? 0.85;
  const edgeTypes = opts?.edgeTypes ?? ["SINERGIA", "TRADE_OFF"];
  const now = opts?.now ?? new Date();

  logger.debug("[ppr] personalizedPageRank", {
    seeds: seedEntityIds,
    iterations,
    dampingFactor,
    edgeTypes,
  });

  if (seedEntityIds.length === 0) {
    logger.warn("[ppr] no seeds provided");
    return [];
  }

  // 1. Carrega todas as edges ativas dos tipos desejados
  const relationships = await prisma.relationship.findMany({
    where: {
      type: { in: edgeTypes },
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
    select: {
      fromId: true,
      toId: true,
      props: true,
      from: { select: { type: true, externalId: true } },
      to: { select: { type: true, externalId: true } },
    },
  });

  if (relationships.length === 0) {
    logger.warn("[ppr] no relationships found for edge types", { edgeTypes });
    return [];
  }

  // 2. Constrói adjacency map e coleta todos os entity ids vistos
  type AdjEntry = { toId: string; weight: number };
  const adjacency = new Map<string, AdjEntry[]>();

  // Coleta metadados de entity id -> {type, externalId}
  const entityMeta = new Map<string, { type: string; externalId: string | null }>();

  for (const rel of relationships) {
    entityMeta.set(rel.fromId, { type: rel.from.type, externalId: rel.from.externalId });
    entityMeta.set(rel.toId, { type: rel.to.type, externalId: rel.to.externalId });

    const absWeight = Math.abs(extractWeight(rel.props));
    if (absWeight === 0) continue;

    const existing = adjacency.get(rel.fromId) ?? [];
    existing.push({ toId: rel.toId, weight: absWeight });
    adjacency.set(rel.fromId, existing);
  }

  // Garante que seeds existam no mapa de metadados (mesmo sem edges de saída)
  const seedSet = new Set(seedEntityIds);
  const allEntityIds = new Set([...entityMeta.keys(), ...seedEntityIds]);

  // 3. Inicializa scores
  const scores = new Map<string, number>();
  const seedScore = 1 / seedEntityIds.length;

  for (const id of allEntityIds) {
    scores.set(id, seedSet.has(id) ? seedScore : 0);
  }

  // Pré-calcula soma dos pesos de saída por nó (para normalização)
  const outWeightSum = new Map<string, number>();
  for (const [fromId, edges] of adjacency) {
    outWeightSum.set(
      fromId,
      edges.reduce((acc, e) => acc + e.weight, 0),
    );
  }

  // 4. Iterações de propagação
  for (let iter = 0; iter < iterations; iter++) {
    const newScores = new Map<string, number>();

    // Base: restart com distribuição seed
    for (const id of allEntityIds) {
      newScores.set(id, (1 - dampingFactor) * (seedSet.has(id) ? seedScore : 0));
    }

    // Propagação via arestas ponderadas
    for (const [fromId, edges] of adjacency) {
      const fromScore = scores.get(fromId) ?? 0;
      if (fromScore === 0) continue;

      const totalOut = outWeightSum.get(fromId) ?? 1;

      for (const { toId, weight } of edges) {
        const contribution = dampingFactor * fromScore * (weight / totalOut);
        newScores.set(toId, (newScores.get(toId) ?? 0) + contribution);
      }
    }

    for (const [id, score] of newScores) {
      scores.set(id, score);
    }
  }

  // 5. Monta resultado, exclui seeds, ordena por score desc, retorna top-20
  const results: PprResult[] = [];

  for (const [entityId, score] of scores) {
    if (score <= 0) continue;
    const meta = entityMeta.get(entityId);
    results.push({
      entityId,
      score,
      type: meta?.type ?? "unknown",
      externalId: meta?.externalId ?? null,
    });
  }

  results.sort((a, b) => b.score - a.score);

  const top20 = results.slice(0, 20);

  logger.debug("[ppr] result", { seedCount: seedEntityIds.length, resultCount: top20.length });

  return top20;
}
