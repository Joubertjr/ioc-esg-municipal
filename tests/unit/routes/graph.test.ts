/**
 * Testes unitários para backend/routes/graph.ts
 *
 * Estratégia de mock:
 * - graph_service.js: todos os exports mockados para isolar a rota dos serviços
 * - ppr_service.js: personalizedPageRank mockado
 * - cache.js: passthrough
 * - logger.js: stub vazio
 * - auth middleware: passthrough (testes unitários de rota não validam auth)
 *
 * A rota é montada localmente com express() sem auth para testes unitários.
 * Testes de autenticação (401) verificam o comportamento sem o middleware bypass.
 *
 * Casos cobertos:
 * ✅ GET /api/graph/neighbors sem type/externalId → 400 (zod)
 * ✅ GET /api/graph/neighbors?type=ods&externalId=abc → 404 quando entidade não existe
 * ✅ GET /api/graph/neighbors?type=ods&externalId=1 → 200 com shape correto
 * ✅ GET /api/graph/neighbors com minWeight inválido → 400
 * ✅ GET /api/graph/synergies?ods=1 → 200 com array de sinergias
 * ✅ GET /api/graph/synergies?ods=abc → 400 (zod — não é número inteiro)
 * ✅ GET /api/graph/synergies sem parâmetro ods → 400
 * ✅ GET /api/graph/tradeoffs?ods=3 → 200 com array de trade-offs
 * ✅ POST /api/graph/ppr body { seeds: ["ods:1"] } → 200 quando seed resolve
 * ✅ POST /api/graph/ppr com seeds vazio → 400 (zod)
 * ✅ POST /api/graph/ppr com seed que não resolve → 404
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const {
  mockFindEntity,
  mockGetNeighbors,
  mockFindSynergies,
  mockFindTradeOffs,
  mockPersonalizedPageRank,
} = vi.hoisted(() => ({
  mockFindEntity: vi.fn(),
  mockGetNeighbors: vi.fn(),
  mockFindSynergies: vi.fn(),
  mockFindTradeOffs: vi.fn(),
  mockPersonalizedPageRank: vi.fn(),
}));

vi.mock("../../../backend/services/graph/graph_service.js", () => ({
  findEntity: mockFindEntity,
  getNeighbors: mockGetNeighbors,
  findSynergies: mockFindSynergies,
  findTradeOffs: mockFindTradeOffs,
}));

vi.mock("../../../backend/services/graph/ppr_service.js", () => ({
  personalizedPageRank: mockPersonalizedPageRank,
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../../backend/utils/cache.js", () => ({
  withCache: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
}));

// Prisma mock — graph_service.ts importa prisma.js; sem mock o PrismaClient
// tentaria conectar ao banco e abortaria o processo em ambiente de teste.
vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {
    entity: {
      findUnique: vi.fn(),
    },
    relationship: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ODS_1_ENTITY = {
  id: "entity-ods-1",
  type: "ods",
  externalId: "1",
  props: { name: "Erradicação da Pobreza", shortName: "Pobreza" },
};

const NEIGHBOR_ODS_3 = {
  entity: {
    id: "entity-ods-3",
    type: "ods",
    externalId: "3",
    props: {},
  },
  edge: {
    id: "rel-1-3",
    type: "SINERGIA",
    fromId: "entity-ods-1",
    toId: "entity-ods-3",
    weight: 0.78,
    confidence: 0.9,
    source: "Pradhan 2017",
  },
  hops: 1,
};

// ─── App de teste ─────────────────────────────────────────────────────────────

async function buildApp() {
  const { default: graphRouter } = await import("../../../backend/routes/graph.js");
  const app = express();
  app.use(express.json());
  app.use("/api/graph", graphRouter);
  return app;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: express.Express;

beforeAll(async () => {
  app = await buildApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/graph/neighbors — validação de query ───────────────────────────

describe("GET /api/graph/neighbors — validação", () => {
  it("retorna 400 quando type está ausente", async () => {
    // Act
    const res = await request(app).get("/api/graph/neighbors?externalId=1");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockGetNeighbors).not.toHaveBeenCalled();
  });

  it("retorna 400 quando externalId está ausente", async () => {
    // Act
    const res = await request(app).get("/api/graph/neighbors?type=ods");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockGetNeighbors).not.toHaveBeenCalled();
  });

  it("retorna 400 quando minWeight é maior que 1", async () => {
    // Act
    const res = await request(app).get("/api/graph/neighbors?type=ods&externalId=1&minWeight=2");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockGetNeighbors).not.toHaveBeenCalled();
  });

  it("retorna 404 quando entity não existe", async () => {
    // Arrange
    mockFindEntity.mockResolvedValue(null);

    // Act
    const res = await request(app).get("/api/graph/neighbors?type=ods&externalId=999");

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Entity não encontrada/i);
  });
});

// ─── GET /api/graph/neighbors — resposta 200 ─────────────────────────────────

describe("GET /api/graph/neighbors — resposta", () => {
  it("retorna 200 com shape correto (entity + neighbors + total)", async () => {
    // Arrange
    mockFindEntity.mockResolvedValue(ODS_1_ENTITY);
    mockGetNeighbors.mockResolvedValue([NEIGHBOR_ODS_3]);

    // Act
    const res = await request(app).get("/api/graph/neighbors?type=ods&externalId=1");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      entity: { id: "entity-ods-1", type: "ods", externalId: "1" },
      total: 1,
      neighbors: expect.any(Array),
    });
    expect(res.body.neighbors).toHaveLength(1);
    expect(res.body.neighbors[0]).toMatchObject({
      entity: { id: "entity-ods-3" },
      edge: { type: "SINERGIA", weight: 0.78 },
      hops: 1,
    });
  });

  it("retorna 200 com neighbors vazio quando entidade existe sem vizinhos", async () => {
    // Arrange
    mockFindEntity.mockResolvedValue(ODS_1_ENTITY);
    mockGetNeighbors.mockResolvedValue([]);

    // Act
    const res = await request(app).get("/api/graph/neighbors?type=ods&externalId=1");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.neighbors).toEqual([]);
  });

  it("passa edgeType e minWeight para getNeighbors", async () => {
    // Arrange
    mockFindEntity.mockResolvedValue(ODS_1_ENTITY);
    mockGetNeighbors.mockResolvedValue([]);

    // Act
    await request(app).get(
      "/api/graph/neighbors?type=ods&externalId=1&edgeType=SINERGIA&minWeight=0.5",
    );

    // Assert
    expect(mockGetNeighbors).toHaveBeenCalledWith(
      "entity-ods-1",
      expect.objectContaining({ edgeType: "SINERGIA", minWeight: 0.5 }),
    );
  });
});

// ─── GET /api/graph/synergies ─────────────────────────────────────────────────

describe("GET /api/graph/synergies", () => {
  it("retorna 400 quando parâmetro ods está ausente", async () => {
    // Act
    const res = await request(app).get("/api/graph/synergies");

    // Assert
    expect(res.status).toBe(400);
    expect(mockFindSynergies).not.toHaveBeenCalled();
  });

  it("retorna 400 quando ods contém valor não numérico (abc)", async () => {
    // Act
    const res = await request(app).get("/api/graph/synergies?ods=abc");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockFindSynergies).not.toHaveBeenCalled();
  });

  it("retorna 400 quando ods contém número fora do range 1-17 (ods=18)", async () => {
    // Act
    const res = await request(app).get("/api/graph/synergies?ods=18");

    // Assert
    expect(res.status).toBe(400);
    expect(mockFindSynergies).not.toHaveBeenCalled();
  });

  it("retorna 200 com array de sinergias para ods=1", async () => {
    // Arrange
    const synergies = [
      { fromOds: 1, toOds: 3, weight: 0.78, confidence: 0.9, source: "Pradhan 2017" },
      { fromOds: 1, toOds: 4, weight: 0.77, confidence: 0.9, source: "Pradhan 2017" },
    ];
    mockFindSynergies.mockResolvedValue(synergies);

    // Act
    const res = await request(app).get("/api/graph/synergies?ods=1");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      odsNumbers: [1],
      total: 2,
      synergies: expect.any(Array),
    });
    expect(res.body.synergies).toHaveLength(2);
    expect(mockFindSynergies).toHaveBeenCalledWith([1]);
  });

  it("aceita CSV de ODS (ods=1,3,4)", async () => {
    // Arrange
    mockFindSynergies.mockResolvedValue([]);

    // Act
    const res = await request(app).get("/api/graph/synergies?ods=1,3,4");

    // Assert
    expect(res.status).toBe(200);
    expect(mockFindSynergies).toHaveBeenCalledWith([1, 3, 4]);
  });
});

// ─── GET /api/graph/tradeoffs ─────────────────────────────────────────────────

describe("GET /api/graph/tradeoffs", () => {
  it("retorna 200 com trade-offs para ods=3", async () => {
    // Arrange
    const tradeoffs = [
      { fromOds: 3, toOds: 12, weight: -0.53, confidence: 0.85, source: "Pradhan 2017" },
    ];
    mockFindTradeOffs.mockResolvedValue(tradeoffs);

    // Act
    const res = await request(app).get("/api/graph/tradeoffs?ods=3");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      odsNumbers: [3],
      total: 1,
      tradeoffs: expect.any(Array),
    });
    expect(res.body.tradeoffs[0]).toMatchObject({
      fromOds: 3,
      toOds: 12,
      weight: -0.53,
    });
    expect(mockFindTradeOffs).toHaveBeenCalledWith([3]);
  });

  it("retorna 400 quando ods está ausente", async () => {
    // Act
    const res = await request(app).get("/api/graph/tradeoffs");

    // Assert
    expect(res.status).toBe(400);
    expect(mockFindTradeOffs).not.toHaveBeenCalled();
  });
});

// ─── POST /api/graph/ppr ──────────────────────────────────────────────────────

describe("POST /api/graph/ppr", () => {
  it("retorna 400 quando seeds está vazio", async () => {
    // Act
    const res = await request(app).post("/api/graph/ppr").send({ seeds: [] });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockPersonalizedPageRank).not.toHaveBeenCalled();
  });

  it("retorna 400 quando body não contém seeds", async () => {
    // Act
    const res = await request(app).post("/api/graph/ppr").send({});

    // Assert
    expect(res.status).toBe(400);
    expect(mockPersonalizedPageRank).not.toHaveBeenCalled();
  });

  it("retorna 404 quando nenhum seed resolve para entity válida", async () => {
    // Arrange — seed "ods:999" não existe no grafo
    mockFindEntity.mockResolvedValue(null);

    // Act
    const res = await request(app)
      .post("/api/graph/ppr")
      .send({ seeds: ["ods:999"] });

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Nenhum seed resolvido/i);
    expect(mockPersonalizedPageRank).not.toHaveBeenCalled();
  });

  it("retorna 200 com resultados PPR quando seed resolve para entity válida", async () => {
    // Arrange
    mockFindEntity.mockResolvedValue(ODS_1_ENTITY);
    const pprResults = [
      { entityId: "entity-ods-1", score: 0.85, type: "ods", externalId: "1" },
      { entityId: "entity-ods-3", score: 0.42, type: "ods", externalId: "3" },
    ];
    mockPersonalizedPageRank.mockResolvedValue(pprResults);

    // Act
    const res = await request(app)
      .post("/api/graph/ppr")
      .send({ seeds: ["ods:1"] });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      seeds: ["ods:1"],
      resolvedSeeds: 1,
      total: 2,
      results: expect.any(Array),
    });
    expect(res.body.results).toHaveLength(2);
    expect(mockPersonalizedPageRank).toHaveBeenCalledWith(["entity-ods-1"], expect.any(Object));
  });

  it("seed sem prefixo ':' é tratado como entity id direto", async () => {
    // Arrange — seed sem ':', passa diretamente como entity id
    mockPersonalizedPageRank.mockResolvedValue([]);

    // Act
    const res = await request(app)
      .post("/api/graph/ppr")
      .send({ seeds: ["entity-ods-1"] });

    // Assert
    expect(res.status).toBe(200);
    // Entity id direto é passado sem chamada ao findEntity
    expect(mockFindEntity).not.toHaveBeenCalled();
    expect(mockPersonalizedPageRank).toHaveBeenCalledWith(["entity-ods-1"], expect.any(Object));
  });

  it("aceita iterations e dampingFactor customizados", async () => {
    // Arrange
    mockFindEntity.mockResolvedValue(ODS_1_ENTITY);
    mockPersonalizedPageRank.mockResolvedValue([]);

    // Act
    const res = await request(app)
      .post("/api/graph/ppr")
      .send({
        seeds: ["ods:1"],
        iterations: 20,
        dampingFactor: 0.9,
      });

    // Assert
    expect(res.status).toBe(200);
    expect(mockPersonalizedPageRank).toHaveBeenCalledWith(
      ["entity-ods-1"],
      expect.objectContaining({ iterations: 20, dampingFactor: 0.9 }),
    );
  });

  it("retorna 400 quando iterations excede máximo (50)", async () => {
    // Act
    const res = await request(app)
      .post("/api/graph/ppr")
      .send({
        seeds: ["ods:1"],
        iterations: 100,
      });

    // Assert
    expect(res.status).toBe(400);
    expect(mockPersonalizedPageRank).not.toHaveBeenCalled();
  });
});
