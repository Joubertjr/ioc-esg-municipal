import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const {
  mockGenerateExecutive,
  mockAnswerQuery,
  mockHitlCheck,
  mockListPending,
  mockApprove,
  mockAppendAudit,
  mockResolveMunicipality,
} = vi.hoisted(() => ({
  mockGenerateExecutive: vi.fn(),
  mockAnswerQuery: vi.fn(),
  mockHitlCheck: vi.fn(),
  mockListPending: vi.fn(),
  mockApprove: vi.fn(),
  mockAppendAudit: vi.fn(),
  mockResolveMunicipality: vi.fn(),
}));

vi.mock("../../../backend/services/agent/executive_report_service.js", () => ({
  generateExecutiveReport: mockGenerateExecutive,
}));

vi.mock("../../../backend/services/agent/agent_query_service.js", () => ({
  answerAgentQuery: mockAnswerQuery,
}));

vi.mock("../../../backend/services/agent/hitl_service.js", () => ({
  checkHitlRequirement: mockHitlCheck,
}));

vi.mock("../../../backend/services/agent/hitl_queue_service.js", () => ({
  listPendingHitlRequests: mockListPending,
  approveHitlRequest: mockApprove,
  rejectHitlRequest: vi.fn(),
  resolveMunicipalityDbId: mockResolveMunicipality,
}));

vi.mock("../../../backend/services/agent/audit_service.js", () => ({
  appendAgentAudit: mockAppendAudit,
}));

vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {
    municipality: {
      findUnique: vi.fn().mockResolvedValue({ id: "mun-db", ibgeCode: "4205407" }),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../backend/middleware/auth.js", () => ({
  authenticateToken: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireMunicipalityScope: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { default: agentRouter } = await import("../../../backend/routes/agent.js");

const MOCK_EXECUTIVE = {
  municipalityId: "4205407",
  generatedAt: "2026-05-27T12:00:00.000Z",
  summary: "Resumo executivo estruturado com indicadores consolidados para o município.",
  odsScores: [
    { odsNumber: 3, score: 65, status: "amarelo" as const, staleness: "recent" as const },
  ],
  recommendations: [
    {
      title: "Investir em saneamento",
      targetOds: 6,
      rationale: "Score crítico no ODS 6 exige ação prioritária em saneamento básico.",
      estimatedImpact: "+35 pontos estimados",
      citations: [{ sourceName: "SNIS", referenceYear: 2023 }],
      priority: "alta" as const,
    },
  ],
  citations: [{ sourceName: "SNIS", referenceYear: 2023 }],
  confidence: 0.85,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/agent", agentRouter);
  return app;
}

describe("GET /api/agent/reports/:ibgeCode/executive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateExecutive.mockResolvedValue(MOCK_EXECUTIVE);
  });

  it("retorna 200 com contrato MDO", async () => {
    const res = await request(buildApp()).get("/api/agent/reports/4205407/executive");
    expect(res.status).toBe(200);
    expect(res.body.municipalityId).toBe("4205407");
    expect(res.body.confidence).toBe(0.85);
    expect(mockGenerateExecutive).toHaveBeenCalledWith("4205407");
  });

  it("retorna 404 sem dados", async () => {
    mockGenerateExecutive.mockResolvedValue(null);
    const res = await request(buildApp()).get("/api/agent/reports/4205407/executive");
    expect(res.status).toBe(404);
  });

  it("retorna 400 para ibgeCode inválido", async () => {
    const res = await request(buildApp()).get("/api/agent/reports/abc/executive");
    expect(res.status).toBe(400);
  });
});

describe("POST /api/agent/query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnswerQuery.mockResolvedValue({
      municipalityId: "4205407",
      question: "Qual o ODS 3?",
      answer: "ODS 3: 58.0",
      citations: [{ sourceName: "DATASUS", referenceYear: 2024 }],
      confidence: 0.85,
      answeredAt: "2026-05-28T12:00:00.000Z",
      mode: "deterministic",
    });
  });

  it("retorna 200 com resposta determinística", async () => {
    const res = await request(buildApp()).post("/api/agent/query").send({
      municipalityId: "4205407",
      question: "Qual o ODS 3?",
      role: "prefeito",
      locale: "pt-BR",
    });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("deterministic");
  });

  it("retorna 400 para body inválido", async () => {
    const res = await request(buildApp()).post("/api/agent/query").send({ question: "x" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/agent/hitl/pending", () => {
  beforeEach(() => {
    mockListPending.mockResolvedValue([]);
  });

  it("retorna lista vazia", async () => {
    const res = await request(buildApp()).get("/api/agent/hitl/pending");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });
});

describe("POST /api/agent/hitl/check", () => {
  beforeEach(() => {
    mockHitlCheck.mockReturnValue({
      action: "persist_scenario",
      requiresHitl: true,
      reason: "Persistir cenário exige aprovação.",
      approverRoles: ["admin", "prefeito"],
    });
  });

  it("retorna regra HITL", async () => {
    const res = await request(buildApp())
      .post("/api/agent/hitl/check")
      .send({ action: "persist_scenario" });
    expect(res.status).toBe(200);
    expect(res.body.requiresHitl).toBe(true);
  });
});
