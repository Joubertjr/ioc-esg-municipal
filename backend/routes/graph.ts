import { Router, type Request, type Response, type Router as RouterType } from "express";
import { z } from "zod";
import {
  findEntity,
  getNeighbors,
  findSynergies,
  findTradeOffs,
} from "../services/graph/graph_service.js";
import { personalizedPageRank } from "../services/graph/ppr_service.js";
import { semanticSearch, findSimilarEntities } from "../services/graph/hipporag_service.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();

// ─── Schemas de validação ─────────────────────────────────────────────────────

const neighborsQuerySchema = z.object({
  type: z.string().min(1, "type é obrigatório"),
  externalId: z.string().min(1, "externalId é obrigatório"),
  edgeType: z.string().optional(),
  minWeight: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseFloat(v) : undefined))
    .pipe(z.number().min(0).max(1).optional()),
});

const odsListQuerySchema = z.object({
  ods: z
    .string()
    .min(1, "ods é obrigatório")
    .transform((v) =>
      v
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n)),
    )
    .pipe(
      z
        .array(z.number().int().min(1).max(17))
        .min(1, "ao menos um ODS é obrigatório")
        .max(17, "máximo 17 ODS"),
    ),
});

const pprBodySchema = z.object({
  seeds: z
    .array(z.string().min(1))
    .min(1, "seeds deve conter ao menos um elemento")
    .max(50, "máximo 50 seeds"),
  iterations: z.number().int().min(1).max(50).optional(),
  dampingFactor: z.number().min(0.1).max(0.99).optional(),
  edgeTypes: z.array(z.string().min(1)).optional(),
});

const queryBodySchema = z.object({
  query: z
    .string()
    .min(3, "query deve ter ao menos 3 caracteres")
    .max(500, "query deve ter no máximo 500 caracteres"),
  topK: z.number().int().min(1).max(50).optional(),
  pprSeeds: z.number().int().min(1).max(20).optional(),
  alpha: z.number().min(0).max(1).optional(),
  entityTypeFilter: z.string().min(1).optional(),
  edgeTypes: z.array(z.string().min(1)).optional(),
});

const similarBodySchema = z.object({
  query: z
    .string()
    .min(3, "query deve ter ao menos 3 caracteres")
    .max(500, "query deve ter no máximo 500 caracteres"),
  topK: z.number().int().min(1).max(50).optional(),
  entityTypeFilter: z.string().min(1).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve "ods:1" → entity id. Formato: "<type>:<externalId>". */
async function resolveSeedId(seed: string): Promise<string | null> {
  const colonIdx = seed.indexOf(":");
  if (colonIdx === -1) {
    // Assume que é um entity id direto (cuid)
    return seed;
  }
  const type = seed.substring(0, colonIdx);
  const externalId = seed.substring(colonIdx + 1);
  const entity = await findEntity(type, externalId);
  return entity?.id ?? null;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/**
 * GET /api/graph/neighbors
 * Query: type, externalId, edgeType?, minWeight?
 * Retorna vizinhos diretos (1 hop) de uma entity.
 */
router.get("/neighbors", async (req: Request, res: Response) => {
  const parsed = neighborsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: "Parâmetros inválidos", details: parsed.error.flatten() });
    return;
  }

  const { type, externalId, edgeType, minWeight } = parsed.data;

  try {
    const entity = await findEntity(type, externalId);

    if (!entity) {
      res.status(404).json({ error: `Entity não encontrada: ${type}:${externalId}` });
      return;
    }

    const neighbors = await getNeighbors(entity.id, { edgeType, minWeight });

    res.json({
      entity,
      total: neighbors.length,
      neighbors,
    });
  } catch (error) {
    logger.error("[graph] getNeighbors error", {
      type,
      externalId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao buscar vizinhos" });
  }
});

/**
 * GET /api/graph/synergies
 * Query: ods (CSV de números 1-17)
 * Retorna sinergias ativas para os ODS informados.
 */
router.get("/synergies", async (req: Request, res: Response) => {
  const parsed = odsListQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: "Parâmetros inválidos", details: parsed.error.flatten() });
    return;
  }

  const { ods } = parsed.data;

  try {
    const synergies = await findSynergies(ods);

    res.json({
      odsNumbers: ods,
      total: synergies.length,
      synergies,
    });
  } catch (error) {
    logger.error("[graph] findSynergies error", {
      ods,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao buscar sinergias" });
  }
});

/**
 * GET /api/graph/tradeoffs
 * Query: ods (CSV de números 1-17)
 * Retorna trade-offs ativos para os ODS informados.
 */
router.get("/tradeoffs", async (req: Request, res: Response) => {
  const parsed = odsListQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: "Parâmetros inválidos", details: parsed.error.flatten() });
    return;
  }

  const { ods } = parsed.data;

  try {
    const tradeoffs = await findTradeOffs(ods);

    res.json({
      odsNumbers: ods,
      total: tradeoffs.length,
      tradeoffs,
    });
  } catch (error) {
    logger.error("[graph] findTradeOffs error", {
      ods,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao buscar trade-offs" });
  }
});

