import { rateLimit, MemoryStore } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "../utils/cache.js";
import { logger } from "../utils/logger.js";

/**
 * Tenta criar um RedisStore conectando ao cliente Redis existente.
 * Se o Redis estiver indisponível, retorna undefined — o chamador deve
 * fazer fallback para MemoryStore (graceful degradation).
 */
async function tryBuildRedisStore(prefix: string): Promise<RedisStore | undefined> {
  try {
    const redis = await getRedisClient();
    return new RedisStore({
      sendCommand: (...args: string[]) => redis.sendCommand(args),
      prefix,
    });
  } catch (error) {
    logger.warn("Redis indisponível para rate-limit — usando MemoryStore", {
      error: String(error),
    });
    return undefined;
  }
}

/**
 * Limiter geral: 60 requisições por minuto por IP.
 * Aplicado globalmente em todos os endpoints.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Muitas requisições. Tente novamente em 1 minuto.",
  },
  store: await tryBuildRedisStore("rl:general:").then((store) => {
    if (store) {
      logger.info("Rate limiter [general] usando RedisStore");
    } else {
      logger.info("Rate limiter [general] usando MemoryStore");
    }
    return store ?? new MemoryStore();
  }),
});

/**
 * Limiter para rotas de batch: 5 requisições por minuto por IP.
 * Aplicado em POST /batch e POST /compare — operações custosas.
 */
export const batchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Muitas requisições de batch. Tente novamente em 1 minuto.",
  },
  store: await tryBuildRedisStore("rl:batch:").then((store) => {
    if (store) {
      logger.info("Rate limiter [batch] usando RedisStore");
    } else {
      logger.info("Rate limiter [batch] usando MemoryStore");
    }
    return store ?? new MemoryStore();
  }),
});

/**
 * Limiter para rotas de autenticação: 10 tentativas por 15 minutos por IP.
 * Aplicado em POST /login e POST /register — proteção contra brute force.
 */
const isProduction = process.env["NODE_ENV"] === "production";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 10 : 200,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  store: await tryBuildRedisStore("rl:auth:").then((store) => {
    if (store) {
      logger.info("Rate limiter [auth] usando RedisStore");
    } else {
      logger.info("Rate limiter [auth] usando MemoryStore");
    }
    return store ?? new MemoryStore();
  }),
});
