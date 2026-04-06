/**
 * Testes unitários para backend/routes/municipalities.ts
 *
 * Estratégia de mock:
 * - prisma.$transaction — mockado via vi.hoisted para controlar o retorno de
 *   [findMany, count] nos testes de listagem.
 * - prisma.municipality.findUnique — mockado para o endpoint de detalhe.
 * - logger — stub vazio para remover efeitos colaterais de I/O.
 * - Sem auth middleware nessas rotas (rotas públicas).
 *
 * A rota é montada com prefixo /api/municipalities para espelhar o app real.
 *
 * Casos cobertos:
 * ✅ GET /  → 200 com lista paginada (defaults page=1, pageSize=50)
 * ✅ GET /  → 200 respeitando page e pageSize customizados
 * ✅ GET /  → 200 com array vazio quando banco não tem registros
 * ✅ GET /  → pageSize limitado ao máximo de 100 via schema Zod
 * ✅ GET /  → 500 quando $transaction lança exceção
 * ✅ GET /:ibgeCode → 200 com dados do município sem campo deletedAt
 * ✅ GET /:ibgeCode → 404 quando código não existe no banco (null)
 * ✅ GET /:ibgeCode → 404 quando município tem deletedAt preenchido (soft delete)
 * ✅ GET /:ibgeCode → 400 quando ibgeCode tem formato inválido (< ou > 7 dígitos, letras)
 * ✅ GET /:ibgeCode → 500 quando findUnique lança exceção
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_IBGE_CODE = "4205407"; // Florianópolis-SC

const municipalityDetailFixture = {
  ibgeCode: VALID_IBGE_CODE,
  siconfiCode: "420540",
  name: "Florianópolis",
  state: "SC",
  population: 508826,
  fpmAnnual: null,
  deletedAt: null,
};

const municipalityListFixture = [
  { ibgeCode: "4204202", name: "Blumenau", state: "SC", population: 362960 },
  { ibgeCode: VALID_IBGE_CODE, name: "Florianópolis", state: "SC", population: 508826 },
];

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const { mockTransaction, mockFindUnique } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {
    municipality: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: mockFindUnique,
    },
    $transaction: mockTransaction,
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

// ─── App de teste ─────────────────────────────────────────────────────────────

async function buildApp() {
  const { default: municipalitiesRouter } = await import(
    "../../../backend/routes/municipalities.js"
  );
  const app = express();
  app.use(express.json());
  app.use("/api/municipalities", municipalitiesRouter);
  return app;
}

// ─── GET /api/municipalities — lista paginada ─────────────────────────────────

describe("GET /api/municipalities", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com lista paginada usando defaults page=1 e pageSize=50", async () => {
    // Arrange
    mockTransaction.mockResolvedValue([municipalityListFixture, 2]);

    // Act
    const res = await request(app).get("/api/municipalities");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({ ibgeCode: "4204202", name: "Blumenau" }),
        expect.objectContaining({ ibgeCode: VALID_IBGE_CODE, name: "Florianópolis" }),
      ]),
      total: 2,
      page: 1,
      pageSize: 50,
    });
  });

  it("deve retornar 200 respeitando page e pageSize customizados na query string", async () => {
    // Arrange
    mockTransaction.mockResolvedValue([[municipalityListFixture[0]], 2]);

    // Act
    const res = await request(app).get("/api/municipalities?page=2&pageSize=10");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(10);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("deve retornar 200 com data vazio e total 0 quando não há municípios no banco", async () => {
    // Arrange
    mockTransaction.mockResolvedValue([[], 0]);

    // Act
    const res = await request(app).get("/api/municipalities");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("deve limitar pageSize ao máximo de 100 quando valor enviado é maior", async () => {
    // Arrange — pageSize=200 deve ser ignorado; Zod aplica max(100) e usa default 50
    mockTransaction.mockResolvedValue([municipalityListFixture, 2]);

    // Act
    const res = await request(app).get("/api/municipalities?pageSize=200");

    // Assert
    expect(res.status).toBe(200);
    // O schema Zod rejeita > 100 via safeParse e o código faz fallback para 50
    expect(res.body.pageSize).toBe(50);
  });

  it("deve retornar 500 quando $transaction lança exceção de banco de dados", async () => {
    // Arrange
    mockTransaction.mockRejectedValue(new Error("Connection refused"));

    // Act
    const res = await request(app).get("/api/municipalities");

    // Assert
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Erro interno ao listar/);
  });
});

// ─── GET /api/municipalities/:ibgeCode — detalhe ──────────────────────────────

describe("GET /api/municipalities/:ibgeCode", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com dados do município sem o campo deletedAt", async () => {
    // Arrange
    mockFindUnique.mockResolvedValue(municipalityDetailFixture);

    // Act
    const res = await request(app).get(`/api/municipalities/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      ibgeCode: VALID_IBGE_CODE,
      siconfiCode: "420540",
      name: "Florianópolis",
      state: "SC",
      population: 508826,
    });
    expect(res.body.data).not.toHaveProperty("deletedAt");
  });

  it("deve retornar 404 quando ibgeCode não existe no banco (findUnique retorna null)", async () => {
    // Arrange
    mockFindUnique.mockResolvedValue(null);

    // Act
    const res = await request(app).get("/api/municipalities/9999999");

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/9999999/);
  });

  it("deve retornar 404 quando município tem deletedAt preenchido (soft delete)", async () => {
    // Arrange — município logicamente excluído
    mockFindUnique.mockResolvedValue({
      ...municipalityDetailFixture,
      deletedAt: new Date("2024-06-01"),
    });

    // Act
    const res = await request(app).get(`/api/municipalities/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/não encontrado/);
  });

  it("deve retornar 400 quando ibgeCode tem 6 dígitos (formato SICONFI, não IBGE)", async () => {
    // Act
    const res = await request(app).get("/api/municipalities/420540");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/7 dígitos/);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCode contém letras", async () => {
    // Act
    const res = await request(app).get("/api/municipalities/420540X");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCode tem 8 dígitos (muito longo)", async () => {
    // Act
    const res = await request(app).get("/api/municipalities/42054070");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("deve retornar 500 quando findUnique lança exceção de banco de dados", async () => {
    // Arrange
    mockFindUnique.mockRejectedValue(new Error("DB timeout"));

    // Act
    const res = await request(app).get(`/api/municipalities/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Erro interno ao buscar/);
  });
});
