import { type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { withCache } from "../../utils/cache.js";
import { logger } from "../../utils/logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GraphEntity = {
  id: string;
  type: string;
  externalId: string | null;
  props: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  weight: number;
  confidence: number;
  source?: string;
};

export type GraphNeighbor = {
  entity: GraphEntity;
  edge: GraphEdge;
  hops: number;
};

// ─── Raw CTE row shape ────────────────────────────────────────────────────────

interface WalkRow {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  props: Prisma.JsonValue;
  hops: number;
  toType: string;
  toExternalId: string | null;
  toProps: Prisma.JsonValue;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractWeight(props: Prisma.JsonValue): number {
  if (typeof props === "object" && props !== null && !Array.isArray(props) && "weight" in props) {
    const w = (props as Record<string, unknown>).weight;
    return typeof w === "number" ? w : 0;
  }
  return 0;
}

function extractConfidence(props: Prisma.JsonValue): number {
  if (
    typeof props === "object" &&
    props !== null &&
    !Array.isArray(props) &&
    "confidence" in props
  ) {
    const c = (props as Record<string, unknown>).confidence;
    return typeof c === "number" ? c : 0;
  }
  return 0;
}

function extractSource(props: Prisma.JsonValue): string | undefined {
  if (typeof props === "object" && props !== null && !Array.isArray(props) && "source" in props) {
    const s = (props as Record<string, unknown>).source;
    return typeof s === "string" ? s : undefined;
  }
  return undefined;
}

function toEntityProps(props: Prisma.JsonValue): Record<string, unknown> {
  if (typeof props === "object" && props !== null && !Array.isArray(props)) {
    return props as Record<string, unknown>;
  }
  return {};
}

function rowToNeighbor(row: WalkRow): GraphNeighbor {
  return {
    entity: {
      id: row.toId,
      type: row.toType,
      externalId: row.toExternalId,
      props: toEntityProps(row.toProps),
    },
    edge: {
      id: row.id,
      type: row.type,
      fromId: row.fromId,
      toId: row.toId,
      weight: extractWeight(row.props),
      confidence: extractConfidence(row.props),
      source: extractSource(row.props),
    },
    hops: Number(row.hops),
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

const GRAPH_CACHE_TTL = 3_600;

/**
 * Resolve entity pelo par (type, externalId). Null se inexistente.
 */
export async function findEntity(type: string, externalId: string): Promise<GraphEntity | null> {
  logger.debug("[graph] findEntity", { type, externalId });

  const entity = await prisma.entity.findUnique({
    where: { type_externalId: { type, externalId } },
  });

  if (!entity) return null;

  return {
    id: entity.id,
    type: entity.type,
    externalId: entity.externalId,
    props: toEntityProps(entity.props),
  };
}

/**
 * Vizinhos diretos (1 hop) de uma entity, opcionalmente filtrando por tipo de aresta.
 */
export async function getNeighbors(
  entityId: string,
  opts?: { edgeType?: string; minWeight?: number; now?: Date },
): Promise<GraphNeighbor[]> {
  const now = opts?.now ?? new Date();

  logger.debug("[graph] getNeighbors", { entityId, edgeType: opts?.edgeType, now });

  const relationships = await prisma.relationship.findMany({
    where: {
      fromId: entityId,
      ...(opts?.edgeType ? { type: opts.edgeType } : {}),
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
    include: { to: true },
  });

  const neighbors: GraphNeighbor[] = relationships.reduce<GraphNeighbor[]>((acc, rel) => {
    const weight = extractWeight(rel.props);
    const confidence = extractConfidence(rel.props);

    if (opts?.minWeight !== undefined && Math.abs(weight) < opts.minWeight) {
      return acc;
    }

    const neighbor: GraphNeighbor = {
      entity: {
        id: rel.to.id,
        type: rel.to.type,
        externalId: rel.to.externalId,
        props: toEntityProps(rel.to.props),
      },
      edge: {
        id: rel.id,
        type: rel.type,
        fromId: rel.fromId,
        toId: rel.toId,
        weight,
        confidence,
        source: extractSource(rel.props),
      },
      hops: 1,
    };

    acc.push(neighbor);
    return acc;
  }, []);

  logger.debug("[graph] getNeighbors result", { entityId, count: neighbors.length });

  return neighbors;
}

/**
 * Traversal multi-hop via CTE recursivo. Max depth 3. Respeita validFrom/validUntil.
 */
export async function traverse(
  startEntityId: string,
  opts?: { maxHops?: number; edgeTypes?: string[]; now?: Date },
): Promise<GraphNeighbor[]> {
  const now = opts?.now ?? new Date();
  const maxHops = Math.min(opts?.maxHops ?? 3, 3);

  logger.debug("[graph] traverse", { startEntityId, maxHops, edgeTypes: opts?.edgeTypes, now });

  // CTE recursivo — note: edgeTypes filter é aplicado em post-processing para manter
  // o template SQL estático e compatível com pg's query plan cache.
  const rows = await prisma.$queryRaw<WalkRow[]>`
    WITH RECURSIVE walk AS (
      SELECT r.id, r."fromId", r."toId", r.type, r.props, 1 AS hops
        FROM "Relationship" r
       WHERE r."fromId" = ${startEntityId}
         AND (r."validUntil" IS NULL OR r."validUntil" > ${now})
         AND r."validFrom" <= ${now}
      UNION ALL
      SELECT r.id, r."fromId", r."toId", r.type, r.props, w.hops + 1
        FROM "Relationship" r
        JOIN walk w ON r."fromId" = w."toId"
       WHERE w.hops < ${maxHops}
         AND (r."validUntil" IS NULL OR r."validUntil" > ${now})
         AND r."validFrom" <= ${now}
    )
    SELECT w.*, e.type AS "toType", e."externalId" AS "toExternalId", e.props AS "toProps"
      FROM walk w
      JOIN "Entity" e ON e.id = w."toId"
  `;

  const filtered =
    opts?.edgeTypes && opts.edgeTypes.length > 0
      ? rows.filter((r) => opts.edgeTypes!.includes(r.type))
      : rows;

  const result = filtered.map(rowToNeighbor);

  logger.debug("[graph] traverse result", { startEntityId, count: result.length });

  return result;
}

// ─── Trade-offs & Synergies helpers ──────────────────────────────────────────

interface OdsRelationResult {
  fromOds: number;
  toOds: number;
  weight: number;
  confidence: number;
  source?: string;
}

async function _findOdsRelationships(
  odsNumbers: number[],
  relType: "TRADE_OFF" | "SINERGIA",
  now: Date,
): Promise<OdsRelationResult[]> {
  const externalIds = odsNumbers.map(String);

  const relationships = await prisma.relationship.findMany({
    where: {
      type: relType,
      from: { type: "ods", externalId: { in: externalIds } },
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
    include: { from: true, to: true },
  });

  return relationships
    .filter((rel) => rel.to.type === "ods" && rel.to.externalId !== null)
    .map((rel) => {
      const fromOds = parseInt(rel.from.externalId ?? "0", 10);
      const toOds = parseInt(rel.to.externalId ?? "0", 10);
      return {
        fromOds,
        toOds,
        weight: extractWeight(rel.props),
        confidence: extractConfidence(rel.props),
        source: extractSource(rel.props),
      };
    });
}

/**
 * Retorna todos os trade-offs ativos conectados a um conjunto de ODS numbers.
 * Cache Redis: graph:tradeoffs:{sorted_ods_csv}, TTL 3600s.
 */
export async function findTradeOffs(
  odsNumbers: number[],
  opts?: { now?: Date },
): Promise<OdsRelationResult[]> {
  const now = opts?.now ?? new Date();
  const sortedKey = [...odsNumbers].sort((a, b) => a - b).join(",");
  const cacheKey = `graph:tradeoffs:${sortedKey}`;

  logger.debug("[graph] findTradeOffs", { odsNumbers, cacheKey });

  return withCache(cacheKey, GRAPH_CACHE_TTL, () =>
    _findOdsRelationships(odsNumbers, "TRADE_OFF", now),
  );
}

/**
 * Retorna todas as sinergias ativas conectadas a um conjunto de ODS numbers.
 * Cache Redis: graph:synergies:{sorted_ods_csv}, TTL 3600s.
 */
export async function findSynergies(
  odsNumbers: number[],
  opts?: { now?: Date },
): Promise<OdsRelationResult[]> {
  const now = opts?.now ?? new Date();
  const sortedKey = [...odsNumbers].sort((a, b) => a - b).join(",");
  const cacheKey = `graph:synergies:${sortedKey}`;

  logger.debug("[graph] findSynergies", { odsNumbers, cacheKey });

  return withCache(cacheKey, GRAPH_CACHE_TTL, () =>
    _findOdsRelationships(odsNumbers, "SINERGIA", now),
  );
}
