import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../utils/logger.js";
import type { JwtPayload, UserRole } from "../../middleware/auth.js";

// ─── Schemas de validação ─────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email("Formato de e-mail inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  name: z.string().min(1, "Nome é obrigatório"),
  role: z.enum(["admin", "prefeito", "secretario", "viewer"], {
    errorMap: () => ({ message: "Role inválida. Use: admin, prefeito, secretario ou viewer" }),
  }),
  municipalityId: z.string().optional().nullable(),
});

export const LoginSchema = z.object({
  email: z.string().email("Formato de e-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  municipalityId: string | null;
  createdAt: Date;
}

export interface LoginResult {
  token: string;
  refreshToken: string;
  user: SafeUser;
}

export interface RefreshResult {
  token: string;
  refreshToken: string;
}

export class AuthRefreshTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthRefreshTokenError";
  }
}

// ─── Erros específicos ────────────────────────────────────────────────────────

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}

export class AuthConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConflictError";
  }
}

export class AuthCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthCredentialsError";
  }
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;
const DEFAULT_JWT_EXPIRATION = "1d";
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

// ─── AuthService ──────────────────────────────────────────────────────────────

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Registra novo usuário.
   * Regra: apenas admins podem registrar novos usuários após o primeiro cadastro.
   * O primeiro usuário cadastrado recebe role admin automaticamente.
   */
  async register(input: RegisterInput): Promise<SafeUser> {
    logger.info("Tentativa de registro de usuário", { email: input.email, role: input.role });

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new AuthConflictError("E-mail já cadastrado");
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
        municipalityId: input.municipalityId ?? null,
      },
    });

    logger.info("Usuário registrado com sucesso", { userId: user.id, role: user.role });

    return this.toSafeUser(user);
  }

  /**
   * Autentica usuário com email e senha.
   * Retorna JWT e dados do usuário (sem passwordHash).
   */
  async login(input: LoginInput): Promise<LoginResult> {
    logger.info("Tentativa de login", { email: input.email });

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      // Mensagem genérica para não revelar se o e-mail existe
      throw new AuthCredentialsError("Credenciais inválidas");
    }

    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatch) {
      logger.warn("Senha incorreta na tentativa de login", { userId: user.id });
      throw new AuthCredentialsError("Credenciais inválidas");
    }

    const token = this.generateToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    logger.info("Login realizado com sucesso", { userId: user.id, role: user.role });

    return {
      token,
      refreshToken: refreshToken.token,
      user: this.toSafeUser(user),
    };
  }

  /**
   * Valida refresh token, revoga o antigo, emite novos access + refresh tokens (rotação).
   */
  async refreshAccessToken(refreshTokenValue: string): Promise<RefreshResult> {
    logger.info("Tentativa de refresh de token");

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
      include: { user: true },
    });

    if (!stored) {
      throw new AuthRefreshTokenError("Refresh token inválido");
    }

    if (stored.revokedAt !== null) {
      // Possible token reuse attack — revoke all tokens for this user
      logger.warn("Refresh token já revogado detectado — possível reuso", { userId: stored.userId });
      await this.revokeAllUserTokens(stored.userId);
      throw new AuthRefreshTokenError("Refresh token já foi utilizado");
    }

    if (stored.expiresAt < new Date()) {
      throw new AuthRefreshTokenError("Refresh token expirado");
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const newToken = this.generateToken(stored.user);
    const newRefreshToken = await this.createRefreshToken(stored.userId);

    logger.info("Tokens renovados com sucesso", { userId: stored.userId });

    return {
      token: newToken,
      refreshToken: newRefreshToken.token,
    };
  }

  /**
   * Revoga um refresh token específico (logout).
   */
  async revokeRefreshToken(refreshTokenValue: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
    });

    if (!stored || stored.revokedAt !== null) return;

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    logger.info("Refresh token revogado", { userId: stored.userId });
  }

  /**
   * Revoga todos os refresh tokens de um usuário (logout global / segurança).
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    logger.info("Todos os refresh tokens revogados para o usuário", { userId });
  }

  /**
   * Retorna dados do usuário pelo ID (sem passwordHash).
   */
  async findById(userId: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    return this.toSafeUser(user);
  }

  /**
   * Conta usuários cadastrados — usado para determinar se é o primeiro usuário.
   */
  async countUsers(): Promise<number> {
    return this.prisma.user.count();
  }

  // ─── Privado ───────────────────────────────────────────────────────────────

  private async createRefreshToken(userId: string) {
    const token = randomBytes(48).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    return this.prisma.refreshToken.create({
      data: { token, userId, expiresAt },
    });
  }

  private generateToken(user: {
    id: string;
    email: string;
    role: string;
    municipalityId: string | null;
  }): string {
    const secret = process.env["JWT_SECRET"];
    if (!secret) {
      throw new Error("JWT_SECRET não configurado");
    }

    const expiration = process.env["JWT_EXPIRATION"] ?? DEFAULT_JWT_EXPIRATION;

    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      municipalityId: user.municipalityId,
    };

    return jwt.sign(payload, secret, { expiresIn: expiration } as jwt.SignOptions);
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    municipalityId: string | null;
    createdAt: Date;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      municipalityId: user.municipalityId,
      createdAt: user.createdAt,
    };
  }
}
