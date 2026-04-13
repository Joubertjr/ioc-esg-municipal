/**
 * scripts/update-snis-data.ts
 *
 * Atualiza shared/data/snis_latest.json com dados do SNIS (Sistema Nacional
 * de Informações sobre Saneamento).
 *
 * Fonte: SNIS Série Histórica — http://app4.mdr.gov.br/serieHistorica/
 * Os dados são publicados anualmente com ~18 meses de defasagem.
 *
 * Indicadores:
 *   IN023 — Índice de atendimento urbano de água (%)
 *   IN056 — Índice de atendimento urbano de esgoto (%)
 *   IN046 — Índice de esgoto tratado referido à água consumida (%)
 *   IN049 — Índice de perdas na distribuição (%)
 *
 * Uso: npx tsx scripts/update-snis-data.ts [--year 2023]
 */

import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/snis_latest.json");
const DEFAULT_FALLBACK_YEAR = 2022;

// SNIS não tem API REST pública simples. Os dados são obtidos via:
// 1. Download direto do portal: http://app4.mdr.gov.br/serieHistorica/
// 2. Ou via SNIS-AP: https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/snis
//
// Como o portal exige interação manual (seleção de indicadores + período),
// este script funciona como framework para processar o CSV/Excel exportado.
//
// Fluxo recomendado:
// 1. Acesse http://app4.mdr.gov.br/serieHistorica/
// 2. Selecione: Água e Esgoto > Municipal > SC > Todos os municípios
// 3. Indicadores: IN023, IN056, IN046, IN049
// 4. Exporte como CSV
// 5. Salve como scripts/data/snis_export.csv
// 6. Execute: npx tsx scripts/update-snis-data.ts

interface SnisEntry {
  atendimentoAgua: number | null;
  atendimentoEsgoto: number | null;
  esgotoTratado: number | null;
  perdaFaturamento: number | null;
}

function parseNum(val: string | undefined): number | null {
  if (!val || val.trim() === "" || val === "-") return null;
  const num = parseFloat(val.replace(",", "."));
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

function main(): void {
  const yearArg = process.argv.find((a) => a === "--year");
  const yearIdx = yearArg ? process.argv.indexOf(yearArg) + 1 : -1;
  const year = yearIdx > 0 ? parseInt(process.argv[yearIdx], 10) : DEFAULT_FALLBACK_YEAR;

  const csvPath = resolve(__dirname, "data/snis_export.csv");

  let data: Record<string, SnisEntry>;

  try {
    const csv = readFileSync(csvPath, "utf-8");
    const lines = csv.split("\n").filter((l) => l.trim());
    const header = lines[0].split(";").map((h) => h.trim().toLowerCase());

    const colIbge = header.findIndex(
      (h) => h.includes("codigo") || h.includes("código") || h.includes("ibge"),
    );
    const colIN023 = header.findIndex((h) => h.includes("in023"));
    const colIN056 = header.findIndex((h) => h.includes("in056"));
    const colIN046 = header.findIndex((h) => h.includes("in046"));
    const colIN049 = header.findIndex((h) => h.includes("in049"));

    if (colIbge === -1) {
      console.error("Coluna de código IBGE não encontrada no CSV. Headers:", header);
      process.exit(1);
    }

    data = {};
    for (const line of lines.slice(1)) {
      const cols = line.split(";");
      const ibge = cols[colIbge]?.trim();
      if (!ibge || !ibge.startsWith("42") || ibge.length !== 7) continue;

      data[ibge] = {
        atendimentoAgua: colIN023 >= 0 ? parseNum(cols[colIN023]) : null,
        atendimentoEsgoto: colIN056 >= 0 ? parseNum(cols[colIN056]) : null,
        esgotoTratado: colIN046 >= 0 ? parseNum(cols[colIN046]) : null,
        perdaFaturamento: colIN049 >= 0 ? parseNum(cols[colIN049]) : null,
      };
    }

    console.log(`[update-snis] Parsed ${Object.keys(data).length} municípios SC do CSV`);
  } catch {
    console.log(`[update-snis] CSV não encontrado em ${csvPath}`);
    console.log("[update-snis] Mantendo dados existentes, adicionando apenas __meta");

    const existing: Record<string, unknown> = JSON.parse(
      readFileSync(OUTPUT_PATH, "utf-8"),
    ) as Record<string, unknown>;
    const { __meta: _, ...entries } = existing;
    data = entries as Record<string, SnisEntry>;
  }

  const output = {
    __meta: {
      lastUpdated: new Date().toISOString(),
      referenceYear: year,
      sourceUrl: "http://app4.mdr.gov.br/serieHistorica/",
      municipalities: Object.keys(data).length,
    },
    ...data,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `[update-snis] Gravado ${OUTPUT_PATH} (${Object.keys(data).length} municípios, ano ref: ${year})`,
  );
}

main();
