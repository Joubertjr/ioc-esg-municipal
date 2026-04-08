/**
 * backend/services/clustering/peer_clustering_service.ts
 *
 * Peer clustering para municípios catarinenses.
 *
 * Dado um código IBGE, encontra os N municípios mais similares com base
 * em três variáveis normalizadas (z-score): população, PIB per capita e
 * macrorregião.
 *
 * Esta é uma função pura — sem I/O, sem cache, sem async.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface MunicipalityProfile {
  ibgeCode: string;
  name: string;
  population: number;
  pibPerCapita: number; // R$ mil
  region: number; // 1–6 (macrorregião SC)
}

// ---------------------------------------------------------------------------
// Dataset — 20 municípios de SC (Censo IBGE 2022)
// Regiões: 1=Norte  2=Vale do Itajaí  3=Grande Fpolis  4=Sul  5=Oeste  6=Serra
// ---------------------------------------------------------------------------

const MUNICIPALITIES: MunicipalityProfile[] = [
  { ibgeCode: "4205407", name: "Florianópolis", population: 516524, pibPerCapita: 58.2, region: 3 },
  { ibgeCode: "4209102", name: "Joinville", population: 616317, pibPerCapita: 52.1, region: 1 },
  { ibgeCode: "4202404", name: "Blumenau", population: 361855, pibPerCapita: 55.8, region: 2 },
  { ibgeCode: "4204202", name: "Chapecó", population: 227587, pibPerCapita: 48.3, region: 5 },
  { ibgeCode: "4204608", name: "Criciúma", population: 215186, pibPerCapita: 39.7, region: 4 },
  { ibgeCode: "4208203", name: "Itajaí", population: 223112, pibPerCapita: 87.4, region: 2 },
  {
    ibgeCode: "4208906",
    name: "Jaraguá do Sul",
    population: 181173,
    pibPerCapita: 62.5,
    region: 1,
  },
  { ibgeCode: "4209300", name: "Lages", population: 157544, pibPerCapita: 30.2, region: 6 },
  {
    ibgeCode: "4202008",
    name: "Balneário Camboriú",
    population: 145796,
    pibPerCapita: 54.1,
    region: 2,
  },
  { ibgeCode: "4218707", name: "São José", population: 250181, pibPerCapita: 37.8, region: 3 },
  { ibgeCode: "4211900", name: "Palhoça", population: 195055, pibPerCapita: 32.4, region: 3 },
  { ibgeCode: "4202909", name: "Brusque", population: 140568, pibPerCapita: 56.3, region: 2 },
  { ibgeCode: "4218509", name: "Tubarão", population: 107220, pibPerCapita: 38.9, region: 4 },
  { ibgeCode: "4203006", name: "Caçador", population: 79472, pibPerCapita: 31.5, region: 5 },
  { ibgeCode: "4204301", name: "Concórdia", population: 75198, pibPerCapita: 52.8, region: 5 },
  { ibgeCode: "4214805", name: "Rio do Sul", population: 73750, pibPerCapita: 45.2, region: 2 },
  { ibgeCode: "4201406", name: "Araranguá", population: 68228, pibPerCapita: 29.8, region: 4 },
  {
    ibgeCode: "4215802",
    name: "São Bento do Sul",
    population: 84507,
    pibPerCapita: 47.1,
    region: 1,
  },
  { ibgeCode: "4203808", name: "Canoinhas", population: 54030, pibPerCapita: 28.4, region: 1 },
  { ibgeCode: "4211306", name: "Navegantes", population: 94474, pibPerCapita: 41.2, region: 2 },
];

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
  // Evita divisão por zero se todos os valores forem idênticos
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
 * Similaridade = distância euclidiana no espaço z-score das três variáveis.
 *
 * @returns Array de ibgeCodes (sem o próprio município). Array vazio se o
 *          código não for encontrado no dataset.
 */
export function findPeerMunicipalities(ibgeCode: string, topN = 5): string[] {
  const targetIndex = MUNICIPALITIES.findIndex((m) => m.ibgeCode === ibgeCode);

  if (targetIndex === -1) {
    return [];
  }

  // Calcula z-scores para cada variável em todos os municípios
  const popZ = zscores(MUNICIPALITIES.map((m) => m.population));
  const pibZ = zscores(MUNICIPALITIES.map((m) => m.pibPerCapita));
  const regZ = zscores(MUNICIPALITIES.map((m) => m.region));

  const targetPop = popZ[targetIndex];
  const targetPib = pibZ[targetIndex];
  const targetReg = regZ[targetIndex];

  // Distância euclidiana de cada outro município em relação ao alvo
  const distances: Array<{ ibgeCode: string; distance: number }> = [];

  for (let i = 0; i < MUNICIPALITIES.length; i++) {
    if (i === targetIndex) continue;

    const distance = Math.sqrt(
      (popZ[i] - targetPop) ** 2 + (pibZ[i] - targetPib) ** 2 + (regZ[i] - targetReg) ** 2,
    );

    distances.push({ ibgeCode: MUNICIPALITIES[i].ibgeCode, distance });
  }

  distances.sort((a, b) => a.distance - b.distance);

  return distances.slice(0, topN).map((d) => d.ibgeCode);
}
