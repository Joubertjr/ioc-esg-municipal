import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger.js";

let client: RedisClientType | null = null;
let connectingPromise: Promise<RedisClientType> | null = null;

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

  // Evita race condition: múltiplos callers concorrentes compartilham a mesma promise de connect
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    const rawUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";
    const password = process.env["REDIS_PASSWORD"] ?? "";
    const url = buildRedisUrl(rawUrl, password);

    const newClient = createClient({ url }) as RedisClientType;

    newClient.on("error", (err) => {
      logger.error("Redis error", { error: String(err) });
    });

    await newClient.connect();
    client = newClient;
    connectingPromise = null;
    return client;
  })();

  return connectingPromise;
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

/**
 * Verifica se uma chave existe no Redis sem executar o fn.
 * Retorna false se Redis estiver indisponível (graceful degradation).
 */
export async function isCached(key: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    const exists = await redis.exists(key);
    return exists > 0;
  } catch {
    return false;
  }
}

/**
 * Fecha o cliente Redis singleton. Necessário em scripts standalone (tsx)
 * para que o processo consiga sair limpo — o connection pool interno do
 * `redis` mantém handles abertos e bloqueia o event loop após o trabalho.
 * No servidor Express, o processo vive para sempre, então isso não é usado.
 */
export async function closeRedisClient(): Promise<void> {
  if (client?.isReady === true) {
    await client.quit();
  }
  client = null;
  connectingPromise = null;
}
