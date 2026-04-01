import { IbgeCollector, mapToOdsIndicators as mapIbgeOds } from "../../agents/ibge/index.js";
import { SiconfiCollector, mapToOdsIndicators as mapSiconfiOds } from "../../agents/siconfi/index.js";
import { DatasusCollector, mapToOdsIndicators as mapDatasusOds } from "../../agents/datasus/index.js";
import { ODS_DEFINITIONS, getOdsDefinition } from "../../../shared/constants/ods.js";
import { getOdsStatus, type OdsIndicator, type OdsStatus } from "../../../shared/types/domain/ods.js";
import { logger } from "../../utils/logger.js";

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
  // Buscar dados de todas as fontes em paralelo
  const [ibgeData, siconfiData, datasusData] = await Promise.all([
    ibgeCollector.collect(ibgeCode),
    siconfiCollector.collect(ibgeCode),
    datasusCollector.collect(ibgeCode),
  ]);

  // Se nenhuma fonte retornou dados, não há score
  if (!ibgeData && !siconfiData && !datasusData) {
    logger.warn(`No data from any source for municipality ${ibgeCode}`);
    return null;
  }

  // Coletar todos os indicadores ODS de todas as fontes
  const allIndicators: OdsIndicator[] = [];
  if (ibgeData) allIndicators.push(...mapIbgeOds(ibgeData));
  if (siconfiData) allIndicators.push(...mapSiconfiOds(siconfiData));
  if (datasusData) allIndicators.push(...mapDatasusOds(datasusData));

  // Determinar ano de referência mais recente
  const referenceYear = Math.max(
    ibgeData?.referenceYear ?? 0,
    siconfiData?.referenceYear ?? 0,
    datasusData?.referenceYear ?? 0,
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
