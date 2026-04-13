import client from "prom-client";

// ─── Registry singleton ──────────────────────────────────────────────────────

export const registry = new client.Registry();

registry.setDefaultLabels({ app: "ioc-esg-municipal" });

client.collectDefaultMetrics({ register: registry });

// ─── Inbound HTTP metrics ────────────────────────────────────────────────────

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of inbound HTTP requests in ms",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [registry],
});

export const httpErrors = new client.Counter({
  name: "http_errors_total",
  help: "Total count of HTTP error responses (4xx and 5xx)",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [registry],
});

// ─── Outbound API metrics ────────────────────────────────────────────────────

export const outboundApiDuration = new client.Histogram({
  name: "outbound_api_duration_ms",
  help: "Duration of outbound API calls to government sources in ms",
  labelNames: ["source", "success"] as const,
  buckets: [100, 500, 1000, 2000, 5000, 15000, 30000],
  registers: [registry],
});

// ─── Cache metrics ───────────────────────────────────────────────────────────

export const cacheOperations = new client.Counter({
  name: "cache_operations_total",
  help: "Redis cache operations by type and key prefix",
  labelNames: ["operation", "key_prefix"] as const,
  registers: [registry],
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IBGE_CODE_RE = /\b\d{7}\b/g;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const CUID_RE = /\/[a-z0-9]{24,30}(?:\/|$)/g;

/**
 * Normaliza route paths para evitar explosão de cardinalidade no Prometheus.
 * Substitui IBGE codes (7 dígitos) por :ibgeCode e UUIDs/CUIDs por :id.
 */
export function normalizeRoute(path: string): string {
  return path
    .replace(UUID_RE, ":id")
    .replace(CUID_RE, (match) => (match.endsWith("/") ? "/:id/" : "/:id"))
    .replace(IBGE_CODE_RE, ":ibgeCode");
}

const SOURCE_MAP: Record<string, string> = {
  "servicodados.ibge.gov.br": "ibge",
  "api.siconfi.tesouro.gov.br": "siconfi",
  "datasus.saude.gov.br": "datasus",
  "terrabrasilis.dpi.inpe.br": "inpe",
  "pncp.gov.br": "pncp",
  "hydro.ana.gov.br": "ana",
};

/**
 * Resolve URL de API governamental para label curto.
 */
export function resolveSource(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    for (const [domain, source] of Object.entries(SOURCE_MAP)) {
      if (hostname.includes(domain)) return source;
    }
    return "other";
  } catch {
    return "other";
  }
}
