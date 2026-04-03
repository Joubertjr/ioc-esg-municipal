/**
 * Testes de integração para os endpoints ODS
 * Rotas: GET /api/ods/:ibgeCode, POST /api/ods/compare
 *
 * Estratégia de mock:
 * - calculateMunicipalOds: mockado para isolar a rota do serviço de
 *   orquestração que depende de 6+ coletores externos — permite controlar
 *   com precisão o retorno (dados, null, erro) por cenário de teste
 * - @prisma/client: substituído por instância em memória — rota ODS não usa
 *   Prisma diretamente, mas o authRouter (montado no mesmo app) usa
 * - express-rate-limit: passthrough — evita bloqueio por IP em testes
 * - logger e agentes: stubs vazios para eliminar efeitos colaterais
 *
 * Token de autenticação: gerado no beforeAll com JWT_SECRET de teste
 * para simular usuário autenticado sem depender de banco real
 *
 * Casos cobertos:
 * ✅ GET /api/ods/:ibgeCode → 401 sem token de auth
 * ✅ GET /api/ods/:ibgeCode → 400 com ibgeCode de 6 dígitos
 * ✅ GET /api/ods/:ibgeCode → 400 com ibgeCode com letras
 * ✅ GET /api/ods/:ibgeCode → 400 com string vazia
 * ✅ GET /api/ods/:ibgeCode → 200 quando serviço retorna dados
 * ✅ GET /api/ods/:ibgeCode → 404 quando serviço retorna null
 * ✅ GET /api/ods/:ibgeCode → 500 quando serviço lança exceção
 * ✅ POST /api/ods/compare → 401 sem token de auth
 * ✅ POST /api/ods/compare → 400 com menos de 2 códigos
 * ✅ POST /api/ods/compare → 400 com mais de 10 códigos
 * ✅ POST /api/ods/compare → 400 com código inválido no array
 * ✅ POST /api/ods/compare → 200 com resultado de comparação
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import type { MunicipalOdsReport } from "../../../backend/services/ods/ods_score_service.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JWT_SECRET = "test-secret-for-integration-tests-minimum-length";

const VALID_IBGE_CODE = "4205407"; // Florianópolis-SC
const VALID_IBGE_CODE_2 = "4204202"; // Blumenau-SC

const odsReportFactory = (
  ibgeCode: string,
  overrides: Partial<MunicipalOdsReport> = {},
): MunicipalOdsReport => ({
  ibgeCode,
  municipalityName: "Florianópolis",
  referenceYear: 2023,
  globalScore: 72,
  globalStatus: "verde",
  odsCount: {
    total: 17,
    withData: 8,
    verde: 4,
    amarelo: 3,
    vermelho: 1,
  },
  ods: [
    {
      odsNumber: 1,
      name: "Erradicação da Pobreza",
      shortName: "Pobreza",
      color: "#E5243B",
      weight: 1,
      score: 65,
      status: "amarelo",
      indicators: [],
      sources: [],
    },
  ],
  ...overrides,
});

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

// vi.hoisted garante que o fn seja criado antes do hoisting do vi.mock
const { mockCalculateMunicipalOds } = vi.hoisted(() => ({
  mockCalculateMunicipalOds: vi.fn(),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("express-rate-limit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../../backend/services/ods/index.js", () => ({
  calculateMunicipalOds: mockCalculateMunicipalOds,
}));

vi.mock("@prisma/client", () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
    },
    municipality: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
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
// JSON data files imported at module load time by the new collectors
vi.mock("../../../shared/data/tse_2024.json", () => ({ default: [] }));
vi.mock("../../../shared/data/aneel_gd_2023.json", () => ({ default: [] }));
vi.mock("../../../shared/data/snis_rs_2022.json", () => ({ default: [] }));
vi.mock("../../../shared/data/ana_2022.json", () => ({ default: [] }));
vi.mock("../../../shared/data/convenios_2023.json", () => ({ default: [] }));
vi.mock("../../../shared/data/anatel_2023.json", () => ({ default: [] }));
vi.mock("../../../shared/data/sisvan_2023.json", () => ({ default: [] }));

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: Express;
let validToken: string;

beforeAll(async () => {
  process.env["JWT_SECRET"] = JWT_SECRET;

  // Token válido gerado com o secret de teste — representa um prefeito autenticado
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

// ─── GET /api/ods/:ibgeCode — proteção de autenticação ───────────────────────

describe("GET /api/ods/:ibgeCode — autenticação", () => {
  it("deve retornar 401 quando não há token de autenticação", async () => {
    // Act
    const res = await request(app).get(`/api/ods/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(401);
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });
});

// ─── GET /api/ods/:ibgeCode — validação de input ──────────────────────────────

describe("GET /api/ods/:ibgeCode — validação de ibgeCode", () => {
  it("deve retornar 400 quando ibgeCode tem 6 dígitos (código SICONFI, não IBGE)", async () => {
    // Act
    const res = await request(app)
      .get("/api/ods/420540")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/7 dígitos/i);
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCode contém letras", async () => {
    // Act
    const res = await request(app)
      .get("/api/ods/420540X")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/7 dígitos/i);
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCode tem 8 dígitos (muito longo)", async () => {
    // Act
    const res = await request(app)
      .get("/api/ods/42054070")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(400);
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });
});

// ─── GET /api/ods/:ibgeCode — comportamento com dados ────────────────────────

describe("GET /api/ods/:ibgeCode — resposta do serviço", () => {
  it("deve retornar 200 com relatório ODS quando serviço retorna dados", async () => {
    // Arrange
    const report = odsReportFactory(VALID_IBGE_CODE);
    mockCalculateMunicipalOds.mockResolvedValue(report);

    // Act
    const res = await request(app)
      .get(`/api/ods/${VALID_IBGE_CODE}`)
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ibgeCode: VALID_IBGE_CODE,
      globalScore: 72,
      globalStatus: "verde",
    });
    expect(mockCalculateMunicipalOds).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve retornar 200 com estrutura completa de odsCount", async () => {
    // Arrange
    const report = odsReportFactory(VALID_IBGE_CODE);
    mockCalculateMunicipalOds.mockResolvedValue(report);

    // Act
    const res = await request(app)
      .get(`/api/ods/${VALID_IBGE_CODE}`)
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.body.odsCount).toMatchObject({
      total: 17,
      withData: expect.any(Number),
      verde: expect.any(Number),
      amarelo: expect.any(Number),
      vermelho: expect.any(Number),
    });
  });

  it("deve retornar 404 quando serviço retorna null (município sem dados)", async () => {
    // Arrange — município válido porém sem dados disponíveis
    mockCalculateMunicipalOds.mockResolvedValue(null);

    // Act
    const res = await request(app)
      .get(`/api/ods/${VALID_IBGE_CODE}`)
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(VALID_IBGE_CODE);
  });

  it("deve retornar 500 quando serviço lança exceção interna", async () => {
    // Arrange — simula falha em cascata dos coletores
    mockCalculateMunicipalOds.mockRejectedValue(
      new Error("Timeout na API governamental"),
    );

    // Act
    const res = await request(app)
      .get(`/api/ods/${VALID_IBGE_CODE}`)
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});

// ─── POST /api/ods/compare ────────────────────────────────────────────────────

describe("POST /api/ods/compare — autenticação", () => {
  it("deve retornar 401 sem token de autenticação", async () => {
    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .send({ ibgeCodes: [VALID_IBGE_CODE, VALID_IBGE_CODE_2] });

    // Assert
    expect(res.status).toBe(401);
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });
});

describe("POST /api/ods/compare — validação de input", () => {
  it("deve retornar 400 quando ibgeCodes tem menos de 2 elementos", async () => {
    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCodes: [VALID_IBGE_CODE] });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ao menos 2/i);
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCodes é array vazio", async () => {
    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCodes: [] });

    // Assert
    expect(res.status).toBe(400);
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCodes tem mais de 10 elementos", async () => {
    // Arrange — 11 códigos válidos de 7 dígitos
    const ibgeCodes = Array.from({ length: 11 }, (_, i) =>
      String(4200000 + i).padStart(7, "0"),
    );

    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCodes });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/10/);
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando array contém código com formato inválido", async () => {
    // Arrange — mistura código válido com inválido (6 dígitos)
    const ibgeCodes = [VALID_IBGE_CODE, "420540"]; // segundo código tem 6 dígitos

    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCodes });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/7 dígitos/i);
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando body não contém ibgeCodes", async () => {
    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send({});

    // Assert
    expect(res.status).toBe(400);
  });
});

describe("POST /api/ods/compare — resposta do serviço", () => {
  it("deve retornar 200 com estrutura de comparação para 2 municípios válidos", async () => {
    // Arrange
    const report1 = odsReportFactory(VALID_IBGE_CODE);
    const report2 = odsReportFactory(VALID_IBGE_CODE_2, {
      municipalityName: "Blumenau",
      globalScore: 58,
      globalStatus: "amarelo",
    });
    mockCalculateMunicipalOds
      .mockResolvedValueOnce(report1)
      .mockResolvedValueOnce(report2);

    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCodes: [VALID_IBGE_CODE, VALID_IBGE_CODE_2] });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 2,
      found: 2,
    });
    expect(Array.isArray(res.body.comparison)).toBe(true);
    expect(res.body.comparison).toHaveLength(2);
    expect(mockCalculateMunicipalOds).toHaveBeenCalledTimes(2);
  });

  it("deve retornar found=1 quando apenas um dos municípios tem dados", async () => {
    // Arrange — primeiro tem dados, segundo não tem (null)
    const report1 = odsReportFactory(VALID_IBGE_CODE);
    mockCalculateMunicipalOds
      .mockResolvedValueOnce(report1)
      .mockResolvedValueOnce(null);

    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ibgeCodes: [VALID_IBGE_CODE, VALID_IBGE_CODE_2] });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.found).toBe(1);
  });
});
