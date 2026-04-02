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
const mockTseCollect = vi.fn();
const mockAneelCollect = vi.fn();
const mockSnisRsCollect = vi.fn();
const mockAnaCollect = vi.fn();
const mockConveniosCollect = vi.fn();
const mockAnatelCollect = vi.fn();
const mockSisvanCollect = vi.fn();

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

vi.mock("../../../backend/agents/tse/index.js", () => ({
  TseCollector: vi.fn().mockImplementation(() => ({
    collect: mockTseCollect,
    collectBatch: vi.fn(),
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../backend/agents/aneel/index.js", () => ({
  AneelCollector: vi.fn().mockImplementation(() => ({
    collect: mockAneelCollect,
    collectBatch: vi.fn(),
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../backend/agents/snis_rs/index.js", () => ({
  SnisRsCollector: vi.fn().mockImplementation(() => ({
    collect: mockSnisRsCollect,
    collectBatch: vi.fn(),
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../backend/agents/ana/index.js", () => ({
  AnaCollector: vi.fn().mockImplementation(() => ({
    collect: mockAnaCollect,
    collectBatch: vi.fn(),
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../backend/agents/convenios/index.js", () => ({
  ConveniosCollector: vi.fn().mockImplementation(() => ({
    collect: mockConveniosCollect,
    collectBatch: vi.fn(),
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../backend/agents/anatel/index.js", () => ({
  AnatelCollector: vi.fn().mockImplementation(() => ({
    collect: mockAnatelCollect,
    collectBatch: vi.fn(),
  })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../backend/agents/sisvan/index.js", () => ({
  SisvanCollector: vi.fn().mockImplementation(() => ({
    collect: mockSisvanCollect,
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

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /tse/:ibgeCode", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com dados eleitorais quando código IBGE válido e collector retorna dados", async () => {
    // Arrange
    const tseData = {
      ibgeCode: VALID_IBGE_CODE,
      referenceYear: 2024,
      indicators: { totalEleitores: 250000 },
    };
    mockTseCollect.mockResolvedValue(tseData);

    // Act
    const res = await request(app).get(`/tse/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      municipality: VALID_IBGE_CODE,
      source: "tse",
      referenceYear: 2024,
    });
    expect(mockTseCollect).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve retornar 400 quando código IBGE é inválido", async () => {
    const res = await request(app).get("/tse/123");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("7 dígitos") });
    expect(mockTseCollect).not.toHaveBeenCalled();
  });

  it("deve retornar 404 quando TSE collector retorna null", async () => {
    mockTseCollect.mockResolvedValue(null);
    const res = await request(app).get(`/tse/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining(VALID_IBGE_CODE) });
  });

  it("deve retornar 500 quando TSE collector lança exceção", async () => {
    mockTseCollect.mockRejectedValue(new Error("timeout"));
    const res = await request(app).get(`/tse/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("TSE") });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /aneel/:ibgeCode", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com dados de energia quando código IBGE válido e collector retorna dados", async () => {
    // Arrange
    const aneelData = {
      ibgeCode: VALID_IBGE_CODE,
      referenceYear: 2023,
      indicators: { indiceDec: 8.5, indiceFec: 4.2 },
    };
    mockAneelCollect.mockResolvedValue(aneelData);

    // Act
    const res = await request(app).get(`/aneel/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      municipality: VALID_IBGE_CODE,
      source: "aneel",
      referenceYear: 2023,
    });
    expect(mockAneelCollect).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve retornar 400 quando código IBGE é inválido", async () => {
    const res = await request(app).get("/aneel/123");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("7 dígitos") });
    expect(mockAneelCollect).not.toHaveBeenCalled();
  });

  it("deve retornar 404 quando ANEEL collector retorna null", async () => {
    mockAneelCollect.mockResolvedValue(null);
    const res = await request(app).get(`/aneel/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining(VALID_IBGE_CODE) });
  });

  it("deve retornar 500 quando ANEEL collector lança exceção", async () => {
    mockAneelCollect.mockRejectedValue(new Error("network error"));
    const res = await request(app).get(`/aneel/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("ANEEL") });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /snis-rs/:ibgeCode", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com dados de resíduos sólidos quando código IBGE válido e collector retorna dados", async () => {
    // Arrange
    const snisRsData = {
      ibgeCode: VALID_IBGE_CODE,
      referenceYear: 2022,
      indicators: { coletaDomiciliar: 95.0, destinacaoAdequada: 80.0 },
    };
    mockSnisRsCollect.mockResolvedValue(snisRsData);

    // Act
    const res = await request(app).get(`/snis-rs/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      municipality: VALID_IBGE_CODE,
      source: "snis-rs",
      referenceYear: 2022,
    });
    expect(mockSnisRsCollect).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve retornar 400 quando código IBGE é inválido", async () => {
    const res = await request(app).get("/snis-rs/123");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("7 dígitos") });
    expect(mockSnisRsCollect).not.toHaveBeenCalled();
  });

  it("deve retornar 404 quando SNIS-RS collector retorna null", async () => {
    mockSnisRsCollect.mockResolvedValue(null);
    const res = await request(app).get(`/snis-rs/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining(VALID_IBGE_CODE) });
  });

  it("deve retornar 500 quando SNIS-RS collector lança exceção", async () => {
    mockSnisRsCollect.mockRejectedValue(new Error("parse error"));
    const res = await request(app).get(`/snis-rs/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("SNIS-RS") });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /ana/:ibgeCode", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com dados hídricos quando código IBGE válido e collector retorna dados", async () => {
    // Arrange
    const anaData = {
      ibgeCode: VALID_IBGE_CODE,
      referenceYear: 2023,
      indicators: { outorgasAtivas: 12, usoTotal: 5.4 },
    };
    mockAnaCollect.mockResolvedValue(anaData);

    // Act
    const res = await request(app).get(`/ana/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      municipality: VALID_IBGE_CODE,
      source: "ana",
      referenceYear: 2023,
    });
    expect(mockAnaCollect).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve retornar 400 quando código IBGE é inválido", async () => {
    const res = await request(app).get("/ana/123");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("7 dígitos") });
    expect(mockAnaCollect).not.toHaveBeenCalled();
  });

  it("deve retornar 404 quando ANA collector retorna null", async () => {
    mockAnaCollect.mockResolvedValue(null);
    const res = await request(app).get(`/ana/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining(VALID_IBGE_CODE) });
  });

  it("deve retornar 500 quando ANA collector lança exceção", async () => {
    mockAnaCollect.mockRejectedValue(new Error("service unavailable"));
    const res = await request(app).get(`/ana/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("ANA") });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /convenios/:ibgeCode", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com dados de convênios quando código IBGE válido e collector retorna dados", async () => {
    // Arrange
    const conveniosData = {
      ibgeCode: VALID_IBGE_CODE,
      referenceYear: 2024,
      indicators: { totalConvenios: 45, valorTotal: 12_000_000 },
    };
    mockConveniosCollect.mockResolvedValue(conveniosData);

    // Act
    const res = await request(app).get(`/convenios/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      municipality: VALID_IBGE_CODE,
      source: "convenios",
      referenceYear: 2024,
    });
    expect(mockConveniosCollect).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve retornar 400 quando código IBGE é inválido", async () => {
    const res = await request(app).get("/convenios/123");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("7 dígitos") });
    expect(mockConveniosCollect).not.toHaveBeenCalled();
  });

  it("deve retornar 404 quando CONVENIOS collector retorna null", async () => {
    mockConveniosCollect.mockResolvedValue(null);
    const res = await request(app).get(`/convenios/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining(VALID_IBGE_CODE) });
  });

  it("deve retornar 500 quando CONVENIOS collector lança exceção", async () => {
    mockConveniosCollect.mockRejectedValue(new Error("auth error"));
    const res = await request(app).get(`/convenios/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("CONVENIOS") });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /anatel/:ibgeCode", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com dados de telecomunicações quando código IBGE válido e collector retorna dados", async () => {
    // Arrange
    const anatelData = {
      ibgeCode: VALID_IBGE_CODE,
      referenceYear: 2023,
      indicators: { acessos4G: 180000, cobertura4G: 92.5 },
    };
    mockAnatelCollect.mockResolvedValue(anatelData);

    // Act
    const res = await request(app).get(`/anatel/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      municipality: VALID_IBGE_CODE,
      source: "anatel",
      referenceYear: 2023,
    });
    expect(mockAnatelCollect).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve retornar 400 quando código IBGE é inválido", async () => {
    const res = await request(app).get("/anatel/123");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("7 dígitos") });
    expect(mockAnatelCollect).not.toHaveBeenCalled();
  });

  it("deve retornar 404 quando ANATEL collector retorna null", async () => {
    mockAnatelCollect.mockResolvedValue(null);
    const res = await request(app).get(`/anatel/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining(VALID_IBGE_CODE) });
  });

  it("deve retornar 500 quando ANATEL collector lança exceção", async () => {
    mockAnatelCollect.mockRejectedValue(new Error("connection reset"));
    const res = await request(app).get(`/anatel/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("ANATEL") });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /sisvan/:ibgeCode", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("deve retornar 200 com dados nutricionais quando código IBGE válido e collector retorna dados", async () => {
    // Arrange
    const sisvanData = {
      ibgeCode: VALID_IBGE_CODE,
      referenceYear: 2023,
      indicators: { pctDesnutricao: 3.2, pctObesidade: 12.5 },
    };
    mockSisvanCollect.mockResolvedValue(sisvanData);

    // Act
    const res = await request(app).get(`/sisvan/${VALID_IBGE_CODE}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      municipality: VALID_IBGE_CODE,
      source: "sisvan",
      referenceYear: 2023,
    });
    expect(mockSisvanCollect).toHaveBeenCalledWith(VALID_IBGE_CODE);
  });

  it("deve retornar 400 quando código IBGE é inválido", async () => {
    const res = await request(app).get("/sisvan/123");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("7 dígitos") });
    expect(mockSisvanCollect).not.toHaveBeenCalled();
  });

  it("deve retornar 404 quando SISVAN collector retorna null", async () => {
    mockSisvanCollect.mockResolvedValue(null);
    const res = await request(app).get(`/sisvan/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining(VALID_IBGE_CODE) });
  });

  it("deve retornar 500 quando SISVAN collector lança exceção", async () => {
    mockSisvanCollect.mockRejectedValue(new Error("file not found"));
    const res = await request(app).get(`/sisvan/${VALID_IBGE_CODE}`);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("SISVAN") });
  });
});
