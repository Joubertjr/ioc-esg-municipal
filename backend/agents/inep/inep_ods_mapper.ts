import type { InepMunicipalData } from "../../../shared/types/agents/inep.types.js";
import { getOdsStatus, type OdsIndicator } from "../../../shared/types/domain/ods.js";

/**
 * Mapeia dados INEP (IDEB) para indicadores ODS normalizados (score 0-100).
 *
 * ODS cobertos pelo INEP:
 * - ODS 4 (Educação de qualidade): 2 indicadores de desempenho escolar
 *   - IDEB anos iniciais (1º-5º ano), IDEB anos finais (6º-9º ano)
 *
 * Scoring: notas IDEB são de 0-10. Referências nacionais:
 * - Meta 2022: 6.0 (anos iniciais), 5.5 (anos finais)
 * - >= 7.0 → 100 (excelente, acima da meta de longo prazo)
 * - >= 4.0 → 50-100 (faixa de desempenho médio-alto)
 * - < 4.0  → 0-50 (abaixo do mínimo aceitável)
 */
export function mapToOdsIndicators(data: InepMunicipalData): OdsIndicator[] {
  const indicators: OdsIndicator[] = [];
  const { ibgeCode, referenceYear, referenceDate } = data;
  const ind = data.indicators;

  // ODS 4 — IDEB anos iniciais (1º-5º ano)
  if (ind.idebAnosIniciais !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 4,
      indicatorName: "ideb_anos_iniciais",
      value: ind.idebAnosIniciais,
      score: scoreIdeb(ind.idebAnosIniciais),
      referenceYear,
      referenceDate,
    }));
  }

  // ODS 4 — IDEB anos finais (6º-9º ano)
  if (ind.idebAnosFinais !== null) {
    indicators.push(makeIndicator({
      municipalityId: ibgeCode,
      odsNumber: 4,
      indicatorName: "ideb_anos_finais",
      value: ind.idebAnosFinais,
      score: scoreIdeb(ind.idebAnosFinais),
      referenceYear,
      referenceDate,
    }));
  }

  return indicators;
}

// ─── Função de normalização ───────────────────────────────────────────────────

/**
 * Nota IDEB (0-10) → score ODS 0-100.
 *
 * >= 7.0 → 100 (excelente)
 * >= 4.0 → 50-100 (interpolação linear)
 * < 4.0  → 0-50 (interpolação linear)
 */
function scoreIdeb(nota: number): number {
  if (nota >= 7.0) return 100;
  if (nota >= 4.0) return 50 + ((nota - 4.0) / 3.0) * 50;
  return (nota / 4.0) * 50;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}

interface IndicatorInput {
  municipalityId: string;
  odsNumber: number;
  indicatorName: string;
  value: number;
  score: number;
  referenceYear: number;
  referenceDate: Date;
}

function makeIndicator(input: IndicatorInput): OdsIndicator {
  const score = clampScore(input.score);
  return {
    id: "",
    municipalityId: input.municipalityId,
    odsNumber: input.odsNumber,
    indicatorName: input.indicatorName,
    value: input.value,
    score,
    status: getOdsStatus(score),
    source: "inep",
    referenceYear: input.referenceYear,
    referenceDate: input.referenceDate,
    dataAvailable: true,
  };
}
