import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    hitlRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    municipality: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../../../backend/lib/prisma.js", () => ({
  prisma: mockPrisma,
}));

vi.mock("../../../../backend/services/simulator/simulator_service.js", () => ({
  persistSimulationResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../backend/services/agent/published_report_service.js", () => ({
  publishExecutiveReportFromHitl: vi.fn().mockResolvedValue({ id: "pub-1" }),
}));

vi.mock("../../../../backend/services/agent/audit_service.js", () => ({
  appendAgentAudit: vi.fn().mockResolvedValue(undefined),
}));

const { createHitlRequest, approveHitlRequest, listPendingHitlRequests } =
  await import("../../../../backend/services/agent/hitl_queue_service.js");

describe("hitl_queue_service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria pedido pending", async () => {
    mockPrisma.hitlRequest.create.mockResolvedValue({
      id: "hitl-1",
      action: "persist_scenario",
      status: "pending",
      municipalityId: "mun-1",
      requestedById: "user-1",
      reviewedById: null,
      payload: {},
      reviewNote: null,
      createdAt: new Date("2026-05-28T12:00:00Z"),
      reviewedAt: null,
    });

    const dto = await createHitlRequest({
      action: "persist_scenario",
      municipalityId: "mun-1",
      requestedById: "user-1",
      payload: { simulationResult: { ibgeCode: "4205407" } },
    });

    expect(dto.status).toBe("pending");
    expect(mockPrisma.hitlRequest.create).toHaveBeenCalled();
  });

  it("lista pedidos pendentes", async () => {
    mockPrisma.hitlRequest.findMany.mockResolvedValue([]);
    const list = await listPendingHitlRequests("mun-1");
    expect(list).toEqual([]);
  });

  it("rejeita aprovação de secretario", async () => {
    await expect(
      approveHitlRequest({
        requestId: "x",
        reviewerId: "u",
        reviewerRole: "secretario",
        municipalityScopeId: "mun-1",
      }),
    ).rejects.toThrow(/prefeito/);
  });
});
