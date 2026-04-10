import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockGenerateReport } = vi.hoisted(() => ({
  mockGenerateReport: vi.fn(),
}));

vi.mock("../../../backend/services/reports/report_service.js", () => ({
  generateEsgReport: mockGenerateReport,
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

vi.mock("../../../shared/data/ideb_2023.json", () => ({ default: {} }));
vi.mock("../../../shared/data/snis_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/tse_2024.json", () => ({ default: {} }));
vi.mock("../../../shared/data/aneel_gd_2023.json", () => ({ default: {} }));
vi.mock("../../../shared/data/snis_rs_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/ana_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/convenios_2023.json", () => ({ default: {} }));

const { default: reportsRouter } = await import("../../../backend/routes/reports.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/reports", reportsRouter);
  return app;
}

const MOCK_REPORT = {
  ibgeCode: "4204202",
  municipalityName: "Chapecó",
  generatedAt: "2024-01-01T00:00:00.000Z",
  referenceYear: 2024,
  executiveSummary: "Resumo executivo de teste.",
  globalScore: 55,
  globalStatus: "amarelo",
  coverage: { total: 17, withData: 3, percentage: 18 },
  statusBreakdown: { verde: 1, amarelo: 1, vermelho: 1 },
  odsDetails: [],
  recommendations: [],
  strengths: ["ODS3 (ODS 3): score 80/100"],
  weaknesses: ["ODS6 (ODS 6): score 30/100 — requer atenção"],
};

describe("GET /api/reports/:ibgeCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateReport.mockResolvedValue(MOCK_REPORT);
  });

  it("retorna 200 com relatório válido", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/reports/4204202");

    expect(res.status).toBe(200);
    expect(res.body.ibgeCode).toBe("4204202");
    expect(res.body.executiveSummary).toBeTruthy();
    expect(res.body.globalScore).toBe(55);
    expect(mockGenerateReport).toHaveBeenCalledWith("4204202");
  });

  it("retorna 404 quando não há dados", async () => {
    mockGenerateReport.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app).get("/api/reports/0000000");

    expect(res.status).toBe(404);
  });

  it("retorna 400 para ibgeCode inválido", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/reports/abc");

    expect(res.status).toBe(400);
    expect(mockGenerateReport).not.toHaveBeenCalled();
  });

  it("retorna 400 para ibgeCode com dígitos insuficientes", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/reports/12345");

    expect(res.status).toBe(400);
  });

  it("retorna 500 quando generateEsgReport lança erro", async () => {
    mockGenerateReport.mockRejectedValue(new Error("DB down"));
    const app = buildApp();
    const res = await request(app).get("/api/reports/4204202");

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Erro interno");
  });
});
