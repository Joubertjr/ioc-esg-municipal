import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";

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

export function toHitlDto(row: {
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
  return toHitlDto(row);
}
