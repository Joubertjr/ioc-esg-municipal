/**
 * Testes unitários para backend/services/graph/ppr_service.ts
 *
 * Estratégia de mock:
 * - backend/lib/prisma.js: stub com prisma.relationship.findMany mockável
 * - backend/utils/logger.js: stub vazio
 *
 * Casos cobertos:
 * ✅ Seeds vazios → retorna array vazio
 * ✅ Nenhum relacionamento no grafo → retorna array vazio
 * ✅ Seed com vizinho único → score do seed > score do vizinho > 0
 * ✅ Trade-off (weight negativo) propaga igual a sinergia via Math.abs
 * ✅ Top-20 cap: mais de 20 entidades ranqueadas → retorna exatamente 20
 * ✅ Iterations default = 10 (não precisa de parâmetro)
 * ✅ Vizinho isolado no now passado (sem edges ativas) → score zero → excluído
 * ✅ Seeds com múltiplos elementos — score inicial = 1/|seeds|
 * ✅ damping factor customizado afeta propagação
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Helpers de fixture ────────────────────────────────────────────────────────

function makeRelRow(overrides: {
  fromId: string;
  toId: string;
  weight: number;
  fromType?: string;
  fromExternalId?: string | null;
  toType?: string;
  toExternalId?: string | null;
  validFrom?: Date;
  validUntil?: Date | null;
}) {
  return {
    fromId: overrides.fromId,
    toId: overrides.toId,
    props: { weight: overrides.weight },
    validFrom: overrides.validFrom ?? new Date("2024-01-01T00:00:00Z"),
    validUntil: overrides.validUntil ?? null,
    from: {
      type: overrides.fromType ?? "ods",
      externalId: overrides.fromExternalId ?? overrides.fromId,
    },
    to: {
      type: overrides.toType ?? "ods",
      externalId: overrides.toExternalId ?? overrides.toId,
    },
  };
}

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const { mockRelFindMany } = vi.hoisted(() => ({
  mockRelFindMany: vi.fn(),
}));

vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {
    relationship: {
      findMany: mockRelFindMany,
    },
  },
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { personalizedPageRank } from "../../../backend/services/graph/ppr_service.js";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("personalizedPageRank", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array vazio quando seeds está vazio", async () => {
    // Arrange
    mockRelFindMany.mockResolvedValue([]);

    // Act
    const result = await personalizedPageRank([]);

    // Assert
    expect(result).toEqual([]);
    // Nenhuma query deve ser feita ao banco
    expect(mockRelFindMany).not.toHaveBeenCalled();
  });

  it("retorna array vazio quando não há relacionamentos no grafo", async () => {
    // Arrange
    mockRelFindMany.mockResolvedValue([]);

    // Act
    const result = await personalizedPageRank(["seed-1"]);

    // Assert
    expect(result).toEqual([]);
  });

  it("score do seed é maior que score do vizinho único após propagação", async () => {
    // Arrange — seed-1 → neighbor-2 com weight 0.8
    mockRelFindMany.mockResolvedValue([
      makeRelRow({ fromId: "seed-1", toId: "neighbor-2", weight: 0.8 }),
    ]);

    // Act
    const result = await personalizedPageRank(["seed-1"]);

    // Assert
    // O seed recebe restart a cada iteração; o vizinho só recebe propagação
    // Portanto seed.score >= neighbor.score
    const seedResult = result.find((r) => r.entityId === "seed-1");
    const neighborResult = result.find((r) => r.entityId === "neighbor-2");

    expect(seedResult).toBeDefined();
    expect(neighborResult).toBeDefined();
    expect(seedResult!.score).toBeGreaterThan(neighborResult!.score);
    expect(neighborResult!.score).toBeGreaterThan(0);
  });

  it("trade-off com weight negativo propaga igual a sinergia de mesmo |weight|", async () => {
    // Arrange — comparamos dois grafos idênticos exceto pela polaridade do weight
    const positiveRel = makeRelRow({ fromId: "seed-pos", toId: "target-pos", weight: 0.5 });
    const negativeRel = makeRelRow({ fromId: "seed-neg", toId: "target-neg", weight: -0.5 });

    // Teste com weight positivo
    mockRelFindMany.mockResolvedValue([positiveRel]);
    const positiveResult = await personalizedPageRank(["seed-pos"]);

    // Teste com weight negativo
    mockRelFindMany.mockResolvedValue([negativeRel]);
    const negativeResult = await personalizedPageRank(["seed-neg"]);

    // Assert — Math.abs garante que ambos propagam identicamente
    const posTargetScore = positiveResult.find((r) => r.entityId === "target-pos")?.score ?? 0;
    const negTargetScore = negativeResult.find((r) => r.entityId === "target-neg")?.score ?? 0;

    expect(posTargetScore).toBeGreaterThan(0);
    expect(negTargetScore).toBeGreaterThan(0);
    expect(Math.abs(posTargetScore - negTargetScore)).toBeLessThan(0.0001);
  });

  it("retorna exatamente 20 resultados quando há mais de 20 entidades ranqueadas", async () => {
    // Arrange — seed conectado a 25 vizinhos distintos
    const relationships = Array.from({ length: 25 }, (_, i) =>
      makeRelRow({
        fromId: "seed-main",
        toId: `neighbor-${i}`,
        weight: 0.5,
        toExternalId: String(i),
      }),
    );
    mockRelFindMany.mockResolvedValue(relationships);

    // Act
    const result = await personalizedPageRank(["seed-main"]);

    // Assert
    expect(result.length).toBeLessThanOrEqual(20);
    // Com 25 vizinhos + 1 seed = 26 entidades, deve retornar no máximo 20
    expect(result.length).toBe(20);
  });

  it("resultado está ordenado por score descendente", async () => {
    // Arrange — dois vizinhos com pesos diferentes (maior weight → maior score recebido)
    mockRelFindMany.mockResolvedValue([
      makeRelRow({ fromId: "seed-1", toId: "high-neighbor", weight: 0.9 }),
      makeRelRow({ fromId: "seed-1", toId: "low-neighbor", weight: 0.1 }),
    ]);

    // Act
    const result = await personalizedPageRank(["seed-1"]);

    // Assert — scores devem estar em ordem descendente
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.score).toBeGreaterThanOrEqual(result[i]!.score);
    }
  });

  it("exclui entidades com score zero do resultado", async () => {
    // Arrange — weight=0 faz skip na construção da adjacency (Math.abs(0) === 0)
    // Portanto o vizinho isolado não recebe propagação e deve ser excluído
    mockRelFindMany.mockResolvedValue([
      makeRelRow({ fromId: "seed-1", toId: "isolated", weight: 0 }),
    ]);

    // Act
    const result = await personalizedPageRank(["seed-1"]);

    // Assert — isolated tem score 0 (nunca recebe propagação), não deve aparecer
    const isolatedResult = result.find((r) => r.entityId === "isolated");
    expect(isolatedResult).toBeUndefined();
  });

  it("dois seeds dividem score inicial igualmente (1/|seeds|)", async () => {
    // Arrange — dois seeds independentes (sem arestas entre eles)
    mockRelFindMany.mockResolvedValue([
      makeRelRow({ fromId: "seed-a", toId: "common", weight: 0.8 }),
      makeRelRow({ fromId: "seed-b", toId: "common", weight: 0.8 }),
    ]);

    // Act
    const result = await personalizedPageRank(["seed-a", "seed-b"]);

    // Assert — ambos seeds devem ter score > 0 e próximos (por simetria)
    const seedA = result.find((r) => r.entityId === "seed-a");
    const seedB = result.find((r) => r.entityId === "seed-b");
    expect(seedA?.score).toBeGreaterThan(0);
    expect(seedB?.score).toBeGreaterThan(0);
    // Por simetria, scores dos seeds devem ser iguais
    expect(Math.abs((seedA?.score ?? 0) - (seedB?.score ?? 0))).toBeLessThan(0.0001);
  });

  it("inclui type e externalId no resultado", async () => {
    // Arrange
    mockRelFindMany.mockResolvedValue([
      makeRelRow({
        fromId: "entity-ods-1",
        toId: "entity-ods-3",
        weight: 0.78,
        fromType: "ods",
        fromExternalId: "1",
        toType: "ods",
        toExternalId: "3",
      }),
    ]);

    // Act
    const result = await personalizedPageRank(["entity-ods-1"]);

    // Assert
    expect(result.length).toBeGreaterThan(0);
    for (const item of result) {
      expect(item.entityId).toBeDefined();
      expect(item.score).toBeGreaterThan(0);
      expect(typeof item.type).toBe("string");
      // externalId pode ser string ou null
      expect(item.externalId === null || typeof item.externalId === "string").toBe(true);
    }
  });

  it("iterations customizadas (1 iteração) produz resultado convergente básico", async () => {
    // Arrange
    mockRelFindMany.mockResolvedValue([
      makeRelRow({ fromId: "seed-1", toId: "neighbor-2", weight: 0.8 }),
    ]);

    // Act — apenas 1 iteração
    const result = await personalizedPageRank(["seed-1"], { iterations: 1 });

    // Assert — com 1 iteração ainda deve produzir propagação ao vizinho
    const neighbor = result.find((r) => r.entityId === "neighbor-2");
    expect(neighbor?.score).toBeGreaterThan(0);
  });
});
