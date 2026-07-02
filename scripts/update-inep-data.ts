/**
 * scripts/update-inep-data.ts
 *
 * Atualiza shared/data/ideb_latest.json com dados do IDEB (INEP).
 *
 * Estratégia (em ordem de prioridade):
 * 1. Download automático dos ZIPs oficiais do INEP (anos iniciais + finais)
 * 2. CSV local em scripts/data/ideb_export.csv (fallback manual)
 * 3. Preserva dados existentes se nenhuma fonte estiver disponível
 *
 * Uso: npx tsx scripts/update-inep-data.ts [--year 2023]
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

import { IdebDataFileSchema } from "../shared/types/agents/inep.types.js";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/ideb_latest.json");
const DEFAULT_FALLBACK_YEAR = 2023;
const TMP_DIR = resolve(__dirname, "data/.tmp-inep");

interface IdebEntry {
  idebAnosIniciais: number | null;
  idebAnosFinais: number | null;
}

function parseNum(val: string | undefined | number | null): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === "" || s === "-" || s === "*") return null;
  const num = parseFloat(s.replace(",", "."));
  return isNaN(num) ? null : Math.round(num * 10) / 10;
}

function cleanup(): void {
  try {
    execSync(`rm -rf "${TMP_DIR}"`, { stdio: "ignore" });
  } catch {
    // ignore
  }
}

function extractIdebFromXlsx(xlsxPath: string, year: number): Map<string, number | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    range: 0,
  });

  // Row 9 has variable names like VL_OBSERVADO_2023
  const varRow = data[9] ?? [];
  const idebColName = `VL_OBSERVADO_${year}`;
  const idebCol = varRow.findIndex((c) => String(c) === idebColName);

  if (idebCol === -1) {
    const available = varRow.filter((c) => String(c).startsWith("VL_OBSERVADO_")).map(String);
    console.log(
      `[update-inep] Coluna ${idebColName} não encontrada. Disponíveis: ${available.join(", ")}`,
    );
    // Try latest available
    const lastAvail = available.pop();
    if (!lastAvail) return new Map();
    const fallbackCol = varRow.findIndex((c) => String(c) === lastAvail);
    console.log(`[update-inep] Usando fallback: ${lastAvail} (col ${fallbackCol})`);
    return extractColumn(data, fallbackCol);
  }

  console.log(`[update-inep] Coluna IDEB: [${idebCol}] = ${idebColName}`);
  return extractColumn(data, idebCol);
}

function extractColumn(
  data: (string | number | null)[][],
  col: number,
): Map<string, number | null> {
  const result = new Map<string, number | null>();

  for (let i = 10; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const uf = String(row[0] ?? "");
    const code = String(row[1] ?? "");
    const rede = String(row[3] ?? "").toLowerCase();

    // Filtrar: SC, 7 dígitos, rede Municipal (preferência) ou Pública
    if (uf !== "SC" || code.length !== 7) continue;
    if (rede !== "municipal" && rede !== "pública" && rede !== "publica") continue;

    // Municipal tem prioridade sobre Pública
    if (result.has(code) && rede !== "municipal") continue;

    result.set(code, parseNum(row[col]));
  }

  return result;
}

function downloadZip(url: string, destPath: string): boolean {
  console.log(`[update-inep] Baixando ${url}...`);
  try {
    execSync(`curl -s --max-time 600 --retry 2 --retry-delay 5 -L -o "${destPath}" "${url}"`, {
      stdio: "pipe",
      timeout: 620_000,
    });
    if (!existsSync(destPath)) return false;
    const stats = execSync(`wc -c < "${destPath}"`).toString().trim();
    const bytes = parseInt(stats, 10);
    if (bytes < 10_000) {
      console.log(`[update-inep] Arquivo muito pequeno (${bytes} bytes), descartando`);
      unlinkSync(destPath);
      return false;
    }
    console.log(`[update-inep] Download OK: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    return true;
  } catch (e) {
    console.log(`[update-inep] Falha no download: ${(e as Error).message}`);
    return false;
  }
}

function fetchFromInep(year: number): Record<string, IdebEntry> | null {
  mkdirSync(TMP_DIR, { recursive: true });

  const baseUrl = "https://download.inep.gov.br/ideb/resultados";
  const iniciais = `divulgacao_anos_iniciais_municipios_${year}`;
  const finais = `divulgacao_anos_finais_municipios_${year}`;

  const inicZip = resolve(TMP_DIR, `${iniciais}.zip`);
  const finZip = resolve(TMP_DIR, `${finais}.zip`);

  const okInic = downloadZip(`${baseUrl}/${iniciais}.zip`, inicZip);
  const okFin = downloadZip(`${baseUrl}/${finais}.zip`, finZip);

  if (!okInic && !okFin) {
    console.log("[update-inep] Nenhum ZIP disponível no INEP");
    cleanup();
    return null;
  }

  const data: Record<string, IdebEntry> = {};

  // Inicializar todos os municípios com null
  const initMap = new Map<string, number | null>();
  const finMap = new Map<string, number | null>();

  if (okInic) {
    try {
      execSync(`unzip -o "${inicZip}" -d "${TMP_DIR}/iniciais"`, { stdio: "ignore" });
      const xlsxFiles = execSync(`find "${TMP_DIR}/iniciais" -name "*.xlsx"`)
        .toString()
        .trim()
        .split("\n")
        .filter(Boolean);
      if (xlsxFiles.length > 0) {
        const map = extractIdebFromXlsx(xlsxFiles[0], year);
        for (const [k, v] of map) initMap.set(k, v);
        console.log(`[update-inep] Anos iniciais: ${initMap.size} municípios SC extraídos`);
      }
    } catch (e) {
      console.log(`[update-inep] Erro ao processar anos iniciais: ${(e as Error).message}`);
    }
  }

  if (okFin) {
    try {
      execSync(`unzip -o "${finZip}" -d "${TMP_DIR}/finais"`, { stdio: "ignore" });
      const xlsxFiles = execSync(`find "${TMP_DIR}/finais" -name "*.xlsx"`)
        .toString()
        .trim()
        .split("\n")
        .filter(Boolean);
      if (xlsxFiles.length > 0) {
        const map = extractIdebFromXlsx(xlsxFiles[0], year);
        for (const [k, v] of map) finMap.set(k, v);
        console.log(`[update-inep] Anos finais: ${finMap.size} municípios SC extraídos`);
      }
    } catch (e) {
      console.log(`[update-inep] Erro ao processar anos finais: ${(e as Error).message}`);
    }
  }

  // Merge com dados existentes para campos que não conseguimos baixar
  let existing: Record<string, IdebEntry> = {};
  try {
    const raw: Record<string, unknown> = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8")) as Record<
      string,
      unknown
    >;
    const { __meta: _, ...entries } = raw;
    existing = entries as Record<string, IdebEntry>;
  } catch {
    // sem dados existentes
  }

  const allCodes = new Set([...initMap.keys(), ...finMap.keys(), ...Object.keys(existing)]);

  for (const code of allCodes) {
    if (!code.startsWith("42") || code.length !== 7) continue;
    const prev = existing[code];
    data[code] = {
      idebAnosIniciais: initMap.has(code)
        ? (initMap.get(code) ?? null)
        : (prev?.idebAnosIniciais ?? null),
      idebAnosFinais: finMap.has(code)
        ? (finMap.get(code) ?? null)
        : (prev?.idebAnosFinais ?? null),
    };
  }

  cleanup();

  if (Object.keys(data).length === 0) return null;
  return data;
}

function readFromCsv(csvPath: string): Record<string, IdebEntry> | null {
  if (!existsSync(csvPath)) return null;

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
    return null;
  }

  const data: Record<string, IdebEntry> = {};
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
  return data;
}

function main(): void {
  const yearArg = process.argv.indexOf("--year");
  const year = yearArg >= 0 ? parseInt(process.argv[yearArg + 1], 10) : DEFAULT_FALLBACK_YEAR;

  let data: Record<string, IdebEntry> | null = null;
  let source = "existing_json_preserved";

  // 1. Tentar download automático do INEP
  console.log(`[update-inep] Tentando download automático do INEP para ${year}...`);
  data = fetchFromInep(year);
  if (data) {
    source = "inep_download_automatico";
    console.log(`[update-inep] Download automático: ${Object.keys(data).length} municípios`);
  }

  // 2. Fallback: CSV local
  if (!data) {
    const csvPath = resolve(__dirname, "data/ideb_export.csv");
    console.log(`[update-inep] Tentando CSV local: ${csvPath}`);
    data = readFromCsv(csvPath);
    if (data) source = "manual_csv_export";
  }

  // 3. Fallback: manter dados existentes
  if (!data) {
    console.log("[update-inep] Nenhuma fonte nova. Mantendo dados existentes.");
    const existing: Record<string, unknown> = JSON.parse(
      readFileSync(OUTPUT_PATH, "utf-8"),
    ) as Record<string, unknown>;
    const { __meta: _, ...entries } = existing;
    data = entries as Record<string, IdebEntry>;
  }

  const validation = IdebDataFileSchema.safeParse(data);
  if (!validation.success) {
    console.error("[update-inep] ERRO: Output falha validação Zod.");
    console.error(
      "[update-inep] Erros:",
      JSON.stringify(validation.error.errors.slice(0, 5), null, 2),
    );
    process.exit(1);
  }

  const output = {
    __meta: {
      lastUpdated: new Date().toISOString(),
      referenceYear: year,
      sourceUrl:
        "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados",
      municipalities: Object.keys(data).length,
      acquisitionMethod: source,
    },
    ...data,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `[update-inep] Gravado ${OUTPUT_PATH} (${Object.keys(data).length} municípios, ano ref: ${year}, fonte: ${source})`,
  );
}

try {
  main();
} catch (e) {
  cleanup();
  console.error("[update-inep] Erro fatal:", e);
  process.exit(1);
}
