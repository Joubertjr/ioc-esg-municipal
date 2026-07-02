import { logger } from "../../utils/logger.js";
import {
  TransfereGovDataFileSchema,
  type TransfereGovPrograma,
  type TransfereGovDataFile,
} from "../../../shared/types/agents/transferegov.types.js";
import transferegovRawData from "../../../shared/data/transferegov_latest.json" with { type: "json" };

const _raw = transferegovRawData as Record<string, unknown>;
const { __meta: _transferegovMeta, ...transferegovEntries } = _raw;

const _parseResult = TransfereGovDataFileSchema.safeParse(transferegovEntries);
if (!_parseResult.success) {
  logger.error("transferegov_latest.json validation failed — collector will return empty data", {
    errors: _parseResult.error.errors.slice(0, 3),
  });
}
const TRANSFEREGOV_DATA: TransfereGovDataFile | null = _parseResult.success
  ? _parseResult.data
  : null;

export interface TransfereGovSummary {
  totalProgramasSC: number;
  totalAbertos: number;
  totalEncerrados: number;
  programasAbertosParaMunicipios: TransfereGovPrograma[];
  programasPorOrgao: Record<string, number>;
}

export class TransfereGovCollector {
  getSummary(): TransfereGovSummary | null {
    if (!TRANSFEREGOV_DATA) return null;

    return {
      totalProgramasSC: TRANSFEREGOV_DATA.totalProgramasSC,
      totalAbertos: TRANSFEREGOV_DATA.totalAbertos,
      totalEncerrados: TRANSFEREGOV_DATA.totalEncerrados,
      programasAbertosParaMunicipios: TRANSFEREGOV_DATA.programasAbertos.filter(
        (p) => p.naturezaJuridica === "Administração Pública Municipal",
      ),
      programasPorOrgao: TRANSFEREGOV_DATA.programasPorOrgao,
    };
  }

  getOpenPrograms(filter?: {
    naturezaJuridica?: string;
    orgaoSuperior?: string;
  }): TransfereGovPrograma[] {
    if (!TRANSFEREGOV_DATA) return [];

    return TRANSFEREGOV_DATA.programasAbertos.filter((p) => {
      if (filter?.naturezaJuridica && p.naturezaJuridica !== filter.naturezaJuridica) {
        return false;
      }
      if (filter?.orgaoSuperior && !p.orgaoSuperior.includes(filter.orgaoSuperior)) {
        return false;
      }
      return true;
    });
  }
}
