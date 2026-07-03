/**
 * Testes unitários para backend/routes/ods.ts
 *
 * Estratégia de mock:
 * - calculateMunicipalOds — mockado via vi.mock para isolar a rota do
 *   serviço de orquestração, que por sua vez depende de 6 coletores externos.
 * - logger e batchLimiter mockados para remover efeitos colaterais.
 *
 * A rota é montada com prefixo /api/ods para espelhar o registro real do app.
 *
 * Casos cobertos: código válido → 200, código inválido → 400,
 *   sem dados → 404, compare com array válido → 200,
 *   compare com array vazio/insuficiente → 400.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { MunicipalOdsReport } from "../../../backend/services/ods/ods_score_service.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_IBGE_CODE = "4204202"; // Blumenau-SC
const VALID_IBGE_CODE_2 = "4205407"; // Florianópolis-SC

const municipalOdsReportFactory = (
  ibgeCode: string,
  overrides: Partial<MunicipalOdsReport> = {},
): MunicipalOdsReport => ({
  ibgeCode,
  municipalityName: null,
  referenceYear: 2023,
  globalScore: 65,
  globalStatus: "amarelo",
  odsCount: { total: 17, withData: 6, verde: 2, amarelo: 3, vermelho: 1 },
  ods: [],
  ...overrides,
});

// ─── Mocks dos módulos ────────────────────────────────────────────────────────

const mockCalculateMunicipalOds = vi.fn();
const mockCalculateAndPersistScores = vi.fn();
const mockGetScoreHistory = vi.fn();

vi.mock("../../../backend/services/ods/index.js", () => ({
  calculateMunicipalOds: mockCalculateMunicipalOds,
}));

vi.mock("../../../backend/services/ods/ods_history_service.js", () => ({
  calculateAndPersistScores: mockCalculateAndPersistScores,
  getScoreHistory: mockGetScoreHistory,
  assessComparability: vi.fn().mockReturnValue({ comparable: true, reason: "mock" }),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// batchLimiter substituído por middleware passthrough para não bloquear testes
vi.mock("../../../backend/middleware/rate-limit.js", () => ({
  batchLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Auth middleware passthrough — testes unitários de rota não testam auth
vi.mock("../../../backend/middleware/auth.js", () => ({
  authenticateToken: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireMunicipalityScope: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Prisma mock — por padrão simula município existente; testes individuais podem sobrescrever
vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {
    municipality: {
      findUnique: vi.fn().mockResolvedValue({ name: "Chapecó" }),
      findMany: vi.fn().mockResolvedValue([
        { ibgeCode: "4204202", name: "Blumenau" },
        { ibgeCode: "4205407", name: "Florianópolis" },
      ]),
    },
  },
}));

// withCache mock — execute fn directly
vi.mock("../../../backend/utils/cache.js", () => ({
  withCache: (_key: string, _ttl: number, fn: () => unknown) => fn(),
}));

// Referência ao mock Prisma para sobrescrever em testes individuais
const { prisma: mockPrisma } = await import("../../../backend/lib/prisma.js");
const mockFindUnique = vi.mocked(mockPrisma.municipality.findUnique);
const mockFindMany = vi.mocked(mockPrisma.municipality.findMany);

// ─── App de teste ─────────────────────────────────────────────────────────────

async function buildApp() {
  const { default: odsRouter } = await import("../../../backend/routes/ods.js");
  const app = express();
  app.use(express.json());
  app.use("/api/ods", odsRouter);
  return app;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("GET /api/ods/:ibgeCode", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Padrão: persistência fire-and-forget resolve sem erros
    mockCalculateAndPersistScores.mockResolvedValue(null);
    app = await buildApp();
  });

  it("deve retornar 200 com relatório ODS consolidado quando código IBGE válido", async () => {
    // Arrange
    const report = municipalOdsReportFactory(VALID_IBGE_CODE);
    mockCalculateMunicipalOds.mockResolvedValue(report);

    // Act
    const res = await request(app).get(`/api/ods/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ibgeCode: VALID_IBGE_CODE,
      globalScore: 65,
      globalStatus: "amarelo",
    });
    expect(mockCalculateMunicipalOds).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve chamar calculateAndPersistScores de forma fire-and-forget após retornar 200", async () => {
    // Arrange
    const report = municipalOdsReportFactory(VALID_IBGE_CODE);
    mockCalculateMunicipalOds.mockResolvedValue(report);

    // Act
    const res = await request(app).get(`/api/ods/${VALID_IBGE_CODE}`);

    // Assert — resposta não é bloqueada; persistência deve ser acionada
    expect(res.status).toBe(200);
    // Aguarda microtasks do fire-and-forget para que o mock seja registrado
    await Promise.resolve();
    expect(mockCalculateAndPersistScores).toHaveBeenCalledWith(
      VALID_IBGE_CODE,
      expect.objectContaining({ ibgeCode: VALID_IBGE_CODE }),
    );
  });

  it("não deve chamar calculateAndPersistScores quando não há dados (404)", async () => {
    // Arrange
    mockCalculateMunicipalOds.mockResolvedValue(null);

    // Act
    const res = await request(app).get(`/api/ods/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(404);
    expect(mockCalculateAndPersistScores).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando código IBGE tem menos de 7 dígitos", async () => {
    // Act
    const res = await request(app).get("/api/ods/420420");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("7 dígitos") });
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });

  it("deve retornar 404 quando calculateMunicipalOds retorna null (nenhuma fonte tem dados)", async () => {
    // Arrange
    mockCalculateMunicipalOds.mockResolvedValue(null);

    // Act
    const res = await request(app).get(`/api/ods/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining(VALID_IBGE_CODE) });
  });

  it("deve retornar 404 para município inexistente SEM chamar calculateMunicipalOds (bug: score 98 para 0000000)", async () => {
    // Arrange — simula município não cadastrado no seed
    mockFindUnique.mockResolvedValueOnce(null);

    // Act
    const res = await request(app).get("/api/ods/0000000");

    // Assert — deve ser rejeitado na guarda do DB, antes de acionar coletores
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining("0000000") });
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/ods/compare", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCalculateAndPersistScores.mockResolvedValue(null);
    app = await buildApp();
  });

  it("deve retornar 200 com comparativo quando array contém ao menos 2 municípios válidos", async () => {
    // Arrange
    mockCalculateMunicipalOds
      .mockResolvedValueOnce(municipalOdsReportFactory(VALID_IBGE_CODE))
      .mockResolvedValueOnce(municipalOdsReportFactory(VALID_IBGE_CODE_2));

    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .send({ ibgeCodes: [VALID_IBGE_CODE, VALID_IBGE_CODE_2] });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 2,
      found: 2,
      comparison: expect.arrayContaining([
        expect.objectContaining({ ibgeCode: VALID_IBGE_CODE }),
        expect.objectContaining({ ibgeCode: VALID_IBGE_CODE_2 }),
      ]),
    });
    expect(mockCalculateMunicipalOds).toHaveBeenCalledTimes(2);
  });

  it("deve retornar 400 quando ibgeCodes é array vazio", async () => {
    // Act
    const res = await request(app).post("/api/ods/compare").send({ ibgeCodes: [] });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("ao menos 2") });
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCodes tem apenas 1 elemento (insuficiente para comparação)", async () => {
    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .send({ ibgeCodes: [VALID_IBGE_CODE] });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("ao menos 2") });
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCodes tem mais de 10 municípios", async () => {
    // Arrange — 11 códigos de 7 dígitos
    const codes = Array.from({ length: 11 }, (_, i) => String(4200000 + i).padStart(7, "0"));

    // Act
    const res = await request(app).post("/api/ods/compare").send({ ibgeCodes: codes });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("10") });
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });

  it("deve retornar 404 quando um dos ibgeCodes não existe no banco SEM chamar calculateMunicipalOds", async () => {
    // Arrange — findMany retorna somente um dos dois códigos (0000000 não existe)
    mockFindMany.mockResolvedValueOnce([{ ibgeCode: VALID_IBGE_CODE, name: "Blumenau" }]);

    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .send({ ibgeCodes: [VALID_IBGE_CODE, "0000000"] });

    // Assert — 404 antes de acionar coletores
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining("0000000") });
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/ods/:ibgeCode/history", () => {
  let app: express.Express;

  const historyFixture = [
    {
      id: "rec-1",
      municipalityId: "mun-1",
      odsNumber: 1,
      score: 72,
      status: "verde",
      indicatorCount: 3,
      referenceYear: 2023,
      sources: ["ibge"],
      calculatedAt: new Date("2024-01-01").toISOString(),
    },
    {
      id: "rec-2",
      municipalityId: "mun-1",
      odsNumber: 0,
      score: 65,
      status: "amarelo",
      indicatorCount: 6,
      referenceYear: 2023,
      sources: ["global"],
      calculatedAt: new Date("2024-01-01").toISOString(),
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCalculateAndPersistScores.mockResolvedValue(null);
    app = await buildApp();
  });

  it("deve retornar 200 com histórico completo quando ibgeCode válido", async () => {
    // Arrange
    mockGetScoreHistory.mockResolvedValue(historyFixture);

    // Act
    const res = await request(app).get(`/api/ods/${VALID_IBGE_CODE}/history`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ibgeCode: VALID_IBGE_CODE,
      total: 2,
      history: expect.arrayContaining([
        expect.objectContaining({ odsNumber: 1, score: 72 }),
        expect.objectContaining({ odsNumber: 0, score: 65 }),
      ]),
    });
    expect(mockGetScoreHistory).toHaveBeenCalledWith(VALID_IBGE_CODE, undefined);
  });

  it("deve filtrar por odsNumber quando query param odsNumber é fornecido", async () => {
    // Arrange
    const filtered = [historyFixture[0]];
    mockGetScoreHistory.mockResolvedValue(filtered);

    // Act
    const res = await request(app).get(`/api/ods/${VALID_IBGE_CODE}/history?odsNumber=1`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1 });
    expect(mockGetScoreHistory).toHaveBeenCalledWith(VALID_IBGE_CODE, 1);
  });

  it("deve retornar 200 com histórico vazio quando município não tem registros", async () => {
    // Arrange
    mockGetScoreHistory.mockResolvedValue([]);

    // Act
    const res = await request(app).get(`/api/ods/${VALID_IBGE_CODE}/history`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ibgeCode: VALID_IBGE_CODE, total: 0, history: [] });
  });

  it("deve retornar 400 quando código IBGE tem menos de 7 dígitos", async () => {
    // Act
    const res = await request(app).get("/api/ods/420420/history");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("7 dígitos") });
    expect(mockGetScoreHistory).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando odsNumber é maior que 17", async () => {
    // Act
    const res = await request(app).get(`/api/ods/${VALID_IBGE_CODE}/history?odsNumber=18`);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("0 e 17") });
    expect(mockGetScoreHistory).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando odsNumber é negativo", async () => {
    // Act
    const res = await request(app).get(`/api/ods/${VALID_IBGE_CODE}/history?odsNumber=-1`);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("0 e 17") });
    expect(mockGetScoreHistory).not.toHaveBeenCalled();
  });

  it("deve retornar 500 quando getScoreHistory lança exceção", async () => {
    // Arrange
    mockGetScoreHistory.mockRejectedValue(new Error("DB offline"));

    // Act
    const res = await request(app).get(`/api/ods/${VALID_IBGE_CODE}/history`);

    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("histórico") });
  });
});
