/**
 * scripts/update-transferegov-data.ts
 *
 * Extrai oportunidades do TransfereGov do banco PostgreSQL do extrata_coleta.
 *
 * Fonte: DB extrata_coleta (localhost:5432, user extrata, db extrata)
 * Container Docker: extrata_coleta-db-1
 *
 * Dados extraídos:
 *   - Programas abertos para municípios de SC
 *   - Totais por status e por órgão
 *
 * Uso: npx tsx scripts/update-transferegov-data.ts
 *
 * Pré-requisito: container Docker extrata_coleta-db-1 rodando
 */

import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { TransfereGovDataFileSchema } from "../shared/types/agents/transferegov.types.js";

const OUTPUT_PATH = resolve(__dirname, "../shared/data/transferegov_latest.json");

function psql(query: string): string {
  return execSync(
    `docker exec extrata_coleta-db-1 psql -U extrata -d extrata -t -A -F'\t' -c "${query.replace(/"/g, '\\"')}"`,
    { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
  )
    .toString()
    .trim();
}

function main(): void {
  // Verificar se container está rodando
  try {
    execSync("docker inspect extrata_coleta-db-1 --format='{{.State.Running}}'", {
      timeout: 5_000,
    });
  } catch {
    // eslint-disable-next-line no-console
    console.error("[update-transferegov] Container extrata_coleta-db-1 não encontrado.");
    // eslint-disable-next-line no-console
    console.error(
      "[update-transferegov] Execute: cd /Users/joubert/extrata_coleta && docker compose up -d",
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log("[update-transferegov] Conectando ao banco extrata_coleta...");

  // 1. Programas abertos para municípios SC
  const abertosRaw = psql(
    `SELECT nome, orgao_superior, modalidade, inicio_janela, fim_janela, acao_orcamentaria, natureza_juridica ` +
      `FROM programa_oportunidade ` +
      `WHERE uf='SC' AND status_normalizado='aberto_confirmado' ` +
      `ORDER BY fim_janela DESC NULLS LAST`,
  );

  const programasAbertos = abertosRaw
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const [nome, orgao, mod, inicio, fim, acao, nat] = line.split("\t");
      return {
        nome: nome ?? "",
        orgaoSuperior: orgao ?? "",
        modalidade: mod ?? "",
        inicioJanela: inicio || null,
        fimJanela: fim || null,
        acaoOrcamentaria: acao || null,
        naturezaJuridica: nat ?? "",
      };
    });

  // 2. Totais
  const totaisRaw = psql(
    `SELECT status_normalizado, COUNT(*) ` +
      `FROM programa_oportunidade WHERE uf='SC' ` +
      `GROUP BY 1`,
  );

  let totalSC = 0;
  let totalEncerrados = 0;
  let totalAbertos = 0;
  for (const line of totaisRaw.split("\n")) {
    const [status, count] = line.split("\t");
    const n = parseInt(count ?? "0", 10);
    totalSC += n;
    if (status === "encerrado") totalEncerrados = n;
    if (status === "aberto_confirmado") totalAbertos = n;
  }

  // 3. Programas por órgão (municipais)
  const orgaoRaw = psql(
    `SELECT orgao_superior, COUNT(*) ` +
      `FROM programa_oportunidade ` +
      `WHERE uf='SC' AND natureza_juridica='Administração Pública Municipal' ` +
      `GROUP BY 1 ORDER BY 2 DESC`,
  );

  const programasPorOrgao: Record<string, number> = {};
  for (const line of orgaoRaw.split("\n")) {
    const [orgao, count] = line.split("\t");
    if (orgao && count) {
      programasPorOrgao[orgao] = parseInt(count, 10);
    }
  }

  const data = {
    programasAbertos,
    totalProgramasSC: totalSC,
    totalEncerrados,
    totalAbertos,
    programasPorOrgao,
  };

  // Validação Zod
  const validation = TransfereGovDataFileSchema.safeParse(data);
  if (!validation.success) {
    // eslint-disable-next-line no-console
    console.error("[update-transferegov] ERRO: Validação Zod falhou.");
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(validation.error.errors.slice(0, 5), null, 2));
    process.exit(1);
  }

  const output = {
    __meta: {
      lastUpdated: new Date().toISOString(),
      source: "extrata_coleta_db",
      sourceUrl: "https://transferegov.gestao.gov.br/",
      acquisitionMethod: "postgresql_direct_query",
    },
    ...data,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  // eslint-disable-next-line no-console
  console.log(
    `[update-transferegov] Gravado ${OUTPUT_PATH} (${programasAbertos.length} programas abertos, ${totalSC} total SC)`,
  );
}

main();
