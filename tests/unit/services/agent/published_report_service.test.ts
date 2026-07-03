import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockGenerate, mockCreateHitl } = vi.hoisted(() => ({
  mockPrisma: {
    municipality: { findUnique: vi.fn() },
    publishedExecutiveReport: { create: vi.fn(), findFirst: vi.fn() },
  },
  mockGenerate: vi.fn(),
  mockCreateHitl: vi.fn(),
}));

vi.mock("../../../../backend/lib/prisma.js", () => ({ prisma: mockPrisma }));

vi.mock("../../../../backend/services/agent/executive_report_service.js", () => ({
  generateExecutiveReport: mockGenerate,
}));

vi.mock("../../../../backend/services/agent/hitl_persistence.js", () => ({
  createHitlRequest: mockCreateHitl,
}));

const { requestPublishExecutiveReport, getLatestPublishedReport } =
  await import("../../../../backend/services/agent/published_report_service.js");

const MOCK_REPORT = {
  municipalityId: "4205407",
  generatedAt: "2026-05-28T12:00:00.000Z",
  summary: "Resumo executivo com dados consolidados do município piloto.",
  odsScores: [{ odsNumber: 3, score: 60, status: "amarelo", staleness: "recent" }],
  recommendations: [
    {
      title: "Investir em saneamento",
      targetOds: 6,
      rationale: "Score crítico no ODS 6 exige ação prioritária em saneamento básico.",
      estimatedImpact: "+20 pts",
      citations: [{ sourceName: "SNIS", referenceYear: 2023 }],
      priority: "alta",
    },
  ],
  citations: [{ sourceName: "SNIS", referenceYear: 2023 }],
  confidence: 0.85,
};

describe("published_report_service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockResolvedValue(MOCK_REPORT);
    mockCreateHitl.mockResolvedValue({ id: "hitl-pub-1", status: "pending" });
  });

  it("cria pedido HITL para publicação", async () => {
    const result = await requestPublishExecutiveReport({
      ibgeCode: "4205407",
      requestedByUserId: "user-1",
      municipalityDbId: "mun-1",
    });
    expect(result.status).toBe("pending");
    expect(mockCreateHitl).toHaveBeenCalledWith(
      expect.objectContaining({ action: "publish_report" }),
    );
  });

  it("retorna null sem publicação", async () => {
    mockPrisma.publishedExecutiveReport.findFirst.mockResolvedValue(null);
    const latest = await getLatestPublishedReport("4205407");
    expect(latest).toBeNull();
  });
});
