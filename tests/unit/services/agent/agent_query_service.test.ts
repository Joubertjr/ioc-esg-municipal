import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCalculate } = vi.hoisted(() => ({
  mockCalculate: vi.fn(),
}));

vi.mock("../../../../backend/services/ods/ods_score_service.js", () => ({
  calculateMunicipalOds: mockCalculate,
}));

const { answerAgentQuery } =
  await import("../../../../backend/services/agent/agent_query_service.js");

const BASE_REPORT = {
  ibgeCode: "4205407",
  municipalityName: "Florianópolis",
  referenceYear: 2024,
  globalScore: 62.5,
  globalStatus: "amarelo" as const,
  geometricScore: 60,
  geometricStatus: "amarelo" as const,
  odsCount: { total: 17, withData: 10, verde: 3, amarelo: 5, vermelho: 2 },
  dataFreshness: { staleness: "recent" as const },
  ods: [
    {
      odsNumber: 3,
      name: "Saúde",
      shortName: "Saúde",
      color: "#4C9F38",
      weight: 1,
      score: 58,
      status: "amarelo" as const,
      indicators: [],
      sources: ["DATASUS"],
      dataFreshness: { staleness: "recent" as const },
    },
    {
      odsNumber: 4,
      name: "Educação",
      shortName: "Educação",
      color: "#C5192D",
      weight: 1,
      score: 72,
      status: "verde" as const,
      indicators: [],
      sources: ["INEP"],
      dataFreshness: { staleness: "recent" as const },
    },
  ],
};

describe("answerAgentQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalculate.mockResolvedValue(BASE_REPORT);
  });

  it("responde pergunta sobre ODS específico", async () => {
    const result = await answerAgentQuery({
      municipalityId: "4205407",
      question: "Qual o score do ODS 3?",
      role: "prefeito",
      locale: "pt-BR",
    });

    expect(result).not.toBeNull();
    expect(result!.answer).toContain("ODS 3");
    expect(result!.answer).toContain("58.0");
    expect(result!.mode).toBe("deterministic");
    expect(result!.citations.length).toBeGreaterThan(0);
  });

  it("responde score global", async () => {
    const result = await answerAgentQuery({
      municipalityId: "4205407",
      question: "Qual o score global do município?",
      role: "secretario",
      locale: "pt-BR",
    });

    expect(result!.answer).toContain("62.5");
    expect(result!.confidence).toBeGreaterThan(0.8);
  });

  it("retorna null sem dados municipais", async () => {
    mockCalculate.mockResolvedValue(null);
    const result = await answerAgentQuery({
      municipalityId: "9999999",
      question: "ODS 1",
      role: "admin",
      locale: "pt-BR",
    });
    expect(result).toBeNull();
  });
});
