/**
 * Testes de integração para os endpoints do simulador
 * Rotas: POST /api/simulator/simulate, POST /api/simulator/compare
 *
 * Estratégia de mock:
 * - runSimulation: mockado para isolar a rota do serviço de simulação
 *   que depende de calculateMunicipalOds e dados externos
 * - @prisma/client: substituído por instância em memória
 * - express-rate-limit: passthrough — sem bloqueio por IP em testes
 * - logger e agentes: stubs vazios
 *
 * Casos cobertos:
 * ✅ POST /api/simulator/simulate → 401 sem token
 * ✅ POST /api/simulator/simulate → 200 com resultado de simulação válido
 * ✅ POST /api/simulator/simulate → 400 com ibgeCode inválido
 * ✅ POST /api/simulator/simulate → 400 com totalAmount negativo
 * ✅ POST /api/simulator/simulate → 400 com allocation incompleto
 * ✅ POST /api/simulator/simulate → 400 sem body
 * ✅ POST /api/simulator/compare → 401 sem token
 * ✅ POST /api/simulator/compare → 200 com resultados de múltiplos cenários
 * ✅ POST /api/simulator/compare → 400 com menos de 2 cenários
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import type { SimulationResult } from "../../../backend/services/simulator/simulator_service.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JWT_SECRET = "test-secret-for-integration-tests-minimum-length";

const VALID_IBGE_CODE = "4205407"; // Florianópolis-SC
const VALID_IBGE_CODE_2 = "4204202"; // Blumenau-SC

const validAllocation = {
  education: 30,
  health: 25,
  sanitation: 15,
  environment: 10,
  security: 5,
  energy: 5,
  urbanization: 5,
  governance: 5,
};

const validSimulationBody = {
  ibgeCode: VALID_IBGE_CODE,
  totalAmount: 5000000,
  allocation: validAllocation,
};

const simulationResultFixture: SimulationResult = {
  ibgeCode: VALID_IBGE_CODE,
  municipalityName: "Florianópolis",
  totalAmount: 5000000,
  allocation: validAllocation,
  currentGlobalScore: 72,
  projectedGlobalScore: 76,
  globalDelta: 4,
  ods: [],
};

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const { mockRunSimulation } = vi.hoisted(() => ({
  mockRunSimulation: vi.fn(),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("express-rate-limit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../../backend/services/simulator/simulator_service.js", () => ({
  runSimulation: mockRunSimulation,
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

// ─── POST /api/simulator/simulate — autenticação ──────────────────────────────

describe("POST /api/simulator/simulate — autenticação", () => {
  it("deve retornar 401 quando não há token de autenticação", async () => {
    // Act
    const res = await request(app).post("/api/simulator/simulate").send(validSimulationBody);

    // Assert
    expect(res.status).toBe(401);
    expect(mockRunSimulation).not.toHaveBeenCalled();
  });
});

// ─── POST /api/simulator/simulate — validação de input ───────────────────────

describe("POST /api/simulator/simulate — validação de input", () => {
  it("deve retornar 400 quando ibgeCode tem formato inválido (6 dígitos)", async () => {
    // Act
    const res = await request(app)
      .post("/api/simulator/simulate")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validSimulationBody, ibgeCode: "420540" });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockRunSimulation).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando totalAmount é negativo", async () => {
    // Act
    const res = await request(app)
      .post("/api/simulator/simulate")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validSimulationBody, totalAmount: -1000 });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockRunSimulation).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando allocation não contém todos os campos obrigatórios", async () => {
    // Arrange — falta o campo 'health'
    const incompleteAllocation = { ...validAllocation };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (incompleteAllocation as any).health;

    // Act
    const res = await request(app)
      .post("/api/simulator/simulate")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validSimulationBody, allocation: incompleteAllocation });

    // Assert
    expect(res.status).toBe(400);
    expect(mockRunSimulation).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando body está completamente vazio", async () => {
    // Act
    const res = await request(app)
      .post("/api/simulator/simulate")
      .set("Authorization", `Bearer ${validToken}`)
      .send({});

    // Assert
    expect(res.status).toBe(400);
    expect(mockRunSimulation).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando percentual de allocation excede 100", async () => {
    // Act
    const res = await request(app)
      .post("/api/simulator/simulate")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validSimulationBody, allocation: { ...validAllocation, education: 150 } });

    // Assert
    expect(res.status).toBe(400);
    expect(mockRunSimulation).not.toHaveBeenCalled();
  });
});

// ─── POST /api/simulator/simulate — resposta do serviço ──────────────────────

describe("POST /api/simulator/simulate — resposta do serviço", () => {
  it("deve retornar 200 com resultado de simulação para input válido", async () => {
    // Arrange
    mockRunSimulation.mockResolvedValue(simulationResultFixture);

    // Act
    const res = await request(app)
      .post("/api/simulator/simulate")
      .set("Authorization", `Bearer ${validToken}`)
      .send(validSimulationBody);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ibgeCode: VALID_IBGE_CODE,
      totalAmount: 5000000,
      currentGlobalScore: 72,
      projectedGlobalScore: 76,
    });
    expect(mockRunSimulation).toHaveBeenCalledWith(validSimulationBody);
  });
});

// ─── POST /api/simulator/compare — autenticação ───────────────────────────────

describe("POST /api/simulator/compare — autenticação", () => {
  it("deve retornar 401 quando não há token de autenticação", async () => {
    // Act
    const res = await request(app)
      .post("/api/simulator/compare")
      .send([validSimulationBody, { ...validSimulationBody, ibgeCode: VALID_IBGE_CODE_2 }]);

    // Assert
    expect(res.status).toBe(401);
    expect(mockRunSimulation).not.toHaveBeenCalled();
  });
});

// ─── POST /api/simulator/compare — validação de input ────────────────────────

describe("POST /api/simulator/compare — validação de input", () => {
  it("deve retornar 400 quando array tem menos de 2 cenários", async () => {
    // Act
    const res = await request(app)
      .post("/api/simulator/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send([validSimulationBody]);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockRunSimulation).not.toHaveBeenCalled();
  });

  it("deve retornar 400 quando array tem mais de 5 cenários", async () => {
    // Arrange — 6 cenários
    const scenarios = Array.from({ length: 6 }, () => validSimulationBody);

    // Act
    const res = await request(app)
      .post("/api/simulator/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send(scenarios);

    // Assert
    expect(res.status).toBe(400);
    expect(mockRunSimulation).not.toHaveBeenCalled();
  });
});

// ─── POST /api/simulator/compare — resposta do serviço ───────────────────────

describe("POST /api/simulator/compare — resposta do serviço", () => {
  it("deve retornar 200 com array de resultados para 2 cenários válidos", async () => {
    // Arrange — dois cenários distintos
    const scenario2 = { ...validSimulationBody, ibgeCode: VALID_IBGE_CODE_2 };
    const result2 = { ...simulationResultFixture, ibgeCode: VALID_IBGE_CODE_2, municipalityName: "Blumenau" };

    mockRunSimulation
      .mockResolvedValueOnce(simulationResultFixture)
      .mockResolvedValueOnce(result2);

    // Act
    const res = await request(app)
      .post("/api/simulator/compare")
      .set("Authorization", `Bearer ${validToken}`)
      .send([validSimulationBody, scenario2]);

    // Assert
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(mockRunSimulation).toHaveBeenCalledTimes(2);
  });
});
