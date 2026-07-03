import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../utils/logger.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../utils/env-validator.js";

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
  // eslint-disable-next-line @typescript-eslint/no-namespace
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

function getAllowedOrigins(): string[] {
  return env.ALLOWED_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Verifica proteção CSRF para requisições que chegam via cookie.
 * Para métodos que alteram estado (POST/PUT/PATCH/DELETE), valida que
 * Origin ou Referer pertence à lista de origens permitidas.
 * GET/HEAD/OPTIONS são seguros por definição (não modificam estado).
 */
function normalizeOrigin(raw: string): string {
  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return raw;
  }
}

function verifyCsrf(req: Request): boolean {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) return true;

  const allowedOrigins = getAllowedOrigins().map(normalizeOrigin);
  const origin = req.headers["origin"];
  const referer = req.headers["referer"];

  let candidate: string | undefined = origin ?? undefined;
  if (!candidate && referer) {
    try {
      candidate = new URL(referer).origin;
    } catch {
      return false;
    }
  }
  if (!candidate) return false;

  const normalized = normalizeOrigin(candidate);
  return allowedOrigins.some((allowed) => allowed === normalized);
}

// ─── Middleware authenticateToken ─────────────────────────────────────────────

/**
 * Verifica JWT via cookie httpOnly (prioritário) ou Authorization header (fallback).
 * Para autenticação via cookie em métodos não-GET, valida CSRF via Origin/Referer.
 * Retorna 401 se token ausente, inválido ou expirado.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.["token"] as
    | string
    | undefined;
  const headerToken = extractBearerToken(req.headers.authorization);
  const usingCookie = Boolean(cookieToken) && !headerToken;
  const token: string | null | undefined = cookieToken ?? headerToken;

  // CSRF check: apenas para auth via cookie (não via Authorization header)
  if (usingCookie && !verifyCsrf(req)) {
    logger.warn("CSRF check falhou", {
      path: req.path,
      method: req.method,
      origin: req.headers["origin"],
    });
    res.status(403).json({ error: "Requisição rejeitada: CSRF check falhou" });
    return;
  }

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
    const payload = jwt.verify(token, secret) as unknown as JwtPayload;
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

// ─── Middleware requireMunicipalityScope ──────────────────────────────────────

/**
 * Garante que o usuário autenticado só acessa dados do seu próprio município.
 * Admins podem acessar qualquer município.
 * Extrai ibgeCode de req.params[paramName] e valida contra req.user.municipalityId.
 * Deve ser usado após authenticateToken.
 */
export function requireMunicipalityScope(paramName = "ibgeCode") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }

    if (req.user.role === "admin") {
      next();
      return;
    }

    const ibgeCode = req.params[paramName];
    if (!ibgeCode) {
      next();
      return;
    }

    const municipality = await prisma.municipality.findUnique({
      where: { ibgeCode },
      select: { id: true },
    });

    if (!municipality) {
      res.status(404).json({ error: `Município ${ibgeCode} não encontrado` });
      return;
    }

    if (req.user.municipalityId !== municipality.id) {
      logger.warn("IDOR bloqueado: acesso a município não autorizado", {
        userId: req.user.sub,
        userMunicipality: req.user.municipalityId,
        requestedMunicipality: municipality.id,
        ibgeCode,
        path: req.path,
      });
      res.status(403).json({
        error: "Acesso negado. Você só pode consultar dados do seu município.",
      });
      return;
    }

    next();
  };
}
