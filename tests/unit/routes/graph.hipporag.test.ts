/**
 * Testes unitários para os novos endpoints HippoRAG em backend/routes/graph.ts:
 *   POST /api/graph/query
 *   POST /api/graph/similar
 *
 * Estratégia de mock:
 * - hipporag_service.js: semanticSearch e findSimilarEntities mockados
 * - graph_service.js, ppr_service.js: mockados (necessários para importação da rota)
 * - cache.js: passthrough
 * - logger.js: stub vazio
 *
 * Express app montado localmente sem auth para testes unitários de rota.
 *
 * Casos cobertos (POST /api/graph/query):
 * ✅ 200 com body válido { query, topK, alpha } → chama semanticSearch, retorna { query, total, results }
 * ✅ 200 com somente { query } mínimo (topK e alpha opcionais)
 * ✅ 400 quando query está ausente
 * ✅ 400 quando query tem menos de 3 caracteres
 * ✅ 400 quando query tem mais de 500 caracteres
 * ✅ 400 quando topK > 50
 * ✅ 400 quando alpha < 0
 * ✅ 400 quando alpha > 1
 * ✅ 500 quando semanticSearch lança erro → { error: "Erro interno ao executar busca semântica" }
 *
 * Casos cobertos (POST /api/graph/similar):
 * ✅ 200 com body válido { query, topK, entityTypeFilter }
 * ✅ 200 com somente { query }
 * ✅ 400 quando query está ausente
 * ✅ 400 quando query tem menos de 3 caracteres
 * ✅ 400 quando query tem mais de 500 caracteres
 * ✅ 400 quando topK > 50
 * ✅ 500 quando findSimilarEntities lança erro → { error: "Erro interno ao buscar similares" }
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const {
  mockSemanticSearch,
  mockFindSimilarEntities,
  mockFindEntity,
  mockGetNeighbors,
  mockFindSynergies,
  mockFindTradeOffs,
  mockPpr,
} = vi.hoisted(() => ({
  mockSemanticSearch: vi.fn(),
  mockFindSimilarEntities: vi.fn(),
  mockFindEntity: vi.fn(),
  mockGetNeighbors: vi.fn(),
  mockFindSynergies: vi.fn(),
  mockFindTradeOffs: vi.fn(),
  mockPpr: vi.fn(),
}));

vi.mock("../../../backend/services/graph/hipporag_service.js", () => ({
  semanticSearch: mockSemanticSearch,
  findSimilarEntities: mockFindSimilarEntities,
}));

vi.mock("../../../backend/services/graph/graph_service.js", () => ({
  findEntity: mockFindEntity,
  getNeighbors: mockGetNeighbors,
  findSynergies: mockFindSynergies,
  findTradeOffs: mockFindTradeOffs,
}));

vi.mock("../../../backend/services/graph/ppr_service.js", () => ({
  personalizedPageRank: mockPpr,
}));

vi.mock("../../../backend/utils/cache.js", () => ({
  withCache: vi
    .fn()
    .mockImplementation(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import graphRouter from "../../../backend/routes/graph.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api/graph", graphRouter);
  return app;
}

function makeHippoResult(
  overrides: Partial<{
    entityId: string;
    type: string;
    externalId: string | null;
    semanticScore: number;
    structuralScore: number;
    finalScore: number;
    props: Record<string, unknown>;
  }> = {},
) {
  return {
    entityId: overrides.entityId ?? "entity-1",
    type: overrides.type ?? "ods",
    externalId: overrides.externalId ?? "1",
    semanticScore: overrides.semanticScore ?? 0.9,
    structuralScore: overrides.structuralScore ?? 0.5,
    finalScore: overrides.finalScore ?? 0.7,
    props: overrides.props ?? {},
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: Express;

beforeAll(() => {
  app = buildApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests: POST /api/graph/query ─────────────────────────────────────────────

describe("POST /api/graph/query", () => {
  describe("respostas de sucesso (200)", () => {
    it("retorna { query, total, results } com body completo válido", async () => {
      // Arrange
      const fakeResults = [
        makeHippoResult({ entityId: "ods-1" }),
        makeHippoResult({ entityId: "ods-2" }),
      ];
      mockSemanticSearch.mockResolvedValue(fakeResults);

      // Act
      const res = await request(app)
        .post("/api/graph/query")
        .send({ query: "como melhorar saneamento básico?", topK: 5, alpha: 0.5 });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        query: "como melhorar saneamento básico?",
        total: 2,
        results: expect.arrayContaining([
          expect.objectContaining({ entityId: "ods-1" }),
          expect.objectContaining({ entityId: "ods-2" }),
        ]),
      });
    });

    it("funciona com somente o campo query (topK e alpha são opcionais)", async () => {
      // Arrange
      mockSemanticSearch.mockResolvedValue([makeHippoResult()]);

      // Act
      const res = await request(app).post("/api/graph/query").send({ query: "educação municipal" });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it("chama semanticSearch com os parâmetros corretos do body", async () => {
      // Arrange
      mockSemanticSearch.mockResolvedValue([]);

      // Act
      await request(app)
        .post("/api/graph/query")
        .send({ query: "saúde infantil", topK: 8, alpha: 0.3, entityTypeFilter: "ods" });

      // Assert
      expect(mockSemanticSearch).toHaveBeenCalledWith(
        "saúde infantil",
        expect.objectContaining({ topK: 8, alpha: 0.3, entityTypeFilter: "ods" }),
      );
    });

    it("retorna total=0 e results=[] quando semanticSearch retorna vazio", async () => {
      // Arrange
      mockSemanticSearch.mockResolvedValue([]);

      // Act
      const res = await request(app)
        .post("/api/graph/query")
        .send({ query: "query sem resultados" });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 0, results: [] });
    });
  });

  describe("validação (400)", () => {
    it("retorna 400 quando query está ausente", async () => {
      const res = await request(app).post("/api/graph/query").send({ topK: 5 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("retorna 400 quando query tem menos de 3 caracteres", async () => {
      const res = await request(app).post("/api/graph/query").send({ query: "ab" });
      expect(res.status).toBe(400);
    });

    it("retorna 400 quando query tem exatamente 2 caracteres (boundary)", async () => {
      const res = await request(app).post("/api/graph/query").send({ query: "ab" });
      expect(res.status).toBe(400);
    });

    it("retorna 200 quando query tem exatamente 3 caracteres (boundary válido)", async () => {
      mockSemanticSearch.mockResolvedValue([]);
      const res = await request(app).post("/api/graph/query").send({ query: "abc" });
      expect(res.status).toBe(200);
    });

    it("retorna 400 quando query tem mais de 500 caracteres", async () => {
      const longQuery = "a".repeat(501);
      const res = await request(app).post("/api/graph/query").send({ query: longQuery });
      expect(res.status).toBe(400);
    });

    it("retorna 200 quando query tem exatamente 500 caracteres (boundary válido)", async () => {
      mockSemanticSearch.mockResolvedValue([]);
      const maxQuery = "a".repeat(500);
      const res = await request(app).post("/api/graph/query").send({ query: maxQuery });
      expect(res.status).toBe(200);
    });

    it("retorna 400 quando topK > 50", async () => {
      const res = await request(app)
        .post("/api/graph/query")
        .send({ query: "query válida", topK: 51 });
      expect(res.status).toBe(400);
    });

    it("retorna 200 quando topK = 50 (boundary válido)", async () => {
      mockSemanticSearch.mockResolvedValue([]);
      const res = await request(app)
        .post("/api/graph/query")
        .send({ query: "query válida", topK: 50 });
      expect(res.status).toBe(200);
    });

    it("retorna 400 quando alpha < 0", async () => {
      const res = await request(app)
        .post("/api/graph/query")
        .send({ query: "query válida", alpha: -0.1 });
      expect(res.status).toBe(400);
    });

    it("retorna 400 quando alpha > 1", async () => {
      const res = await request(app)
        .post("/api/graph/query")
        .send({ query: "query válida", alpha: 1.1 });
      expect(res.status).toBe(400);
    });

    it("retorna 400 quando body está completamente vazio", async () => {
      const res = await request(app).post("/api/graph/query").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("erro interno (500)", () => {
    it("retorna 500 quando semanticSearch lança erro", async () => {
      // Arrange
      mockSemanticSearch.mockRejectedValue(new Error("falha interna"));

      // Act
      const res = await request(app)
        .post("/api/graph/query")
        .send({ query: "query que causa erro" });

      // Assert
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Erro interno ao executar busca semântica");
    });

    it("não expõe detalhes do erro interno no body de 500", async () => {
      // Arrange
      mockSemanticSearch.mockRejectedValue(new Error("stack trace sensível"));

      // Act
      const res = await request(app).post("/api/graph/query").send({ query: "query teste" });

      // Assert
      expect(res.body.error).not.toContain("stack trace sensível");
    });
  });
});

// ─── Tests: POST /api/graph/similar ──────────────────────────────────────────

describe("POST /api/graph/similar", () => {
  describe("respostas de sucesso (200)", () => {
    it("retorna { query, total, results } com body completo válido", async () => {
      // Arrange
      const fakeResults = [makeHippoResult({ entityId: "municipio-1", type: "municipio" })];
      mockFindSimilarEntities.mockResolvedValue(fakeResults);

      // Act
      const res = await request(app)
        .post("/api/graph/similar")
        .send({ query: "municípios com bom IDEB", topK: 3, entityTypeFilter: "municipio" });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        query: "municípios com bom IDEB",
        total: 1,
        results: expect.arrayContaining([expect.objectContaining({ entityId: "municipio-1" })]),
      });
    });

    it("funciona com somente o campo query (topK e entityTypeFilter são opcionais)", async () => {
      // Arrange
      mockFindSimilarEntities.mockResolvedValue([]);

      // Act
      const res = await request(app)
        .post("/api/graph/similar")
        .send({ query: "saneamento básico" });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
    });

    it("chama findSimilarEntities com os parâmetros corretos do body", async () => {
      // Arrange
      mockFindSimilarEntities.mockResolvedValue([]);

      // Act
      await request(app)
        .post("/api/graph/similar")
        .send({ query: "educação básica", topK: 7, entityTypeFilter: "ods" });

      // Assert
      expect(mockFindSimilarEntities).toHaveBeenCalledWith(
        "educação básica",
        expect.objectContaining({ topK: 7, entityTypeFilter: "ods" }),
      );
    });

    it("retorna total=0 e results=[] quando findSimilarEntities retorna vazio", async () => {
      // Arrange
      mockFindSimilarEntities.mockResolvedValue([]);

      // Act
      const res = await request(app)
        .post("/api/graph/similar")
        .send({ query: "sem resultados aqui" });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 0, results: [] });
    });
  });

  describe("validação (400)", () => {
    it("retorna 400 quando query está ausente", async () => {
      const res = await request(app).post("/api/graph/similar").send({ topK: 3 });
      expect(res.status).toBe(400);
    });

    it("retorna 400 quando query tem menos de 3 caracteres", async () => {
      const res = await request(app).post("/api/graph/similar").send({ query: "xy" });
      expect(res.status).toBe(400);
    });

    it("retorna 200 quando query tem exatamente 3 caracteres (boundary válido)", async () => {
      mockFindSimilarEntities.mockResolvedValue([]);
      const res = await request(app).post("/api/graph/similar").send({ query: "abc" });
      expect(res.status).toBe(200);
    });

    it("retorna 400 quando query tem mais de 500 caracteres", async () => {
      const longQuery = "b".repeat(501);
      const res = await request(app).post("/api/graph/similar").send({ query: longQuery });
      expect(res.status).toBe(400);
    });

    it("retorna 200 quando query tem exatamente 500 caracteres (boundary válido)", async () => {
      mockFindSimilarEntities.mockResolvedValue([]);
      const res = await request(app)
        .post("/api/graph/similar")
        .send({ query: "b".repeat(500) });
      expect(res.status).toBe(200);
    });

    it("retorna 400 quando topK > 50", async () => {
      const res = await request(app)
        .post("/api/graph/similar")
        .send({ query: "query válida", topK: 51 });
      expect(res.status).toBe(400);
    });

    it("retorna 200 quando topK = 1 (boundary mínimo válido)", async () => {
      mockFindSimilarEntities.mockResolvedValue([]);
      const res = await request(app)
        .post("/api/graph/similar")
        .send({ query: "query válida", topK: 1 });
      expect(res.status).toBe(200);
    });

    it("retorna 400 quando body está vazio", async () => {
      const res = await request(app).post("/api/graph/similar").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("erro interno (500)", () => {
    it("retorna 500 quando findSimilarEntities lança erro", async () => {
      // Arrange
      mockFindSimilarEntities.mockRejectedValue(new Error("falha no serviço"));

      // Act
      const res = await request(app)
        .post("/api/graph/similar")
        .send({ query: "query que causa erro" });

      // Assert
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Erro interno ao buscar similares");
    });

    it("não expõe detalhes do erro interno no body de 500", async () => {
      // Arrange
      mockFindSimilarEntities.mockRejectedValue(new Error("credencial vazada"));

      // Act
      const res = await request(app).post("/api/graph/similar").send({ query: "query teste" });

      // Assert
      expect(res.body.error).not.toContain("credencial vazada");
    });
  });
});
