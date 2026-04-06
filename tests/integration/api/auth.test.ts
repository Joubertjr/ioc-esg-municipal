/**
 * Testes de integração para o fluxo de autenticação
 * Rotas: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me,
 *        POST /api/auth/refresh, POST /api/auth/logout
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
 * ✅ POST /api/auth/login → seta cookie httpOnly com o token
 * ✅ POST /api/auth/login → 401 para senha incorreta
 * ✅ POST /api/auth/login → 401 para email inexistente
 * ✅ POST /api/auth/login → 400 com body inválido (sem email)
 * ✅ GET /api/auth/me → 200 + user para token válido
 * ✅ GET /api/auth/me → 200 com autenticação via cookie httpOnly
 * ✅ GET /api/auth/me → 401 sem token
 * ✅ GET /api/auth/me → 401 com token malformado
 * ✅ POST /api/auth/refresh → 200 + novos tokens para refresh token válido
 * ✅ POST /api/auth/refresh → 401 para refresh token revogado
 * ✅ POST /api/auth/refresh → 401 para refresh token expirado
 * ✅ POST /api/auth/refresh → 401 para refresh token inexistente
 * ✅ POST /api/auth/refresh → rotação: token antigo não pode ser reutilizado
 * ✅ POST /api/auth/logout → 200 e limpa cookie
 * ✅ POST /api/auth/logout → revoga refresh token no banco
 * ✅ CSRF: POST com cookie e Origin errada → 403
 * ✅ CSRF: POST com cookie e Origin correta → passa
 * ✅ CSRF: POST com Bearer header (sem cookie) → CSRF não aplica
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
const {
  mockUserFindUnique,
  mockUserCreate,
  mockUserCount,
  mockRefreshTokenCreate,
  mockRefreshTokenFindUnique,
  mockRefreshTokenUpdate,
  mockRefreshTokenUpdateMany,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserCount: vi.fn(),
  mockRefreshTokenCreate: vi.fn(),
  mockRefreshTokenFindUnique: vi.fn(),
  mockRefreshTokenUpdate: vi.fn(),
  mockRefreshTokenUpdateMany: vi.fn(),
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
      refreshToken: {
        create: mockRefreshTokenCreate,
        findUnique: mockRefreshTokenFindUnique,
        update: mockRefreshTokenUpdate,
        updateMany: mockRefreshTokenUpdateMany,
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
vi.mock("../../../backend/agents/tse/index.js", () => ({
  TseCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/aneel/index.js", () => ({
  AneelCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/snis_rs/index.js", () => ({
  SnisRsCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/ana/index.js", () => ({
  AnaCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/convenios/index.js", () => ({
  ConveniosCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/anatel/index.js", () => ({
  AnatelCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../backend/agents/sisvan/index.js", () => ({
  SisvanCollector: vi.fn().mockImplementation(() => ({ collect: vi.fn(), collectBatch: vi.fn() })),
  mapToOdsIndicators: vi.fn().mockReturnValue([]),
}));
// JSON data files imported at module load time by the new collectors
vi.mock("../../../shared/data/tse_2024.json", () => ({ default: [] }));
vi.mock("../../../shared/data/aneel_gd_2023.json", () => ({ default: [] }));
vi.mock("../../../shared/data/snis_rs_2022.json", () => ({ default: [] }));
vi.mock("../../../shared/data/ana_2022.json", () => ({ default: [] }));
vi.mock("../../../shared/data/convenios_2023.json", () => ({ default: [] }));
vi.mock("../../../shared/data/anatel_2023.json", () => ({ default: [] }));
vi.mock("../../../shared/data/sisvan_2023.json", () => ({ default: [] }));
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
}, 15_000);

// Fixture de refresh token válido — reutilizado em vários testes
const refreshTokenFixture = {
  id: "rt-uuid-1",
  token: "valid-refresh-token-hex-96chars",
  userId: userFixture.id,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  revokedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();

  // Defaults seguros para os mocks de refreshToken — cada teste sobrescreve
  // apenas o que precisa. Isso garante que testes existentes (login, register)
  // continuem funcionando sem configurar o refreshToken explicitamente.
  mockRefreshTokenCreate.mockResolvedValue(refreshTokenFixture);
  mockRefreshTokenFindUnique.mockResolvedValue(null);
  mockRefreshTokenUpdate.mockResolvedValue({ ...refreshTokenFixture, revokedAt: new Date() });
  mockRefreshTokenUpdateMany.mockResolvedValue({ count: 0 });
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  it("deve retornar 201 com dados do usuário quando é o primeiro registro (bootstrap)", { timeout: 15_000 }, async () => {
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

  it("deve retornar 200 com dados do usuário quando autenticado via cookie httpOnly", async () => {
    // Arrange — gera token real e simula cookie enviado pelo browser
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

    // Act — GET é safe method, CSRF não se aplica
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `token=${token}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: userFixture.id,
      email: userFixture.email,
    });
  });
});

// ─── POST /api/auth/login — cookie ────────────────────────────────────────────

describe("POST /api/auth/login — cookie httpOnly", () => {
  it("deve setar cookie httpOnly com o token JWT no response de login", async () => {
    // Arrange
    mockUserFindUnique.mockResolvedValue({ ...userFixture, passwordHash: hashedPassword });

    // Act
    const res = await request(app).post("/api/auth/login").send({
      email: userFixture.email,
      password: "senha-valida-123",
    });

    // Assert
    expect(res.status).toBe(200);
    const setCookieHeader = res.headers["set-cookie"] as string[] | string | undefined;
    expect(setCookieHeader).toBeDefined();
    const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader.join(";") : setCookieHeader;
    expect(cookieStr).toMatch(/token=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
  });

  it("deve incluir refreshToken no body do response de login", async () => {
    // Arrange
    mockUserFindUnique.mockResolvedValue({ ...userFixture, passwordHash: hashedPassword });

    // Act
    const res = await request(app).post("/api/auth/login").send({
      email: userFixture.email,
      password: "senha-valida-123",
    });

    // Assert
    expect(res.status).toBe(200);
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.body.refreshToken.length).toBeGreaterThan(0);
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe("POST /api/auth/refresh", () => {
  it("deve retornar 200 com novos access e refresh tokens para refresh token válido", async () => {
    // Arrange — banco retorna refresh token ativo e o user associado
    mockRefreshTokenFindUnique.mockResolvedValue({
      ...refreshTokenFixture,
      user: { ...userFixture, passwordHash: hashedPassword },
    });

    // Act
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: refreshTokenFixture.token });

    // Assert
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
    // Valida que o novo access token é um JWT legítimo
    const decoded = jwt.verify(res.body.token, JWT_SECRET) as { sub: string };
    expect(decoded.sub).toBe(userFixture.id);
  });

  it("deve retornar 401 para refresh token inexistente no banco", async () => {
    // Arrange — banco não encontra o token
    mockRefreshTokenFindUnique.mockResolvedValue(null);

    // Act
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "token-que-nao-existe" });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("deve retornar 401 para refresh token já revogado", async () => {
    // Arrange — token foi revogado (revokedAt preenchido)
    mockRefreshTokenFindUnique.mockResolvedValue({
      ...refreshTokenFixture,
      revokedAt: new Date("2024-01-01T00:00:00Z"),
      user: { ...userFixture, passwordHash: hashedPassword },
    });

    // Act
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: refreshTokenFixture.token });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("deve retornar 401 para refresh token expirado", async () => {
    // Arrange — token existe mas expirou
    mockRefreshTokenFindUnique.mockResolvedValue({
      ...refreshTokenFixture,
      expiresAt: new Date("2023-01-01T00:00:00Z"), // data no passado
      user: { ...userFixture, passwordHash: hashedPassword },
    });

    // Act
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: refreshTokenFixture.token });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("deve revogar o refresh token antigo após rotação bem-sucedida", async () => {
    // Arrange
    mockRefreshTokenFindUnique.mockResolvedValue({
      ...refreshTokenFixture,
      user: { ...userFixture, passwordHash: hashedPassword },
    });

    // Act
    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: refreshTokenFixture.token });

    // Assert — o update deve ter sido chamado para revogar o token antigo
    expect(mockRefreshTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: refreshTokenFixture.id },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  it("deve retornar 400 quando o body não contém refreshToken", async () => {
    // Act
    const res = await request(app).post("/api/auth/refresh").send({});

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("deve revogar todos os tokens do usuário quando refresh token revogado é reutilizado (token reuse attack)", async () => {
    // Arrange — token já revogado sinaliza possível reuso
    mockRefreshTokenFindUnique.mockResolvedValue({
      ...refreshTokenFixture,
      revokedAt: new Date("2024-01-01T00:00:00Z"),
      user: { ...userFixture, passwordHash: hashedPassword },
    });

    // Act
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: refreshTokenFixture.token });

    // Assert — todos os tokens do usuário devem ser revogados
    expect(res.status).toBe(401);
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: userFixture.id, revokedAt: null }),
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  it("deve retornar 200 e mensagem de sucesso", async () => {
    // Act
    const res = await request(app).post("/api/auth/logout").send({});

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logout/i);
  });

  it("deve limpar o cookie token no response", async () => {
    // Act
    const res = await request(app).post("/api/auth/logout").send({});

    // Assert
    const setCookieHeader = res.headers["set-cookie"] as string[] | string | undefined;
    expect(setCookieHeader).toBeDefined();
    const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader.join(";") : setCookieHeader;
    // Cookie limpo: expires no passado ou Max-Age=0
    expect(cookieStr).toMatch(/token=;|token=$/i);
  });

  it("deve revogar o refresh token no banco quando fornecido no body", async () => {
    // Arrange — banco encontra o token ativo
    mockRefreshTokenFindUnique.mockResolvedValue(refreshTokenFixture);

    // Act
    await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: refreshTokenFixture.token });

    // Assert — update chamado para marcar revokedAt
    expect(mockRefreshTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: refreshTokenFixture.id },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  it("deve retornar 200 mesmo quando nenhum refreshToken é fornecido", async () => {
    // Act — logout sem body
    const res = await request(app).post("/api/auth/logout").send({});

    // Assert
    expect(res.status).toBe(200);
    // Nenhuma tentativa de buscar token no banco
    expect(mockRefreshTokenFindUnique).not.toHaveBeenCalled();
  });
});

// ─── CSRF protection ──────────────────────────────────────────────────────────

describe("CSRF protection no authenticateToken", () => {
  // Usa /api/auth/me como rota protegida intermediária.
  // Para testar CSRF em POST via cookie, precisamos de uma rota POST protegida.
  // A rota GET /me não aciona o check (GET é safe). Portanto testamos via
  // a lógica do middleware diretamente usando um endpoint POST protegido que
  // usa authenticateToken. Como auth.ts não expõe POST autenticado fácil,
  // usamos /api/municipalities (autenticado) ou simulamos via header/cookie.
  //
  // Estratégia: o middleware `authenticateToken` é chamado para rotas protegidas.
  // Para testar CSRF isolamos o comportamento usando a rota de municipalities
  // que já usa authenticateToken via app-factory.

  const makeValidToken = () =>
    jwt.sign(
      {
        sub: userFixture.id,
        email: userFixture.email,
        role: userFixture.role,
        municipalityId: userFixture.municipalityId,
      },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

  it("deve rejeitar POST via cookie com Origin de domínio externo (CSRF)", async () => {
    // Arrange — cookie válido mas Origin errado
    const token = makeValidToken();

    // Act — POST em rota protegida com cookie + Origin estranho
    const res = await request(app)
      .post("/api/municipalities")
      .set("Cookie", `token=${token}`)
      .set("Origin", "https://site-malicioso.com")
      .send({});

    // Assert — middleware CSRF rejeita antes de processar a rota
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/CSRF/i);
  });

  it("deve aceitar POST via cookie com Origin permitida (localhost:5173)", async () => {
    // Arrange — o mock do Prisma já está configurado; municipality.findMany retorna []
    const token = makeValidToken();

    // Act — POST em rota protegida com cookie + Origin correta
    const res = await request(app)
      .post("/api/municipalities")
      .set("Cookie", `token=${token}`)
      .set("Origin", "http://localhost:5173")
      .send({});

    // Assert — CSRF passa; rota pode retornar 404/405/400 mas NÃO 403 por CSRF
    expect(res.status).not.toBe(403);
  });

  it("deve aceitar POST com Authorization Bearer sem verificar CSRF (não usa cookie)", async () => {
    // Arrange — auth via header, não cookie — CSRF não se aplica
    const token = makeValidToken();

    // Act — POST sem cookie, com Bearer token e Origin externa
    const res = await request(app)
      .post("/api/municipalities")
      .set("Authorization", `Bearer ${token}`)
      .set("Origin", "https://site-qualquer.com")
      .send({});

    // Assert — CSRF check não se aplica para Bearer; rota processa normalmente
    expect(res.status).not.toBe(403);
  });
});
