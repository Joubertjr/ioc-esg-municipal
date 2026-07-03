import { IbgeCollector, mapToOdsIndicators as mapIbgeOds } from "../../agents/ibge/index.js";
import {
  SiconfiCollector,
  mapToOdsIndicators as mapSiconfiOds,
} from "../../agents/siconfi/index.js";
import {
  DatasusCollector,
  mapToOdsIndicators as mapDatasusOds,
} from "../../agents/datasus/index.js";
import { InepCollector, mapToOdsIndicators as mapInepOds } from "../../agents/inep/index.js";
import { SnisCollector, mapToOdsIndicators as mapSnisOds } from "../../agents/snis/index.js";
import { InpeCollector, mapToOdsIndicators as mapInpeOds } from "../../agents/inpe/index.js";
import { PncpCollector, mapToOdsIndicators as mapPncpOds } from "../../agents/pncp/index.js";
import { TseCollector, mapToOdsIndicators as mapTseOds } from "../../agents/tse/index.js";
import { AneelCollector, mapToOdsIndicators as mapAneelOds } from "../../agents/aneel/index.js";
import { SnisRsCollector, mapToOdsIndicators as mapSnisRsOds } from "../../agents/snis_rs/index.js";
import { AnaCollector, mapToOdsIndicators as mapAnaOds } from "../../agents/ana/index.js";
import {
  ConveniosCollector,
  mapToOdsIndicators as mapConveniosOds,
} from "../../agents/convenios/index.js";
import { AnatelCollector, mapToOdsIndicators as mapAnatelOds } from "../../agents/anatel/index.js";
import { SisvanCollector, mapToOdsIndicators as mapSisvanOds } from "../../agents/sisvan/index.js";
import { IepsCollector, mapToOdsIndicators as mapIepsOds } from "../../agents/ieps/index.js";
import { ODS_DEFINITIONS, getOdsDefinition } from "../../../shared/constants/ods.js";
import {
  getOdsStatus,
  classifyStaleness,
  type OdsIndicator,
  type OdsStatus,
  type DataFreshness,
  type SourceFreshness,
  type OdsSummary,
  type MunicipalOdsReport,
} from "../../../shared/types/domain/ods.js";
import { logger } from "../../utils/logger.js";
import { withCache } from "../../utils/cache.js";

/**
 * Média geométrica ponderada (padrão IDHM/ONU).
 * Floor em 1 para evitar ln(0) — scores zero contribuem como 1.
 */
export function calculateGeometricMean(scores: number[], weights?: number[]): number {
  if (scores.length === 0) return 0;
  const w = weights ?? scores.map(() => 1);
  const totalWeight = w.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;
  const weightedLogSum = scores.reduce((acc, s, i) => acc + w[i] * Math.log(Math.max(s, 1)), 0);
  return Math.round(Math.exp(weightedLogSum / totalWeight));
}

/**
 * Envolve uma promise com timeout independente.
 * Em caso de timeout ou erro, loga o aviso e retorna null em vez de rejeitar.
 * Isso impede que um coletor lento (ex: DATASUS) bloqueie o Promise.all inteiro.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
      ),
    ]);
  } catch (err) {
    logger.warn(`Collector ${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export type { OdsSummary, MunicipalOdsReport } from "../../../shared/types/domain/ods.js";

/**
 * Calcula freshness a partir de um conjunto de indicadores.
 * Usa o ano corrente (new Date().getFullYear()) como baseline.
 * Quando não há indicadores, retorna `unknown`.
 */
function buildDataFreshness(indicators: OdsIndicator[]): DataFreshness {
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

  // Agrupa por fonte, mantendo o ano mais recente por fonte
  const yearBySource = new Map<string, number>();
  for (const ind of indicators) {
    const prev = yearBySource.get(ind.source);
    if (prev === undefined || ind.referenceYear > prev) {
      yearBySource.set(ind.source, ind.referenceYear);
    }
  }

  const sources: SourceFreshness[] = Array.from(yearBySource.entries())
    .map(([name, year]) => {
      const age = currentYear - year;
      return {
        name,
        referenceYear: year,
        ageYears: age,
        staleness: classifyStaleness(age),
      };
    })
    .sort((a, b) => a.ageYears - b.ageYears);

  const years = sources.map((s) => s.referenceYear);
  const newestYear = Math.max(...years);
  const oldestYear = Math.min(...years);
  // Idade representativa = a do dado MAIS ANTIGO, porque o ODS só é
  // tão fresco quanto seu indicador mais desatualizado.
  const ageYears = currentYear - oldestYear;
  const staleness = classifyStaleness(ageYears);

  return { newestYear, oldestYear, ageYears, staleness, sources };
}

