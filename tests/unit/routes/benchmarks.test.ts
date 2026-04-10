import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Hoisted mocks (must be declared before any import that triggers the module) ─

const { mockGenerateBenchmark, mockCompareAgainstBenchmark } = vi.hoisted(() => ({
  mockGenerateBenchmark: vi.fn(),
  mockCompareAgainstBenchmark: vi.fn(),
}));

vi.mock("../../../backend/services/benchmarks/benchmark_service.js", () => ({
  generateBenchmark: mockGenerateBenchmark,
  compareAgainstBenchmark: mockCompareAgainstBenchmark,
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Auth middleware passthrough — testes unitários de rota não testam auth
vi.mock("../../../backend/middleware/auth.js", () => ({
  authenticateToken: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireMunicipalityScope: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Prisma mock — não utilizado diretamente pela rota, mas importado transitivamente
vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {
    municipality: { findUnique: vi.fn().mockResolvedValue({ name: "Blumenau" }) },
  },
}));

const { default: benchmarksRouter } = await import("../../../backend/routes/benchmarks.js");

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_IBGE_CODES = ["4204202", "4205407", "4209102"];

const MOCK_ODS_AVERAGES = Array.from({ length: 17 }, (_, i) => ({
  odsNumber: i + 1,
  average: 60,
  min: 40,
  max: 80,
  count: 3,
}));

const MOCK_MUNICIPALITY_BENCHMARK = {
  ibgeCode: "4204202",
  municipalityName: "Blumenau",
  globalScore: 65,
  globalStatus: "verde",
  odsScores: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i + 1, 65])),
};

const MOCK_BENCHMARK_RESULT = {
  generatedAt: "2026-04-06T00:00:00.000Z",
  referenceYear: 2023,
  municipalityCount: 3,
  municipalities: [
    MOCK_MUNICIPALITY_BENCHMARK,
    {
      ibgeCode: "4205407",
      municipalityName: "Florianópolis",
      globalScore: 70,
      globalStatus: "verde",
      odsScores: {},
    },
    {
      ibgeCode: "4209102",
      municipalityName: "Joinville",
      globalScore: 55,
      globalStatus: "amarelo",
      odsScores: {},
    },
  ],
  ranking: [
    { position: 1, ibgeCode: "4205407", municipalityName: "Florianópolis", globalScore: 70 },
    { position: 2, ibgeCode: "4204202", municipalityName: "Blumenau", globalScore: 65 },
    { position: 3, ibgeCode: "4209102", municipalityName: "Joinville", globalScore: 55 },
  ],
  averages: MOCK_ODS_AVERAGES,
  globalAverage: 63.3,
};

const MOCK_COMPARE_RESULT = {
  municipality: MOCK_MUNICIPALITY_BENCHMARK,
  benchmark: MOCK_BENCHMARK_RESULT,
  comparison: Array.from({ length: 17 }, (_, i) => ({
    odsNumber: i + 1,
    municipalityScore: 65,
    benchmarkAverage: 60,
    delta: 5,
    aboveAverage: true,
  })),
};

// ─── App factory ─────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/benchmarks", benchmarksRouter);
  return app;
}

// ─── POST /api/benchmarks ─────────────────────────────────────────────────────

