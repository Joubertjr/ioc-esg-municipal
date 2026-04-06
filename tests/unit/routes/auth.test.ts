import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_SAFE_USER = {
  id: "user-1",
  email: "prefeito@blumenau.sc.gov.br",
  name: "João Prefeito",
  role: "prefeito" as const,
  municipalityId: "mun-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const MOCK_LOGIN_RESULT = {
  token: "jwt.token.assinado",
  user: MOCK_SAFE_USER,
};

const VALID_REGISTER_BODY = {
  email: "prefeito@blumenau.sc.gov.br",
  password: "senhasegura123",
  name: "João Prefeito",
  role: "prefeito",
  municipalityId: "mun-1",
};

const VALID_LOGIN_BODY = {
  email: "prefeito@blumenau.sc.gov.br",
  password: "senhasegura123",
};

// ─── Mocks hoisted ───────────────────────────────────────────────────────────

const { mockRegister, mockLogin, mockFindById, mockCountUsers } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockLogin: vi.fn(),
  mockFindById: vi.fn(),
  mockCountUsers: vi.fn(),
}));

// AuthService: mock da classe inteira via factory
vi.mock("../../../backend/services/auth/auth_service.js", () => {
  const AuthConflictError = class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthConflictError";
    }
  };

  const AuthCredentialsError = class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthCredentialsError";
    }
  };

  // Schemas reais do Zod — re-exportados para que a rota os use corretamente
  const { z } = require("zod");
  const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
    role: z.enum(["admin", "prefeito", "secretario", "viewer"]),
    municipalityId: z.string().optional().nullable(),
  });
  const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  return {
    AuthService: vi.fn().mockImplementation(() => ({
      register: mockRegister,
      login: mockLogin,
      findById: mockFindById,
      countUsers: mockCountUsers,
    })),
    RegisterSchema,
    LoginSchema,
    AuthConflictError,
    AuthCredentialsError,
  };
});

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Rate limiter: passthrough para não bloquear testes
vi.mock("../../../backend/middleware/rate-limit.js", () => ({
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  batchLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Auth middleware: por padrão autentica com usuário fixture — testamos o caso
// não-autenticado injetando um mock que retorna 401 no teste específico
vi.mock("../../../backend/middleware/auth.js", () => ({
  authenticateToken: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  requireRole:
    () =>
    (_req: unknown, _res: unknown, next: () => void) =>
      next(),
}));

// Prisma: necessário pois a rota instancia `new AuthService(prisma)` no módulo
vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {},
}));

// ─── Importação da rota após os mocks ────────────────────────────────────────

// eslint-disable-next-line import/first
const { default: authRouter } = await import("../../../backend/routes/auth.js");
import { authenticateToken } from "../../../backend/middleware/auth.js";
import {
  AuthConflictError,
  AuthCredentialsError,
} from "../../../backend/services/auth/auth_service.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  return app;
}

// ─── POST /register ───────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Cenário default: primeiro usuário (bootstrap) — sem exigência de admin
    mockCountUsers.mockResolvedValue(0);
    mockRegister.mockResolvedValue(MOCK_SAFE_USER);
  });

  it("retorna 201 e dados do usuário quando registro é válido", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/auth/register")
      .send(VALID_REGISTER_BODY);

    expect(res.status).toBe(201);
    expect(res.body.user.id).toBe(MOCK_SAFE_USER.id);
    expect(res.body.user.email).toBe(MOCK_SAFE_USER.email);
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it("retorna 400 quando email está ausente", async () => {
    const app = buildApp();
    const { email: _omit, ...bodyWithoutEmail } = VALID_REGISTER_BODY;

    const res = await request(app)
      .post("/api/auth/register")
      .send(bodyWithoutEmail);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Dados inválidos");
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("retorna 400 quando password está ausente", async () => {
    const app = buildApp();
    const { password: _omit, ...bodyWithoutPassword } = VALID_REGISTER_BODY;

    const res = await request(app)
      .post("/api/auth/register")
      .send(bodyWithoutPassword);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Dados inválidos");
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("retorna 409 quando service lança AuthConflictError", async () => {
    mockRegister.mockRejectedValue(new AuthConflictError("E-mail já cadastrado"));
    const app = buildApp();

    const res = await request(app)
      .post("/api/auth/register")
      .send(VALID_REGISTER_BODY);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("E-mail já cadastrado");
  });

  it("retorna 500 quando service lança erro genérico", async () => {
    mockRegister.mockRejectedValue(new Error("DB connection failed"));
    const app = buildApp();

    const res = await request(app)
      .post("/api/auth/register")
      .send(VALID_REGISTER_BODY);

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Erro interno");
  });
});

// ─── POST /login ──────────────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(MOCK_LOGIN_RESULT);
  });

  it("retorna 200 com token e dados do usuário quando credenciais são válidas", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/auth/login")
      .send(VALID_LOGIN_BODY);

    expect(res.status).toBe(200);
    expect(res.body.token).toBe(MOCK_LOGIN_RESULT.token);
    expect(res.body.user.id).toBe(MOCK_SAFE_USER.id);
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it("retorna 400 quando email está ausente", async () => {
    const app = buildApp();
    const { email: _omit, ...bodyWithoutEmail } = VALID_LOGIN_BODY;

    const res = await request(app)
      .post("/api/auth/login")
      .send(bodyWithoutEmail);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Dados inválidos");
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("retorna 400 quando password está ausente", async () => {
    const app = buildApp();
    const { password: _omit, ...bodyWithoutPassword } = VALID_LOGIN_BODY;

    const res = await request(app)
      .post("/api/auth/login")
      .send(bodyWithoutPassword);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Dados inválidos");
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("retorna 401 quando service lança AuthCredentialsError", async () => {
    mockLogin.mockRejectedValue(new AuthCredentialsError("Credenciais inválidas"));
    const app = buildApp();

    const res = await request(app)
      .post("/api/auth/login")
      .send(VALID_LOGIN_BODY);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciais inválidas");
  });

  it("retorna 500 quando service lança erro genérico", async () => {
    mockLogin.mockRejectedValue(new Error("DB timeout"));
    const app = buildApp();

    const res = await request(app)
      .post("/api/auth/login")
      .send(VALID_LOGIN_BODY);

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Erro interno");
  });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindById.mockResolvedValue(MOCK_SAFE_USER);

    // Middleware autentica e injeta req.user por padrão
    vi.mocked(authenticateToken).mockImplementation((req, _res, next) => {
      (req as express.Request).user = {
        sub: MOCK_SAFE_USER.id,
        email: MOCK_SAFE_USER.email,
        role: MOCK_SAFE_USER.role,
        municipalityId: MOCK_SAFE_USER.municipalityId,
      };
      next();
    });
  });

  it("retorna 200 com dados do usuário quando autenticado", async () => {
    const app = buildApp();

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer jwt.token.assinado");

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(MOCK_SAFE_USER.id);
    expect(res.body.user.email).toBe(MOCK_SAFE_USER.email);
    expect(mockFindById).toHaveBeenCalledWith(MOCK_SAFE_USER.id);
  });

  it("retorna 401 quando token está ausente", async () => {
    // Simula middleware rejeitando a requisição sem token
    vi.mocked(authenticateToken).mockImplementation((_req, res, _next) => {
      (res as express.Response).status(401).json({ error: "Token de autenticação ausente" });
    });

    const app = buildApp();

    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Token");
    expect(mockFindById).not.toHaveBeenCalled();
  });
});
