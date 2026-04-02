import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

/**
 * Classe base para erros operacionais com statusCode semântico.
 * Separa erros esperados (operacionais) de bugs (programmer errors).
 */
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
    // Mantém o stack trace correto no V8
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Extrai o statusCode de um erro desconhecido.
 * Apenas AppError carrega statusCode confiável — qualquer outro erro é 500.
 */
function resolveStatusCode(err: unknown): number {
  if (err instanceof AppError) return err.statusCode;
  return 500;
}

/**
 * Extrai a mensagem pública do erro.
 * Erros não-operacionais expõem mensagem genérica para não vazar internals.
 */
function resolvePublicMessage(err: unknown, statusCode: number): string {
  if (err instanceof AppError) return err.message;

  // Erros 4xx têm mensagem segura para expor (gerados pela camada de rota)
  if (statusCode >= 400 && statusCode < 500 && err instanceof Error) {
    return err.message;
  }

  return "Erro interno do servidor. Tente novamente.";
}

/**
 * Middleware de erro global do Express — deve ser registrado por último.
 * Assina (err, req, res, next) — Express identifica error handlers pelos 4 params.
 */
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // next é obrigatório para o Express reconhecer como error middleware
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const statusCode = resolveStatusCode(err);
  const isServerError = statusCode >= 500;

  // Log estruturado — erros 5xx como error, 4xx como warn
  const logPayload = {
    statusCode,
    method: req.method,
    path: req.path,
    // Stack apenas em server errors (4xx são esperados, não necessitam stack)
    ...(isServerError && err instanceof Error ? { stack: err.stack } : {}),
  };

  if (isServerError) {
    logger.error(
      `[error-handler] ${err instanceof Error ? err.message : String(err)}`,
      logPayload,
    );
  } else {
    logger.warn(
      `[error-handler] ${err instanceof Error ? err.message : String(err)}`,
      logPayload,
    );
  }

  const publicMessage = resolvePublicMessage(err, statusCode);
  const isDevelopment = process.env["NODE_ENV"] !== "production";

  const body: {
    error: string;
    statusCode: number;
    stack?: string;
  } = {
    error: publicMessage,
    statusCode,
  };

  // Em development, stack trace no response ajuda debug local
  if (isDevelopment && err instanceof Error && err.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

/**
 * Handler para rotas não encontradas — deve ser registrado antes do error handler
 * e depois de todas as rotas. Retorna JSON consistente, sem expor o framework.
 */
export function notFoundHandler(req: Request, res: Response): void {
  logger.warn("[not-found] Rota não encontrada", {
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    error: "Rota não encontrada",
    statusCode: 404,
  });
}
