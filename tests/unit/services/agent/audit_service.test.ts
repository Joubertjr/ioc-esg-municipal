import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock("../../../../backend/lib/prisma.js", () => ({
  prisma: { agentAuditLog: { create: mockCreate } },
}));

vi.mock("../../../../backend/utils/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const { appendAgentAudit, hashPrompt } =
  await import("../../../../backend/services/agent/audit_service.js");

describe("audit_service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({});
  });

  it("grava entrada de auditoria", async () => {
    await appendAgentAudit({
      userId: "user-1",
      municipalityId: "mun-1",
      action: "agent_query",
      toolNames: ["ods_score_reader"],
      promptText: "Qual ODS 3?",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "agent_query",
          promptHash: expect.any(String),
        }),
      }),
    );
  });

  it("hashPrompt é determinístico", () => {
    expect(hashPrompt("teste")).toBe(hashPrompt("teste"));
  });
});
