/**
 * 10 maiores municípios de SC usados como grupo de comparação estadual.
 * Fonte única — importado por frontend e backend.
 * Evita chamar todos os 295 municípios por requisição.
 */
export const SC_BENCHMARK_CODES: readonly string[] = [
  "4205407", // Florianópolis
  "4209102", // Joinville
  "4202404", // Blumenau
  "4204608", // Criciúma
  "4216602", // São José
  "4209300", // Lages
  "4202008", // Balneário Camboriú
  "4204202", // Chapecó
  "4208203", // Itajaí
  "4211900", // Palhoça
] as const;
