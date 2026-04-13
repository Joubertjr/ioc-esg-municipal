/**
 * scripts/update-aneel-data.ts
 *
 * Atualiza shared/data/aneel_latest.json com dados da ANEEL (geração distribuída).
 *
 * Fonte: ANEEL Dados Abertos (CKAN) — https://dadosabertos.aneel.gov.br/
 * Dataset: "Empreendimentos de Geração Distribuída"
 * API: https://dadosabertos.aneel.gov.br/api/3/action/datastore_search
 *
 * Indicadores:
 *   geracaoDistribuidaKw — potência instalada de GD em kW (nullable)
 *   unidadesGd           — número de unidades consumidoras com GD (int, nullable)
 *   populacao            — população do município (int, nullable)
 *
 * Uso: npx tsx scripts/update-aneel-data.ts [--year 2024]
 *
 * Este script tenta primeiro a API CKAN. Se falhar, lê CSV local.
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/aneel_latest.json");
const DEFAULT_FALLBACK_YEAR = 2023;

// CKAN resource ID para GD — pode mudar ao longo do tempo
const ANEEL_CKAN_BASE = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";

interface AneelEntry {
  geracaoDistribuidaKw: number | null;
  unidadesGd: number | null;
  populacao: number | null;
}

async function fetchFromCkan(_year: number): Promise<Record<string, AneelEntry> | null> {
  try {
    // ANEEL CKAN usa resource_id para identificar o dataset
    // Primeiro busca a lista de recursos do dataset de GD
    const searchUrl = `${ANEEL_CKAN_BASE}?resource_id=b1bd71e7-d0ad-4214-9053-cbd58e9564a7&limit=5000&filters={"SigUF":"SC"}`;

    console.log(`[update-aneel] Tentando API CKAN: ${searchUrl}`);
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      console.log(`[update-aneel] CKAN retornou ${response.status}`);
      return null;
    }

    const json = (await response.json()) as {
      result?: { records?: Array<Record<string, unknown>> };
    };

    const records = json.result?.records;
    if (!records || records.length === 0) {
      console.log("[update-aneel] CKAN retornou 0 registros");
      return null;
    }

    // Agregar por município
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
        populacao: null, // população não vem da ANEEL — preenchida por cruzamento com IBGE
      };
    }

    console.log(`[update-aneel] API CKAN: ${Object.keys(data).length} municípios SC`);
    return data;
  } catch (err) {
    console.log(
      `[update-aneel] Erro na API CKAN: ${err instanceof Error ? err.message : String(err)}`,
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

async function main(): Promise<void> {
  const yearArg = process.argv.indexOf("--year");
  const year = yearArg >= 0 ? parseInt(process.argv[yearArg + 1], 10) : DEFAULT_FALLBACK_YEAR;

  // Tenta API CKAN primeiro, depois CSV, depois mantém existente
  let data = await fetchFromCkan(year);

  if (!data) {
    data = readFromCsv();
  }

  if (!data) {
    console.log("[update-aneel] Nenhuma fonte nova disponível. Mantendo dados existentes.");
    const existing: Record<string, unknown> = JSON.parse(
      readFileSync(OUTPUT_PATH, "utf-8"),
    ) as Record<string, unknown>;
    const { __meta: _, ...entries } = existing;
    data = entries as Record<string, AneelEntry>;
  }

  const output = {
    __meta: {
      lastUpdated: new Date().toISOString(),
      referenceYear: year,
      sourceUrl: "https://dadosabertos.aneel.gov.br/",
      municipalities: Object.keys(data).length,
    },
    ...data,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `[update-aneel] Gravado ${OUTPUT_PATH} (${Object.keys(data).length} municípios, ano ref: ${year})`,
  );
}

void main();
