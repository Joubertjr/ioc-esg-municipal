/**
 * Testes de integração para os endpoints de municípios
 * Rotas: GET /api/municipalities, GET /api/municipalities/:ibgeCode
 *
 * Estratégia de mock:
 * - @prisma/client: substituído por instância em memória com fns controlados
 *   por teste — evita conexão real com PostgreSQL
 * - municipalitiesRouter usa prisma.$transaction e municipality.*
 *   que são mockados via PrismaClient mock
 * - express-rate-limit: passthrough — sem bloqueio por IP em testes
 * - logger e agentes: stubs vazios para eliminar efeitos colaterais
 *
 * Casos cobertos:
 * ✅ GET /api/municipalities → 401 sem token
 * ✅ GET /api/municipalities → 200 com lista paginada (default page=1, pageSize=50)
 * ✅ GET /api/municipalities?page=1&pageSize=10 → 200 respeitando paginação
 * ✅ GET /api/municipalities/:ibgeCode → 401 sem token
 * ✅ GET /api/municipalities/:ibgeCode → 200 com dados do município
 * ✅ GET /api/municipalities/:ibgeCode → 404 para código desconhecido
 * ✅ GET /api/municipalities/:ibgeCode → 400 para código com formato inválido
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JWT_SECRET = "test-secret-for-integration-tests-minimum-length";

const VALID_IBGE_CODE = "4205407"; // Florianópolis-SC

const municipalityFixture = {
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
  { ibgeCode: "4205407", name: "Florianópolis", state: "SC", population: 508826 },
];

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const { mockMunicipalityFindMany, mockMunicipalityCount, mockMunicipalityFindUnique, mockTransaction } =
  vi.hoisted(() => ({
    mockMunicipalityFindMany: vi.fn(),
    mockMunicipalityCount: vi.fn(),
    mockMunicipalityFindUnique: vi.fn(),
    mockTransaction: vi.fn(),
  }));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("express-rate-limit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
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
        findMany: mockMunicipalityFindMany,
        findUnique: mockMunicipalityFindUnique,
        count: mockMunicipalityCount,
      },
      $transaction: mockTransaction,
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
  ConveniosCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
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

// ─── GET /api/municipalities — autenticação ────────────────────────────────────

describe("GET /api/municipalities — autenticação", () => {
  it("deve retornar 401 quando não há token de autenticação", async () => {
    // Act
    const res = await request(app).get("/api/municipalities");

    // Assert
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/municipalities — lista paginada ─────────────────────────────────

describe("GET /api/municipalities — lista paginada", () => {
  it("deve retornar 200 com lista paginada usando defaults page=1 e pageSize=50", async () => {
    // Arrange — $transaction retorna [lista, total]
    mockTransaction.mockResolvedValue([municipalityListFixture, 2]);

    // Act
    const res = await request(app)
      .get("/api/municipalities")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({ ibgeCode: "4204202", name: "Blumenau" }),
      ]),
      total: 2,
      page: 1,
      pageSize: 50,
    });
  });

  it("deve retornar 200 respeitando page e pageSize passados na query string", async () => {
    // Arrange
    mockTransaction.mockResolvedValue([[municipalityListFixture[0]], 2]);

    // Act
    const res = await request(app)
      .get("/api/municipalities?page=1&pageSize=10")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("deve retornar array vazio quando não há municípios no banco", async () => {
    // Arrange
    mockTransaction.mockResolvedValue([[], 0]);

    // Act
    const res = await request(app)
      .get("/api/municipalities")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

// ─── GET /api/municipalities/:ibgeCode — autenticação ────────────────────────

describe("GET /api/municipalities/:ibgeCode — autenticação", () => {
  it("deve retornar 401 quando não há token de autenticação", async () => {
    // Act
    const res = await request(app).get(`/api/municipalities/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/municipalities/:ibgeCode — validação de input ──────────────────

describe("GET /api/municipalities/:ibgeCode — validação de ibgeCode", () => {
  it("deve retornar 400 quando ibgeCode tem 6 dígitos (código SICONFI, não IBGE)", async () => {
    // Act
    const res = await request(app)
      .get("/api/municipalities/420540")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("deve retornar 400 quando ibgeCode contém letras", async () => {
    // Act
    const res = await request(app)
      .get("/api/municipalities/420540X")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("deve retornar 400 quando ibgeCode tem 8 dígitos (muito longo)", async () => {
    // Act
    const res = await request(app)
      .get("/api/municipalities/42054070")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// ─── GET /api/municipalities/:ibgeCode — comportamento com dados ──────────────

describe("GET /api/municipalities/:ibgeCode — resposta do serviço", () => {
  it("deve retornar 200 com dados do município para ibgeCode válido encontrado no banco", async () => {
    // Arrange
    mockMunicipalityFindUnique.mockResolvedValue(municipalityFixture);

    // Act
    const res = await request(app)
      .get(`/api/municipalities/${VALID_IBGE_CODE}`)
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      ibgeCode: VALID_IBGE_CODE,
      name: "Florianópolis",
      state: "SC",
    });
  });

  it("deve retornar 404 quando ibgeCode não existe no banco", async () => {
    // Arrange — findUnique retorna null (código desconhecido)
    mockMunicipalityFindUnique.mockResolvedValue(null);

    // Act
    const res = await request(app)
      .get("/api/municipalities/9999999")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/9999999/);
  });

  it("deve retornar 404 quando município tem deletedAt preenchido (soft delete)", async () => {
    // Arrange — município deletado logicamente
    mockMunicipalityFindUnique.mockResolvedValue({
      ...municipalityFixture,
      deletedAt: new Date("2024-01-01"),
    });

    // Act
    const res = await request(app)
      .get(`/api/municipalities/${VALID_IBGE_CODE}`)
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(404);
  });
});
