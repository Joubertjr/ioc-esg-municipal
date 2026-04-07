import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Hoisted mocks (devem ser declarados antes de qualquer import que acione o módulo) ──

const { mockGenerateRecommendations } = vi.hoisted(() => ({
  mockGenerateRecommendations: vi.fn(),
}));

vi.mock("../../../backend/services/recommendations/recommendation_service.js", () => ({
  generateRecommendations: mockGenerateRecommendations,
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
}));

const { default: recommendationsRouter } =
  await import("../../../backend/routes/recommendations.js");

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_RECOMMENDATION_REPORT = {
  ibgeCode: "4204202",
  municipalityName: "Blumenau",
  generatedAt: "2026-04-07T00:00:00.000Z",
  totalRecommendations: 3,
  criticalCount: 1,
  summary:
    "Blumenau tem 1 ODS em situação crítica (score < 40 e abaixo da média estadual). 2 indicadores estão abaixo da média estadual. Prioridade imediata: Água Potável e Saneamento (ODS 6) e Erradicação da Pobreza (ODS 1).",
  recommendations: [
    {
      odsNumber: 6,
      odsName: "Água Potável e Saneamento",
      priority: "critica" as const,
      currentScore: 30,
      stateAverage: 62,
      gap: -32,
      ranking: "abaixo da média estadual",
      actions: [
        "Expandir rede de coleta e tratamento de esgoto",
        "Reduzir perdas na distribuição de água (programa de eficiência hídrica)",
      ],
      investmentArea: "saneamento básico",
      estimatedImpact: "Alto",
    },
    {
      odsNumber: 1,
      odsName: "Erradicação da Pobreza",
      priority: "alta" as const,
      currentScore: 38,
      stateAverage: null,
      gap: null,
      ranking: "sem dados de comparação estadual",
      actions: ["Ampliar cobertura do Cadastro Único"],
      investmentArea: "assistência social",
      estimatedImpact: "Médio",
    },
    {
      odsNumber: 4,
      odsName: "Educação de Qualidade",
      priority: "media" as const,
      currentScore: 55,
      stateAverage: 60,
      gap: -5,
      ranking: "abaixo da média estadual",
      actions: ["Investir em formação continuada de professores da rede municipal"],
      investmentArea: "educação",
      estimatedImpact: "Baixo",
    },
  ],
  strengths: [
    { odsNumber: 7, odsName: "Energia Limpa e Acessível", score: 78 },
    { odsNumber: 11, odsName: "Cidades e Comunidades Sustentáveis", score: 72 },
  ],
};

// ─── App factory ─────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/recommendations", recommendationsRouter);
  return app;
}

// ─── GET /api/recommendations/:ibgeCode ──────────────────────────────────────

describe("GET /api/recommendations/:ibgeCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateRecommendations.mockResolvedValue(MOCK_RECOMMENDATION_REPORT);
  });

  it("retorna 200 com dados válidos para ibgeCode de 7 dígitos", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/recommendations/4204202");

    expect(res.status).toBe(200);
    expect(res.body.ibgeCode).toBe("4204202");
    expect(res.body.municipalityName).toBe("Blumenau");
    expect(mockGenerateRecommendations).toHaveBeenCalledOnce();
    expect(mockGenerateRecommendations).toHaveBeenCalledWith("4204202");
  });

  it("response contém todos os campos obrigatórios do RecommendationReport", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/recommendations/4204202");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ibgeCode");
    expect(res.body).toHaveProperty("municipalityName");
    expect(res.body).toHaveProperty("generatedAt");
    expect(res.body).toHaveProperty("totalRecommendations");
    expect(res.body).toHaveProperty("criticalCount");
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("recommendations");
    expect(res.body).toHaveProperty("strengths");
  });

  it("recommendations têm os campos esperados de SmartRecommendation", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/recommendations/4204202");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recommendations)).toBe(true);

    const rec = res.body.recommendations[0] as Record<string, unknown>;
    expect(rec).toHaveProperty("odsNumber");
    expect(rec).toHaveProperty("odsName");
    expect(rec).toHaveProperty("priority");
    expect(rec).toHaveProperty("currentScore");
    expect(rec).toHaveProperty("stateAverage");
    expect(rec).toHaveProperty("gap");
    expect(rec).toHaveProperty("ranking");
    expect(rec).toHaveProperty("actions");
    expect(rec).toHaveProperty("investmentArea");
    expect(rec).toHaveProperty("estimatedImpact");
  });

  it("retorna 400 para ibgeCode com menos de 7 dígitos", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/recommendations/12345");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockGenerateRecommendations).not.toHaveBeenCalled();
  });

  it("retorna 400 para ibgeCode com mais de 7 dígitos", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/recommendations/12345678");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockGenerateRecommendations).not.toHaveBeenCalled();
  });

  it("retorna 400 para ibgeCode com letras", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/recommendations/abc4202");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockGenerateRecommendations).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o serviço não encontra dados para o ibgeCode", async () => {
    mockGenerateRecommendations.mockResolvedValue(null);
    const app = buildApp();

    const res = await request(app).get("/api/recommendations/0000000");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toContain("0000000");
    expect(mockGenerateRecommendations).toHaveBeenCalledWith("0000000");
  });

  it("retorna 500 quando o serviço lança erro interno", async () => {
    mockGenerateRecommendations.mockRejectedValue(new Error("Timeout na API do IBGE"));
    const app = buildApp();

    const res = await request(app).get("/api/recommendations/4204202");

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Erro interno");
    expect(mockGenerateRecommendations).toHaveBeenCalledOnce();
  });
});
