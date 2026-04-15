/**
 * scripts/update-ieps-data.ts
 *
 * Atualiza shared/data/ieps_latest.json com dados do IEPS Data.
 *
 * Fonte: IEPS Data (iepsdata.org.br) via Base dos Dados (basedosdados.org)
 * Tabela original: basedosdados-dev.br_ieps_saude.municipio
 *
 * Indicadores (todos nullable):
 *   mortalidadeInfantil  — taxa por 1.000 NV (menor = melhor)
 *   coberturaEsf         — % cobertura ESF (maior = melhor)
 *   coberturaVacinal     — % vacinal polio (maior = melhor)
 *   internacoesCsap      — por 100k hab (menor = melhor)
 *   gastoSaudePerCapita  — R$ deflacionado 2019 (contextual)
 *   prenatalAdequado     — % 7+ consultas (maior = melhor)
 *
 * Uso: npx tsx scripts/update-ieps-data.ts [--year 2021]
 *
 * Fluxo:
 * 1. Acesse https://iepsdata.org.br/ ou https://basedosdados.org/
 * 2. Exporte CSV com colunas: id_municipio, tx_mort_inf_ibge, cob_esf,
 *    cob_vac_polio, tx_hosp_csap, desp_tot_saude_pc_mun_def, pct_prenatal_adeq
 * 3. Filtre por UF=SC e ano desejado
 * 4. Salve como scripts/data/ieps_export.csv
 * 5. Execute: npx tsx scripts/update-ieps-data.ts --year 2021
 *
 * Alternativa: Se tiver credenciais GCP, use BigQuery diretamente:
 *   GOOGLE_APPLICATION_CREDENTIALS=cred.json npx tsx scripts/update-ieps-data.ts
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { IepsDataFileSchema } from "../shared/types/agents/ieps.types.js";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/ieps_latest.json");
const DEFAULT_FALLBACK_YEAR = 2021;

interface IepsEntry {
  mortalidadeInfantil: number | null;
  coberturaEsf: number | null;
  coberturaVacinal: number | null;
  internacoesCsap: number | null;
  gastoSaudePerCapita: number | null;
  prenatalAdequado: number | null;
}

function parseNum(val: string | undefined): number | null {
  if (!val || val.trim() === "" || val === "-" || val === "NA") return null;
  const num = parseFloat(val.replace(",", "."));
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

/** Mapeia nomes de coluna da Base dos Dados / IEPS para nossos campos */
const COLUMN_MAP: Record<string, keyof IepsEntry> = {
  tx_mort_inf_ibge: "mortalidadeInfantil",
  mortalidade_infantil: "mortalidadeInfantil",
  mortalidadeinfantil: "mortalidadeInfantil",
  cob_esf: "coberturaEsf",
  cobertura_esf: "coberturaEsf",
  coberturaesf: "coberturaEsf",
  cob_vac_polio: "coberturaVacinal",
  cobertura_vacinal: "coberturaVacinal",
  coberturavacinal: "coberturaVacinal",
  tx_hosp_csap: "internacoesCsap",
  internacoes_csap: "internacoesCsap",
  internacoescsap: "internacoesCsap",
  desp_tot_saude_pc_mun_def: "gastoSaudePerCapita",
  gasto_saude_percapita: "gastoSaudePerCapita",
  gastosaudepercapita: "gastoSaudePerCapita",
  pct_prenatal_adeq: "prenatalAdequado",
  prenatal_adequado: "prenatalAdequado",
  prenataladequado: "prenatalAdequado",
};

