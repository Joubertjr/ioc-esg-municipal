import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger.js";

let client: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (client?.isReady) return client;

  const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
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
