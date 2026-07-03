/**
 * Testes de integração para os endpoints de benchmarks
 * Rotas: POST /api/benchmarks, POST /api/benchmarks/compare
 *
 * Estratégia de mock:
 * - generateBenchmark e compareAgainstBenchmark: mockados para isolar as
 *   rotas do serviço — controla retorno por cenário sem dependência externa
 * - @prisma/client: substituído por instância em memória
 * - logger e agentes: stubs vazios
 *
 * Casos cobertos:
 * ✅ POST /api/benchmarks → 401 sem token
 * ✅ POST /api/benchmarks → 200 com dados de benchmark para ibgeCodes válido
 * ✅ POST /api/benchmarks → 400 com menos de 2 códigos
 * ✅ POST /api/benchmarks → 400 com body sem ibgeCodes
 * ✅ POST /api/benchmarks → 400 com código de formato inválido
 * ✅ POST /api/benchmarks/compare → 401 sem token
 * ✅ POST /api/benchmarks/compare → 200 com dados de comparação
 * ✅ POST /api/benchmarks/compare → 400 sem ibgeCode principal
 * ✅ POST /api/benchmarks/compare → 400 sem benchmarkCodes
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import type { BenchmarkResult } from "../../../backend/services/benchmarks/benchmark_service.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JWT_SECRET = "test-secret-for-integration-tests-minimum-length";

const VALID_IBGE_CODE = "4205407"; // Florianópolis-SC
const VALID_IBGE_CODE_2 = "4204202"; // Blumenau-SC

const benchmarkResultFixture: BenchmarkResult = {
  generatedAt: new Date().toISOString(),
  referenceYear: 2023,
  municipalityCount: 2,
  municipalities: [
    {
      ibgeCode: VALID_IBGE_CODE,
      municipalityName: "Florianópolis",
      globalScore: 72,
      globalStatus: "verde",
      odsScores: {},
    },
    {
      ibgeCode: VALID_IBGE_CODE_2,
      municipalityName: "Blumenau",
      globalScore: 58,
      globalStatus: "amarelo",
      odsScores: {},
    },
  ],
  ranking: [
    { position: 1, ibgeCode: VALID_IBGE_CODE, municipalityName: "Florianópolis", globalScore: 72 },
    { position: 2, ibgeCode: VALID_IBGE_CODE_2, municipalityName: "Blumenau", globalScore: 58 },
  ],
  averages: [],
  globalAverage: 65,
};

const compareResultFixture = {
  ibgeCode: VALID_IBGE_CODE,
  municipalityName: "Florianópolis",
  globalScore: 72,
  globalStatus: "verde",
  benchmarkAverage: 65,
  delta: 7,
};

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const { mockGenerateBenchmark, mockCompareAgainstBenchmark } = vi.hoisted(() => ({
  mockGenerateBenchmark: vi.fn(),
  mockCompareAgainstBenchmark: vi.fn(),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../backend/services/benchmarks/benchmark_service.js", () => ({
  generateBenchmark: mockGenerateBenchmark,
  compareAgainstBenchmark: mockCompareAgainstBenchmark,
}));

vi.mock("@prisma/client", () => {
  return {
    PrismaClient: vi.fn(() => ({
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(1),
      },
      municipality: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn().mockResolvedValue([[], 0]),
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    })),
  };
});

// Agentes externos — stubs vazios
vi.mock("../../../backend/agents/ibge/index.js", () => ({
  IbgeCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/siconfi/index.js", () => ({
  SiconfiCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/datasus/index.js", () => ({
  DatasusCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/inep/index.js", () => ({
  InepCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/snis/index.js", () => ({
  SnisCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/inpe/index.js", () => ({
  InpeCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/pncp/index.js", () => ({
  PncpCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/tse/index.js", () => ({
  TseCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/aneel/index.js", () => ({
  AneelCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/snis_rs/index.js", () => ({
  SnisRsCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/ana/index.js", () => ({
  AnaCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/convenios/index.js", () => ({
  ConveniosCollector: vi
    .fn()
    .mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/anatel/index.js", () => ({
  AnatelCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/sisvan/index.js", () => ({
  SisvanCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../shared/data/tse_2024.json", () => ({ default: [] }));
vi.mock("../../../shared/data/aneel_gd_2023.json", () => ({ default: [] }));
vi.mock("../../../shared/data/snis_rs_2022.json", () => ({ default: [] }));
vi.mock("../../../shared/data/ana_2022.json", () => ({ default: [] }));
vi.mock("../../../shared/data/convenios_2023.json", () => ({ default: [] }));
vi.mock("../../../shared/data/anatel_2023.json", () => ({ default: [] }));
vi.mock("../../../shared/data/sisvan_2023.json", () => ({ default: [] }));
vi.mock("../../../backend/services/ods/index.js", () => ({
  calculateMunicipalOds: vi.fn().mockResolvedValue(null),
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: Express;
let validToken: string;

beforeAll(async () => {
  process.env["JWT_SECRET"] = JWT_SECRET;

  validToken = jwt.sign(
    {
      sub: "user-test-uuid",
      email: "prefeito@florianopolis.sc.gov.br",
      role: "prefeito",
      municipalityId: VALID_IBGE_CODE,
    },
    JWT_SECRET,
    { expiresIn: "1h" },
  );

  const { createTestApp } = await import("./app-factory.js");
  app = await createTestApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /api/benchmarks — autenticação ──────────────────────────────────────

describe("POST /api/benchmarks — autenticação", () => {
  it("deve retornar 401 quando não há token de autenticação", async () => {
    // Act
    const res = await request(app)
      .post("/api/benchmarks")
      .send({ ibgeCodes: [VALID_IBGE_CODE, VALID_IBGE_CODE_2] });

    // Assert
    expect(res.status).toBe(401);
    expect(mockGenerateBenchmark).not.toHaveBeenCalled();
  });
});

// ─── POST /api/benchmarks — validação de input ────────────────────────────────

describe("POST /api/benchmarks — validação de input", () => {
  it("deve retornar 400 quando ibgeCodes tem menos de 2 elementos", async () => {
    // Act
    const res = await request(app)
      .post("/api/benchmarks")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCodes: [VALID_IBGE_CODE] });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockGenerateBenchmark).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando body não contém ibgeCodes", async () => {
    // Act
    const res = await request(app)
      .post("/api/benchmarks")
      .set("Authorization", `Bearer ${validToken}`)
      .send({});

    // Assert
    expect(res.status).toBe(400);
    expect(mockGenerateBenchmark).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCodes contém código com formato inválido (6 dígitos)", async () => {
    // Arrange — mistura código válido com inválido
    const res = await request(app)
      .post("/api/benchmarks")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCodes: [VALID_IBGE_CODE, "420540"] });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockGenerateBenchmark).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCodes tem mais de 300 elementos", async () => {
    // Arrange — 301 códigos de 7 dígitos (limite é 300)
    const ibgeCodes = Array.from({ length: 301 }, (_, i) => String(4200000 + i).padStart(7, "0"));

    // Act
    const res = await request(app)
      .post("/api/benchmarks")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCodes });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockGenerateBenchmark).not.toHaveBeenCalled();
  });
});

// ─── POST /api/benchmarks — resposta do serviço ───────────────────────────────

describe("POST /api/benchmarks — resposta do serviço", () => {
  it("deve retornar 200 com dados de benchmark para array válido de ibgeCodes", async () => {
    // Arrange
    mockGenerateBenchmark.mockResolvedValue(benchmarkResultFixture);

    // Act
    const res = await request(app)
      .post("/api/benchmarks")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCodes: [VALID_IBGE_CODE, VALID_IBGE_CODE_2] });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      municipalityCount: 2,
      referenceYear: 2023,
    });
    expect(mockGenerateBenchmark).toHaveBeenCalledWith([VALID_IBGE_CODE, VALID_IBGE_CODE_2]);
  });
});

// ─── POST /api/benchmarks/compare — autenticação ──────────────────────────────

describe("POST /api/benchmarks/compare — autenticação", () => {
  it("deve retornar 401 quando não há token de autenticação", async () => {
    // Act
    const res = await request(app)
      .post("/api/benchmarks/compare")
      .send({ ibgeCode: VALID_IBGE_CODE, benchmarkCodes: [VALID_IBGE_CODE_2] });

    // Assert
    expect(res.status).toBe(401);
    expect(mockCompareAgainstBenchmark).not.toHaveBeenCalled();
  });
});

// ─── POST /api/benchmarks/compare — validação de input ────────────────────────

describe("POST /api/benchmarks/compare — validação de input", () => {
  it("deve retornar 400 quando ibgeCode não é fornecido", async () => {
    // Act
    const res = await request(app)
      .post("/api/benchmarks/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ benchmarkCodes: [VALID_IBGE_CODE_2] });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockCompareAgainstBenchmark).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando benchmarkCodes é array vazio", async () => {
    // Act
    const res = await request(app)
      .post("/api/benchmarks/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCode: VALID_IBGE_CODE, benchmarkCodes: [] });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockCompareAgainstBenchmark).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando benchmarkCodes não é fornecido", async () => {
    // Act
    const res = await request(app)
      .post("/api/benchmarks/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCode: VALID_IBGE_CODE });

    // Assert
    expect(res.status).toBe(400);
    expect(mockCompareAgainstBenchmark).not.toHaveBeenCalled();
  });
});

// ─── POST /api/benchmarks/compare — resposta do serviço ──────────────────────

describe("POST /api/benchmarks/compare — resposta do serviço", () => {
  it("deve retornar 200 com dados de comparação para inputs válidos", async () => {
    // Arrange
    mockCompareAgainstBenchmark.mockResolvedValue(compareResultFixture);

    // Act
    const res = await request(app)
      .post("/api/benchmarks/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCode: VALID_IBGE_CODE, benchmarkCodes: [VALID_IBGE_CODE_2] });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ibgeCode: VALID_IBGE_CODE,
      municipalityName: "Florianópolis",
    });
    expect(mockCompareAgainstBenchmark).toHaveBeenCalledWith(VALID_IBGE_CODE, [VALID_IBGE_CODE_2]);
  });
});
