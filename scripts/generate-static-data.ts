/**
 * Gera dados estáticos IDEB 2023 e SNIS 2022 para os 295 municípios de SC.
 *
 * Usa distribuições realistas baseadas em benchmarks estaduais:
 * - IDEB SC 2023: média anos iniciais ~6.2, anos finais ~5.0
 * - SNIS SC 2022: cobertura água ~95%, esgoto ~40%, tratamento ~70%
 *
 * Para produção, substituir por dados reais dos Excel/CSV oficiais.
 * Este script gera dados determinísticos (seed baseada no ibgeCode).
 *
 * Uso: npx tsx scripts/generate-static-data.ts
 */

import { writeFileSync } from "fs";
import { SC_MUNICIPALITIES } from "../shared/constants/municipalities-sc.js";

// Seed determinística baseada no ibgeCode
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

// Gera valor com distribuição normal aproximada (Box-Muller simplificado)
function normalish(rng: () => number, mean: number, stddev: number, min: number, max: number): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 0.001))) * Math.cos(2 * Math.PI * u2);
  const value = mean + z * stddev;
  return Math.round(Math.max(min, Math.min(max, value)) * 10) / 10;
}

// ─── IDEB 2023 ───────────────────────────────────────────────────────────────

interface IdebEntry {
  idebAnosIniciais: number | null;
  idebAnosFinais: number | null;
}

const idebData: Record<string, IdebEntry> = {};

for (const mun of SC_MUNICIPALITIES) {
  const rng = seededRandom(`ideb-${mun.ibgeCode}`);

  // ~5% dos municípios muito pequenos não têm IDEB publicado
  const hasAnosIniciais = rng() > 0.05;
  const hasAnosFinais = rng() > 0.08; // mais municípios sem dados em anos finais

  idebData[mun.ibgeCode] = {
    // SC tem IDEB alto: média ~6.2 anos iniciais, ~5.0 anos finais
    idebAnosIniciais: hasAnosIniciais ? normalish(rng, 6.2, 0.8, 3.0, 8.5) : null,
    idebAnosFinais: hasAnosFinais ? normalish(rng, 5.0, 0.7, 2.5, 7.5) : null,
  };
}

writeFileSync(
  "shared/data/ideb_2023.json",
  JSON.stringify(idebData, null, 2) + "\n",
);
console.log(`IDEB 2023: ${Object.keys(idebData).length} municípios gerados`);

// ─── SNIS 2022 ───────────────────────────────────────────────────────────────

interface SnisEntry {
  atendimentoAgua: number | null;
  atendimentoEsgoto: number | null;
  esgotoTratado: number | null;
  perdaFaturamento: number | null;
}

const snisData: Record<string, SnisEntry> = {};

for (const mun of SC_MUNICIPALITIES) {
  const rng = seededRandom(`snis-${mun.ibgeCode}`);

  // ~3% dos municípios não têm dados no SNIS
  if (rng() < 0.03) continue;

  snisData[mun.ibgeCode] = {
    // SC: boa cobertura de água, esgoto é o ponto fraco
    atendimentoAgua: normalish(rng, 95, 5, 60, 100),
    atendimentoEsgoto: normalish(rng, 40, 20, 0, 95),
    esgotoTratado: normalish(rng, 70, 20, 10, 100),
    perdaFaturamento: normalish(rng, 30, 10, 8, 60),
  };
}

writeFileSync(
  "shared/data/snis_2022.json",
  JSON.stringify(snisData, null, 2) + "\n",
);
console.log(`SNIS 2022: ${Object.keys(snisData).length} municípios gerados`);
