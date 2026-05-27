import { calculateMunicipalOds } from "../ods/ods_score_service.js";
import { generateEsgReport } from "../reports/report_service.js";
import { logger } from "../../utils/logger.js";
import { mapEsgReportToExecutiveReport } from "./executive_report_mapper.js";
import type { ExecutiveReport } from "./schemas.js";

/**
 * Relatório executivo no contrato MDO (P-011: determinístico antes de agência).
 * Reutiliza `generateEsgReport` + scores ODS; validação Zod em runtime.
 */
export async function generateExecutiveReport(ibgeCode: string): Promise<ExecutiveReport | null> {
  logger.info("[agent] gerando relatório executivo MDO", { ibgeCode });

  const [esg, municipal] = await Promise.all([
    generateEsgReport(ibgeCode),
    calculateMunicipalOds(ibgeCode),
  ]);

  if (!esg || !municipal) {
    logger.warn("[agent] sem dados para relatório executivo", { ibgeCode });
    return null;
  }

  if (municipal.ods.every((o) => o.score === null)) {
    logger.warn("[agent] nenhum score ODS disponível", { ibgeCode });
    return null;
  }

  return mapEsgReportToExecutiveReport(esg, municipal);
}