const ibgeCollector = new IbgeCollector();
const siconfiCollector = new SiconfiCollector();
const datasusCollector = new DatasusCollector();
const inepCollector = new InepCollector();
const snisCollector = new SnisCollector();
const inpeCollector = new InpeCollector();
const pncpCollector = new PncpCollector();
const tseCollector = new TseCollector();
const aneelCollector = new AneelCollector();
const snisRsCollector = new SnisRsCollector();
const anaCollector = new AnaCollector();
const conveniosCollector = new ConveniosCollector();
const anatelCollector = new AnatelCollector();
const sisvanCollector = new SisvanCollector();
const iepsCollector = new IepsCollector();

/**
 * Serviço que orquestra todos os coletores e consolida scores ODS para um município.
 *
 * Fluxo:
 * 1. Busca dados IBGE + SICONFI em paralelo
 * 2. Mapeia cada fonte para indicadores ODS
 * 3. Agrupa indicadores por ODS number
 * 4. Calcula score por ODS (média dos indicadores)
 * 5. Calcula score global (média ponderada dos ODS com dados)
 */
/**
 * TTL do cache do score ODS por município: 1 hora.
 * Compartilhado com a rota /api/ods/:ibgeCode (mesma chave).
 * Benchmark, compare e history service se beneficiam automaticamente.
 */
const ODS_REPORT_CACHE_TTL = 3_600;

export async function calculateMunicipalOds(ibgeCode: string): Promise<MunicipalOdsReport | null> {
  return withCache(`ods:report:${ibgeCode}`, ODS_REPORT_CACHE_TTL, async () => {
    // ADR-011: Try database first → fallback to real-time if empty
    const { readOdsReportFromDatabase } = await import("../ingestion/ods_score_reader.js");
    const dbReport = await readOdsReportFromDatabase(ibgeCode);
    if (dbReport) {
      logger.debug(`[ods] serving ${ibgeCode} from database`);
      return dbReport;
    }

    // Fallback: real-time collection (pre-ingestion or first access)
    logger.debug(`[ods] no database data for ${ibgeCode}, falling back to real-time`);
    const realtimeReport = await _fetchAndCalculate(ibgeCode);
    if (!realtimeReport) return null;

    return {
      ...realtimeReport,
      dataSource: "realtime" as const,
      dataCollectedAt: null,
    };
  });
}

