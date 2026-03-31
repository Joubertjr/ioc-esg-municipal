export interface ApiConfig {
  name: string;
  baseUrl: string;
  cacheTtlSeconds: number;
  rateLimit: number; // max requests per second
  timeoutMs: number;
  retryCount: number;
}

export const API_CONFIGS: Record<string, ApiConfig> = {
  ibge: {
    name: "IBGE",
    baseUrl: "https://servicodados.ibge.gov.br/api/v1",
    cacheTtlSeconds: 86_400, // 24h
    rateLimit: 2,
    timeoutMs: 15_000,
    retryCount: 3,
  },
  siconfi: {
    name: "SICONFI",
    baseUrl: "https://api.siconfi.tesouro.gov.br/v1",
    cacheTtlSeconds: 21_600, // 6h
    rateLimit: 2,
    timeoutMs: 30_000,
    retryCount: 3,
  },
  datasus: {
    name: "DATASUS",
    baseUrl: "https://datasus.saude.gov.br",
    cacheTtlSeconds: 43_200, // 12h
    rateLimit: 1,
    timeoutMs: 30_000,
    retryCount: 3,
  },
  inep: {
    name: "INEP",
    baseUrl: "https://www.gov.br/inep",
    cacheTtlSeconds: 604_800, // 7 dias
    rateLimit: 1,
    timeoutMs: 30_000,
    retryCount: 3,
  },
  snis: {
    name: "SNIS",
    baseUrl: "https://www.snis.gov.br",
    cacheTtlSeconds: 604_800, // 7 dias
    rateLimit: 1,
    timeoutMs: 30_000,
    retryCount: 3,
  },
  inpe: {
    name: "INPE",
    baseUrl: "https://terrabrasilis.dpi.inpe.br/api/v1",
    cacheTtlSeconds: 86_400, // 24h
    rateLimit: 2,
    timeoutMs: 15_000,
    retryCount: 3,
  },
  pncp: {
    name: "PNCP",
    baseUrl: "https://pncp.gov.br/api/pncp/v1",
    cacheTtlSeconds: 3_600, // 1h
    rateLimit: 2,
    timeoutMs: 15_000,
    retryCount: 3,
  },
} as const;

/** Converte código IBGE (7 dígitos) para código SICONFI (6 dígitos) */
export function ibgeToSiconfi(ibgeCode: string): string {
  return ibgeCode.slice(0, 6);
}
