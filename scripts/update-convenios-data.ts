/**
 * scripts/update-convenios-data.ts
 *
 * Atualiza shared/data/convenios_latest.json com dados de convênios federais.
 *
 * Estratégia (em ordem):
 * 1. SICONV ZIPs do repositório DETRU (siconv_convenio.csv.zip + siconv_proposta.csv.zip + siconv_consorcios.csv.zip)
 *    Fonte: https://repositorio.dados.gov.br/seges/detru/
 *    Uso: SICONV_DIR=/path/to/detru npx tsx scripts/update-convenios-data.ts
 * 2. API do Portal da Transparência (requer PORTAL_TRANSPARENCIA_API_KEY)
 * 3. CSV local em scripts/data/convenios_export.csv
 * 4. Preserva dados existentes
 *
 * Uso: npx tsx scripts/update-convenios-data.ts [--year 2026]
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { ConveniosDataFileSchema } from "../shared/types/agents/convenios.types.js";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/convenios_latest.json");
const DEFAULT_FALLBACK_YEAR = 2026;

const PORTAL_API_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados/convenios";

interface ConveniosEntry {
  conveniosFederaisAtivos: number | null;
  pctOrcamentoConvenios: number | null;
  consorciosIntermunicipais: number | null;
  valorTotalRepasse: number | null;
  valorTotalDesembolsado: number | null;
  valorTotalGlobal: number | null;
}

interface FinancialData {
  desembolsado: number;
  global: number;
  gasto: number;
}

function readFinancialFromIndicadores(siconvDir: string): Map<string, FinancialData> | null {
  const indicadoresZip = resolve(siconvDir, "siconv_prop_inst_indicadores_municipios.csv.zip");
  if (!existsSync(indicadoresZip)) return null;

  try {
    const tsvRaw = execSync(
      `unzip -p "${indicadoresZip}" siconv_prop_inst_indicadores_municipios.csv | ` +
        `awk -F';' 'NR>1 && length($1)==7 && substr($1,1,2)=="42" && $12!="Cancelado" && $12!="Convênio Anulado" && $12!="Convênio Rescindido" {` +
        `gsub(",",".",$16); gsub(",",".",$26); gsub(",",".",$13); ` +
        `print $1 "\\t" $16+0 "\\t" $26+0 "\\t" $13+0}'`,
      { maxBuffer: 30 * 1024 * 1024, timeout: 120_000 },
    ).toString();

    const result = new Map<string, FinancialData>();
    for (const line of tsvRaw.split("\n")) {
      const [ibge, desemb, glob, gasto] = line.split("\t");
      if (!ibge || ibge.length !== 7) continue;

      const existing = result.get(ibge) ?? { desembolsado: 0, global: 0, gasto: 0 };
      existing.desembolsado += parseFloat(desemb ?? "0");
      existing.global += parseFloat(glob ?? "0");
      existing.gasto += parseFloat(gasto ?? "0");
      result.set(ibge, existing);
    }

    // eslint-disable-next-line no-console
    console.log(`[update-convenios] ${result.size} municípios SC com dados financeiros`);
    return result;
  } catch {
    return null;
  }
}

function readFromSiconvZips(): Record<string, ConveniosEntry> | null {
  const siconvDir = process.env["SICONV_DIR"] ?? resolve(__dirname, "data/detru");
  const convenioZip = resolve(siconvDir, "siconv_convenio.csv.zip");
  const propostaZip = resolve(siconvDir, "siconv_proposta.csv.zip");
  const consorcioZip = resolve(siconvDir, "siconv_consorcios.csv.zip");

  if (!existsSync(convenioZip) || !existsSync(propostaZip)) {
    return null;
  }

  console.log(`[update-convenios] Processando SICONV ZIPs de ${siconvDir}...`);

  // Passo 1: Extrair propostas SC via awk (evita carregar 200MB+ em memória)
  const propostaMap = new Map<string, string>();
  try {
    const tsvRaw = execSync(
      `unzip -p "${propostaZip}" siconv_proposta.csv | awk -F';' 'NR>1 && length($4)==7 && substr($4,1,2)=="42" {print $1 "\\t" $4}'`,
      { maxBuffer: 20 * 1024 * 1024, timeout: 120_000 },
    ).toString();

    for (const line of tsvRaw.split("\n")) {
      const [id, ibge] = line.split("\t");
      if (id && ibge) propostaMap.set(id, ibge);
    }
  } catch (err) {
    console.error(
      `[update-convenios] Erro ao ler propostas: ${(err as Error).message.split("\n")[0]}`,
    );
    return null;
  }

  console.log(`[update-convenios] ${propostaMap.size} propostas SC mapeadas`);

  // Passo 2: Contar convênios não-cancelados por município SC via awk
  const convenioCount = new Map<string, number>();
  try {
    const tsvRaw = execSync(
      `unzip -p "${convenioZip}" siconv_convenio.csv | awk -F';' 'NR>1 && $7!="Convênio Anulado" && $7!="Cancelado" && $7!="Convênio Rescindido" {print $2}'`,
      { maxBuffer: 20 * 1024 * 1024, timeout: 120_000 },
    ).toString();

    for (const id of tsvRaw.split("\n")) {
      const trimmed = id.trim();
      if (!trimmed) continue;
      const ibge = propostaMap.get(trimmed);
      if (!ibge) continue;
      convenioCount.set(ibge, (convenioCount.get(ibge) ?? 0) + 1);
    }
  } catch (err) {
    console.error(
      `[update-convenios] Erro ao ler convênios: ${(err as Error).message.split("\n")[0]}`,
    );
    return null;
  }

  console.log(`[update-convenios] ${convenioCount.size} municípios SC com convênios`);

  // Passo 3: Contar consórcios distintos por município SC
  const consorcioCount = new Map<string, number>();
  if (existsSync(consorcioZip)) {
    try {
      const tsvRaw = execSync(
        `unzip -p "${consorcioZip}" siconv_consorcios.csv | awk -F';' 'NR>1 {print $1 "\\t" $2}'`,
        { maxBuffer: 20 * 1024 * 1024, timeout: 120_000 },
      ).toString();

      const seen = new Set<string>();
      for (const line of tsvRaw.split("\n")) {
        const [idProposta, cnpjConsorcio] = line.split("\t");
        if (!idProposta || !cnpjConsorcio) continue;

        const ibge = propostaMap.get(idProposta.trim());
        if (!ibge) continue;

        const key = `${ibge}:${cnpjConsorcio.trim()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        consorcioCount.set(ibge, (consorcioCount.get(ibge) ?? 0) + 1);
      }

      console.log(`[update-convenios] ${consorcioCount.size} municípios SC com consórcios`);
    } catch {
      console.log("[update-convenios] Aviso: não foi possível processar consórcios");
    }
  }

  // Passo 4: Extrair dados financeiros do indicadores_municipios
  const financialData = readFinancialFromIndicadores(siconvDir);

  // Montar dados
  const data: Record<string, ConveniosEntry> = {};
  const allIbges = new Set([...convenioCount.keys(), ...(financialData?.keys() ?? [])]);
  for (const ibge of allIbges) {
    const count = convenioCount.get(ibge) ?? 0;
    const fin = financialData?.get(ibge);
    data[ibge] = {
      conveniosFederaisAtivos: count > 0 ? count : null,
      pctOrcamentoConvenios: null,
      consorciosIntermunicipais: consorcioCount.get(ibge) ?? null,
      valorTotalRepasse: fin ? Math.round(fin.global * 100) / 100 : null,
      valorTotalDesembolsado: fin ? Math.round(fin.desembolsado * 100) / 100 : null,
      valorTotalGlobal: fin ? Math.round(fin.global * 100) / 100 : null,
    };
  }

  return data;
}

function fetchFromPortalApi(): Record<string, ConveniosEntry> | null {
  const apiKey = process.env["PORTAL_TRANSPARENCIA_API_KEY"];
  if (!apiKey) {
    console.log("[update-convenios] PORTAL_TRANSPARENCIA_API_KEY não definida.");
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
      valorTotalRepasse: null,
      valorTotalDesembolsado: null,
      valorTotalGlobal: null,
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
      valorTotalRepasse: null,
      valorTotalDesembolsado: null,
      valorTotalGlobal: null,
    };
  }

  console.log(`[update-convenios] CSV: ${Object.keys(data).length} municípios SC`);
  return data;
}

function main(): void {
  const yearArg = process.argv.indexOf("--year");
  const year = yearArg >= 0 ? parseInt(process.argv[yearArg + 1], 10) : DEFAULT_FALLBACK_YEAR;

  // 1. SICONV ZIPs
  let data = readFromSiconvZips();
  let source = "siconv_detru_zip";

  // 2. Portal da Transparência API
  if (!data) {
    data = fetchFromPortalApi();
    source = "portal_transparencia_api";
  }

  // 3. CSV manual
  if (!data) {
    data = readFromCsv();
    source = "manual_csv";
  }

  // 4. Preservar existentes
  if (!data) {
    console.log("[update-convenios] Nenhuma fonte nova. Mantendo dados existentes.");
    console.log("[update-convenios] Para atualizar:");
    console.log("  Opção 1: SICONV_DIR=/path/to/detru pnpm data:update:convenios");
    console.log("           (ZIPs do https://repositorio.dados.gov.br/seges/detru/)");
    console.log("  Opção 2: PORTAL_TRANSPARENCIA_API_KEY=xxx pnpm data:update:convenios");
    console.log("  Opção 3: Baixe CSV e salve em scripts/data/convenios_export.csv");
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
