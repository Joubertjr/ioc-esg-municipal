import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { ODS_DEFINITIONS } from "../../../shared/constants/ods.js";
import { getOdsStatus } from "../../../shared/types/domain/ods.js";
import { calculateGeometricMean } from "../ods/ods_score_service.js";

/**
 * Recalcula OdsScore para todos os municípios a partir dos OdsIndicator no banco.
 * Usa a mesma lógica de score do ods_score_service (média aritmética por ODS,
 * média ponderada global, média geométrica).
 */
export async function recalculateAllScores(): Promise<{
  municipalities: number;
  scoresUpserted: number;
}> {
  const municipalities = await prisma.municipality.findMany({
    where: { deletedAt: null },
    select: { id: true, ibgeCode: true },
  });

  let scoresUpserted = 0;

  for (const municipality of municipalities) {
    const count = await recalculateMunicipalityScores(municipality.id);
    scoresUpserted += count;
  }

  logger.info("[score-recalculator] recalculation complete", {
    municipalities: municipalities.length,
    scoresUpserted,
  });

  return { municipalities: municipalities.length, scoresUpserted };
}

/**
 * Recalcula scores para um único município.
 * Retorna o número de OdsScore upsertados.
 */
async function recalculateMunicipalityScores(municipalityId: string): Promise<number> {
  // Buscar todos os indicadores do município
  const indicators = await prisma.odsIndicator.findMany({
    where: { municipalityId },
    select: {
      odsNumber: true,
      score: true,
      source: true,
      referenceYear: true,
    },
  });

  if (indicators.length === 0) return 0;

  // Determinar referenceYear mais recente
  const referenceYear = Math.max(...indicators.map((i) => i.referenceYear));

  // Agrupar por ODS
  const indicatorsByOds = new Map<number, typeof indicators>();
  for (const ind of indicators) {
    const existing = indicatorsByOds.get(ind.odsNumber) ?? [];
    existing.push(ind);
    indicatorsByOds.set(ind.odsNumber, existing);
  }

  const upserts: ReturnType<typeof prisma.odsScore.upsert>[] = [];
  const geoScores: number[] = [];
  const geoWeights: number[] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  let withDataCount = 0;

  for (const def of ODS_DEFINITIONS) {
    const odsIndicators = indicatorsByOds.get(def.number) ?? [];
    const sources = [...new Set(odsIndicators.map((i) => i.source))];
    const validScores = odsIndicators.map((i) => i.score).filter((s): s is number => s !== null);

    let score: number | null = null;
    let status: string | null = null;

    if (validScores.length > 0) {
      score = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
      status = getOdsStatus(score);

      const weight = def.weight;
      weightedSum += score * weight;
      weightTotal += weight;
      withDataCount++;
      geoScores.push(score);
      geoWeights.push(weight);
    }

    upserts.push(
      prisma.odsScore.upsert({
        where: {
          municipalityId_odsNumber_referenceYear: {
            municipalityId,
            odsNumber: def.number,
            referenceYear,
          },
        },
        update: {
          score,
          status,
          indicatorCount: odsIndicators.length,
          sources,
          calculatedAt: new Date(),
        },
        create: {
          municipalityId,
          odsNumber: def.number,
          score,
          status,
          indicatorCount: odsIndicators.length,
          referenceYear,
          sources,
        },
      }),
    );
  }

  // Global score (odsNumber = 0)
  const globalScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null;
  const globalStatus = globalScore !== null ? getOdsStatus(globalScore) : null;
  const geometricScore =
    geoScores.length > 0 ? calculateGeometricMean(geoScores, geoWeights) : null;

  upserts.push(
    prisma.odsScore.upsert({
      where: {
        municipalityId_odsNumber_referenceYear: {
          municipalityId,
          odsNumber: 0,
          referenceYear,
        },
      },
      update: {
        score: globalScore,
        geometricScore,
        status: globalStatus,
        indicatorCount: withDataCount,
        sources: ["global"],
        calculatedAt: new Date(),
      },
      create: {
        municipalityId,
        odsNumber: 0,
        score: globalScore,
        geometricScore,
        status: globalStatus,
        indicatorCount: withDataCount,
        referenceYear,
        sources: ["global"],
      },
    }),
  );

  await prisma.$transaction(upserts);
  return upserts.length;
}
