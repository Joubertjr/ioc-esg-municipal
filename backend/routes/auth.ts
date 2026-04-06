import { Router, type Request, type Response, type Router as RouterType } from "express";
import { ZodError } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  AuthService,
  RegisterSchema,
  LoginSchema,
  AuthConflictError,
  AuthCredentialsError,
  AuthRefreshTokenError,
} from "../services/auth/auth_service.js";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rate-limit.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();
const authService = new AuthService(prisma);

// ─── POST /api/auth/register ──────────────────────────────────────────────────

/**
 * Cria novo usuário.
 * - O primeiro usuário pode se registrar sem autenticação (bootstrap).
 * - Os demais requerem que o solicitante seja admin (authenticateToken + requireRole).
 *
 * Nota: A checagem de "admin only após primeiro user" é feita dinamicamente
 * para evitar dependência circular entre routes e middleware.
 */
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  logger.info("POST /api/auth/register", { ip: req.ip });

  // Valida body com Zod
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    res.status(400).json({ error: "Dados inválidos", details: errors });
    return;
  }

  const input = parsed.data;

  // Verifica se é o primeiro usuário (bootstrap) ou requer autenticação admin
  try {
    const userCount = await authService.countUsers();

    if (userCount > 0) {
      // Após o primeiro usuário: requer autenticação como admin
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Registro de novos usuários requer autenticação de admin" });
        return;
      }

      // Usa authenticateToken como função auxiliar inline
      await new Promise<void>((resolve, reject) => {
        authenticateToken(req, res, (err?: unknown) => {
          if (err) reject(err);
          else resolve();
        });
      }).catch(() => {
        // authenticateToken já enviou resposta
      });

      if (!req.user) return; // resposta já enviada pelo middleware

      if (req.user.role !== "admin") {
        res.status(403).json({ error: "Apenas administradores podem registrar novos usuários" });
        return;
      }
    }

    const user = await authService.register(input);

    logger.info("Usuário registrado via API", { userId: user.id });
    res.status(201).json({ user });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Dados inválidos", details: err.flatten().fieldErrors });
      return;
    }

    if (err instanceof AuthConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }

    logger.error("Erro inesperado no registro", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Erro interno ao registrar usuário" });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

/**
 * Autentica usuário e retorna JWT.
 */
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  logger.info("POST /api/auth/login", { ip: req.ip });

  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    res.status(400).json({ error: "Dados inválidos", details: errors });
    return;
  }

  try {
    const result = await authService.login(parsed.data);

    // Cookie httpOnly — proteção XSS; Authorization header ainda retornado para
    // compatibilidade com clientes mobile e consumidores de API
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 dia — alinhado com JWT_EXPIRATION
      path: "/",
    });

    res.json({
      token: result.token,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (err) {
    if (err instanceof AuthCredentialsError) {
      res.status(401).json({ error: err.message });
      return;
    }

    logger.error("Erro inesperado no login", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Erro interno ao autenticar" });
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

const RefreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken é obrigatório"),
});

/**
 * Troca um refresh token válido por novos access + refresh tokens (rotação).
 * O refresh token antigo é revogado imediatamente.
 */
router.post("/refresh", authLimiter, async (req: Request, res: Response) => {
  logger.info("POST /api/auth/refresh", { ip: req.ip });

  const parsed = RefreshSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    res.status(400).json({ error: "Dados inválidos", details: errors });
    return;
  }

  try {
    const result = await authService.refreshAccessToken(parsed.data.refreshToken);

    // Atualiza cookie httpOnly com novo access token
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({ token: result.token, refreshToken: result.refreshToken });
  } catch (err) {
    if (err instanceof AuthRefreshTokenError) {
      res.status(401).json({ error: err.message });
      return;
    }

    logger.error("Erro inesperado no refresh de token", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Erro interno ao renovar token" });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

/**
 * Encerra a sessão: revoga o refresh token (se fornecido) e limpa o cookie.
 */
router.post("/logout", authLimiter, async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (refreshToken && typeof refreshToken === "string") {
    try {
      await authService.revokeRefreshToken(refreshToken);
    } catch (err) {
      logger.warn("Erro ao revogar refresh token no logout", {
        error: err instanceof Error ? err.message : String(err),
      });
      // Não bloqueia o logout mesmo se revogação falhar
    }
  }

  res.clearCookie("token", { path: "/" });
  res.json({ message: "Logout realizado com sucesso" });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

/**
 * Retorna dados do usuário atualmente autenticado.
 */
router.get("/me", authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user!.sub;

  try {
    const user = await authService.findById(userId);

    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    res.json({ user });
  } catch (err) {
    logger.error("Erro ao buscar dados do usuário autenticado", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Erro interno ao buscar dados do usuário" });
  }
});

export default router;
