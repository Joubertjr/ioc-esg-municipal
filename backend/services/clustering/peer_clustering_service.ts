/**
 * backend/services/clustering/peer_clustering_service.ts
 *
 * Peer clustering para todos os 295 municípios catarinenses.
 *
 * Dado um código IBGE, encontra os N municípios mais similares com base
 * em duas variáveis normalizadas (z-score): população e FPM per capita.
 *
 * Carrega dados do PostgreSQL (Municipality table) e cacheia em memória.
 * Cache é invalidado a cada 24h ou manualmente via invalidateClusteringCache().
 */

import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface MunicipalityProfile {
  ibgeCode: string;
  name: string;
  population: number;
  fpmPerCapita: number;
}

// ---------------------------------------------------------------------------
// Cache em memória
// ---------------------------------------------------------------------------

let cachedProfiles: MunicipalityProfile[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function invalidateClusteringCache(): void {
  cachedProfiles = null;
  cacheTimestamp = 0;
}

async function loadProfiles(): Promise<MunicipalityProfile[]> {
  if (cachedProfiles && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedProfiles;
  }

  const municipalities = await prisma.municipality.findMany({
    where: { deletedAt: null, state: "SC" },
    select: {
      ibgeCode: true,
      name: true,
      population: true,
      fpmAnnual: true,
    },
  });

  cachedProfiles = municipalities
    .filter((m) => m.population !== null && m.population > 0 && m.fpmAnnual !== null)
    .map((m) => ({
      ibgeCode: m.ibgeCode,
      name: m.name,
      population: m.population!,
      fpmPerCapita: Number(m.fpmAnnual!) / m.population!,
    }));

  cacheTimestamp = Date.now();

  logger.info(`[clustering] loaded ${cachedProfiles.length} municipality profiles`);
  return cachedProfiles;
}

// ---------------------------------------------------------------------------
// Helpers estatísticos
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function stddev(values: number[], mu: number): number {
  const variance = values.reduce((acc, v) => acc + (v - mu) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function zscores(values: number[]): number[] {
  const mu = mean(values);
  const sd = stddev(values, mu);
  if (sd === 0) return values.map(() => 0);
  return values.map((v) => (v - mu) / sd);
}

// ---------------------------------------------------------------------------
// Função pública
// ---------------------------------------------------------------------------

/**
 * Retorna os ibgeCodes dos `topN` municípios mais similares ao alvo,
 * ordenados do mais similar para o menos similar.
 *
 * Similaridade = distância euclidiana no espaço z-score (população, FPM per capita).
 *
 * @returns Array de ibgeCodes (sem o próprio município). Array vazio se o
 *          código não for encontrado no dataset.
 */
export async function findPeerMunicipalities(ibgeCode: string, topN = 5): Promise<string[]> {
  const profiles = await loadProfiles();

  const targetIndex = profiles.findIndex((m) => m.ibgeCode === ibgeCode);
  if (targetIndex === -1) {
    return [];
  }

  const popZ = zscores(profiles.map((m) => m.population));
  const fpmZ = zscores(profiles.map((m) => m.fpmPerCapita));

  const targetPop = popZ[targetIndex];
  const targetFpm = fpmZ[targetIndex];

  const distances: Array<{ ibgeCode: string; distance: number }> = [];

  for (let i = 0; i < profiles.length; i++) {
    if (i === targetIndex) continue;

    const distance = Math.sqrt((popZ[i] - targetPop) ** 2 + (fpmZ[i] - targetFpm) ** 2);

    distances.push({ ibgeCode: profiles[i].ibgeCode, distance });
  }

  distances.sort((a, b) => a.distance - b.distance);

  return distances.slice(0, topN).map((d) => d.ibgeCode);
}
