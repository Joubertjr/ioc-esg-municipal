import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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
  user: SafeUser;
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

    logger.info("Login realizado com sucesso", { userId: user.id, role: user.role });

    return {
      token,
      user: this.toSafeUser(user),
    };
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
