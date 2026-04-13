/**
 * scripts/update-convenios-data.ts
 *
 * Atualiza shared/data/convenios_latest.json com dados do Transferegov/+Brasil.
 *
 * Fonte: Plataforma +Brasil (download de dados)
 * https://plataformamaisbrasil.gov.br/download-de-dados
 *
 * Indicadores:
 *   conveniosFederaisAtivos       — int, nullable
 *   pctOrcamentoConvenios         — % do orçamento via convênios (0-100, nullable)
 *   consorciosIntermunicipais     — int, nullable
 *
 * Uso: npx tsx scripts/update-convenios-data.ts [--year 2024]
 *
 * Fluxo:
 * 1. Acesse https://plataformamaisbrasil.gov.br/download-de-dados
 * 2. Baixe "Convênios" filtrando UF=SC, Situação=Em Execução/Adimplente
 * 3. Salve como scripts/data/convenios_export.csv
 * 4. Execute este script
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ConveniosDataFileSchema } from "../shared/types/agents/convenios.types.js";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/convenios_latest.json");
const DEFAULT_FALLBACK_YEAR = 2023;

interface ConveniosEntry {
  conveniosFederaisAtivos: number | null;
  pctOrcamentoConvenios: number | null;
  consorciosIntermunicipais: number | null;
}

function main(): void {
  const yearArg = process.argv.indexOf("--year");
  const year = yearArg >= 0 ? parseInt(process.argv[yearArg + 1], 10) : DEFAULT_FALLBACK_YEAR;

  const csvPath = resolve(__dirname, "data/convenios_export.csv");
  let data: Record<string, ConveniosEntry>;

  if (existsSync(csvPath)) {
    const csv = readFileSync(csvPath, "utf-8");
    const lines = csv.split("\n").filter((l) => l.trim());
    const header = lines[0].split(";").map((h) => h.trim().toLowerCase());

    const colIbge = header.findIndex(
      (h) => h.includes("codigo") || h.includes("ibge") || h.includes("município"),
    );

    if (colIbge === -1) {
      console.error("Coluna de código IBGE não encontrada. Headers:", header);
      process.exit(1);
    }

    // Conta convênios ativos por município
    const convenioCount = new Map<string, number>();
    for (const line of lines.slice(1)) {
      const cols = line.split(";");
      let ibge = cols[colIbge]?.trim() ?? "";

      // Transferegov pode usar 6 dígitos (sem verificador)
      if (ibge.length === 6 && ibge.startsWith("42")) {
        ibge = ibge + "0"; // fallback simplificado
      }
      if (!ibge.startsWith("42") || ibge.length !== 7) continue;

      convenioCount.set(ibge, (convenioCount.get(ibge) ?? 0) + 1);
    }

    data = {};
    for (const [ibge, count] of convenioCount) {
      data[ibge] = {
        conveniosFederaisAtivos: count,
        pctOrcamentoConvenios: null, // requer cruzamento com dados orçamentários (SICONFI)
        consorciosIntermunicipais: null, // requer fonte adicional (CNM/IBGE Munic)
      };
    }

    console.log(`[update-convenios] Parsed ${Object.keys(data).length} municípios SC do CSV`);
  } else {
    console.log(`[update-convenios] CSV não encontrado em ${csvPath}`);
    console.log("[update-convenios] Mantendo dados existentes, adicionando apenas __meta");

    const existing: Record<string, unknown> = JSON.parse(
      readFileSync(OUTPUT_PATH, "utf-8"),
    ) as Record<string, unknown>;
    const { __meta: _, ...entries } = existing;
    data = entries as Record<string, ConveniosEntry>;
  }

  // Validação Zod antes de gravar — garante compatibilidade com o collector
  const validation = ConveniosDataFileSchema.safeParse(data);
  if (!validation.success) {
    console.error("[update-convenios] ERRO: Output falha validação Zod. O JSON NÃO foi gravado.");
    console.error(
      "[update-convenios] Erros:",
      JSON.stringify(validation.error.errors.slice(0, 5), null, 2),
    );
    process.exit(1);
  }

  const output = {
    __meta: {
      lastUpdated: new Date().toISOString(),
      referenceYear: year,
      sourceUrl: "https://plataformamaisbrasil.gov.br/download-de-dados",
      municipalities: Object.keys(data).length,
    },
    ...data,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `[update-convenios] Gravado ${OUTPUT_PATH} (${Object.keys(data).length} municípios, ano ref: ${year})`,
  );
}

main();
