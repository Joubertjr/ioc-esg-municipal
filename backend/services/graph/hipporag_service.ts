/**
 * backend/services/graph/hipporag_service.ts
 *
 * HippoRAG-style semantic retrieval sobre o Knowledge Graph ESG.
 *
 * Pipeline (Gutiérrez et al., NeurIPS 2024):
 *   1. Query em linguagem natural → embedding (query: prefix via e5)
 *   2. Similaridade de cosseno contra todos os nós com embedding indexado
 *   3. Top-K nós mais similares → seeds do Personalized PageRank
 *   4. PPR propaga score através das arestas ponderadas (sinergias + trade-offs)
 *   5. Resultado final = blend entre score semântico (cosine) e score estrutural (PPR)
 *
 * Por que blend? HippoRAG mostra que combinar recall semântico com navegação
 * estrutural supera qualquer um isoladamente. Nosso blend:
 *   final_score = alpha * semantic + (1 - alpha) * structural
 *   (default alpha = 0.5)
 *
 * Cache: chave composta (query hash + topK + alpha). TTL 10min.
 */

import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { withCache } from "../../utils/cache.js";
import { logger } from "../../utils/logger.js";
import {
  embedQuery,
  cosineSimilarity,
  extractEmbedding,
  EMBEDDING_DIM,
} from "./embeddings_service.js";
import { personalizedPageRank, type PprResult } from "./ppr_service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HippoRagResult = {
  entityId: string;
  type: string;
  externalId: string | null;
  semanticScore: number;
  structuralScore: number;
  finalScore: number;
  props: Record<string, unknown>;
};

export type HippoRagOptions = {
  topK?: number;
  pprSeeds?: number;
  alpha?: number;
  entityTypeFilter?: string;
  edgeTypes?: string[];
  now?: Date;
};

const QUERY_CACHE_TTL = 600;
const DEFAULT_TOP_K = 10;
const DEFAULT_PPR_SEEDS = 5;
const DEFAULT_ALPHA = 0.5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPropsRecord(props: unknown): Record<string, unknown> {
  if (typeof props === "object" && props !== null && !Array.isArray(props)) {
    return props as Record<string, unknown>;
  }
  return {};
}

function hashQuery(query: string, opts: HippoRagOptions): string {
  const normalized = JSON.stringify({
    q: query.trim().toLowerCase(),
    k: opts.topK ?? DEFAULT_TOP_K,
    s: opts.pprSeeds ?? DEFAULT_PPR_SEEDS,
    a: opts.alpha ?? DEFAULT_ALPHA,
    t: opts.entityTypeFilter ?? null,
    e: opts.edgeTypes ?? null,
  });
  return crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 16);
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Executa uma query semântica sobre o grafo. Retorna top-K entidades rankadas
 * por blend de similaridade de cosseno + Personalized PageRank.
 *
 * Fluxo executa em duas fases:
 *   Phase 1 (semantic): busca nós com maior cosine vs query embedding
 *   Phase 2 (structural): usa top-N como seeds do PPR e ranqueia o grafo
 *
 * Fallback gracioso: se a busca por embeddings falhar (modelo indisponível,
 * nós sem embedding indexado), cai automaticamente em PPR-only com seeds
 * vazios → retorna array vazio. Nenhum erro propaga.
 */
export async function semanticSearch(
  query: string,
  opts: HippoRagOptions = {},
): Promise<HippoRagResult[]> {
  const topK = opts.topK ?? DEFAULT_TOP_K;
  const pprSeeds = opts.pprSeeds ?? DEFAULT_PPR_SEEDS;
  const alpha = opts.alpha ?? DEFAULT_ALPHA;

  if (alpha < 0 || alpha > 1) {
    throw new Error(`semanticSearch: alpha deve estar em [0,1], recebido ${alpha}`);
  }

  const cacheKey = `graph:hipporag:${hashQuery(query, opts)}`;

  return withCache(cacheKey, QUERY_CACHE_TTL, () =>
    _semanticSearchUncached(query, topK, pprSeeds, alpha, opts),
  );
}

