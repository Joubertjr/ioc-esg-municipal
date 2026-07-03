import { prisma } from "../../lib/prisma.js";
import { appendAgentAudit } from "./audit_service.js";
import {
  createHitlRequest,
  resolveMunicipalityDbId,
  toHitlDto,
  type HitlAction,
  type HitlRequestDto,
} from "./hitl_persistence.js";
import type { ExecutiveReport } from "./schemas.js";

export { createHitlRequest, resolveMunicipalityDbId };
export type { HitlAction, HitlRequestDto, HitlStatus } from "./hitl_persistence.js";

export async function listPendingHitlRequests(municipalityId?: string): Promise<HitlRequestDto[]> {
  const rows = await prisma.hitlRequest.findMany({
    where: {
      status: "pending",
      ...(municipalityId ? { municipalityId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return rows.map(toHitlDto);
}

async function executeApprovedAction(
  action: HitlAction,
  payload: unknown,
  context: { reviewerId: string; municipalityId: string; hitlRequestId: string },
): Promise<void> {
  if (action === "persist_scenario") {
    const body = payload as { simulationResult?: unknown };
    if (!body.simulationResult) {
      throw new Error("Payload HITL inválido: simulationResult ausente");
    }
    const { persistSimulationResult } = await import("../simulator/simulator_service.js");
    await persistSimulationResult(
      body.simulationResult as Parameters<typeof persistSimulationResult>[0],
    );
    return;
  }

  const body = payload as { ibgeCode?: string; executiveReport?: ExecutiveReport };
  if (!body.ibgeCode || !body.executiveReport) {
    throw new Error("Payload HITL inválido: executiveReport ausente");
  }
  const { publishExecutiveReportFromHitl } = await import("./published_report_service.js");
  await publishExecutiveReportFromHitl(
    { ibgeCode: body.ibgeCode, executiveReport: body.executiveReport },
    context.reviewerId,
    context.municipalityId,
    context.hitlRequestId,
  );
}

export async function approveHitlRequest(params: {
  requestId: string;
  reviewerId: string;
  reviewerRole: string;
  municipalityScopeId: string | null;
}): Promise<HitlRequestDto> {
  if (params.reviewerRole !== "admin" && params.reviewerRole !== "prefeito") {
    throw new Error("Apenas admin ou prefeito podem aprovar pedidos HITL");
  }

  const existing = await prisma.hitlRequest.findUnique({ where: { id: params.requestId } });
  if (!existing || existing.status !== "pending") {
    throw new Error("Pedido HITL não encontrado ou já processado");
  }

  if (
    params.reviewerRole !== "admin" &&
    params.municipalityScopeId &&
    existing.municipalityId !== params.municipalityScopeId
  ) {
    throw new Error("Acesso negado ao pedido de outro município");
  }

  await executeApprovedAction(existing.action as HitlAction, existing.payload, {
    reviewerId: params.reviewerId,
    municipalityId: existing.municipalityId,
    hitlRequestId: existing.id,
  });

  const updated = await prisma.hitlRequest.update({
    where: { id: params.requestId },
    data: {
      status: "approved",
      reviewedById: params.reviewerId,
      reviewedAt: new Date(),
    },
  });

  void appendAgentAudit({
    userId: params.reviewerId,
    municipalityId: existing.municipalityId,
    action: "hitl_approved",
    toolNames: ["hitl_queue"],
    metadata: { hitlRequestId: existing.id, hitlAction: existing.action },
  });

  return toHitlDto(updated);
}

export async function rejectHitlRequest(params: {
  requestId: string;
  reviewerId: string;
  reviewerRole: string;
  municipalityScopeId: string | null;
  reviewNote?: string;
}): Promise<HitlRequestDto> {
  if (params.reviewerRole !== "admin" && params.reviewerRole !== "prefeito") {
    throw new Error("Apenas admin ou prefeito podem rejeitar pedidos HITL");
  }

  const existing = await prisma.hitlRequest.findUnique({ where: { id: params.requestId } });
  if (!existing || existing.status !== "pending") {
    throw new Error("Pedido HITL não encontrado ou já processado");
  }

  if (
    params.reviewerRole !== "admin" &&
    params.municipalityScopeId &&
    existing.municipalityId !== params.municipalityScopeId
  ) {
    throw new Error("Acesso negado ao pedido de outro município");
  }

  const updated = await prisma.hitlRequest.update({
    where: { id: params.requestId },
    data: {
      status: "rejected",
      reviewedById: params.reviewerId,
      reviewedAt: new Date(),
      reviewNote: params.reviewNote ?? null,
    },
  });

  void appendAgentAudit({
    userId: params.reviewerId,
    municipalityId: existing.municipalityId,
    action: "hitl_rejected",
    toolNames: ["hitl_queue"],
    metadata: { hitlRequestId: existing.id },
  });

  return toHitlDto(updated);
}
