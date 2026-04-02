import { Router, type Request, type Response, type Router as RouterType } from "express";
import { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import {
  AuthService,
  RegisterSchema,
  LoginSchema,
  AuthConflictError,
  AuthCredentialsError,
} from "../services/auth/auth_service.js";
import { authenticateToken } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();
const prisma = new PrismaClient();
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
router.post("/register", async (req: Request, res: Response) => {
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
router.post("/login", async (req: Request, res: Response) => {
  logger.info("POST /api/auth/login", { ip: req.ip });

  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    res.status(400).json({ error: "Dados inválidos", details: errors });
    return;
  }

  try {
    const result = await authService.login(parsed.data);
    res.json({
      token: result.token,
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
