import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger.js";

let client: RedisClientType | null = null;

/**
 * Constrói a URL de conexão Redis incluindo a senha quando:
 *   1. REDIS_PASSWORD está definido via env-validator; E
 *   2. A REDIS_URL não contém credenciais (formato redis://:pass@host:port)
 *
 * Em desenvolvimento, sem REDIS_PASSWORD, funciona sem autenticação.
 * Em produção, env-validator garante que REDIS_PASSWORD existe (min 8 chars).
 */
export function buildRedisUrl(baseUrl: string, password: string): string {
  if (!password) return baseUrl;

  // Se a URL já contém @ assume que as credenciais estão presentes
  if (baseUrl.includes("@")) return baseUrl;

  // Injeta a senha no formato redis://:password@host:port/db
  return baseUrl.replace(/^(rediss?:\/\/)/, `$1:${encodeURIComponent(password)}@`);
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (client?.isReady) return client;

  const rawUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  const password = process.env["REDIS_PASSWORD"] ?? "";
  const url = buildRedisUrl(rawUrl, password);

  client = createClient({ url });

  client.on("error", (err) => {
    logger.error("Redis error", { error: String(err) });
  });

  await client.connect();
  return client;
}

/**
 * Executa `fn` e cacheia o resultado no Redis com TTL.
 * Se o Redis estiver indisponível, executa `fn` diretamente (graceful degradation).
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const redis = await getRedisClient();
    const cached = await redis.get(key);

    if (cached !== null) {
      logger.debug(`Cache HIT: ${key}`);
      return JSON.parse(cached) as T;
    }

    logger.debug(`Cache MISS: ${key}`);
    const result = await fn();
    await redis.setEx(key, ttlSeconds, JSON.stringify(result));
    return result;
  } catch (error) {
    // Redis indisponível — executa sem cache
    logger.warn(`Cache unavailable for key ${key}, fetching directly`, {
      error: String(error),
    });
    return fn();
  }
}
