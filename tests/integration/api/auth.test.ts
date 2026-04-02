/**
 * Testes de integração para o fluxo de autenticação
 * Rotas: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
 *
 * Estratégia de mock:
 * - @prisma/client: substituído por instância em memória com vi.fn()
 *   controlados por teste — evita conexão real com PostgreSQL
 * - bcryptjs: NÃO mockado — usa a implementação real para validar que
 *   hash e compare funcionam corretamente no fluxo completo
 * - logger: silenciado para evitar poluição de saída
 * - express-rate-limit: passthrough — não queremos bloqueio por IP em testes
 * - Agentes coletores: stubs vazios — não são utilizados pelo fluxo de auth,
 *   mas são importados indiretamente pelo app
 *
 * Casos cobertos:
 * ✅ POST /api/auth/register → 201 + user (primeiro usuário, sem auth)
 * ✅ POST /api/auth/register → 400 com email inválido
 * ✅ POST /api/auth/register → 400 com senha curta (< 8 chars)
 * ✅ POST /api/auth/register → 409 quando email já cadastrado
 * ✅ POST /api/auth/login → 200 + token para credenciais válidas
 * ✅ POST /api/auth/login → 401 para senha incorreta
 * ✅ POST /api/auth/login → 401 para email inexistente
 * ✅ POST /api/auth/login → 400 com body inválido (sem email)
 * ✅ GET /api/auth/me → 200 + user para token válido
 * ✅ GET /api/auth/me → 401 sem token
 * ✅ GET /api/auth/me → 401 com token malformado
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Express } from "express";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JWT_SECRET = "test-secret-for-integration-tests-minimum-length";

const userFixture = {
  id: "user-uuid-001",
  email: "prefeito@blumenau.sc.gov.br",
  name: "João Prefeito",
  role: "admin" as const,
  municipalityId: null,
  createdAt: new Date("2024-01-15T10:00:00Z"),
};

// Gerado uma vez para todos os testes de login — bcrypt é lento, não repetir
let hashedPassword: string;

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

// vi.hoisted garante que os fns sejam criados antes do hoisting do vi.mock
const { mockUserFindUnique, mockUserCreate, mockUserCount } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserCount: vi.fn(),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("express-rate-limit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@prisma/client", () => {
  return {
    PrismaClient: vi.fn(() => ({
      user: {
        findUnique: mockUserFindUnique,
        create: mockUserCreate,
        count: mockUserCount,
      },
      municipality: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    })),
  };
});

// Agentes externos — stubs vazios
vi.mock("../../../backend/agents/ibge/index.js", () => ({
  IbgeCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/siconfi/index.js", () => ({
  SiconfiCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/datasus/index.js", () => ({
  DatasusCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/inep/index.js", () => ({
  InepCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/snis/index.js", () => ({
  SnisCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/inpe/index.js", () => ({
  InpeCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/pncp/index.js", () => ({
  PncpCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/services/ods/index.js", () => ({
  calculateMunicipalOds: vi.fn().mockResolvedValue(null),
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: Express;

beforeAll(async () => {
  process.env["JWT_SECRET"] = JWT_SECRET;
  // Gera hash real uma vez — bcrypt é intencional para validar fluxo completo
  hashedPassword = await bcrypt.hash("senha-valida-123", 10);
  const { createTestApp } = await import("./app-factory.js");
  app = await createTestApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  it("deve retornar 201 com dados do usuário quando é o primeiro registro (bootstrap)", async () => {
    // Arrange
    mockUserCount.mockResolvedValue(0);
    mockUserFindUnique.mockResolvedValue(null); // email não existe
    mockUserCreate.mockResolvedValue({ ...userFixture, passwordHash: hashedPassword });

    // Act
    const res = await request(app).post("/api/auth/register").send({
      email: userFixture.email,
      password: "senha-valida-123",
      name: userFixture.name,
      role: "admin",
    });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: userFixture.email,
      name: userFixture.name,
      role: "admin",
    });
    // Nunca expõe o hash da senha
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("deve retornar 400 quando email tem formato inválido", async () => {
    // Arrange
    mockUserCount.mockResolvedValue(0);

    // Act
    const res = await request(app).post("/api/auth/register").send({
      email: "email-sem-arroba",
      password: "senha-valida-123",
      name: "Teste",
      role: "admin",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("deve retornar 400 quando senha tem menos de 8 caracteres", async () => {
    // Arrange
    mockUserCount.mockResolvedValue(0);

    // Act
    const res = await request(app).post("/api/auth/register").send({
      email: "novo@municipio.sc.gov.br",
      password: "curta",
      name: "Teste",
      role: "admin",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("deve retornar 400 quando role tem valor fora do enum permitido", async () => {
    // Arrange
    mockUserCount.mockResolvedValue(0);

    // Act
    const res = await request(app).post("/api/auth/register").send({
      email: "novo@municipio.sc.gov.br",
      password: "senha-valida-123",
      name: "Teste",
      role: "superadmin", // inválido
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("deve retornar 409 quando email já está cadastrado", async () => {
    // Arrange — banco retorna usuário existente
    mockUserCount.mockResolvedValue(0);
    mockUserFindUnique.mockResolvedValue({ ...userFixture, passwordHash: hashedPassword });

    // Act
    const res = await request(app).post("/api/auth/register").send({
      email: userFixture.email,
      password: "senha-valida-123",
      name: "Outro Nome",
      role: "admin",
    });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/já cadastrado/i);
  });

  it("deve retornar 400 quando body está completamente vazio", async () => {
    // Arrange
    mockUserCount.mockResolvedValue(0);

    // Act
    const res = await request(app).post("/api/auth/register").send({});

    // Assert
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  it("deve retornar 200 com token JWT para credenciais válidas", async () => {
    // Arrange
    mockUserFindUnique.mockResolvedValue({ ...userFixture, passwordHash: hashedPassword });

    // Act
    const res = await request(app).post("/api/auth/login").send({
      email: userFixture.email,
      password: "senha-valida-123",
    });

    // Assert
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(0);
    // Verifica que o token é um JWT válido e bem formado
    const decoded = jwt.verify(res.body.token, JWT_SECRET) as { sub: string; email: string };
    expect(decoded.sub).toBe(userFixture.id);
    expect(decoded.email).toBe(userFixture.email);
  });

  it("deve retornar user no body (sem passwordHash) junto com o token", async () => {
    // Arrange
    mockUserFindUnique.mockResolvedValue({ ...userFixture, passwordHash: hashedPassword });

    // Act
    const res = await request(app).post("/api/auth/login").send({
      email: userFixture.email,
      password: "senha-valida-123",
    });

    // Assert
    expect(res.body.user).toMatchObject({
      id: userFixture.id,
      email: userFixture.email,
      role: userFixture.role,
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("deve retornar 401 para senha incorreta", async () => {
    // Arrange
    mockUserFindUnique.mockResolvedValue({ ...userFixture, passwordHash: hashedPassword });

    // Act
    const res = await request(app).post("/api/auth/login").send({
      email: userFixture.email,
      password: "senha-errada-999",
    });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("deve retornar 401 para email inexistente", async () => {
    // Arrange — banco não encontra nenhum usuário
    mockUserFindUnique.mockResolvedValue(null);

    // Act
    const res = await request(app).post("/api/auth/login").send({
      email: "nao-existe@municipio.gov.br",
      password: "qualquer-senha",
    });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("deve retornar 400 quando body não contém email", async () => {
    // Act
    const res = await request(app).post("/api/auth/login").send({
      password: "senha-valida-123",
    });

    // Assert
    expect(res.status).toBe(400);
  });

  it("deve retornar 400 quando body não contém senha", async () => {
    // Act
    const res = await request(app).post("/api/auth/login").send({
      email: userFixture.email,
    });

    // Assert
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("deve retornar 401 quando não há token no header", async () => {
    // Act
    const res = await request(app).get("/api/auth/me");

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("deve retornar 401 quando token é malformado", async () => {
    // Act
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer token.invalido.aqui");

    // Assert
    expect(res.status).toBe(401);
  });

  it("deve retornar 401 quando Authorization header não usa prefixo Bearer", async () => {
    // Act
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Basic dXNlcjpwYXNz");

    // Assert
    expect(res.status).toBe(401);
  });

  it("deve retornar 200 com dados do usuário para token JWT válido", async () => {
    // Arrange — gera token real com o secret de teste
    const token = jwt.sign(
      {
        sub: userFixture.id,
        email: userFixture.email,
        role: userFixture.role,
        municipalityId: userFixture.municipalityId,
      },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
    mockUserFindUnique.mockResolvedValue({ ...userFixture, passwordHash: hashedPassword });

    // Act
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: userFixture.id,
      email: userFixture.email,
      role: userFixture.role,
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("deve retornar 404 quando usuário do token não existe mais no banco", async () => {
    // Arrange — usuário foi deletado após emissão do token
    const token = jwt.sign(
      {
        sub: "usuario-deletado-uuid",
        email: "deletado@municipio.gov.br",
        role: "viewer",
        municipalityId: null,
      },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
    mockUserFindUnique.mockResolvedValue(null);

    // Act
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    // Assert
    expect(res.status).toBe(404);
  });
});
