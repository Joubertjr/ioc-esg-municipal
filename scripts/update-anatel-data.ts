/**
 * scripts/update-anatel-data.ts
 *
 * Atualiza shared/data/anatel_latest.json com dados da ANATEL.
 *
 * Fonte: ANATEL Dados Abertos — https://dados.anatel.gov.br/
 * Datasets: Banda Larga Fixa + Cobertura de Redes Móveis
 *
 * Indicadores (todos NOT nullable, 0-100):
 *   acessosBandaLargaPor100hab — acessos de banda larga fixa por 100 habitantes
 *   cobertura4gPercentual      — % de cobertura 4G no município
 *
 * Uso: npx tsx scripts/update-anatel-data.ts [--year 2024]
 *
 * Fluxo:
 * 1. Acesse https://dados.anatel.gov.br/
 * 2. Baixe "Acessos - Banda Larga Fixa" (CSV) e "Cobertura Rede Móvel" (CSV)
 * 3. Salve como scripts/data/anatel_bl_export.csv e scripts/data/anatel_4g_export.csv
 * 4. Execute este script
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { AnatelDataFileSchema } from "../shared/types/agents/anatel.types.js";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/anatel_latest.json");
const DEFAULT_FALLBACK_YEAR = 2023;

interface AnatelEntry {
  acessosBandaLargaPor100hab: number;
  cobertura4gPercentual: number;
}

function parseNum(val: string | undefined): number | null {
  if (!val || val.trim() === "" || val === "-") return null;
  const num = parseFloat(val.replace(",", "."));
  return isNaN(num) ? null : Math.round(num * 10) / 10;
}

function main(): void {
  const yearArg = process.argv.indexOf("--year");
  const year = yearArg >= 0 ? parseInt(process.argv[yearArg + 1], 10) : DEFAULT_FALLBACK_YEAR;

  const blCsvPath = resolve(__dirname, "data/anatel_bl_export.csv");
  const g4CsvPath = resolve(__dirname, "data/anatel_4g_export.csv");
  let data: Record<string, AnatelEntry>;

  if (existsSync(blCsvPath) || existsSync(g4CsvPath)) {
    const blData = new Map<string, number>();
    const g4Data = new Map<string, number>();

    if (existsSync(blCsvPath)) {
      const csv = readFileSync(blCsvPath, "utf-8");
      const lines = csv.split("\n").filter((l) => l.trim());
      const header = lines[0].split(";").map((h) => h.trim().toLowerCase());
      const colIbge = header.findIndex((h) => h.includes("codigo") || h.includes("ibge"));
      const colAcessos = header.findIndex((h) => h.includes("100hab") || h.includes("acessos"));

      for (const line of lines.slice(1)) {
        const cols = line.split(";");
        const ibge = cols[colIbge]?.trim();
        if (!ibge || !ibge.startsWith("42") || ibge.length !== 7) continue;
        const val = colAcessos >= 0 ? parseNum(cols[colAcessos]) : null;
        if (val !== null) blData.set(ibge, val);
      }
    }

    if (existsSync(g4CsvPath)) {
      const csv = readFileSync(g4CsvPath, "utf-8");
      const lines = csv.split("\n").filter((l) => l.trim());
      const header = lines[0].split(";").map((h) => h.trim().toLowerCase());
      const colIbge = header.findIndex((h) => h.includes("codigo") || h.includes("ibge"));
      const colCobertura = header.findIndex((h) => h.includes("cobertura") || h.includes("4g"));

      for (const line of lines.slice(1)) {
        const cols = line.split(";");
        const ibge = cols[colIbge]?.trim();
        if (!ibge || !ibge.startsWith("42") || ibge.length !== 7) continue;
        const val = colCobertura >= 0 ? parseNum(cols[colCobertura]) : null;
        if (val !== null) g4Data.set(ibge, val);
      }
    }

    // Merge — ANATEL não aceita null, só inclui se ambos campos existem
    data = {};
    const allIbges = new Set([...blData.keys(), ...g4Data.keys()]);
    for (const ibge of allIbges) {
      const bl = blData.get(ibge);
      const g4 = g4Data.get(ibge);
      if (bl !== undefined && g4 !== undefined) {
        data[ibge] = {
          acessosBandaLargaPor100hab: bl,
          cobertura4gPercentual: g4,
        };
      }
    }

    console.log(`[update-anatel] Parsed ${Object.keys(data).length} municípios SC dos CSVs`);
  } else {
    console.log("[update-anatel] CSVs não encontrados em scripts/data/");
    console.log("[update-anatel] Mantendo dados existentes, adicionando apenas __meta");

    const existing: Record<string, unknown> = JSON.parse(
      readFileSync(OUTPUT_PATH, "utf-8"),
    ) as Record<string, unknown>;
    const { __meta: _, ...entries } = existing;
    data = entries as Record<string, AnatelEntry>;
  }

  // Validação Zod antes de gravar — garante compatibilidade com o collector
  const validation = AnatelDataFileSchema.safeParse(data);
  if (!validation.success) {
    console.error("[update-anatel] ERRO: Output falha validação Zod. O JSON NÃO foi gravado.");
    console.error(
      "[update-anatel] Erros:",
      JSON.stringify(validation.error.errors.slice(0, 5), null, 2),
    );
    process.exit(1);
  }

  const output = {
    __meta: {
      lastUpdated: new Date().toISOString(),
      referenceYear: year,
      sourceUrl: "https://dados.anatel.gov.br/",
      municipalities: Object.keys(data).length,
    },
    ...data,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `[update-anatel] Gravado ${OUTPUT_PATH} (${Object.keys(data).length} municípios, ano ref: ${year})`,
  );
}

main();
