import { prisma } from "../../lib/prisma.js";
import { ODS_DEFINITIONS } from "../../../shared/constants/ods.js";
import {
  getOdsStatus,
  classifyStaleness,
  type DataFreshness,
  type SourceFreshness,
} from "../../../shared/types/domain/ods.js";
import type { MunicipalOdsReport, OdsSummary } from "../ods/ods_score_service.js";

/**
 * Lê MunicipalOdsReport diretamente do PostgreSQL (OdsIndicator + OdsScore).
 * Retorna null se o banco não tem dados para este município.
 * O formato é type-compatible com o report gerado em tempo real.
 */
export async function readOdsReportFromDatabase(
  ibgeCode: string,
): Promise<MunicipalOdsReport | null> {
  const municipality = await prisma.municipality.findUnique({
    where: { ibgeCode },
    select: { id: true, name: true },
  });

  if (!municipality) return null;

  // Verificar se temos scores calculados
  const scores = await prisma.odsScore.findMany({
    where: { municipalityId: municipality.id },
    orderBy: [{ referenceYear: "desc" }, { odsNumber: "asc" }],
  });

  if (scores.length === 0) return null;

  // Usar o referenceYear mais recente
  const referenceYear = Math.max(...scores.map((s) => s.referenceYear));
  const currentScores = scores.filter((s) => s.referenceYear === referenceYear);

  // Buscar indicadores para construir o detalhe por ODS
  const indicators = await prisma.odsIndicator.findMany({
    where: { municipalityId: municipality.id },
    orderBy: [{ odsNumber: "asc" }, { indicatorName: "asc" }],
  });

  // Buscar última ingestão para dataCollectedAt
  const lastRun = await prisma.ingestionRun.findFirst({
    where: { status: { in: ["completed", "partial"] } },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });

  // Agrupar indicadores por ODS
  const indicatorsByOds = new Map<number, typeof indicators>();
  for (const ind of indicators) {
    const existing = indicatorsByOds.get(ind.odsNumber) ?? [];
    existing.push(ind);
    indicatorsByOds.set(ind.odsNumber, existing);
  }

  // Indexar scores por odsNumber
  const scoreByOds = new Map(currentScores.map((s) => [s.odsNumber, s]));

  // Global score
  const globalRow = scoreByOds.get(0);
  const globalScore = globalRow?.score ?? null;
  const globalStatus = globalScore !== null ? getOdsStatus(globalScore) : null;
  const geometricScore = globalRow?.geometricScore ?? null;
  const geometricStatus = geometricScore !== null ? getOdsStatus(geometricScore) : null;

  let verdeCount = 0;
  let amareloCount = 0;
  let vermelhoCount = 0;
  let withDataCount = 0;

  const odsSummaries: OdsSummary[] = ODS_DEFINITIONS.map((def) => {
    const odsScore = scoreByOds.get(def.number);
    const odsIndicators = indicatorsByOds.get(def.number) ?? [];

    const score = odsScore?.score ?? null;
    const status = score !== null ? getOdsStatus(score) : null;
    const sources = odsScore?.sources ?? [];

    if (score !== null) {
      withDataCount++;
      if (status === "verde") verdeCount++;
      else if (status === "amarelo") amareloCount++;
      else if (status === "vermelho") vermelhoCount++;
    }

    // Converter indicadores Prisma para o formato OdsIndicator do domínio
    const domainIndicators = odsIndicators.map((ind) => ({
      id: ind.id,
      municipalityId: ind.municipalityId,
      odsNumber: ind.odsNumber,
      indicatorName: ind.indicatorName,
      value: ind.value !== null ? Number(ind.value) : null,
      score: ind.score,
      status: ind.status as "verde" | "amarelo" | "vermelho" | null,
      source: ind.source,
      referenceYear: ind.referenceYear,
      referenceDate: ind.referenceDate,
      dataAvailable: ind.dataAvailable,
    }));

    return {
      odsNumber: def.number,
      name: def.name,
      shortName: def.shortName,
      color: def.color,
      weight: def.weight,
      score,
      status,
      indicators: domainIndicators,
      sources,
      dataFreshness: buildDataFreshness(domainIndicators),
    };
  });

  // DataFreshness global
  const allDomainIndicators = odsSummaries.flatMap((o) => o.indicators);

  return {
    ibgeCode,
    municipalityName: municipality.name,
    referenceYear,
    globalScore,
    globalStatus,
    geometricScore,
    geometricStatus,
    odsCount: {
      total: 17,
      withData: withDataCount,
      verde: verdeCount,
      amarelo: amareloCount,
      vermelho: vermelhoCount,
    },
    dataFreshness: buildDataFreshness(allDomainIndicators),
    ods: odsSummaries,
    dataSource: "database",
    dataCollectedAt: lastRun?.completedAt?.toISOString() ?? null,
  };
}

// ─── Helper ───────────────────────────────────────────────────────���──────────

function buildDataFreshness(
  indicators: Array<{ source: string; referenceYear: number }>,
): DataFreshness {
  if (indicators.length === 0) {
    return {
      newestYear: null,
      oldestYear: null,
      ageYears: null,
      staleness: "unknown",
      sources: [],
    };
  }

  const currentYear = new Date().getFullYear();
  const yearBySource = new Map<string, number>();
  for (const ind of indicators) {
    const prev = yearBySource.get(ind.source);
    if (prev === undefined || ind.referenceYear > prev) {
      yearBySource.set(ind.source, ind.referenceYear);
    }
  }

  const sources: SourceFreshness[] = Array.from(yearBySource.entries())
    .map(([name, year]) => ({
      name,
      referenceYear: year,
      ageYears: currentYear - year,
      staleness: classifyStaleness(currentYear - year),
    }))
    .sort((a, b) => a.ageYears - b.ageYears);

  const years = sources.map((s) => s.referenceYear);
  const newestYear = Math.max(...years);
  const oldestYear = Math.min(...years);
  const ageYears = currentYear - oldestYear;

  return {
    newestYear,
    oldestYear,
    ageYears,
    staleness: classifyStaleness(ageYears),
    sources,
  };
}
