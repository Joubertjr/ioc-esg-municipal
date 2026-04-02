/**
 * Testes unitários para backend/services/auth/auth_service.ts
 *
 * Estratégia:
 * - PrismaClient mockado via vi.mock
 * - bcryptjs mockado para controlar hash e compare
 * - jsonwebtoken mockado para controlar sign
 * - Logger mockado para evitar output
 *
 * Casos cobertos:
 *   register — sucesso, email duplicado, validação de input
 *   login    — sucesso, credenciais inválidas (user não existe, senha errada)
 *   findById — user existe, user não existe
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const {
  mockPrismaUserFindUnique,
  mockPrismaUserCreate,
  mockPrismaUserCount,
} = vi.hoisted(() => ({
  mockPrismaUserFindUnique: vi.fn(),
  mockPrismaUserCreate: vi.fn(),
  mockPrismaUserCount: vi.fn(),
}));

const { mockBcryptHash, mockBcryptCompare } = vi.hoisted(() => ({
  mockBcryptHash: vi.fn(),
  mockBcryptCompare: vi.fn(),
}));

const { mockJwtSign } = vi.hoisted(() => ({
  mockJwtSign: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    user: {
      findUnique: mockPrismaUserFindUnique,
      create: mockPrismaUserCreate,
      count: mockPrismaUserCount,
    },
  })),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: mockBcryptHash,
    compare: mockBcryptCompare,
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: mockJwtSign,
    verify: vi.fn(),
  },
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Import após mocks ────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import {
  AuthService,
  AuthConflictError,
  AuthCredentialsError,
  RegisterSchema,
  LoginSchema,
} from "../../../backend/services/auth/auth_service.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: "cuid-user-1",
  email: "prefeito@florianopolis.sc.gov.br",
  name: "João Silva",
  passwordHash: "$2a$12$hashedpassword",
  role: "prefeito",
  municipalityId: "muni-123",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("AuthService.register", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["JWT_SECRET"] = "test-secret-para-testes";
    process.env["JWT_EXPIRATION"] = "1d";
    const prisma = new PrismaClient();
    service = new AuthService(prisma);
  });

  it("registra usuário com sucesso", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(null);
    mockBcryptHash.mockResolvedValueOnce("$2a$12$hashed");
    mockPrismaUserCreate.mockResolvedValueOnce(MOCK_USER);

    const result = await service.register({
      email: MOCK_USER.email,
      password: "SenhaSegura123",
      name: MOCK_USER.name,
      role: "prefeito",
      municipalityId: "muni-123",
    });

    expect(result).toMatchObject({
      id: MOCK_USER.id,
      email: MOCK_USER.email,
      role: "prefeito",
    });
    // Não deve expor passwordHash
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("usa saltRounds=12 no bcrypt.hash", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(null);
    mockBcryptHash.mockResolvedValueOnce("$2a$12$hashed");
    mockPrismaUserCreate.mockResolvedValueOnce(MOCK_USER);

    await service.register({
      email: MOCK_USER.email,
      password: "SenhaSegura123",
      name: MOCK_USER.name,
      role: "prefeito",
    });

    expect(mockBcryptHash).toHaveBeenCalledWith("SenhaSegura123", 12);
  });

  it("lança AuthConflictError quando email já existe", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(MOCK_USER);

    await expect(
      service.register({
        email: MOCK_USER.email,
        password: "SenhaSegura123",
        name: "Outro Nome",
        role: "viewer",
      }),
    ).rejects.toThrow(AuthConflictError);
  });

  it("não cria usuário quando email já existe", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(MOCK_USER);

    await expect(
      service.register({
        email: MOCK_USER.email,
        password: "SenhaSegura123",
        name: "Outro Nome",
        role: "viewer",
      }),
    ).rejects.toThrow();

    expect(mockPrismaUserCreate).not.toHaveBeenCalled();
  });

  it("aceita municipalityId null (usuário sem município vinculado)", async () => {
    const userAdmin = { ...MOCK_USER, municipalityId: null, role: "admin" };
    mockPrismaUserFindUnique.mockResolvedValueOnce(null);
    mockBcryptHash.mockResolvedValueOnce("$2a$12$hashed");
    mockPrismaUserCreate.mockResolvedValueOnce(userAdmin);

    const result = await service.register({
      email: "admin@sistema.gov.br",
      password: "SenhaSegura123",
      name: "Admin Sistema",
      role: "admin",
    });

    expect(result.municipalityId).toBeNull();
  });
});

describe("AuthService.login", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["JWT_SECRET"] = "test-secret-para-testes";
    process.env["JWT_EXPIRATION"] = "1d";
    const prisma = new PrismaClient();
    service = new AuthService(prisma);
  });

  it("retorna token e user quando credenciais são válidas", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(MOCK_USER);
    mockBcryptCompare.mockResolvedValueOnce(true);
    mockJwtSign.mockReturnValueOnce("jwt.token.aqui");

    const result = await service.login({
      email: MOCK_USER.email,
      password: "SenhaCorreta",
    });

    expect(result.token).toBe("jwt.token.aqui");
    expect(result.user).toMatchObject({
      id: MOCK_USER.id,
      email: MOCK_USER.email,
      role: "prefeito",
    });
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("lança AuthCredentialsError quando user não existe", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(null);

    await expect(
      service.login({ email: "naoexiste@test.com", password: "qualquer" }),
    ).rejects.toThrow(AuthCredentialsError);
  });

  it("lança AuthCredentialsError quando senha está errada", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(MOCK_USER);
    mockBcryptCompare.mockResolvedValueOnce(false);

    await expect(
      service.login({ email: MOCK_USER.email, password: "SenhaErrada" }),
    ).rejects.toThrow(AuthCredentialsError);
  });

  it("mensagem de erro é genérica para não revelar se email existe", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(null);

    try {
      await service.login({ email: "naoexiste@test.com", password: "qualquer" });
    } catch (err) {
      expect(err).toBeInstanceOf(AuthCredentialsError);
      expect((err as AuthCredentialsError).message).toBe("Credenciais inválidas");
    }
  });

  it("não chama bcrypt.compare quando user não existe (evita timing attack parcial)", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(null);

    await expect(
      service.login({ email: "ghost@test.com", password: "qualquer" }),
    ).rejects.toThrow();

    expect(mockBcryptCompare).not.toHaveBeenCalled();
  });

  it("usa JWT_EXPIRATION do env ao gerar token", async () => {
    process.env["JWT_EXPIRATION"] = "7d";
    mockPrismaUserFindUnique.mockResolvedValueOnce(MOCK_USER);
    mockBcryptCompare.mockResolvedValueOnce(true);
    mockJwtSign.mockReturnValueOnce("token");

    await service.login({ email: MOCK_USER.email, password: "SenhaCorreta" });

    expect(mockJwtSign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: MOCK_USER.id }),
      "test-secret-para-testes",
      expect.objectContaining({ expiresIn: "7d" }),
    );
  });
});

describe("AuthService.findById", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    const prisma = new PrismaClient();
    service = new AuthService(prisma);
  });

  it("retorna SafeUser quando user existe", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(MOCK_USER);

    const result = await service.findById(MOCK_USER.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(MOCK_USER.id);
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("retorna null quando user não existe", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(null);

    const result = await service.findById("id-inexistente");

    expect(result).toBeNull();
  });
});

describe("AuthService.countUsers", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    const prisma = new PrismaClient();
    service = new AuthService(prisma);
  });

  it("retorna contagem de usuários", async () => {
    mockPrismaUserCount.mockResolvedValueOnce(5);
    const count = await service.countUsers();
    expect(count).toBe(5);
  });

  it("retorna 0 quando não há usuários", async () => {
    mockPrismaUserCount.mockResolvedValueOnce(0);
    const count = await service.countUsers();
    expect(count).toBe(0);
  });
});

describe("RegisterSchema (Zod validation)", () => {
  it("aceita input válido", () => {
    const result = RegisterSchema.safeParse({
      email: "user@municipio.sc.gov.br",
      password: "Senha1234",
      name: "Maria Santos",
      role: "secretario",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita email inválido", () => {
    const result = RegisterSchema.safeParse({
      email: "nao-e-email",
      password: "Senha1234",
      name: "Nome",
      role: "viewer",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha menor que 8 caracteres", () => {
    const result = RegisterSchema.safeParse({
      email: "user@test.com",
      password: "curta",
      name: "Nome",
      role: "viewer",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita role inválida", () => {
    const result = RegisterSchema.safeParse({
      email: "user@test.com",
      password: "Senha1234",
      name: "Nome",
      role: "superadmin",
    });
    expect(result.success).toBe(false);
  });

  it("aceita todas as roles válidas", () => {
    const roles = ["admin", "prefeito", "secretario", "viewer"];
    for (const role of roles) {
      const result = RegisterSchema.safeParse({
        email: "user@test.com",
        password: "Senha1234",
        name: "Nome",
        role,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("LoginSchema (Zod validation)", () => {
  it("aceita input válido", () => {
    const result = LoginSchema.safeParse({
      email: "user@test.com",
      password: "qualquer",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita email inválido", () => {
    const result = LoginSchema.safeParse({
      email: "invalido",
      password: "qualquer",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha vazia", () => {
    const result = LoginSchema.safeParse({
      email: "user@test.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});
