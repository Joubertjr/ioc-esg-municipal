/**
 * scripts/update-inep-data.ts
 *
 * Atualiza shared/data/ideb_latest.json com dados do IDEB (INEP).
 *
 * Fonte: https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados
 * O IDEB é publicado bienalmente (anos pares: 2019, 2021, 2023, 2025...).
 *
 * Indicadores:
 *   idebAnosIniciais — IDEB Anos Iniciais (1º ao 5º ano), escala 0-10
 *   idebAnosFinais   — IDEB Anos Finais (6º ao 9º ano), escala 0-10
 *
 * Uso: npx tsx scripts/update-inep-data.ts [--year 2023]
 *
 * Fluxo:
 * 1. Baixe o Excel do IDEB em gov.br/inep (rede municipal, por município)
 * 2. Salve como scripts/data/ideb_export.xlsx ou .csv
 * 3. Execute este script
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/ideb_latest.json");
const DEFAULT_FALLBACK_YEAR = 2023;

interface IdebEntry {
  idebAnosIniciais: number | null;
  idebAnosFinais: number | null;
}

function parseNum(val: string | undefined): number | null {
  if (!val || val.trim() === "" || val === "-" || val === "*") return null;
  const num = parseFloat(val.replace(",", "."));
  return isNaN(num) ? null : Math.round(num * 10) / 10;
}

function main(): void {
  const yearArg = process.argv.indexOf("--year");
  const year = yearArg >= 0 ? parseInt(process.argv[yearArg + 1], 10) : DEFAULT_FALLBACK_YEAR;

  const csvPath = resolve(__dirname, "data/ideb_export.csv");
  let data: Record<string, IdebEntry>;

  if (existsSync(csvPath)) {
    const csv = readFileSync(csvPath, "utf-8");
    const lines = csv.split("\n").filter((l) => l.trim());
    const header = lines[0].split(";").map((h) => h.trim().toLowerCase());

    const colIbge = header.findIndex(
      (h) => h.includes("codigo") || h.includes("código") || h.includes("ibge"),
    );
    const colIniciais = header.findIndex((h) => h.includes("iniciais") || h.includes("1_5"));
    const colFinais = header.findIndex((h) => h.includes("finais") || h.includes("6_9"));

    if (colIbge === -1) {
      console.error("Coluna de código IBGE não encontrada. Headers:", header);
      process.exit(1);
    }

    data = {};
    for (const line of lines.slice(1)) {
      const cols = line.split(";");
      const ibge = cols[colIbge]?.trim();
      if (!ibge || !ibge.startsWith("42") || ibge.length !== 7) continue;

      data[ibge] = {
        idebAnosIniciais: colIniciais >= 0 ? parseNum(cols[colIniciais]) : null,
        idebAnosFinais: colFinais >= 0 ? parseNum(cols[colFinais]) : null,
      };
    }

    console.log(`[update-inep] Parsed ${Object.keys(data).length} municípios SC do CSV`);
  } else {
    console.log(`[update-inep] CSV não encontrado em ${csvPath}`);
    console.log("[update-inep] Mantendo dados existentes, adicionando apenas __meta");

    const existing: Record<string, unknown> = JSON.parse(
      readFileSync(OUTPUT_PATH, "utf-8"),
    ) as Record<string, unknown>;
    const { __meta: _, ...entries } = existing;
    data = entries as Record<string, IdebEntry>;
  }

  const output = {
    __meta: {
      lastUpdated: new Date().toISOString(),
      referenceYear: year,
      sourceUrl:
        "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados",
      municipalities: Object.keys(data).length,
    },
    ...data,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `[update-inep] Gravado ${OUTPUT_PATH} (${Object.keys(data).length} municípios, ano ref: ${year})`,
  );
}

main();