async function _fetchAndCalculate(ibgeCode: string): Promise<MunicipalOdsReport | null> {
  // Buscar dados de todas as fontes em paralelo com budget de tempo por fonte.
  // DATASUS cai com frequência (timeout=30s x retries=3 = 93s no pior caso).
  // Budget de 10s por fonte garante resposta em ≤15s mesmo com DATASUS down.
  // INEP e SNIS são locais (JSON estático) — 1s é suficiente.
  const [
    ibgeData,
    siconfiData,
    datasusData,
    inepData,
    snisData,
    inpeData,
    pncpData,
    tseData,
    aneelData,
    snisRsData,
    anaData,
    conveniosData,
    anatelData,
    sisvanData,
    iepsData,
  ] = await Promise.all([
    withTimeout(ibgeCollector.collect(ibgeCode), 10_000, "ibge"),
    withTimeout(siconfiCollector.collect(ibgeCode), 15_000, "siconfi"),
    withTimeout(datasusCollector.collect(ibgeCode), 10_000, "datasus"),
    withTimeout(inepCollector.collect(ibgeCode), 1_000, "inep"),
    withTimeout(snisCollector.collect(ibgeCode), 1_000, "snis"),
    withTimeout(inpeCollector.collect(ibgeCode), 15_000, "inpe"),
    withTimeout(pncpCollector.collect(ibgeCode), 15_000, "pncp"),
    withTimeout(tseCollector.collect(ibgeCode), 1_000, "tse"),
    withTimeout(aneelCollector.collect(ibgeCode), 1_000, "aneel"),
    withTimeout(snisRsCollector.collect(ibgeCode), 1_000, "snis_rs"),
    withTimeout(anaCollector.collect(ibgeCode), 1_000, "ana"),
    withTimeout(conveniosCollector.collect(ibgeCode), 1_000, "convenios"),
    withTimeout(anatelCollector.collect(ibgeCode), 1_000, "anatel"),
    withTimeout(sisvanCollector.collect(ibgeCode), 1_000, "sisvan"),
    withTimeout(iepsCollector.collect(ibgeCode), 1_000, "ieps"),
  ]);

  // Se nenhuma fonte retornou dados, não há score
  if (
    !ibgeData &&
    !siconfiData &&
    !datasusData &&
    !inepData &&
    !snisData &&
    !inpeData &&
    !pncpData &&
    !tseData &&
    !aneelData &&
    !snisRsData &&
    !anaData &&
    !conveniosData &&
    !anatelData &&
    !sisvanData &&
    !iepsData
  ) {
    logger.warn(`No data from any source for municipality ${ibgeCode}`);
    return null;
  }

  // Coletar todos os indicadores ODS de todas as fontes
  const allIndicators: OdsIndicator[] = [];
  if (ibgeData) allIndicators.push(...mapIbgeOds(ibgeData));
  if (siconfiData) allIndicators.push(...mapSiconfiOds(siconfiData));
  if (datasusData) allIndicators.push(...mapDatasusOds(datasusData));
  if (inepData) allIndicators.push(...mapInepOds(inepData));
  if (snisData) allIndicators.push(...mapSnisOds(snisData));
  if (inpeData) allIndicators.push(...mapInpeOds(inpeData));
  if (pncpData) allIndicators.push(...mapPncpOds(pncpData));
  if (tseData) allIndicators.push(...mapTseOds(tseData));
  if (aneelData) allIndicators.push(...mapAneelOds(aneelData));
  if (snisRsData) allIndicators.push(...mapSnisRsOds(snisRsData));
  if (anaData) allIndicators.push(...mapAnaOds(anaData));
  if (conveniosData) allIndicators.push(...mapConveniosOds(conveniosData));
  if (anatelData) allIndicators.push(...mapAnatelOds(anatelData));
  if (sisvanData) allIndicators.push(...mapSisvanOds(sisvanData));
  if (iepsData) allIndicators.push(...mapIepsOds(iepsData));

  // Determinar ano de referência mais recente
  const referenceYear = Math.max(
    ibgeData?.referenceYear ?? 0,
    siconfiData?.referenceYear ?? 0,
    datasusData?.referenceYear ?? 0,
    inepData?.referenceYear ?? 0,
    snisData?.referenceYear ?? 0,
    inpeData?.referenceYear ?? 0,
    pncpData?.referenceYear ?? 0,
    tseData?.referenceYear ?? 0,
    aneelData?.referenceYear ?? 0,
    snisRsData?.referenceYear ?? 0,
    anaData?.referenceYear ?? 0,
    conveniosData?.referenceYear ?? 0,
    anatelData?.referenceYear ?? 0,
    sisvanData?.referenceYear ?? 0,
    iepsData?.referenceYear ?? 0,
  );

  // Agrupar indicadores por ODS number
  const indicatorsByOds = new Map<number, OdsIndicator[]>();
  for (const ind of allIndicators) {
    const existing = indicatorsByOds.get(ind.odsNumber) ?? [];
    existing.push(ind);
    indicatorsByOds.set(ind.odsNumber, existing);
  }

  // Construir resumo para cada ODS (1-17)
  const odsSummaries: OdsSummary[] = ODS_DEFINITIONS.map((def) => {
    const indicators = indicatorsByOds.get(def.number) ?? [];
    const sources = [...new Set(indicators.map((i) => i.source))];

    let score: number | null = null;
    let status: OdsStatus | null = null;

    if (indicators.length > 0) {
      const validScores = indicators.map((i) => i.score).filter((s): s is number => s !== null);

      if (validScores.length > 0) {
        score = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
        status = getOdsStatus(score);
      }
    }

    return {
      odsNumber: def.number,
      name: def.name,
      shortName: def.shortName,
      color: def.color,
      weight: def.weight,
      score,
      status,
      indicators,
      sources,
      dataFreshness: buildDataFreshness(indicators),
    };
  });

  // Calcular score global (média ponderada dos ODS com dados)
  let weightedSum = 0;
  let weightTotal = 0;
  let verdeCount = 0;
  let amareloCount = 0;
  let vermelhoCount = 0;
  let withDataCount = 0;

  for (const ods of odsSummaries) {
    if (ods.score !== null) {
      const def = getOdsDefinition(ods.odsNumber);
      const weight = def?.weight ?? 1.0;
      weightedSum += ods.score * weight;
      weightTotal += weight;
      withDataCount++;

      if (ods.status === "verde") verdeCount++;
      else if (ods.status === "amarelo") amareloCount++;
      else if (ods.status === "vermelho") vermelhoCount++;
    }
  }

  const globalScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null;
  const globalStatus = globalScore !== null ? getOdsStatus(globalScore) : null;

  // Média geométrica ponderada (padrão IDHM/ONU)
  const geoScores: number[] = [];
  const geoWeights: number[] = [];
  for (const ods of odsSummaries) {
    if (ods.score !== null) {
      const def = getOdsDefinition(ods.odsNumber);
      geoWeights.push(def?.weight ?? 1.0);
      geoScores.push(ods.score);
    }
  }
  const geometricScore =
    geoScores.length > 0 ? calculateGeometricMean(geoScores, geoWeights) : null;
  const geometricStatus = geometricScore !== null ? getOdsStatus(geometricScore) : null;

  return {
    ibgeCode,
    municipalityName: null, // Populated by route if DB available
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
    dataFreshness: buildDataFreshness(allIndicators),
    ods: odsSummaries,
  };
}
