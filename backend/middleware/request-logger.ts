import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../utils/logger.js";

/**
 * Loga cada requisição HTTP com método, path, status e tempo de resposta.
 * Nível de log varia pelo status: debug (2xx/3xx), warn (4xx), error (5xx).
 * Inclui requestId gerado pelo requestIdMiddleware para rastreabilidade.
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startAt) / 1_000_000;
    const status = res.statusCode;
    const payload = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status,
      durationMs: Math.round(durationMs * 100) / 100,
    };

    const message = `${req.method} ${req.path} ${status} ${payload.durationMs}ms`;

    if (status >= 500) {
      logger.error(`[http] ${message}`, payload);
    } else if (status >= 400) {
      logger.warn(`[http] ${message}`, payload);
    } else {
      logger.debug(`[http] ${message}`, payload);
    }
  });

  next();
}
