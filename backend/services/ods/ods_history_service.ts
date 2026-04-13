import { prisma } from "../../lib/prisma.js";
import { calculateMunicipalOds, type MunicipalOdsReport } from "./ods_score_service.js";
import { logger } from "../../utils/logger.js";

/**
 * Calcula e persiste scores ODS de um município no banco.
 * Aceita um report já calculado para evitar chamada dupla à calculateMunicipalOds
 * (o caller normalmente já tem o report em cache).
 */
export async function calculateAndPersistScores(
  ibgeCode: string,
  existingReport?: MunicipalOdsReport,
): Promise<MunicipalOdsReport | null> {
  const report = existingReport ?? (await calculateMunicipalOds(ibgeCode));
  if (!report) return null;

  const municipality = await prisma.municipality.findUnique({
    where: { ibgeCode },
  });

  if (!municipality) {
    logger.warn("[ods-history] município não encontrado no banco", { ibgeCode });
    return report;
  }

  const upserts = report.ods.map((ods) =>
    prisma.odsScore.upsert({
      where: {
        municipalityId_odsNumber_referenceYear: {
          municipalityId: municipality.id,
          odsNumber: ods.odsNumber,
          referenceYear: report.referenceYear,
        },
      },
      update: {
        score: ods.score,
        status: ods.status,
        indicatorCount: ods.indicators.length,
        sources: ods.sources,
        calculatedAt: new Date(),
      },
      create: {
        municipalityId: municipality.id,
        odsNumber: ods.odsNumber,
        score: ods.score,
        status: ods.status,
        indicatorCount: ods.indicators.length,
        referenceYear: report.referenceYear,
        sources: ods.sources,
      },
    }),
  );

  // Global score (odsNumber = 0)
  upserts.push(
    prisma.odsScore.upsert({
      where: {
        municipalityId_odsNumber_referenceYear: {
          municipalityId: municipality.id,
          odsNumber: 0,
          referenceYear: report.referenceYear,
        },
      },
      update: {
        score: report.globalScore,
        geometricScore: report.geometricScore,
        status: report.globalStatus,
        indicatorCount: report.odsCount.withData,
        sources: ["global"],
        calculatedAt: new Date(),
      },
      create: {
        municipalityId: municipality.id,
        odsNumber: 0,
        score: report.globalScore,
        geometricScore: report.geometricScore,
        status: report.globalStatus,
        indicatorCount: report.odsCount.withData,
        referenceYear: report.referenceYear,
        sources: ["global"],
      },
    }),
  );

  await prisma.$transaction(upserts);

  logger.info("[ods-history] scores persistidos", {
    ibgeCode,
    referenceYear: report.referenceYear,
    odsCount: report.odsCount.withData,
  });

  return report;
}

/**
 * Busca histórico de scores ODS de um município.
 */
export async function getScoreHistory(ibgeCode: string, odsNumber?: number, limit = 100) {
  // Single query via nested select — evita round-trip extra de findUnique
  const municipality = await prisma.municipality.findUnique({
    where: { ibgeCode },
    select: {
      odsScores: {
        where: odsNumber !== undefined ? { odsNumber } : undefined,
        orderBy: [{ referenceYear: "desc" }, { odsNumber: "asc" }],
        take: limit,
      },
    },
  });

  return municipality?.odsScores ?? [];
}
