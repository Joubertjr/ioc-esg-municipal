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
 * Cria novo usuário com registro aberto.
 * - O primeiro usuário recebe role "admin" (bootstrap).
 * - Os demais recebem role "prefeito" — nunca aceita role do body.
 * - Retorna token + refreshToken para auto-login após registro.
 */
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  logger.info("POST /api/auth/register", { ip: req.ip });

  // Valida body com Zod — role é deliberadamente excluída do schema
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    res.status(400).json({ error: "Dados inválidos", details: errors });
    return;
  }

  const input = parsed.data;

  try {
    // Role determinada pelo servidor: admin apenas para o primeiro usuário (bootstrap)
    const userCount = await authService.countUsers();
    const role = userCount === 0 ? "admin" : "prefeito";

    const user = await authService.register(input, role);

    // Auto-login: gera tokens para o usuário recém-criado
    const result = await authService.login({ email: input.email, password: input.password });

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    logger.info("Usuário registrado via API", { userId: user.id });
    res.status(201).json({
      user,
      token: result.token,
      refreshToken: result.refreshToken,
    });
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

    // Resolver municipalityId → ibgeCode para o frontend
    let ibgeCode: string | null = null;
    if (result.user.municipalityId) {
      const municipality = await prisma.municipality.findUnique({
        where: { id: result.user.municipalityId },
        select: { ibgeCode: true },
      });
      ibgeCode = municipality?.ibgeCode ?? null;
    }

    res.json({
      token: result.token,
      refreshToken: result.refreshToken,
      user: { ...result.user, ibgeCode },
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

    // Resolver municipalityId (CUID) → ibgeCode para o frontend
    let ibgeCode: string | null = null;
    if (user.municipalityId) {
      const municipality = await prisma.municipality.findUnique({
        where: { id: user.municipalityId },
        select: { ibgeCode: true },
      });
      ibgeCode = municipality?.ibgeCode ?? null;
    }

    res.json({ user: { ...user, ibgeCode } });
  } catch (err) {
    logger.error("Erro ao buscar dados do usuário autenticado", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Erro interno ao buscar dados do usuário" });
  }
});

// ─── PATCH /api/auth/me ───────────────────────────────────────────────────────

const UpdateMeSchema = z.object({
  ibgeCode: z.string().regex(/^\d{7}$/, "ibgeCode deve ter 7 dígitos"),
});

/**
 * Atualiza o município do usuário autenticado.
 * Usado no fluxo de onboarding após o primeiro login/registro.
 */
router.patch("/me", authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  logger.info("PATCH /api/auth/me", { userId });

  const parsed = UpdateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    res.status(400).json({ error: "Dados inválidos", details: errors });
    return;
  }

  const { ibgeCode } = parsed.data;

  try {
    // Resolver ibgeCode → Municipality CUID
    const municipality = await prisma.municipality.findUnique({
      where: { ibgeCode },
      select: { id: true, ibgeCode: true },
    });

    if (!municipality) {
      res.status(404).json({ error: `Município com ibgeCode ${ibgeCode} não encontrado` });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { municipalityId: municipality.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        municipalityId: true,
        createdAt: true,
      },
    });

    // Gerar novo JWT com municipalityId correto (CUID)
    const token = authService.generateNewToken({
      id: updated.id,
      email: updated.email,
      role: updated.role,
      municipalityId: updated.municipalityId,
    });

    // Atualizar cookie httpOnly com novo JWT
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    logger.info("municipalityId atualizado com sucesso", {
      userId,
      ibgeCode,
      municipalityId: municipality.id,
    });
    res.json({
      user: { ...updated, ibgeCode: municipality.ibgeCode },
      token,
    });
  } catch (err) {
    logger.error("Erro ao atualizar município do usuário", {
      userId,
      ibgeCode,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Erro interno ao atualizar município" });
  }
});

export default router;
