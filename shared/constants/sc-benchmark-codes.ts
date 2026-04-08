/**
 * 10 maiores municípios de SC usados como grupo de comparação estadual.
 * Fonte única — importado por frontend e backend.
 * Evita chamar todos os 295 municípios por requisição.
 */
export const SC_BENCHMARK_CODES: readonly string[] = [
  "4205407", // Florianópolis
  "4209102", // Joinville
  "4204202", // Blumenau
  "4205002", // Criciúma
  "4218707", // São José
  "4211503", // Lages
  "4202404", // Balneário Camboriú
  "4204806", // Chapecó
  "4207007", // Itajaí
  "4215802", // Palhoça
] as const;
