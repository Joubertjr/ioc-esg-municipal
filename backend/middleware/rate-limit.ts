import { rateLimit } from "express-rate-limit";

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
});

/**
 * Limiter para rotas de autenticação: 10 tentativas por 15 minutos por IP.
 * Aplicado em POST /login e POST /register — proteção contra brute force.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});
