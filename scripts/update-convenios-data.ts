/**
 * scripts/update-convenios-data.ts
 *
 * Atualiza shared/data/convenios_latest.json com dados de convênios federais.
 *
 * Estratégia (em ordem):
 * 1. API do Portal da Transparência (requer PORTAL_TRANSPARENCIA_API_KEY)
 *    Cadastro gratuito: https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email
 * 2. CSV local em scripts/data/convenios_export.csv
 * 3. Preserva dados existentes
 *
 * Uso: npx tsx scripts/update-convenios-data.ts [--year 2024]
 * Com API: PORTAL_TRANSPARENCIA_API_KEY=xxx npx tsx scripts/update-convenios-data.ts
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { ConveniosDataFileSchema } from "../shared/types/agents/convenios.types.js";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/convenios_latest.json");
const DEFAULT_FALLBACK_YEAR = 2023;

const PORTAL_API_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados/convenios";

interface ConveniosEntry {
  conveniosFederaisAtivos: number | null;
  pctOrcamentoConvenios: number | null;
  consorciosIntermunicipais: number | null;
}

function fetchFromPortalApi(): Record<string, ConveniosEntry> | null {
  const apiKey = process.env["PORTAL_TRANSPARENCIA_API_KEY"];
  if (!apiKey) {
    console.log("[update-convenios] PORTAL_TRANSPARENCIA_API_KEY não definida.");
    console.log(
      "[update-convenios] Cadastro gratuito: https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email",
    );
    return null;
  }

  console.log("[update-convenios] Buscando convênios SC via Portal da Transparência...");
  const convenioCount = new Map<string, number>();
  let pagina = 1;
  const tamanhoPagina = 500;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const url = `${PORTAL_API_BASE}?uf=SC&pagina=${pagina}&tamanhoPagina=${tamanhoPagina}`;
      const raw = execSync(`curl -s --max-time 30 -H "chave-api-dados: ${apiKey}" "${url}"`, {
        timeout: 35_000,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();

      const records = JSON.parse(raw) as Array<{
        municipio?: { codigoIBGE?: string };
        situacao?: string;
      }>;

      if (!Array.isArray(records) || records.length === 0) break;

      for (const rec of records) {
        let ibge = String(rec.municipio?.codigoIBGE ?? "").trim();
        if (ibge.length === 6 && ibge.startsWith("42")) {
          ibge = ibge + "0";
        }
        if (!ibge.startsWith("42") || ibge.length !== 7) continue;
        convenioCount.set(ibge, (convenioCount.get(ibge) ?? 0) + 1);
      }

      console.log(`[update-convenios] Página ${pagina}: ${records.length} registros`);
      if (records.length < tamanhoPagina) break;
      pagina++;

      if (pagina > 50) {
        console.log("[update-convenios] Limite de 50 páginas atingido");
        break;
      }
    } catch (err) {
      console.log(
        `[update-convenios] Erro na página ${pagina}: ${(err as Error).message.split("\n")[0]}`,
      );
      break;
    }
  }

  if (convenioCount.size === 0) return null;

  const data: Record<string, ConveniosEntry> = {};
  for (const [ibge, count] of convenioCount) {
    data[ibge] = {
      conveniosFederaisAtivos: count,
      pctOrcamentoConvenios: null,
      consorciosIntermunicipais: null,
    };
  }

  console.log(`[update-convenios] API: ${Object.keys(data).length} municípios SC`);
  return data;
}

function readFromCsv(): Record<string, ConveniosEntry> | null {
  const csvPath = resolve(__dirname, "data/convenios_export.csv");
  if (!existsSync(csvPath)) return null;

  const csv = readFileSync(csvPath, "utf-8");
  const lines = csv.split("\n").filter((l) => l.trim());
  const header = lines[0].split(";").map((h) => h.trim().toLowerCase());

  const colIbge = header.findIndex(
    (h) => h.includes("codigo") || h.includes("ibge") || h.includes("município"),
  );

  if (colIbge === -1) {
    console.error("Coluna de código IBGE não encontrada. Headers:", header);
    return null;
  }

  const convenioCount = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const cols = line.split(";");
    let ibge = cols[colIbge]?.trim() ?? "";
    if (ibge.length === 6 && ibge.startsWith("42")) ibge = ibge + "0";
    if (!ibge.startsWith("42") || ibge.length !== 7) continue;
    convenioCount.set(ibge, (convenioCount.get(ibge) ?? 0) + 1);
  }

  const data: Record<string, ConveniosEntry> = {};
  for (const [ibge, count] of convenioCount) {
    data[ibge] = {
      conveniosFederaisAtivos: count,
      pctOrcamentoConvenios: null,
      consorciosIntermunicipais: null,
    };
  }

  console.log(`[update-convenios] CSV: ${Object.keys(data).length} municípios SC`);
  return data;
}

function main(): void {
  const yearArg = process.argv.indexOf("--year");
  const year = yearArg >= 0 ? parseInt(process.argv[yearArg + 1], 10) : DEFAULT_FALLBACK_YEAR;

  let data = fetchFromPortalApi();
  let source = "portal_transparencia_api";

  if (!data) {
    data = readFromCsv();
    source = "manual_csv";
  }

  if (!data) {
    console.log("[update-convenios] Nenhuma fonte nova. Mantendo dados existentes.");
    console.log("[update-convenios] Para atualizar:");
    console.log("  Opção 1: PORTAL_TRANSPARENCIA_API_KEY=xxx pnpm data:update:convenios");
    console.log("  Opção 2: Baixe CSV de https://plataformamaisbrasil.gov.br/download-de-dados");
    console.log("           Salve em scripts/data/convenios_export.csv");
    const existing: Record<string, unknown> = JSON.parse(
      readFileSync(OUTPUT_PATH, "utf-8"),
    ) as Record<string, unknown>;
    const { __meta: _, ...entries } = existing;
    data = entries as Record<string, ConveniosEntry>;
    source = "existing_json_preserved";
  }

  const validation = ConveniosDataFileSchema.safeParse(data);
  if (!validation.success) {
    console.error("[update-convenios] ERRO: Validação Zod falhou.");
    console.error(JSON.stringify(validation.error.errors.slice(0, 5), null, 2));
    process.exit(1);
  }

  const output = {
    __meta: {
      lastUpdated: new Date().toISOString(),
      referenceYear: year,
      sourceUrl: "https://plataformamaisbrasil.gov.br/download-de-dados",
      municipalities: Object.keys(data).length,
      acquisitionMethod: source,
    },
    ...data,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `[update-convenios] Gravado ${OUTPUT_PATH} (${Object.keys(data).length} municípios, ano ref: ${year}, fonte: ${source})`,
  );
}

main();
