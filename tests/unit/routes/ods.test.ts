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

vi.mock("../../../backend/services/ods/index.js", () => ({
  calculateMunicipalOds: mockCalculateMunicipalOds,
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// batchLimiter substituído por middleware passthrough para não bloquear testes
vi.mock("../../../backend/middleware/rate-limit.js", () => ({
  batchLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

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
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/ods/compare", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
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
    const res = await request(app)
      .post("/api/ods/compare")
      .send({ ibgeCodes: [] });

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
    const codes = Array.from({ length: 11 }, (_, i) =>
      String(4200000 + i).padStart(7, "0"),
    );

    // Act
    const res = await request(app)
      .post("/api/ods/compare")
      .send({ ibgeCodes: codes });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("10") });
    expect(mockCalculateMunicipalOds).not.toHaveBeenCalled();
  });
});
