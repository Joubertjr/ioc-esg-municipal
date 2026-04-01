import { IbgeCollector, mapToOdsIndicators as mapIbgeOds } from "../../agents/ibge/index.js";
import { SiconfiCollector, mapToOdsIndicators as mapSiconfiOds } from "../../agents/siconfi/index.js";
import { DatasusCollector, mapToOdsIndicators as mapDatasusOds } from "../../agents/datasus/index.js";
import { InepCollector, mapToOdsIndicators as mapInepOds } from "../../agents/inep/index.js";
import { SnisCollector, mapToOdsIndicators as mapSnisOds } from "../../agents/snis/index.js";
import { InpeCollector, mapToOdsIndicators as mapInpeOds } from "../../agents/inpe/index.js";
import { PncpCollector, mapToOdsIndicators as mapPncpOds } from "../../agents/pncp/index.js";
import { ODS_DEFINITIONS, getOdsDefinition } from "../../../shared/constants/ods.js";
import { getOdsStatus, type OdsIndicator, type OdsStatus } from "../../../shared/types/domain/ods.js";
import { logger } from "../../utils/logger.js";

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

export interface OdsSummary {
  odsNumber: number;
  name: string;
  shortName: string;
  color: string;
  weight: number;
  score: number | null;
  status: OdsStatus | null;
  indicators: OdsIndicator[];
  sources: string[];
}

export interface MunicipalOdsReport {
  ibgeCode: string;
  municipalityName: string | null;
  referenceYear: number;
  globalScore: number | null;
  globalStatus: OdsStatus | null;
  odsCount: { total: number; withData: number; verde: number; amarelo: number; vermelho: number };
  ods: OdsSummary[];
}

const ibgeCollector = new IbgeCollector();
const siconfiCollector = new SiconfiCollector();
const datasusCollector = new DatasusCollector();
const inepCollector = new InepCollector();
const snisCollector = new SnisCollector();
const inpeCollector = new InpeCollector();
const pncpCollector = new PncpCollector();

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
export async function calculateMunicipalOds(ibgeCode: string): Promise<MunicipalOdsReport | null> {
  // Buscar dados de todas as fontes em paralelo com budget de tempo por fonte.
  // DATASUS cai com frequência (timeout=30s x retries=3 = 93s no pior caso).
  // Budget de 10s por fonte garante resposta em ≤15s mesmo com DATASUS down.
  // INEP e SNIS são locais (JSON estático) — 1s é suficiente.
  const [ibgeData, siconfiData, datasusData, inepData, snisData, inpeData, pncpData] =
    await Promise.all([
      withTimeout(ibgeCollector.collect(ibgeCode), 10_000, "ibge"),
      withTimeout(siconfiCollector.collect(ibgeCode), 15_000, "siconfi"),
      withTimeout(datasusCollector.collect(ibgeCode), 10_000, "datasus"),
      withTimeout(inepCollector.collect(ibgeCode), 1_000, "inep"),
      withTimeout(snisCollector.collect(ibgeCode), 1_000, "snis"),
      withTimeout(inpeCollector.collect(ibgeCode), 15_000, "inpe"),
      withTimeout(pncpCollector.collect(ibgeCode), 15_000, "pncp"),
    ]);

  // Se nenhuma fonte retornou dados, não há score
  if (!ibgeData && !siconfiData && !datasusData && !inepData && !snisData && !inpeData && !pncpData) {
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

  // Determinar ano de referência mais recente
  const referenceYear = Math.max(
    ibgeData?.referenceYear ?? 0,
    siconfiData?.referenceYear ?? 0,
    datasusData?.referenceYear ?? 0,
    inepData?.referenceYear ?? 0,
    snisData?.referenceYear ?? 0,
    inpeData?.referenceYear ?? 0,
    pncpData?.referenceYear ?? 0,
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
      const validScores = indicators
        .map((i) => i.score)
        .filter((s): s is number => s !== null);

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

  return {
    ibgeCode,
    municipalityName: null, // Populated by route if DB available
    referenceYear,
    globalScore,
    globalStatus,
    odsCount: {
      total: 17,
      withData: withDataCount,
      verde: verdeCount,
      amarelo: amareloCount,
      vermelho: vermelhoCount,
    },
    ods: odsSummaries,
  };
}
