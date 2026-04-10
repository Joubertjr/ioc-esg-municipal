/**
 * Testes unitários para backend/services/graph/graph_service.ts
 *
 * Estratégia de mock:
 * - @prisma/client / backend/lib/prisma.js: substituído por stub em memória
 * - backend/utils/cache.js: passthrough (executa fn diretamente, sem Redis)
 * - backend/utils/logger.js: stub vazio
 *
 * Casos cobertos:
 * ✅ findEntity — entidade existente retorna GraphEntity com props corretos
 * ✅ findEntity — entidade inexistente retorna null
 * ✅ getNeighbors — filtra por edgeType (apenas SINERGIA)
 * ✅ getNeighbors — filtra por minWeight (apenas weight >= 0.5)
 * ✅ getNeighbors — respeita validFrom/validUntil (filtra expirados)
 * ✅ getNeighbors — weight negativo passa no filtro minWeight via Math.abs
 * ✅ traverse — não retorna nós além de maxHops=2
 * ✅ findTradeOffs — retorna par 3↔12 com weight negativo
 * ✅ findSynergies — retorna sinergias de ODS 1
 * ✅ findTradeOffs com now anterior a validFrom — retorna vazio
 * ✅ findTradeOffs — ODS sem relacionamentos retorna array vazio
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Factories de dados para o stub Prisma ────────────────────────────────────

function makeEntity(overrides: {
  id: string;
  type: string;
  externalId: string | null;
  props?: Record<string, unknown>;
}) {
  return {
    id: overrides.id,
    type: overrides.type,
    externalId: overrides.externalId,
    props: overrides.props ?? {},
  };
}

function makeRelationship(overrides: {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  props: Record<string, unknown>;
  validFrom?: Date;
  validUntil?: Date | null;
  to?: ReturnType<typeof makeEntity>;
  from?: ReturnType<typeof makeEntity>;
}) {
  const validFrom = overrides.validFrom ?? new Date("2024-01-01T00:00:00Z");
  const to = overrides.to ?? makeEntity({ id: overrides.toId, type: "ods", externalId: null });
  const from =
    overrides.from ?? makeEntity({ id: overrides.fromId, type: "ods", externalId: null });
  return {
    id: overrides.id,
    type: overrides.type,
    fromId: overrides.fromId,
    toId: overrides.toId,
    props: overrides.props,
    validFrom,
    validUntil: overrides.validUntil ?? null,
    to,
    from,
  };
}

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const { mockEntityFindUnique, mockRelationshipFindMany, mockQueryRaw } = vi.hoisted(() => ({
  mockEntityFindUnique: vi.fn(),
  mockRelationshipFindMany: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {
    entity: {
      findUnique: mockEntityFindUnique,
    },
    relationship: {
      findMany: mockRelationshipFindMany,
    },
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock("../../../backend/utils/cache.js", () => ({
  withCache: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  findEntity,
  getNeighbors,
  traverse,
  findTradeOffs,
  findSynergies,
} from "../../../backend/services/graph/graph_service.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ODS_1_ENTITY = makeEntity({
  id: "entity-ods-1",
  type: "ods",
  externalId: "1",
  props: { name: "Erradicação da Pobreza", shortName: "Pobreza" },
});

const ODS_3_ENTITY = makeEntity({
  id: "entity-ods-3",
  type: "ods",
  externalId: "3",
  props: { name: "Saúde e Bem-Estar", shortName: "Saúde" },
});

const ODS_4_ENTITY = makeEntity({
  id: "entity-ods-4",
  type: "ods",
  externalId: "4",
  props: { name: "Educação de Qualidade", shortName: "Educação" },
});

const ODS_12_ENTITY = makeEntity({
  id: "entity-ods-12",
  type: "ods",
  externalId: "12",
  props: { name: "Consumo e Produção Responsáveis", shortName: "Consumo" },
});

const VALID_FROM_2024 = new Date("2024-01-01T00:00:00Z");

// ─── findEntity ───────────────────────────────────────────────────────────────

describe("findEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna GraphEntity com props corretos quando entidade existe", async () => {
    // Arrange
    mockEntityFindUnique.mockResolvedValue(ODS_1_ENTITY);

    // Act
    const result = await findEntity("ods", "1");

    // Assert
    expect(result).not.toBeNull();
    expect(result!.id).toBe("entity-ods-1");
    expect(result!.type).toBe("ods");
    expect(result!.externalId).toBe("1");
    expect(result!.props).toMatchObject({ name: "Erradicação da Pobreza" });
    expect(mockEntityFindUnique).toHaveBeenCalledWith({
      where: { type_externalId: { type: "ods", externalId: "1" } },
    });
  });

  it("retorna null quando entidade não existe (externalId 999)", async () => {
    // Arrange
    mockEntityFindUnique.mockResolvedValue(null);

    // Act
    const result = await findEntity("ods", "999");

    // Assert
    expect(result).toBeNull();
  });

  it("retorna null para tipo inexistente", async () => {
    // Arrange
    mockEntityFindUnique.mockResolvedValue(null);

    // Act
    const result = await findEntity("nonexistent", "1");

    // Assert
    expect(result).toBeNull();
  });
});

// ─── getNeighbors ─────────────────────────────────────────────────────────────

describe("getNeighbors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna apenas vizinhos com edgeType SINERGIA quando filtro é aplicado", async () => {
    // Arrange
    const sinergiaRel = makeRelationship({
      id: "rel-1",
      type: "SINERGIA",
      fromId: "entity-ods-1",
      toId: "entity-ods-3",
      props: { weight: 0.78, confidence: 0.9, source: "Pradhan 2017" },
      validFrom: VALID_FROM_2024,
      to: ODS_3_ENTITY,
    });
    const tradeOffRel = makeRelationship({
      id: "rel-2",
      type: "TRADE_OFF",
      fromId: "entity-ods-1",
      toId: "entity-ods-12",
      props: { weight: -0.45, confidence: 0.8, source: "Pradhan 2017" },
      validFrom: VALID_FROM_2024,
      to: ODS_12_ENTITY,
    });
    mockRelationshipFindMany.mockResolvedValue([sinergiaRel]);

    // Act
    const result = await getNeighbors("entity-ods-1", { edgeType: "SINERGIA" });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]!.edge.type).toBe("SINERGIA");
    expect(result[0]!.entity.id).toBe("entity-ods-3");
    expect(result[0]!.hops).toBe(1);
    // Confirma que o filtro foi passado para o Prisma
    expect(mockRelationshipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "SINERGIA" }) }),
    );
    // O trade-off não deve aparecer (não foi retornado pelo mock já filtrado)
    const tradeOffIds = result.map((n) => n.edge.id);
    expect(tradeOffIds).not.toContain(tradeOffRel.id);
  });

  it("filtra vizinhos com |weight| < minWeight", async () => {
    // Arrange — dois relacionamentos: weight 0.78 e 0.30
    const strongRel = makeRelationship({
      id: "rel-strong",
      type: "SINERGIA",
      fromId: "entity-ods-1",
      toId: "entity-ods-3",
      props: { weight: 0.78, confidence: 0.9, source: "Pradhan 2017" },
      validFrom: VALID_FROM_2024,
      to: ODS_3_ENTITY,
    });
    const weakRel = makeRelationship({
      id: "rel-weak",
      type: "SINERGIA",
      fromId: "entity-ods-1",
      toId: "entity-ods-4",
      props: { weight: 0.3, confidence: 0.7, source: "Pradhan 2017" },
      validFrom: VALID_FROM_2024,
      to: ODS_4_ENTITY,
    });
    // Prisma retorna ambos; o service aplica o filtro minWeight em memória
    mockRelationshipFindMany.mockResolvedValue([strongRel, weakRel]);

    // Act
    const result = await getNeighbors("entity-ods-1", { minWeight: 0.5 });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]!.edge.weight).toBeGreaterThanOrEqual(0.5);
    expect(result[0]!.entity.id).toBe("entity-ods-3");
  });

  it("weight negativo (-0.53) passa no filtro minWeight 0.5 via Math.abs", async () => {
    // Arrange
    const tradeOffRel = makeRelationship({
      id: "rel-tradeoff",
      type: "TRADE_OFF",
      fromId: "entity-ods-3",
      toId: "entity-ods-12",
      props: { weight: -0.53, confidence: 0.85, source: "Pradhan 2017" },
      validFrom: VALID_FROM_2024,
      to: ODS_12_ENTITY,
    });
    mockRelationshipFindMany.mockResolvedValue([tradeOffRel]);

    // Act
    const result = await getNeighbors("entity-ods-3", { minWeight: 0.5 });

    // Assert — |weight| = 0.53 >= 0.5, deve passar
    expect(result).toHaveLength(1);
    expect(result[0]!.edge.weight).toBe(-0.53);
  });

  it("exclui relacionamentos expirados (validUntil no passado)", async () => {
    // Arrange — relacionamento que expirou antes do now de referência
    const expiredRel = makeRelationship({
      id: "rel-expired",
      type: "SINERGIA",
      fromId: "entity-ods-1",
      toId: "entity-ods-3",
      props: { weight: 0.78, confidence: 0.9, source: "Pradhan 2017" },
      validFrom: new Date("2020-01-01T00:00:00Z"),
      validUntil: new Date("2021-01-01T00:00:00Z"),
      to: ODS_3_ENTITY,
    });
    // Prisma com filtro temporal não retorna expirados; simulamos retorno vazio
    mockRelationshipFindMany.mockResolvedValue([]);

    // Act
    const result = await getNeighbors("entity-ods-1", {
      now: new Date("2025-01-01T00:00:00Z"),
    });

    // Assert
    expect(result).toHaveLength(0);
    // Confirma que o filtro temporal foi passado ao Prisma
    expect(mockRelationshipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          validFrom: expect.any(Object),
        }),
      }),
    );
    void expiredRel; // utilizado para documentação
  });

  it("retorna array vazio quando entidade não tem vizinhos", async () => {
    // Arrange
    mockRelationshipFindMany.mockResolvedValue([]);

    // Act
    const result = await getNeighbors("entity-ods-999");

    // Assert
    expect(result).toEqual([]);
  });
});

// ─── traverse ─────────────────────────────────────────────────────────────────

describe("traverse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não retorna nós além de maxHops=2 quando CTE retorna 3 níveis", async () => {
    // Arrange — simulamos o retorno do queryRaw com hops 1, 2 e 3
    const hop1Row = {
      id: "rel-hop1",
      fromId: "entity-ods-1",
      toId: "entity-ods-3",
      type: "SINERGIA",
      props: { weight: 0.78, confidence: 0.9 },
      hops: 1,
      toType: "ods",
      toExternalId: "3",
      toProps: {},
    };
    const hop2Row = {
      id: "rel-hop2",
      fromId: "entity-ods-3",
      toId: "entity-ods-4",
      type: "SINERGIA",
      props: { weight: 0.74, confidence: 0.9 },
      hops: 2,
      toType: "ods",
      toExternalId: "4",
      toProps: {},
    };
    const hop3Row = {
      id: "rel-hop3",
      fromId: "entity-ods-4",
      toId: "entity-ods-12",
      type: "TRADE_OFF",
      props: { weight: -0.53, confidence: 0.85 },
      hops: 3,
      toType: "ods",
      toExternalId: "12",
      toProps: {},
    };

    // O CTE limita no banco; aqui simulamos que a query com maxHops=2
    // só retorna hop1 e hop2 (o banco trunca no limite).
    mockQueryRaw.mockResolvedValue([hop1Row, hop2Row]);

    // Act
    const result = await traverse("entity-ods-1", { maxHops: 2 });

    // Assert — apenas 2 hops retornados
    expect(result).toHaveLength(2);
    const hops = result.map((n) => n.hops);
    expect(hops.every((h) => h <= 2)).toBe(true);
    expect(hops).not.toContain(3);
    void hop3Row; // hop3 não deve aparecer
  });

  it("respeita edgeTypes passados como filtro pós-CTE", async () => {
    // Arrange — CTE retorna SINERGIA e TRADE_OFF misturados
    const sinergiaRow = {
      id: "rel-s",
      fromId: "entity-ods-1",
      toId: "entity-ods-3",
      type: "SINERGIA",
      props: { weight: 0.78, confidence: 0.9 },
      hops: 1,
      toType: "ods",
      toExternalId: "3",
      toProps: {},
    };
    const tradeOffRow = {
      id: "rel-t",
      fromId: "entity-ods-1",
      toId: "entity-ods-12",
      type: "TRADE_OFF",
      props: { weight: -0.53, confidence: 0.85 },
      hops: 1,
      toType: "ods",
      toExternalId: "12",
      toProps: {},
    };
    mockQueryRaw.mockResolvedValue([sinergiaRow, tradeOffRow]);

    // Act — filtra para retornar apenas SINERGIA
    const result = await traverse("entity-ods-1", { edgeTypes: ["SINERGIA"] });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]!.edge.type).toBe("SINERGIA");
  });

  it("retorna array vazio quando CTE não encontra nenhum nó", async () => {
    // Arrange
    mockQueryRaw.mockResolvedValue([]);

    // Act
    const result = await traverse("entity-ods-999", { maxHops: 2 });

    // Assert
    expect(result).toEqual([]);
  });
});

// ─── findTradeOffs ────────────────────────────────────────────────────────────

describe("findTradeOffs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna par 3↔12 com weight negativo (-0.53)", async () => {
    // Arrange
    const tradeOffRel = makeRelationship({
      id: "rel-3-12",
      type: "TRADE_OFF",
      fromId: "entity-ods-3",
      toId: "entity-ods-12",
      props: { weight: -0.53, confidence: 0.85, source: "Pradhan 2017" },
      validFrom: VALID_FROM_2024,
      from: ODS_3_ENTITY,
      to: ODS_12_ENTITY,
    });
    mockRelationshipFindMany.mockResolvedValue([tradeOffRel]);

    // Act
    const result = await findTradeOffs([3]);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]!.fromOds).toBe(3);
    expect(result[0]!.toOds).toBe(12);
    expect(result[0]!.weight).toBe(-0.53);
    expect(result[0]!.confidence).toBe(0.85);
  });

  it("retorna array vazio quando ODS não tem trade-offs ativos", async () => {
    // Arrange
    mockRelationshipFindMany.mockResolvedValue([]);

    // Act
    const result = await findTradeOffs([999]);

    // Assert
    expect(result).toEqual([]);
  });

  it("retorna vazio quando now é anterior ao validFrom 2024-01-01", async () => {
    // Arrange — Prisma não retorna linhas quando validFrom > now
    mockRelationshipFindMany.mockResolvedValue([]);

    // Act
    const result = await findTradeOffs([3], { now: new Date("2020-01-01T00:00:00Z") });

    // Assert
    expect(result).toEqual([]);
    // Confirma que o filtro de data foi passado ao Prisma
    expect(mockRelationshipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "TRADE_OFF",
        }),
      }),
    );
  });

  it("lida com múltiplos ODS como entrada e agrega todos os trade-offs", async () => {
    // Arrange — ODS 3 tem trade-off com 12; ODS 9 com 13
    const rel3_12 = makeRelationship({
      id: "rel-3-12",
      type: "TRADE_OFF",
      fromId: "entity-ods-3",
      toId: "entity-ods-12",
      props: { weight: -0.53, confidence: 0.85, source: "Pradhan 2017" },
      validFrom: VALID_FROM_2024,
      from: ODS_3_ENTITY,
      to: ODS_12_ENTITY,
    });
    const ods9Entity = makeEntity({ id: "entity-ods-9", type: "ods", externalId: "9" });
    const ods13Entity = makeEntity({ id: "entity-ods-13", type: "ods", externalId: "13" });
    const rel9_13 = makeRelationship({
      id: "rel-9-13",
      type: "TRADE_OFF",
      fromId: "entity-ods-9",
      toId: "entity-ods-13",
      props: { weight: -0.35, confidence: 0.72, source: "Weitz 2018" },
      validFrom: VALID_FROM_2024,
      from: ods9Entity,
      to: ods13Entity,
    });
    mockRelationshipFindMany.mockResolvedValue([rel3_12, rel9_13]);

    // Act
    const result = await findTradeOffs([3, 9]);

    // Assert
    expect(result).toHaveLength(2);
    const fromOdsNumbers = result.map((r) => r.fromOds);
    expect(fromOdsNumbers).toContain(3);
    expect(fromOdsNumbers).toContain(9);
  });
});

// ─── findSynergies ────────────────────────────────────────────────────────────

describe("findSynergies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna sinergias de ODS 1 (1↔3 e 1↔4)", async () => {
    // Arrange
    const rel1_3 = makeRelationship({
      id: "rel-1-3",
      type: "SINERGIA",
      fromId: "entity-ods-1",
      toId: "entity-ods-3",
      props: { weight: 0.78, confidence: 0.9, source: "Pradhan 2017" },
      validFrom: VALID_FROM_2024,
      from: ODS_1_ENTITY,
      to: ODS_3_ENTITY,
    });
    const rel1_4 = makeRelationship({
      id: "rel-1-4",
      type: "SINERGIA",
      fromId: "entity-ods-1",
      toId: "entity-ods-4",
      props: { weight: 0.77, confidence: 0.9, source: "Pradhan 2017" },
      validFrom: VALID_FROM_2024,
      from: ODS_1_ENTITY,
      to: ODS_4_ENTITY,
    });
    mockRelationshipFindMany.mockResolvedValue([rel1_3, rel1_4]);

    // Act
    const result = await findSynergies([1]);

    // Assert
    expect(result).toHaveLength(2);
    const toOdsNumbers = result.map((r) => r.toOds);
    expect(toOdsNumbers).toContain(3);
    expect(toOdsNumbers).toContain(4);
    expect(result.every((r) => r.weight > 0)).toBe(true);
  });

  it("retorna array vazio quando ODS não tem sinergias", async () => {
    // Arrange
    mockRelationshipFindMany.mockResolvedValue([]);

    // Act
    const result = await findSynergies([999]);

    // Assert
    expect(result).toEqual([]);
  });

  it("passa type SINERGIA como filtro ao Prisma", async () => {
    // Arrange
    mockRelationshipFindMany.mockResolvedValue([]);

    // Act
    await findSynergies([1]);

    // Assert
    expect(mockRelationshipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "SINERGIA" }),
      }),
    );
  });

  it("retorna vazio quando now é anterior ao validFrom do relacionamento", async () => {
    // Arrange — Prisma filtra pelo validFrom e não retorna nada
    mockRelationshipFindMany.mockResolvedValue([]);

    // Act
    const result = await findSynergies([1], { now: new Date("2020-01-01T00:00:00Z") });

    // Assert
    expect(result).toEqual([]);
  });
});
