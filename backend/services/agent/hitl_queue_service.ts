import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { persistSimulationResult } from "../simulator/simulator_service.js";
import type { SimulationResult } from "../simulator/simulator_service.js";
import { appendAgentAudit } from "./audit_service.js";
import { publishExecutiveReportFromHitl } from "./published_report_service.js";
import type { ExecutiveReport } from "./schemas.js";

export type HitlAction = "persist_scenario" | "publish_report";
export type HitlStatus = "pending" | "approved" | "rejected";

export interface HitlRequestDto {
  id: string;
  action: HitlAction;
  status: HitlStatus;
  municipalityId: string;
  requestedById: string;
  reviewedById: string | null;
  payload: unknown;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

function toDto(row: {
  id: string;
  action: string;
  status: string;
  municipalityId: string;
  requestedById: string;
  reviewedById: string | null;
  payload: unknown;
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}): HitlRequestDto {
  return {
    id: row.id,
    action: row.action as HitlAction,
    status: row.status as HitlStatus,
    municipalityId: row.municipalityId,
    requestedById: row.requestedById,
    reviewedById: row.reviewedById,
    payload: row.payload,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

export async function resolveMunicipalityDbId(ibgeCode: string): Promise<string | null> {
  const m = await prisma.municipality.findUnique({
    where: { ibgeCode },
    select: { id: true },
  });
  return m?.id ?? null;
}

export async function createHitlRequest(params: {
  action: HitlAction;
  municipalityId: string;
  requestedById: string;
  payload: unknown;
}): Promise<HitlRequestDto> {
  const row = await prisma.hitlRequest.create({
    data: {
      action: params.action,
      status: "pending",
      municipalityId: params.municipalityId,
      requestedById: params.requestedById,
      payload: params.payload as object,
    },
  });
  logger.info("[hitl] pedido criado", { id: row.id, action: params.action });
  return toDto(row);
}

export async function listPendingHitlRequests(municipalityId?: string): Promise<HitlRequestDto[]> {
  const rows = await prisma.hitlRequest.findMany({
    where: {
      status: "pending",
      ...(municipalityId ? { municipalityId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return rows.map(toDto);
}

async function executeApprovedAction(
  action: HitlAction,
  payload: unknown,
  context: { reviewerId: string; municipalityId: string; hitlRequestId: string },
): Promise<void> {
  if (action === "persist_scenario") {
    const body = payload as { simulationResult?: SimulationResult };
    if (!body.simulationResult) {
      throw new Error("Payload HITL inválido: simulationResult ausente");
    }
    await persistSimulationResult(body.simulationResult);
    return;
  }

  const body = payload as { ibgeCode?: string; executiveReport?: ExecutiveReport };
  if (!body.ibgeCode || !body.executiveReport) {
    throw new Error("Payload HITL inválido: executiveReport ausente");
  }
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

  return toDto(updated);
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

  return toDto(updated);
}