/**
 * POST /api/graph/ppr
 * Body: { seeds: string[], iterations?, dampingFactor?, edgeTypes? }
 * seeds: array de "type:externalId" ou entity id direto.
 * Retorna Personalized PageRank top-20.
 */
router.post("/ppr", async (req: Request, res: Response) => {
  const parsed = pprBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Body inválido", details: parsed.error.flatten() });
    return;
  }

  const { seeds, iterations, dampingFactor, edgeTypes } = parsed.data;

  try {
    // Resolve seeds para entity ids
    const resolvedIds = await Promise.all(seeds.map(resolveSeedId));
    const validIds = resolvedIds.filter((id): id is string => id !== null);

    if (validIds.length === 0) {
      res.status(404).json({ error: "Nenhum seed resolvido para entity válida" });
      return;
    }

    const unresolved = seeds.filter((_, i) => resolvedIds[i] === null);
    if (unresolved.length > 0) {
      logger.warn("[graph] PPR seeds não resolvidos", { unresolved });
    }

    const results = await personalizedPageRank(validIds, {
      iterations,
      dampingFactor,
      edgeTypes,
    });

    res.json({
      seeds,
      resolvedSeeds: validIds.length,
      unresolvedSeeds: unresolved,
      total: results.length,
      results,
    });
  } catch (error) {
    logger.error("[graph] ppr error", {
      seeds,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao executar PPR" });
  }
});

/**
 * POST /api/graph/query
 * Body: { query, topK?, pprSeeds?, alpha?, entityTypeFilter?, edgeTypes? }
 *
 * HippoRAG semantic search: embed da query → cosine vs nós → top-K seeds
 * → Personalized PageRank → blend (alpha * semantic + (1-alpha) * structural).
 *
 * Exemplo:
 *   POST /api/graph/query
 *   { "query": "como melhorar saneamento básico em municípios pequenos?", "topK": 5 }
 */
router.post("/query", async (req: Request, res: Response) => {
  const parsed = queryBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Body inválido", details: parsed.error.flatten() });
    return;
  }

  const { query, topK, pprSeeds, alpha, entityTypeFilter, edgeTypes } = parsed.data;

  try {
    const results = await semanticSearch(query, {
      ...(topK !== undefined ? { topK } : {}),
      ...(pprSeeds !== undefined ? { pprSeeds } : {}),
      ...(alpha !== undefined ? { alpha } : {}),
      ...(entityTypeFilter !== undefined ? { entityTypeFilter } : {}),
      ...(edgeTypes !== undefined ? { edgeTypes } : {}),
    });

    res.json({
      query,
      total: results.length,
      results,
    });
  } catch (error) {
    logger.error("[graph] semanticSearch error", {
      query,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao executar busca semântica" });
  }
});

/**
 * POST /api/graph/similar
 * Body: { query, topK?, entityTypeFilter? }
 *
 * Busca semântica pura (alpha=1.0): top-K entidades mais similares à query
 * sem propagação estrutural. Útil para autocomplete e sugestão direta.
 */
router.post("/similar", async (req: Request, res: Response) => {
  const parsed = similarBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Body inválido", details: parsed.error.flatten() });
    return;
  }

  const { query, topK, entityTypeFilter } = parsed.data;

  try {
    const results = await findSimilarEntities(query, {
      ...(topK !== undefined ? { topK } : {}),
      ...(entityTypeFilter !== undefined ? { entityTypeFilter } : {}),
    });

    res.json({
      query,
      total: results.length,
      results,
    });
  } catch (error) {
    logger.error("[graph] findSimilarEntities error", {
      query,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao buscar similares" });
  }
});

export default router;