function findColumn(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function main(): void {
  const yearArg = process.argv.indexOf("--year");
  const year = yearArg >= 0 ? parseInt(process.argv[yearArg + 1], 10) : DEFAULT_FALLBACK_YEAR;

  const csvPath = resolve(__dirname, "data/ieps_export.csv");
  let data: Record<string, IepsEntry>;

  if (existsSync(csvPath)) {
    const csv = readFileSync(csvPath, "utf-8");
    const lines = csv.split("\n").filter((l) => l.trim());
    const separator = lines[0].includes(";") ? ";" : ",";
    const header = lines[0].split(separator).map((h) => h.trim().toLowerCase());

    const colIbge = findColumn(header, "id_municipio", "codigo", "código", "ibge");
    if (colIbge === -1) {
      console.error("Coluna de código IBGE não encontrada. Headers:", header);
      process.exit(1);
    }

    // Mapeia colunas disponíveis no CSV para campos do IepsEntry
    const fieldColumns: Partial<Record<keyof IepsEntry, number>> = {};
    for (let i = 0; i < header.length; i++) {
      const mapped = COLUMN_MAP[header[i]];
      if (mapped) {
        fieldColumns[mapped] = i;
      }
    }

    data = {};
    for (const line of lines.slice(1)) {
      const cols = line.split(separator);
      const ibge = cols[colIbge]?.trim();
      if (!ibge || !ibge.startsWith("42") || ibge.length !== 7) continue;

      const entry: IepsEntry = {
        mortalidadeInfantil:
          fieldColumns.mortalidadeInfantil !== undefined
            ? parseNum(cols[fieldColumns.mortalidadeInfantil])
            : null,
        coberturaEsf:
          fieldColumns.coberturaEsf !== undefined
            ? parseNum(cols[fieldColumns.coberturaEsf])
            : null,
        coberturaVacinal:
          fieldColumns.coberturaVacinal !== undefined
            ? parseNum(cols[fieldColumns.coberturaVacinal])
            : null,
        internacoesCsap:
          fieldColumns.internacoesCsap !== undefined
            ? parseNum(cols[fieldColumns.internacoesCsap])
            : null,
        gastoSaudePerCapita:
          fieldColumns.gastoSaudePerCapita !== undefined
            ? parseNum(cols[fieldColumns.gastoSaudePerCapita])
            : null,
        prenatalAdequado:
          fieldColumns.prenatalAdequado !== undefined
            ? parseNum(cols[fieldColumns.prenatalAdequado])
            : null,
      };

      data[ibge] = entry;
    }

    console.log(`[update-ieps] Parsed ${Object.keys(data).length} municípios SC do CSV`);
    console.log(
      `[update-ieps] Campos mapeados: ${Object.keys(fieldColumns).join(", ") || "nenhum"}`,
    );
  } else {
    console.log(`[update-ieps] CSV não encontrado em ${csvPath}`);
    console.log("[update-ieps] Mantendo dados existentes, adicionando apenas __meta");

    const existing: Record<string, unknown> = JSON.parse(
      readFileSync(OUTPUT_PATH, "utf-8"),
    ) as Record<string, unknown>;
    const { __meta: _, ...entries } = existing;
    data = entries as Record<string, IepsEntry>;
  }

  // Validação Zod antes de gravar — garante compatibilidade com o collector
  const validation = IepsDataFileSchema.safeParse(data);
  if (!validation.success) {
    console.error("[update-ieps] ERRO: Output falha validação Zod. O JSON NÃO foi gravado.");
    console.error(
      "[update-ieps] Erros:",
      JSON.stringify(validation.error.errors.slice(0, 5), null, 2),
    );
    console.error("[update-ieps] Verifique se o CSV exportado tem o formato esperado.");
    process.exit(1);
  }

  const csvExists = existsSync(csvPath);
  const output = {
    __meta: {
      lastUpdated: new Date().toISOString(),
      referenceYear: year,
      sourceUrl: "https://iepsdata.org.br/",
      municipalities: Object.keys(data).length,
      sourceManifest: {
        acquisitionMethod: csvExists ? "manual_csv_export" : "existing_json_preserved",
        sourceFile: csvExists ? "scripts/data/ieps_export.csv" : null,
        sourceFileHash: csvExists
          ? createHash("sha256").update(readFileSync(csvPath)).digest("hex")
          : null,
        operator: os.userInfo().username,
      },
    },
    ...data,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `[update-ieps] Gravado ${OUTPUT_PATH} (${Object.keys(data).length} municípios, ano ref: ${year})`,
  );
}

main();
