import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../utils/logger.js";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "prefeito" | "secretario" | "viewer";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  municipalityId: string | null;
  iat?: number;
  exp?: number;
}

// Extende Request do Express para incluir user autenticado
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    throw new Error("JWT_SECRET não configurado");
  }

  if (process.env["NODE_ENV"] === "production" && secret.includes("troque")) {
    throw new Error("JWT_SECRET com valor placeholder não é permitido em produção");
  }

  return secret;
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

// ─── Middleware authenticateToken ─────────────────────────────────────────────

/**
 * Verifica o Bearer token JWT e popula req.user.
 * Retorna 401 se token ausente, inválido ou expirado.
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: "Token de autenticação ausente" });
    return;
  }

  let secret: string;
  try {
    secret = getJwtSecret();
  } catch (err) {
    logger.error("Erro crítico na configuração JWT", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Erro interno de configuração de autenticação" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = payload;
    logger.info("Token autenticado com sucesso", {
      userId: payload.sub,
      role: payload.role,
      path: req.path,
    });
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      logger.warn("Token expirado", { path: req.path });
      res.status(401).json({ error: "Token expirado" });
      return;
    }

    if (err instanceof jwt.JsonWebTokenError) {
      logger.warn("Token inválido", {
        path: req.path,
        error: err.message,
      });
      res.status(401).json({ error: "Token inválido" });
      return;
    }

    logger.error("Erro inesperado ao verificar token", {
      path: req.path,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Erro interno ao verificar autenticação" });
  }
}

// ─── Middleware requireRole ────────────────────────────────────────────────────

/**
 * Verifica se o user autenticado possui uma das roles exigidas.
 * Deve ser usado após authenticateToken.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn("Acesso negado por role insuficiente", {
        userId: req.user.sub,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
      });
      res.status(403).json({
        error: "Acesso negado. Permissão insuficiente para esta operação.",
      });
      return;
    }

    next();
  };
}
