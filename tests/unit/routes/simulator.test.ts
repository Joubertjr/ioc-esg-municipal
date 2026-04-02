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

const MOCK_RESULT = {
  ibgeCode: "4204202",
  scenarioName: "Test",
  totalInvestment: 5_000_000,
  currentGlobalScore: 55,
  projectedGlobalScore: 62,
  deltaGlobalScore: 7,
  odsProjections: Array.from({ length: 17 }, (_, i) => ({
    odsNumber: i + 1,
    name: `ODS ${i + 1}`,
    currentScore: 50,
    projectedScore: 55,
    delta: 5,
    primaryInvestment: 0,
    secondaryInvestment: 0,
    status: "amarelo",
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

    const res = await request(app)
      .post("/api/simulator/simulate")
      .send({
        ibgeCode: "4204202",
        scenarioName: "Teste saúde",
        allocations: [{ area: "health", amount: 5000000 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.ibgeCode).toBe("4204202");
    expect(res.body.odsProjections).toHaveLength(17);
    expect(mockRunSimulation).toHaveBeenCalledTimes(1);
  });

  it("retorna 400 quando ibgeCode é inválido", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/simulator/simulate")
      .send({
        ibgeCode: "abc",
        scenarioName: "Teste",
        allocations: [{ area: "health", amount: 5000000 }],
      });

    expect(res.status).toBe(400);
  });

  it("retorna 400 quando allocations está vazia", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/simulator/simulate")
      .send({
        ibgeCode: "4204202",
        scenarioName: "Teste",
        allocations: [],
      });

    expect(res.status).toBe(400);
  });

  it("retorna 400 quando area é inválida", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/simulator/simulate")
      .send({
        ibgeCode: "4204202",
        scenarioName: "Teste",
        allocations: [{ area: "invalid_area", amount: 5000000 }],
      });

    expect(res.status).toBe(400);
  });

  it("retorna 400 quando amount é negativo", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/simulator/simulate")
      .send({
        ibgeCode: "4204202",
        scenarioName: "Teste",
        allocations: [{ area: "health", amount: -100 }],
      });

    expect(res.status).toBe(400);
  });

  it("retorna 400 quando scenarioName está ausente", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/simulator/simulate")
      .send({
        ibgeCode: "4204202",
        allocations: [{ area: "health", amount: 5000000 }],
      });

    expect(res.status).toBe(400);
  });

  it("retorna 500 quando runSimulation lança erro", async () => {
    mockRunSimulation.mockRejectedValue(new Error("DB down"));
    const app = buildApp();

    const res = await request(app)
      .post("/api/simulator/simulate")
      .send({
        ibgeCode: "4204202",
        scenarioName: "Falha",
        allocations: [{ area: "health", amount: 5000000 }],
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
          scenarioName: "A",
          allocations: [{ area: "health", amount: 5000000 }],
        },
        {
          ibgeCode: "4204202",
          scenarioName: "B",
          allocations: [{ area: "education", amount: 5000000 }],
        },
      ]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockRunSimulation).toHaveBeenCalledTimes(2);
  });

  it("retorna 400 quando scenarios excede limite de 5", async () => {
    const app = buildApp();
    const scenarios = Array.from({ length: 6 }, (_, i) => ({
      ibgeCode: "4204202",
      scenarioName: `Cenário ${i}`,
      allocations: [{ area: "health" as const, amount: 1000000 }],
    }));

    const res = await request(app)
      .post("/api/simulator/compare")
      .send(scenarios);

    expect(res.status).toBe(400);
  });

  it("retorna 400 quando menos de 2 cenários", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/simulator/compare")
      .send([
        {
          ibgeCode: "4204202",
          scenarioName: "A",
          allocations: [{ area: "health", amount: 5000000 }],
        },
      ]);

    expect(res.status).toBe(400);
  });
});