describe("POST /api/benchmarks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateBenchmark.mockResolvedValue(MOCK_BENCHMARK_RESULT);
  });

  it("retorna 200 com resultado de benchmark para ibgeCodes válidos", async () => {
    const app = buildApp();

    const res = await request(app).post("/api/benchmarks").send({ ibgeCodes: VALID_IBGE_CODES });

    expect(res.status).toBe(200);
    expect(res.body.municipalityCount).toBe(3);
    expect(res.body.ranking).toHaveLength(3);
    expect(res.body.averages).toHaveLength(17);
    expect(mockGenerateBenchmark).toHaveBeenCalledOnce();
    expect(mockGenerateBenchmark).toHaveBeenCalledWith(VALID_IBGE_CODES);
  });

  it("retorna 400 quando ibgeCodes está vazio", async () => {
    const app = buildApp();

    const res = await request(app).post("/api/benchmarks").send({ ibgeCodes: [] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockGenerateBenchmark).not.toHaveBeenCalled();
  });

  it("retorna 400 quando ibgeCodes tem apenas um elemento (mínimo é 2)", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/benchmarks")
      .send({ ibgeCodes: ["4204202"] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockGenerateBenchmark).not.toHaveBeenCalled();
  });

  it("retorna 400 quando ibgeCode tem formato inválido (não são 7 dígitos)", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/benchmarks")
      .send({ ibgeCodes: ["42042", "4205407"] }); // primeiro tem apenas 5 dígitos

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockGenerateBenchmark).not.toHaveBeenCalled();
  });

  it("retorna 400 quando ibgeCode contém letras", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/benchmarks")
      .send({ ibgeCodes: ["abc4202", "4205407"] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockGenerateBenchmark).not.toHaveBeenCalled();
  });

  it("retorna 400 quando ibgeCodes está ausente no payload", async () => {
    const app = buildApp();

    const res = await request(app).post("/api/benchmarks").send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockGenerateBenchmark).not.toHaveBeenCalled();
  });

  it("retorna 500 quando generateBenchmark lança erro", async () => {
    mockGenerateBenchmark.mockRejectedValue(new Error("Timeout na API do IBGE"));
    const app = buildApp();

    const res = await request(app).post("/api/benchmarks").send({ ibgeCodes: VALID_IBGE_CODES });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Erro interno");
    expect(mockGenerateBenchmark).toHaveBeenCalledOnce();
  });
});

// ─── POST /api/benchmarks/compare ────────────────────────────────────────────

describe("POST /api/benchmarks/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompareAgainstBenchmark.mockResolvedValue(MOCK_COMPARE_RESULT);
  });

  it("retorna 200 com comparação para payload válido", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/benchmarks/compare")
      .send({
        ibgeCode: "4204202",
        benchmarkCodes: ["4205407", "4209102"],
      });

    expect(res.status).toBe(200);
    expect(res.body.municipality.ibgeCode).toBe("4204202");
    expect(res.body.comparison).toHaveLength(17);
    expect(mockCompareAgainstBenchmark).toHaveBeenCalledOnce();
    expect(mockCompareAgainstBenchmark).toHaveBeenCalledWith("4204202", ["4205407", "4209102"]);
  });

  it("retorna 400 quando ibgeCode está ausente", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/benchmarks/compare")
      .send({ benchmarkCodes: ["4205407", "4209102"] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockCompareAgainstBenchmark).not.toHaveBeenCalled();
  });

  it("retorna 400 quando ibgeCode tem formato inválido", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/benchmarks/compare")
      .send({
        ibgeCode: "420", // apenas 3 dígitos
        benchmarkCodes: ["4205407", "4209102"],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockCompareAgainstBenchmark).not.toHaveBeenCalled();
  });

  it("retorna 400 quando benchmarkCodes está vazio (mínimo é 1)", async () => {
    const app = buildApp();

    const res = await request(app).post("/api/benchmarks/compare").send({
      ibgeCode: "4204202",
      benchmarkCodes: [],
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockCompareAgainstBenchmark).not.toHaveBeenCalled();
  });

  it("retorna 400 quando benchmarkCodes está ausente", async () => {
    const app = buildApp();

    const res = await request(app).post("/api/benchmarks/compare").send({ ibgeCode: "4204202" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockCompareAgainstBenchmark).not.toHaveBeenCalled();
  });

  it("retorna 400 quando benchmarkCodes contém código com formato inválido", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/benchmarks/compare")
      .send({
        ibgeCode: "4204202",
        benchmarkCodes: ["abc1234", "4209102"],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockCompareAgainstBenchmark).not.toHaveBeenCalled();
  });

  it("retorna 500 quando compareAgainstBenchmark lança erro", async () => {
    mockCompareAgainstBenchmark.mockRejectedValue(new Error("DB connection lost"));
    const app = buildApp();

    const res = await request(app)
      .post("/api/benchmarks/compare")
      .send({
        ibgeCode: "4204202",
        benchmarkCodes: ["4205407", "4209102"],
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Erro interno");
    expect(mockCompareAgainstBenchmark).toHaveBeenCalledOnce();
  });
});
