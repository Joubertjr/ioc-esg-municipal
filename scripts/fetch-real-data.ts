/**
 * Busca dados REAIS do IDEB e SNIS via Base dos Dados (BigQuery).
 *
 * Substitui os dados sintéticos gerados por generate-static-data.ts:
 * - shared/data/ideb_2023.json (IDEB/INEP)
 * - shared/data/snis_2022.json (SNIS saneamento)
 *
 * Pré-requisitos:
 * 1. npm install @google-cloud/bigquery (ou pnpm add -D @google-cloud/bigquery)
 * 2. GOOGLE_APPLICATION_CREDENTIALS configurado
 * 3. Projeto GCP com BigQuery API habilitada
 *
 * Uso: npx tsx scripts/fetch-real-data.ts
 *
 * Alternativa Python (sem @google-cloud/bigquery):
 *
 * ```python
 * import basedosdados as bd
 * import pandas as pd
 * import json
 *
 * # --- IDEB ---
 * df_ideb = bd.read_sql("""
 *     SELECT id_municipio,
 *            MAX(CASE WHEN rede = 'publica' AND anos_escolares = 'iniciais' THEN ideb END) as idebAnosIniciais,
 *            MAX(CASE WHEN rede = 'publica' AND anos_escolares = 'finais' THEN ideb END) as idebAnosFinais
 *     FROM `basedosdados-dev.br_inep_ideb.municipio`
 *     WHERE sigla_uf = 'SC' AND ano = 2023
 *     GROUP BY id_municipio
 * """, billing_project_id="SEU_PROJETO_GCP")
 *
 * ideb_output = {}
 * for _, row in df_ideb.iterrows():
 *     ideb_output[str(row['id_municipio'])] = {
 *         "idebAnosIniciais": None if pd.isna(row['idebAnosIniciais']) else round(float(row['idebAnosIniciais']), 1),
 *         "idebAnosFinais": None if pd.isna(row['idebAnosFinais']) else round(float(row['idebAnosFinais']), 1),
 *     }
 * with open('shared/data/ideb_2023.json', 'w') as f:
 *     json.dump(ideb_output, f, indent=2, ensure_ascii=False)
 * print(f"IDEB 2023: {len(ideb_output)} municípios")
 *
 * # --- SNIS ---
 * df_snis = bd.read_sql("""
 *     SELECT id_municipio,
 *            indice_atendimento_agua AS atendimentoAgua,
 *            indice_atendimento_esgoto AS atendimentoEsgoto,
 *            indice_tratamento_esgoto AS esgotoTratado,
 *            indice_perda_faturamento AS perdaFaturamento
 *     FROM `basedosdados-dev.br_mdr_snis.municipio_agua_esgoto`
 *     WHERE sigla_uf = 'SC' AND ano = 2022
 * """, billing_project_id="SEU_PROJETO_GCP")
 *
 * snis_output = {}
 * for _, row in df_snis.iterrows():
 *     snis_output[str(row['id_municipio'])] = {
 *         "atendimentoAgua": None if pd.isna(row['atendimentoAgua']) else round(float(row['atendimentoAgua']), 1),
 *         "atendimentoEsgoto": None if pd.isna(row['atendimentoEsgoto']) else round(float(row['atendimentoEsgoto']), 1),
 *         "esgotoTratado": None if pd.isna(row['esgotoTratado']) else round(float(row['esgotoTratado']), 1),
 *         "perdaFaturamento": None if pd.isna(row['perdaFaturamento']) else round(float(row['perdaFaturamento']), 1),
 *     }
 * with open('shared/data/snis_2022.json', 'w') as f:
 *     json.dump(snis_output, f, indent=2, ensure_ascii=False)
 * print(f"SNIS 2022: {len(snis_output)} municípios")
 * ```
 */

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║  fetch-real-data.ts — Busca dados REAIS do IDEB e SNIS             ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  Este script requer credenciais Google Cloud para BigQuery.         ║
║                                                                     ║
║  Opção 1 — Node.js (@google-cloud/bigquery):                       ║
║    1. pnpm add -D @google-cloud/bigquery                           ║
║    2. export GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json         ║
║    3. Descomentar código BigQuery neste arquivo                     ║
║    4. npx tsx scripts/fetch-real-data.ts                            ║
║                                                                     ║
║  Opção 2 — Python (basedosdados):                                   ║
║    1. pip install basedosdados pandas                               ║
║    2. Copiar script Python do docstring deste arquivo               ║
║    3. python scripts/fetch_real_data.py                             ║
║                                                                     ║
║  Tabelas BigQuery (dados públicos, free tier 1TB/mês):              ║
║    - basedosdados-dev.br_inep_ideb.municipio                       ║
║    - basedosdados-dev.br_mdr_snis.municipio_agua_esgoto            ║
║                                                                     ║
║  IMPORTANTE: Dados atuais em ideb_2023.json e snis_2022.json são   ║
║  estimados (gerados por generate-static-data.ts com benchmarks SC). ║
║  Substituir por dados reais antes de produção.                      ║
║                                                                     ║
╚═══════════════════════════════════════════════════════════════════════╝
`);

// ─── Código BigQuery (descomentar quando credenciais estiverem disponíveis) ──
/*
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync } from "fs";

const bigquery = new BigQuery();

async function fetchIdeb(): Promise<void> {
  const query = `
    SELECT
      id_municipio,
      MAX(CASE WHEN rede = 'publica' AND anos_escolares = 'iniciais' THEN ideb END) as idebAnosIniciais,
      MAX(CASE WHEN rede = 'publica' AND anos_escolares = 'finais' THEN ideb END) as idebAnosFinais
    FROM \`basedosdados-dev.br_inep_ideb.municipio\`
    WHERE sigla_uf = 'SC' AND ano = 2023
    GROUP BY id_municipio
    ORDER BY id_municipio
  `;

  const [rows] = await bigquery.query({ query });
  const output: Record<string, { idebAnosIniciais: number | null; idebAnosFinais: number | null }> = {};

  for (const row of rows) {
    output[row.id_municipio] = {
      idebAnosIniciais: row.idebAnosIniciais != null ? Number(Number(row.idebAnosIniciais).toFixed(1)) : null,
      idebAnosFinais: row.idebAnosFinais != null ? Number(Number(row.idebAnosFinais).toFixed(1)) : null,
    };
  }

  writeFileSync("shared/data/ideb_2023.json", JSON.stringify(output, null, 2) + "\n");
  console.log(`IDEB 2023: ${Object.keys(output).length} municípios SC`);
}

