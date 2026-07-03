import { z } from "zod";
import dotenv from "dotenv";
import { logger } from "./logger.js";

// Carrega .env ANTES de qualquer validação — necessário porque
// este módulo exporta um singleton que executa no nível do módulo
dotenv.config();

// ─── Schema base (todos os ambientes) ────────────────────────────────────────

const portSchema = z.coerce
  .number({ invalid_type_error: "PORT deve ser um número" })
  .int()
  .min(1, "PORT deve ser >= 1")
  .max(65535, "PORT deve ser <= 65535")
  .default(3000);

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: portSchema,
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL é obrigatória")
    .refine((v) => v.startsWith("postgresql://"), {
      message: 'DATABASE_URL deve começar com "postgresql://"',
    })
    .default("postgresql://postgres:postgres@localhost:5432/ioc_esg_municipal"),
  JWT_SECRET: z
    .string()
    .min(1, "JWT_SECRET é obrigatório")
    .default("troque-por-chave-segura-em-producao"),
  JWT_EXPIRATION: z.string().default("1d"),
  REDIS_URL: z.string().min(1, "REDIS_URL é obrigatória").default("redis://localhost:6379"),
  REDIS_PASSWORD: z.string().optional().default(""),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  IBGE_API_URL: z.string().url().default("https://servicodados.ibge.gov.br/api/v1"),
  SICONFI_API_URL: z.string().url().default("https://api.siconfi.tesouro.gov.br/v1"),
  DATASUS_API_URL: z.string().url().default("https://datasus.saude.gov.br"),
  INPE_API_URL: z.string().url().default("https://terrabrasilis.dpi.inpe.br/api/v1"),
  PNCP_API_URL: z.string().url().default("https://pncp.gov.br/api/pncp/v1"),
  AGENT_TIMEOUT: z.coerce.number().positive().default(30000),
  AGENT_RETRY_COUNT: z.coerce.number().int().positive().default(3),
  AGENT_RETRY_DELAY: z.coerce.number().positive().default(1000),
  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "verbose", "debug", "silly"]).default("info"),
});

// ─── Regras adicionais em produção ───────────────────────────────────────────

const productionRefinements = baseSchema
  .refine(
    (data) =>
      !["troque", "dev-secret", "change-in-production"].some((s) => data.JWT_SECRET.includes(s)),
    {
      message:
        "JWT_SECRET contém placeholder de desenvolvimento — defina um segredo real em produção",
      path: ["JWT_SECRET"],
    },
  )
  .refine((data) => (data.REDIS_PASSWORD ?? "").length >= 8, {
    message: "REDIS_PASSWORD deve ter no mínimo 8 caracteres em produção",
    path: ["REDIS_PASSWORD"],
  });

// ─── Resultado tipado ─────────────────────────────────────────────────────────

export type Env = z.infer<typeof baseSchema>;

// ─── Função de validação ──────────────────────────────────────────────────────

export function validateEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const isProduction = raw["NODE_ENV"] === "production";

  const schema = isProduction ? productionRefinements : baseSchema;

  const result = schema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`);

    if (isProduction) {
      logger.error("[env-validator] Variáveis de ambiente inválidas — abortando inicialização", {
        issues,
      });
      process.exit(1);
    }

    logger.warn("[env-validator] Variáveis de ambiente com problemas (desenvolvimento)", {
      issues,
    });

    // Em desenvolvimento aplica defaults nas chaves com falha, ignorando valores inválidos
    const failingPaths = new Set(result.error.issues.map((i) => i.path[0] as string));
    const sanitized: NodeJS.ProcessEnv = { ...raw };
    for (const key of failingPaths) {
      delete sanitized[key];
    }
    const fallback = baseSchema.parse(sanitized);
    return fallback;
  }

  const origins = (result.data.ALLOWED_ORIGINS ?? "").split(",").map((o: string) => o.trim());
  const hasLocalhost = origins.some((o: string) => o.includes("localhost"));
  if (hasLocalhost && isProduction) {
    logger.warn(
      "[env-validator] ALLOWED_ORIGINS contém localhost em produção — configure domínio real antes do deploy público",
      { ALLOWED_ORIGINS: result.data.ALLOWED_ORIGINS },
    );
  }

  logger.info("[env-validator] Variáveis de ambiente validadas com sucesso", {
    NODE_ENV: result.data.NODE_ENV,
    PORT: result.data.PORT,
  });

  return result.data;
}

// ─── Instância singleton — usada em toda a aplicação ─────────────────────────

export const env: Env = validateEnv();