async function _semanticSearchUncached(
  query: string,
  topK: number,
  pprSeeds: number,
  alpha: number,
  opts: HippoRagOptions,
): Promise<HippoRagResult[]> {
  logger.debug("[hipporag] semanticSearch start", { query: query.slice(0, 80), topK, alpha });

  // ── Phase 1: Semantic ──
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(query);
  } catch (err) {
    logger.warn("[hipporag] embedQuery failed, returning empty", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  if (queryEmbedding.length !== EMBEDDING_DIM) {
    logger.warn("[hipporag] query embedding dim mismatch", {
      got: queryEmbedding.length,
      expected: EMBEDDING_DIM,
    });
    return [];
  }

  // Carrega todos os nós candidatos (com filtro de tipo opcional)
  const candidates = await prisma.entity.findMany({
    where: opts.entityTypeFilter !== undefined ? { type: opts.entityTypeFilter } : {},
    select: { id: true, type: true, externalId: true, props: true },
  });

  logger.debug("[hipporag] candidates loaded", { count: candidates.length });

  // Calcula cosine similarity para cada candidato que tiver embedding
  type SemanticHit = {
    id: string;
    type: string;
    externalId: string | null;
    props: Record<string, unknown>;
    semanticScore: number;
  };

  const semanticHits: SemanticHit[] = [];

  for (const cand of candidates) {
    const embedding = extractEmbedding(cand.props);
    if (embedding === null) continue;
    if (embedding.length !== queryEmbedding.length) continue;

    const score = cosineSimilarity(queryEmbedding, embedding);
    semanticHits.push({
      id: cand.id,
      type: cand.type,
      externalId: cand.externalId,
      props: toPropsRecord(cand.props),
      semanticScore: score,
    });
  }

  if (semanticHits.length === 0) {
    logger.warn("[hipporag] no candidates with valid embeddings");
    return [];
  }

  semanticHits.sort((a, b) => b.semanticScore - a.semanticScore);

  // ── Phase 2: Structural (PPR) ──
  const seedIds = semanticHits.slice(0, pprSeeds).map((h) => h.id);

  let pprResults: PprResult[] = [];
  try {
    pprResults = await personalizedPageRank(seedIds, {
      edgeTypes: opts.edgeTypes,
      ...(opts.now !== undefined ? { now: opts.now } : {}),
    });
  } catch (err) {
    logger.warn("[hipporag] PPR failed, falling back to semantic-only", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Fallback: usa apenas scores semânticos
    return semanticHits.slice(0, topK).map((h) => ({
      entityId: h.id,
      type: h.type,
      externalId: h.externalId,
      semanticScore: h.semanticScore,
      structuralScore: 0,
      finalScore: h.semanticScore,
      props: h.props,
    }));
  }

  // Normaliza PPR scores para [0,1] pelo máximo observado
  const maxPpr = pprResults.reduce((m, r) => Math.max(m, r.score), 0);
  const pprById = new Map<string, number>();
  for (const r of pprResults) {
    pprById.set(r.entityId, maxPpr > 0 ? r.score / maxPpr : 0);
  }

  // ── Phase 3: Blend ──
  // Normaliza semantic scores para [0,1] pelo máximo — cosine já é [-1,1]
  // mas com e5 normalizado e PT-BR consistente, normalmente fica em [0.3, 0.95].
  const maxSemantic = semanticHits.reduce((m, h) => Math.max(m, h.semanticScore), 0);

  const blended: HippoRagResult[] = semanticHits.map((h) => {
    const semNorm = maxSemantic > 0 ? h.semanticScore / maxSemantic : 0;
    const structNorm = pprById.get(h.id) ?? 0;
    const finalScore = alpha * semNorm + (1 - alpha) * structNorm;

    return {
      entityId: h.id,
      type: h.type,
      externalId: h.externalId,
      semanticScore: h.semanticScore,
      structuralScore: structNorm,
      finalScore,
      props: h.props,
    };
  });

  // Inclui entidades descobertas só pelo PPR (não estavam no top semantic)
  const semanticIdSet = new Set(semanticHits.map((h) => h.id));
  const pprOnlyIds = pprResults.filter((r) => !semanticIdSet.has(r.entityId)).slice(0, topK);

  if (pprOnlyIds.length > 0) {
    const pprEntities = await prisma.entity.findMany({
      where: { id: { in: pprOnlyIds.map((r) => r.entityId) } },
      select: { id: true, type: true, externalId: true, props: true },
    });

    const entityById = new Map(pprEntities.map((e) => [e.id, e]));

    for (const r of pprOnlyIds) {
      const entity = entityById.get(r.entityId);
      if (entity === undefined) continue;
      const structNorm = maxPpr > 0 ? r.score / maxPpr : 0;

      blended.push({
        entityId: entity.id,
        type: entity.type,
        externalId: entity.externalId,
        semanticScore: 0,
        structuralScore: structNorm,
        finalScore: (1 - alpha) * structNorm,
        props: toPropsRecord(entity.props),
      });
    }
  }

  blended.sort((a, b) => b.finalScore - a.finalScore);

  const top = blended.slice(0, topK);

  logger.debug("[hipporag] semanticSearch done", {
    query: query.slice(0, 80),
    topK,
    returnedCount: top.length,
  });

  return top;
}

/**
 * Busca simples de nós por similaridade semântica (sem PPR). Útil para
 * auto-complete e recomendação "mais parecidos com" sem custo do PPR.
 */
export async function findSimilarEntities(
  query: string,
  opts: { topK?: number; entityTypeFilter?: string } = {},
): Promise<HippoRagResult[]> {
  return semanticSearch(query, {
    ...(opts.topK !== undefined ? { topK: opts.topK } : {}),
    ...(opts.entityTypeFilter !== undefined ? { entityTypeFilter: opts.entityTypeFilter } : {}),
    alpha: 1.0, // 100% semantic, 0% structural
  });
}