async function fetchSnis(): Promise<void> {
  const query = `
    SELECT
      id_municipio,
      indice_atendimento_agua,
      indice_atendimento_esgoto,
      indice_tratamento_esgoto,
      indice_perda_faturamento
    FROM \`basedosdados-dev.br_mdr_snis.municipio_agua_esgoto\`
    WHERE sigla_uf = 'SC' AND ano = 2022
    ORDER BY id_municipio
  `;

  const [rows] = await bigquery.query({ query });
  const output: Record<string, {
    atendimentoAgua: number | null;
    atendimentoEsgoto: number | null;
    esgotoTratado: number | null;
    perdaFaturamento: number | null;
  }> = {};

  for (const row of rows) {
    output[row.id_municipio] = {
      atendimentoAgua: row.indice_atendimento_agua != null ? Number(Number(row.indice_atendimento_agua).toFixed(1)) : null,
      atendimentoEsgoto: row.indice_atendimento_esgoto != null ? Number(Number(row.indice_atendimento_esgoto).toFixed(1)) : null,
      esgotoTratado: row.indice_tratamento_esgoto != null ? Number(Number(row.indice_tratamento_esgoto).toFixed(1)) : null,
      perdaFaturamento: row.indice_perda_faturamento != null ? Number(Number(row.indice_perda_faturamento).toFixed(1)) : null,
    };
  }

  writeFileSync("shared/data/snis_2022.json", JSON.stringify(output, null, 2) + "\n");
  console.log(`SNIS 2022: ${Object.keys(output).length} municípios SC`);
}

Promise.all([fetchIdeb(), fetchSnis()]).catch(console.error);
*/
