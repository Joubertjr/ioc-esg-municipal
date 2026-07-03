import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { generateExecutiveReport } from "./executive_report_service.js";
import { createHitlRequest } from "./hitl_persistence.js";
import type { ExecutiveReport } from "./schemas.js";

export interface PublishedReportDto {
  id: string;
  ibgeCode: string;
  municipalityId: string;
  report: ExecutiveReport;
  institutionStamp: string;
  publishedAt: string;
  publishedById: string;
}

function buildInstitutionStamp(municipalityName: string): string {
  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const org = process.env.INSTITUTION_STAMP_PREFIX ?? "Prefeitura Municipal";
  return `${org} — ${municipalityName} — Documento publicado em ${date} via IOC ESG Municipal (MDO).`;
}

export async function requestPublishExecutiveReport(params: {
  ibgeCode: string;
  requestedByUserId: string;
  municipalityDbId: string;
}): Promise<{ hitlRequestId: string; status: "pending" }> {
  const report = await generateExecutiveReport(params.ibgeCode);
  if (!report) {
    throw new Error("Não há dados suficientes para publicar o relatório executivo");
  }

  const hitl = await createHitlRequest({
    action: "publish_report",
    municipalityId: params.municipalityDbId,
    requestedById: params.requestedByUserId,
    payload: {
      ibgeCode: params.ibgeCode,
      executiveReport: report,
    },
  });

  return { hitlRequestId: hitl.id, status: "pending" };
}

export async function publishExecutiveReportFromHitl(
  payload: { ibgeCode: string; executiveReport: ExecutiveReport },
  reviewerId: string,
  municipalityDbId: string,
  hitlRequestId?: string,
): Promise<PublishedReportDto> {
  const municipality = await prisma.municipality.findUnique({
    where: { id: municipalityDbId },
    select: { name: true },
  });

  const stamp = buildInstitutionStamp(municipality?.name ?? payload.ibgeCode);

  const row = await prisma.publishedExecutiveReport.create({
    data: {
      municipalityId: municipalityDbId,
      ibgeCode: payload.ibgeCode,
      reportSnapshot: payload.executiveReport as object,
      institutionStamp: stamp,
      publishedById: reviewerId,
      hitlRequestId: hitlRequestId ?? null,
    },
  });

  logger.info("[publish] relatório executivo publicado", {
    ibgeCode: payload.ibgeCode,
    id: row.id,
  });

  return {
    id: row.id,
    ibgeCode: row.ibgeCode,
    municipalityId: row.municipalityId,
    report: payload.executiveReport,
    institutionStamp: row.institutionStamp,
    publishedAt: row.publishedAt.toISOString(),
    publishedById: row.publishedById,
  };
}

export async function getLatestPublishedReport(
  ibgeCode: string,
): Promise<PublishedReportDto | null> {
  const row = await prisma.publishedExecutiveReport.findFirst({
    where: { ibgeCode },
    orderBy: { publishedAt: "desc" },
  });

  if (!row) return null;

  return {
    id: row.id,
    ibgeCode: row.ibgeCode,
    municipalityId: row.municipalityId,
    report: row.reportSnapshot as ExecutiveReport,
    institutionStamp: row.institutionStamp,
    publishedAt: row.publishedAt.toISOString(),
    publishedById: row.publishedById,
  };
}
