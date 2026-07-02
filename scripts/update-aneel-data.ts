/**
 * scripts/update-aneel-data.ts
 *
 * Atualiza shared/data/aneel_latest.json com dados da ANEEL (geração distribuída).
 *
 * Estratégia (em ordem):
 * 1. API CKAN da ANEEL (via curl — fetch do Node falha por TLS gov)
 * 2. CSV local em scripts/data/aneel_export.csv
 * 3. Preserva dados existentes
 *
 * Uso: npx tsx scripts/update-aneel-data.ts [--year 2024]
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { AneelDataFileSchema } from "../shared/types/agents/aneel.types.js";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/aneel_latest.json");
const DEFAULT_FALLBACK_YEAR = 2023;

const ANEEL_CKAN_BASE = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";
const ANEEL_RESOURCE_ID = "b1bd71e7-d0ad-4214-9053-cbd58e9564a7";

interface AneelEntry {
  geracaoDistribuidaKw: number | null;
  unidadesGd: number | null;
  populacao: number | null;
}

function fetchFromCkan(): Record<string, AneelEntry> | null {
  try {
    const url = `${ANEEL_CKAN_BASE}?resource_id=${ANEEL_RESOURCE_ID}&limit=5000&filters={"SigUF":"SC"}`;
    console.log(`[update-aneel] Tentando API CKAN via curl...`);

    const raw = execSync(`curl -s --max-time 30 "${url}"`, {
      timeout: 35_000,
      maxBuffer: 50 * 1024 * 1024,
    }).toString();

    const json = JSON.parse(raw) as {
      result?: { records?: Array<Record<string, unknown>> };
    };

    const records = json.result?.records;
    if (!records || records.length === 0) {
      console.log("[update-aneel] CKAN retornou 0 registros");
      return null;
    }

    const byMunicipio = new Map<string, { kw: number; units: number }>();
    for (const rec of records) {
      const ibge = String(rec["CodMunicipioIbge"] ?? "").trim();
      if (!ibge.startsWith("42") || ibge.length !== 7) continue;

      const kw = parseFloat(String(rec["MdaPotenciaInstaladaKW"] ?? "0"));
      const existing = byMunicipio.get(ibge) ?? { kw: 0, units: 0 };
      existing.kw += isNaN(kw) ? 0 : kw;
      existing.units += 1;
      byMunicipio.set(ibge, existing);
    }

    const data: Record<string, AneelEntry> = {};
    for (const [ibge, agg] of byMunicipio) {
      data[ibge] = {
        geracaoDistribuidaKw: Math.round(agg.kw * 100) / 100,
        unidadesGd: agg.units,
        populacao: null,
      };
    }

    console.log(`[update-aneel] API CKAN: ${Object.keys(data).length} municípios SC`);
    return data;
  } catch (err) {
    console.log(
      `[update-aneel] Erro na API CKAN: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
    );
    return null;
  }
}

function readFromCsv(): Record<string, AneelEntry> | null {
  const csvPath = resolve(__dirname, "data/aneel_export.csv");
  if (!existsSync(csvPath)) return null;

  const csv = readFileSync(csvPath, "utf-8");
  const lines = csv.split("\n").filter((l) => l.trim());
  const header = lines[0].split(";").map((h) => h.trim().toLowerCase());

  const colIbge = header.findIndex((h) => h.includes("codigo") || h.includes("ibge"));
  const colKw = header.findIndex((h) => h.includes("potencia") || h.includes("kw"));
  const colUnidades = header.findIndex((h) => h.includes("unidades") || h.includes("gd"));
  const colPop = header.findIndex((h) => h.includes("populacao") || h.includes("população"));

  if (colIbge === -1) return null;

  const data: Record<string, AneelEntry> = {};
  for (const line of lines.slice(1)) {
    const cols = line.split(";");
    const ibge = cols[colIbge]?.trim();
    if (!ibge || !ibge.startsWith("42") || ibge.length !== 7) continue;

    const kw = colKw >= 0 ? parseFloat(cols[colKw].replace(",", ".")) : NaN;
    const units = colUnidades >= 0 ? parseInt(cols[colUnidades], 10) : NaN;
    const pop = colPop >= 0 ? parseInt(cols[colPop], 10) : NaN;

    data[ibge] = {
      geracaoDistribuidaKw: isNaN(kw) ? null : Math.round(kw * 100) / 100,
      unidadesGd: isNaN(units) ? null : units,
      populacao: isNaN(pop) ? null : pop,
    };
  }

  console.log(`[update-aneel] CSV: ${Object.keys(data).length} municípios SC`);
  return data;
}

function main(): void {
  const yearArg = process.argv.indexOf("--year");
  const year = yearArg >= 0 ? parseInt(process.argv[yearArg + 1], 10) : DEFAULT_FALLBACK_YEAR;

  let data = fetchFromCkan();
  let source = "ckan_api";

  if (!data) {
    data = readFromCsv();
    source = "manual_csv";
  }

  if (!data) {
    console.log("[update-aneel] Nenhuma fonte nova. Mantendo dados existentes.");
    console.log("[update-aneel] Para atualizar manualmente:");
    console.log("  1. Acesse https://dadosabertos.aneel.gov.br/");
    console.log("  2. Busque 'Empreendimentos de Geração Distribuída'");
    console.log("  3. Baixe CSV e salve em scripts/data/aneel_export.csv");
    const existing: Record<string, unknown> = JSON.parse(
      readFileSync(OUTPUT_PATH, "utf-8"),
    ) as Record<string, unknown>;
    const { __meta: _, ...entries } = existing;
    data = entries as Record<string, AneelEntry>;
    source = "existing_json_preserved";
  }

  const validation = AneelDataFileSchema.safeParse(data);
  if (!validation.success) {
    console.error("[update-aneel] ERRO: Validação Zod falhou.");
    console.error(JSON.stringify(validation.error.errors.slice(0, 5), null, 2));
    process.exit(1);
  }

  const output = {
    __meta: {
      lastUpdated: new Date().toISOString(),
      referenceYear: year,
      sourceUrl: "https://dadosabertos.aneel.gov.br/",
      municipalities: Object.keys(data).length,
      acquisitionMethod: source,
    },
    ...data,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `[update-aneel] Gravado ${OUTPUT_PATH} (${Object.keys(data).length} municípios, ano ref: ${year}, fonte: ${source})`,
  );
}

main();
