import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockRunSimulation } = vi.hoisted(() => ({
  mockRunSimulation: vi.fn(),
}));

vi.mock("../../../backend/services/simulator/simulator_service.js", () => ({
  runSimulation: mockRunSimulation,
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

// Prisma mock
vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {
    simulation: { create: vi.fn().mockResolvedValue({ id: "sim-1" }) },
    municipality: { findUnique: vi.fn().mockResolvedValue({ name: "Blumenau" }) },
  },
}));

vi.mock("../../../shared/data/ideb_2023.json", () => ({ default: {} }));
vi.mock("../../../shared/data/snis_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/tse_2024.json", () => ({ default: {} }));
vi.mock("../../../shared/data/aneel_gd_2023.json", () => ({ default: {} }));
vi.mock("../../../shared/data/snis_rs_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/ana_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/convenios_2023.json", () => ({ default: {} }));

const { default: simulatorRouter } = await import("../../../backend/routes/simulator.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/simulator", simulatorRouter);
  return app;
}

const DEFAULT_ALLOCATION = {
  education: 12,
  health: 13,
  sanitation: 12,
  environment: 13,
  security: 12,
  energy: 13,
  urbanization: 12,
  governance: 13,
};

const MOCK_RESULT = {
  ibgeCode: "4204202",
  municipalityName: "Blumenau",
  totalAmount: 5_000_000,
  allocation: DEFAULT_ALLOCATION,
  currentGlobalScore: 55,
  projectedGlobalScore: 62,
  globalDelta: 7,
  ods: Array.from({ length: 17 }, (_, i) => ({
    odsNumber: i + 1,
    name: `ODS ${i + 1}`,
    shortName: `ODS${i + 1}`,
    color: "#000000",
    currentScore: 50,
    projectedScore: 55,
    delta: 5,
    currentStatus: "amarelo",
    projectedStatus: "amarelo",
  })),
};

describe("POST /api/simulator/simulate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunSimulation.mockResolvedValue(MOCK_RESULT);
  });

  it("retorna 200 com resultado de simulação válido", async () => {
    const app = buildApp();

    const res = await request(app).post("/api/simulator/simulate").send({
      ibgeCode: "4204202",
      totalAmount: 5000000,
      allocation: DEFAULT_ALLOCATION,
    });

    expect(res.status).toBe(200);
    expect(res.body.ibgeCode).toBe("4204202");
    expect(res.body.ods).toHaveLength(17);
    expect(mockRunSimulation).toHaveBeenCalledTimes(1);
  });

  it("retorna 400 quando ibgeCode é inválido", async () => {
    const app = buildApp();

    const res = await request(app).post("/api/simulator/simulate").send({
      ibgeCode: "abc",
      totalAmount: 5000000,
      allocation: DEFAULT_ALLOCATION,
    });

    expect(res.status).toBe(400);
  });

  it("retorna 400 quando totalAmount está ausente", async () => {
    const app = buildApp();

    const res = await request(app).post("/api/simulator/simulate").send({
      ibgeCode: "4204202",
      allocation: DEFAULT_ALLOCATION,
    });

    expect(res.status).toBe(400);
  });

  it("retorna 400 quando allocation tem percentual negativo", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/simulator/simulate")
      .send({
        ibgeCode: "4204202",
        totalAmount: 5000000,
        allocation: { ...DEFAULT_ALLOCATION, health: -10 },
      });

    expect(res.status).toBe(400);
  });

  it("retorna 400 quando totalAmount é negativo", async () => {
    const app = buildApp();

    const res = await request(app).post("/api/simulator/simulate").send({
      ibgeCode: "4204202",
      totalAmount: -100,
      allocation: DEFAULT_ALLOCATION,
    });

    expect(res.status).toBe(400);
  });

  it("retorna 400 quando allocation está ausente", async () => {
    const app = buildApp();

    const res = await request(app).post("/api/simulator/simulate").send({
      ibgeCode: "4204202",
      totalAmount: 5000000,
    });

    expect(res.status).toBe(400);
  });

  it("retorna 500 quando runSimulation lança erro", async () => {
    mockRunSimulation.mockRejectedValue(new Error("DB down"));
    const app = buildApp();

    const res = await request(app).post("/api/simulator/simulate").send({
      ibgeCode: "4204202",
      totalAmount: 5000000,
      allocation: DEFAULT_ALLOCATION,
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Erro interno");
  });
});

describe("POST /api/simulator/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunSimulation.mockResolvedValue(MOCK_RESULT);
  });

  it("retorna array de resultados para comparação", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/simulator/compare")
      .send([
        {
          ibgeCode: "4204202",
          totalAmount: 5000000,
          allocation: {
            education: 25,
            health: 25,
            sanitation: 15,
            environment: 10,
            security: 5,
            energy: 10,
            urbanization: 5,
            governance: 5,
          },
        },
        {
          ibgeCode: "4204202",
          totalAmount: 5000000,
          allocation: {
            education: 10,
            health: 10,
            sanitation: 25,
            environment: 25,
            security: 10,
            energy: 10,
            urbanization: 5,
            governance: 5,
          },
        },
      ]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockRunSimulation).toHaveBeenCalledTimes(2);
  });

  it("retorna 400 quando scenarios excede limite de 5", async () => {
    const app = buildApp();
    const scenarios = Array.from({ length: 6 }, () => ({
      ibgeCode: "4204202",
      totalAmount: 1000000,
      allocation: DEFAULT_ALLOCATION,
    }));

    const res = await request(app).post("/api/simulator/compare").send(scenarios);

    expect(res.status).toBe(400);
  });

  it("retorna 400 quando menos de 2 cenários", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/simulator/compare")
      .send([
        {
          ibgeCode: "4204202",
          totalAmount: 5000000,
          allocation: DEFAULT_ALLOCATION,
        },
      ]);

    expect(res.status).toBe(400);
  });
});
