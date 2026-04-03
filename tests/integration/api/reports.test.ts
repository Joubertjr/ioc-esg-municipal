/**
 * Testes de integração para os endpoints de relatórios ESG
 * Rotas: GET /api/reports/:ibgeCode
 *
 * Estratégia de mock:
 * - generateEsgReport: mockado para isolar a rota do serviço de geração
 *   de relatórios que depende de calculateMunicipalOds e dados externos
 * - @prisma/client: substituído por instância em memória
 * - express-rate-limit: passthrough — sem bloqueio por IP em testes
 * - logger e agentes: stubs vazios
 *
 * Casos cobertos:
 * ✅ GET /api/reports/:ibgeCode → 401 sem token
 * ✅ GET /api/reports/:ibgeCode → 200 com relatório ESG completo
 * ✅ GET /api/reports/:ibgeCode → 404 para município sem dados
 * ✅ GET /api/reports/:ibgeCode → 400 para código com formato inválido (6 dígitos)
 * ✅ GET /api/reports/:ibgeCode → 400 para código com letras
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import type { EsgReport } from "../../../backend/services/reports/report_service.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JWT_SECRET = "test-secret-for-integration-tests-minimum-length";

const VALID_IBGE_CODE = "4205407"; // Florianópolis-SC

const esgReportFixture: EsgReport = {
  ibgeCode: VALID_IBGE_CODE,
  municipalityName: "Florianópolis",
  generatedAt: new Date().toISOString(),
  referenceYear: 2023,
  executiveSummary: "Município apresenta bom desempenho nos indicadores ESG.",
  globalScore: 72,
  globalStatus: "verde",
  coverage: { total: 17, withData: 12, percentage: 70.6 },
  statusBreakdown: { verde: 6, amarelo: 4, vermelho: 2 },
  odsDetails: [],
  recommendations: [],
  strengths: ["Saneamento acima da média"],
  weaknesses: ["Desmatamento crescente"],
};

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const { mockGenerateEsgReport } = vi.hoisted(() => ({
  mockGenerateEsgReport: vi.fn(),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("express-rate-limit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../../backend/services/reports/report_service.js", () => ({
  generateEsgReport: mockGenerateEsgReport,
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

// ─── GET /api/reports/:ibgeCode — autenticação ────────────────────────────────

describe("GET /api/reports/:ibgeCode — autenticação", () => {
  it("deve retornar 401 quando não há token de autenticação", async () => {
    // Act
    const res = await request(app).get(`/api/reports/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(401);
    expect(mockGenerateEsgReport).not.toHaveBeenCalled();
  });
});

// ─── GET /api/reports/:ibgeCode — validação de input ─────────────────────────

describe("GET /api/reports/:ibgeCode — validação de ibgeCode", () => {
  it("deve retornar 400 quando ibgeCode tem 6 dígitos (código SICONFI, não IBGE)", async () => {
    // Act
    const res = await request(app)
      .get("/api/reports/420540")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockGenerateEsgReport).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCode contém letras", async () => {
    // Act
    const res = await request(app)
      .get("/api/reports/420540X")
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockGenerateEsgReport).not.toHaveBeenCalled();
  });
});

// ─── GET /api/reports/:ibgeCode — resposta do serviço ────────────────────────

describe("GET /api/reports/:ibgeCode — resposta do serviço", () => {
  it("deve retornar 200 com relatório ESG completo para ibgeCode válido com dados", async () => {
    // Arrange
    mockGenerateEsgReport.mockResolvedValue(esgReportFixture);

    // Act
    const res = await request(app)
      .get(`/api/reports/${VALID_IBGE_CODE}`)
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ibgeCode: VALID_IBGE_CODE,
      municipalityName: "Florianópolis",
      globalScore: 72,
      globalStatus: "verde",
    });
    expect(mockGenerateEsgReport).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve retornar relatório com estrutura de coverage completa", async () => {
    // Arrange
    mockGenerateEsgReport.mockResolvedValue(esgReportFixture);

    // Act
    const res = await request(app)
      .get(`/api/reports/${VALID_IBGE_CODE}`)
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.body.coverage).toMatchObject({
      total: 17,
      withData: expect.any(Number),
      percentage: expect.any(Number),
    });
    expect(res.body.statusBreakdown).toMatchObject({
      verde: expect.any(Number),
      amarelo: expect.any(Number),
      vermelho: expect.any(Number),
    });
  });

  it("deve retornar 404 quando município não tem dados disponíveis", async () => {
    // Arrange — serviço retorna null para município sem dados
    mockGenerateEsgReport.mockResolvedValue(null);

    // Act
    const res = await request(app)
      .get(`/api/reports/${VALID_IBGE_CODE}`)
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(VALID_IBGE_CODE);
  });

  it("deve retornar 500 quando serviço lança exceção interna", async () => {
    // Arrange — simula falha no serviço de relatórios
    mockGenerateEsgReport.mockRejectedValue(new Error("Falha ao processar dados"));

    // Act
    const res = await request(app)
      .get(`/api/reports/${VALID_IBGE_CODE}`)
      .set("Authorization", `Bearer ${validToken}`);

    // Assert
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
