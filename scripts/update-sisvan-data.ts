/**
 * scripts/update-sisvan-data.ts
 *
 * Atualiza shared/data/sisvan_latest.json com dados do SISVAN Web.
 *
 * Fonte: OpenDataSUS — https://opendatasus.saude.gov.br/dataset/sisvan-estado-nutricional
 * Publicação anual com ~12 meses de defasagem.
 *
 * Indicadores (todos NOT nullable, 0-100):
 *   cobertura_acompanhamento — % crianças <5 anos com acompanhamento nutricional
 *   deficit_nutricional      — % com déficit peso/idade (invertido: menor = melhor)
 *   sobrepeso_infantil       — % com sobrepeso (invertido: menor = melhor)
 *
 * Uso: npx tsx scripts/update-sisvan-data.ts [--year 2023]
 *
 * Fluxo:
 * 1. Acesse https://opendatasus.saude.gov.br/dataset/sisvan-estado-nutricional
 * 2. Baixe CSV do estado nutricional (crianças <5 anos)
 * 3. Salve como scripts/data/sisvan_export.csv
 * 4. Execute este script
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SisvanDataFileSchema } from "../shared/types/agents/sisvan.types.js";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/sisvan_latest.json");
const DEFAULT_FALLBACK_YEAR = 2023;

interface SisvanEntry {
  cobertura_acompanhamento: number;
  deficit_nutricional: number;
  sobrepeso_infantil: number;
}

function parseNum(val: string | undefined): number | null {
  if (!val || val.trim() === "" || val === "-") return null;
  const num = parseFloat(val.replace(",", "."));
  return isNaN(num) ? null : Math.round(num * 10) / 10;
}

function main(): void {
  const yearArg = process.argv.indexOf("--year");
  const year = yearArg >= 0 ? parseInt(process.argv[yearArg + 1], 10) : DEFAULT_FALLBACK_YEAR;

  const csvPath = resolve(__dirname, "data/sisvan_export.csv");
  let data: Record<string, SisvanEntry>;

  if (existsSync(csvPath)) {
    const csv = readFileSync(csvPath, "utf-8");
    const lines = csv.split("\n").filter((l) => l.trim());
    const header = lines[0].split(";").map((h) => h.trim().toLowerCase());

    const colIbge = header.findIndex(
      (h) => h.includes("codigo") || h.includes("código") || h.includes("ibge"),
    );
    const colCobertura = header.findIndex((h) => h.includes("cobertura"));
    const colDeficit = header.findIndex((h) => h.includes("deficit") || h.includes("déficit"));
    const colSobrepeso = header.findIndex((h) => h.includes("sobrepeso"));

    if (colIbge === -1) {
      console.error("Coluna de código IBGE não encontrada. Headers:", header);
      process.exit(1);
    }

    data = {};
    for (const line of lines.slice(1)) {
      const cols = line.split(";");
      const ibge = cols[colIbge]?.trim();
      if (!ibge || !ibge.startsWith("42") || ibge.length !== 7) continue;

      const cobertura = colCobertura >= 0 ? parseNum(cols[colCobertura]) : null;
      const deficit = colDeficit >= 0 ? parseNum(cols[colDeficit]) : null;
      const sobrepeso = colSobrepeso >= 0 ? parseNum(cols[colSobrepeso]) : null;

      // SISVAN não aceita null — só inclui município se todos os campos têm valor
      if (cobertura !== null && deficit !== null && sobrepeso !== null) {
        data[ibge] = {
          cobertura_acompanhamento: cobertura,
          deficit_nutricional: deficit,
          sobrepeso_infantil: sobrepeso,
        };
      }
    }

    console.log(`[update-sisvan] Parsed ${Object.keys(data).length} municípios SC do CSV`);
  } else {
    console.log(`[update-sisvan] CSV não encontrado em ${csvPath}`);
    console.log("[update-sisvan] Mantendo dados existentes, adicionando apenas __meta");

    const existing: Record<string, unknown> = JSON.parse(
      readFileSync(OUTPUT_PATH, "utf-8"),
    ) as Record<string, unknown>;
    const { __meta: _, ...entries } = existing;
    data = entries as Record<string, SisvanEntry>;
  }

  // Validação Zod antes de gravar — garante compatibilidade com o collector
  const validation = SisvanDataFileSchema.safeParse(data);
  if (!validation.success) {
    console.error("[update-sisvan] ERRO: Output falha validação Zod. O JSON NÃO foi gravado.");
    console.error(
      "[update-sisvan] Erros:",
      JSON.stringify(validation.error.errors.slice(0, 5), null, 2),
    );
    process.exit(1);
  }

  const output = {
    __meta: {
      lastUpdated: new Date().toISOString(),
      referenceYear: year,
      sourceUrl: "https://opendatasus.saude.gov.br/dataset/sisvan-estado-nutricional",
      municipalities: Object.keys(data).length,
    },
    ...data,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `[update-sisvan] Gravado ${OUTPUT_PATH} (${Object.keys(data).length} municípios, ano ref: ${year})`,
  );
}

main();
