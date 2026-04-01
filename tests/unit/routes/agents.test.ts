/**
 * Testes unitários para backend/routes/agents.ts
 *
 * Estratégia de mock:
 * - IbgeCollector, SiconfiCollector, DatasusCollector, InepCollector,
 *   SnisCollector, InpeCollector — todos mockados via vi.mock para
 *   isolar a lógica da rota de qualquer dependência externa (HTTP, Redis, etc.)
 * - mapToOdsIndicators de cada agente retorna array vazio por padrão,
 *   suficiente para validar a estrutura de resposta das rotas
 * - logger e batchLimiter mockados para remover efeitos colaterais
 *
 * Casos cobertos: validação de input, happy path, not found, erro interno,
 *   batch válido, batch vazio, batch acima do limite.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_IBGE_CODE = "4204202"; // Blumenau-SC

const ibgeMunicipalDataFactory = (overrides: Record<string, unknown> = {}) => ({
  ibgeCode: VALID_IBGE_CODE,
  siconfiCode: "420420",
  referenceYear: 2023,
  referenceDate: new Date("2023-12-31"),
  dataAvailable: true,
  indicators: {
    populacao: 361855,
    pibPerCapita: 42000,
    pctBaixaRenda: 18.5,
    taxaOcupacao: 62.3,
    receitasOrcamentarias: 1_200_000_000,
    despesasOrcamentarias: 1_100_000_000,
  },
  ...overrides,
});

// ─── Mocks dos módulos ────────────────────────────────────────────────────────

const mockIbgeCollect = vi.fn();
const mockIbgeCollectBatch = vi.fn();
const mockSiconfiCollect = vi.fn();
const mockInpeCollect = vi.fn();

vi.mock("../../../backend/agents/ibge/index.js", () => ({
  IbgeCollector: vi.fn().mockImplementation(() => ({
    collect: mockIbgeCollect,
    collectBatch: mockIbgeCollectBatch,
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../backend/agents/siconfi/index.js", () => ({
  SiconfiCollector: vi.fn().mockImplementation(() => ({
    collect: mockSiconfiCollect,
    collectBatch: vi.fn(),
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../backend/agents/datasus/index.js", () => ({
  DatasusCollector: vi.fn().mockImplementation(() => ({
    collect: vi.fn(),
    collectBatch: vi.fn(),
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../backend/agents/inep/index.js", () => ({
  InepCollector: vi.fn().mockImplementation(() => ({
    collect: vi.fn(),
    collectBatch: vi.fn(),
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../backend/agents/snis/index.js", () => ({
  SnisCollector: vi.fn().mockImplementation(() => ({
    collect: vi.fn(),
    collectBatch: vi.fn(),
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../backend/agents/inpe/index.js", () => ({
  InpeCollector: vi.fn().mockImplementation(() => ({
    collect: mockInpeCollect,
    collectBatch: vi.fn(),
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
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
  const { default: agentsRouter } = await import(
    "../../../backend/routes/agents.js"
  );
  const app = express();
  app.use(express.json());
  app.use("/", agentsRouter);
  return app;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("GET /ibge/:ibgeCode", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com dados do município quando código IBGE válido e collector retorna dados", async () => {
    // Arrange
    const data = ibgeMunicipalDataFactory();
    mockIbgeCollect.mockResolvedValue(data);

    // Act
    const res = await request(app).get(`/ibge/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      municipality: VALID_IBGE_CODE,
      source: "ibge",
      referenceYear: 2023,
    });
    expect(mockIbgeCollect).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve retornar 400 quando código IBGE tem 6 dígitos", async () => {
    // Act
    const res = await request(app).get("/ibge/420420");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("7 dígitos") });
    expect(mockIbgeCollect).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando código IBGE contém letras", async () => {
    // Act
    const res = await request(app).get("/ibge/42042AB");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("7 dígitos") });
    expect(mockIbgeCollect).not.toHaveBeenCalled();
  });

  it("deve retornar 404 quando collector retorna null (município sem dados)", async () => {
    // Arrange
    mockIbgeCollect.mockResolvedValue(null);

    // Act
    const res = await request(app).get(`/ibge/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining(VALID_IBGE_CODE) });
  });

  it("deve retornar 500 quando collector lança exceção", async () => {
    // Arrange
    mockIbgeCollect.mockRejectedValue(new Error("Redis connection refused"));

    // Act
    const res = await request(app).get(`/ibge/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("IBGE") });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /ibge/batch", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com mapa de resultados quando body contém códigos válidos", async () => {
    // Arrange
    const codes = [VALID_IBGE_CODE, "4205407"];
    const data = ibgeMunicipalDataFactory();
    const batchMap = new Map([
      [VALID_IBGE_CODE, data],
      ["4205407", ibgeMunicipalDataFactory({ ibgeCode: "4205407" })],
    ]);
    mockIbgeCollectBatch.mockResolvedValue(batchMap);

    // Act
    const res = await request(app)
      .post("/ibge/batch")
      .send({ ibgeCodes: codes });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 2,
      found: 2,
    });
    expect(mockIbgeCollectBatch).toHaveBeenCalledWith(codes);
  });

  it("deve retornar 400 quando body está vazio (sem ibgeCodes)", async () => {
    // Act
    const res = await request(app).post("/ibge/batch").send({});

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("ibgeCodes") });
    expect(mockIbgeCollectBatch).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCodes tem mais de 50 códigos", async () => {
    // Arrange — gera 51 códigos de 7 dígitos
    const codes = Array.from({ length: 51 }, (_, i) =>
      String(4200000 + i).padStart(7, "0"),
    );

    // Act
    const res = await request(app)
      .post("/ibge/batch")
      .send({ ibgeCodes: codes });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("50") });
    expect(mockIbgeCollectBatch).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando ibgeCodes é array vazio", async () => {
    // Act
    const res = await request(app)
      .post("/ibge/batch")
      .send({ ibgeCodes: [] });

    // Assert
    expect(res.status).toBe(400);
    expect(mockIbgeCollectBatch).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /inpe/:ibgeCode", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com dados florestais quando código IBGE válido e collector retorna dados", async () => {
    // Arrange
    const inpeData = {
      ibgeCode: VALID_IBGE_CODE,
      siconfiCode: "420420",
      referenceYear: 2023,
      referenceDate: new Date("2023-12-31"),
      dataAvailable: true,
      indicators: {
        areaDesmatada: 0.5,
        cobertura: 78.2,
      },
    };
    mockInpeCollect.mockResolvedValue(inpeData);

    // Act
    const res = await request(app).get(`/inpe/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      municipality: VALID_IBGE_CODE,
      source: "inpe",
      referenceYear: 2023,
    });
    expect(mockInpeCollect).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve retornar 404 quando INPE collector retorna null (município sem dados florestais)", async () => {
    // Arrange
    mockInpeCollect.mockResolvedValue(null);

    // Act
    const res = await request(app).get(`/inpe/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining(VALID_IBGE_CODE) });
  });
});
