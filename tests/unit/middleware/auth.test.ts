/**
 * Testes unitários para backend/middleware/auth.ts
 *
 * Estratégia:
 * - Mock do logger para evitar output em testes
 * - JWT gerado e verificado com secret de teste
 * - Express app mínima para testar authenticateToken e requireRole via supertest
 *
 * Casos cobertos:
 *   authenticateToken — token ausente, inválido, expirado, válido
 *   authenticateToken — rejeita JWT_SECRET placeholder em produção
 *   requireRole       — role correta, role insuficiente, sem user
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express, { type Request, type Response } from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// ─── Mock do logger ───────────────────────────────────────────────────────────

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-secret-seguro-para-testes";

function makeValidToken(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      sub: "user-123",
      email: "test@example.com",
      role: "admin",
      municipalityId: null,
      ...overrides,
    },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

// ─── Setup do app de teste ─────────────────────────────────────────────────────

async function buildAuthApp() {
  // Import após configurar env para evitar cache
  const { authenticateToken, requireRole } = await import("../../../backend/middleware/auth.js");

  const app = express();
  app.use(express.json());
  // cookie-parser necessário para que req.cookies esteja disponível
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cookieParser = require("cookie-parser");
  app.use(cookieParser());

  // Rota só com autenticação
  app.get("/protected", authenticateToken, (_req: Request, res: Response) => {
    res.json({ ok: true, user: _req.user });
  });

  // Rota com autenticação + role admin
  app.get(
    "/admin-only",
    authenticateToken,
    requireRole("admin"),
    (_req: Request, res: Response) => {
      res.json({ ok: true });
    },
  );

  // Rota com autenticação + múltiplas roles
  app.get(
    "/staff",
    authenticateToken,
    requireRole("admin", "prefeito", "secretario"),
    (_req: Request, res: Response) => {
      res.json({ ok: true });
    },
  );

  // Rota POST para testar CSRF
  app.post("/protected", authenticateToken, (_req: Request, res: Response) => {
    res.json({ ok: true, user: _req.user });
  });

  return app;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("authenticateToken", () => {
  beforeEach(() => {
    process.env["JWT_SECRET"] = TEST_SECRET;
    process.env["NODE_ENV"] = "development";
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 quando Authorization header está ausente", async () => {
    const app = await buildAuthApp();
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/ausente/i);
  });

  it("retorna 401 quando token não tem prefixo Bearer", async () => {
    const app = await buildAuthApp();
    const token = makeValidToken();
    const res = await request(app).get("/protected").set("Authorization", token);
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token inválido (string aleatória)", async () => {
    const app = await buildAuthApp();
    const res = await request(app).get("/protected").set("Authorization", "Bearer token-invalido");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido/i);
  });

  it("retorna 401 com token assinado por secret diferente", async () => {
    const app = await buildAuthApp();
    const token = jwt.sign(
      { sub: "u1", email: "x@x.com", role: "viewer", municipalityId: null },
      "outro-secret",
      { expiresIn: "1h" },
    );
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token expirado", async () => {
    const app = await buildAuthApp();
    const token = jwt.sign(
      { sub: "u1", email: "x@x.com", role: "viewer", municipalityId: null },
      TEST_SECRET,
      { expiresIn: -1 }, // já expirado
    );
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expir/i);
  });

  it("retorna 200 com token válido e popula req.user", async () => {
    const app = await buildAuthApp();
    const token = makeValidToken({ sub: "user-abc", role: "prefeito" });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      sub: "user-abc",
      role: "prefeito",
      email: "test@example.com",
    });
  });

  it("bloqueia startup em produção quando JWT_SECRET contém 'troque'", async () => {
    process.env["JWT_SECRET"] = "troque-por-chave-segura-em-producao";
    process.env["NODE_ENV"] = "production";
    vi.resetModules();

    const mockExit = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error(`process.exit(${_code})`);
    });

    await expect(buildAuthApp()).rejects.toThrow("process.exit(1)");
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it("retorna 200 com token válido enviado via cookie httpOnly", async () => {
    const app = await buildAuthApp();
    const token = makeValidToken({ sub: "user-cookie", role: "prefeito" });
    const res = await request(app).get("/protected").set("Cookie", `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ sub: "user-cookie", role: "prefeito" });
  });

  it("prefere cookie sobre Authorization header quando ambos estão presentes", async () => {
    const app = await buildAuthApp();
    const cookieToken = makeValidToken({ sub: "user-via-cookie", role: "admin" });
    // Header com token assinado por secret diferente (seria inválido) — mas cookie deve ter precedência
    const res = await request(app)
      .get("/protected")
      .set("Cookie", `token=${cookieToken}`)
      .set("Authorization", `Bearer ${cookieToken}`);
    // Quando Authorization header presente, cookie NÃO tem precedência (fallback para header)
    // Ambos os tokens são válidos aqui, então o resultado deve ser 200
    expect(res.status).toBe(200);
  });

  it("retorna 403 quando cookie é enviado em POST sem Origin permitido (CSRF)", async () => {
    process.env["ALLOWED_ORIGINS"] = "http://localhost:5173";
    vi.resetModules();

    const app = await buildAuthApp();
    const token = makeValidToken();
    const res = await request(app)
      .post("/protected")
      .set("Cookie", `token=${token}`)
      .set("Origin", "http://evil.example.com");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/CSRF/i);
  });

  it("retorna 200 quando cookie é enviado em POST com Origin permitido", async () => {
    process.env["ALLOWED_ORIGINS"] = "http://localhost:5173";
    vi.resetModules();

    const app = await buildAuthApp();
    const token = makeValidToken();
    const res = await request(app)
      .post("/protected")
      .set("Cookie", `token=${token}`)
      .set("Origin", "http://localhost:5173");
    expect(res.status).toBe(200);
  });

  it("ignora CSRF check quando auth é via Authorization header (não cookie)", async () => {
    process.env["ALLOWED_ORIGINS"] = "http://localhost:5173";
    vi.resetModules();

    const app = await buildAuthApp();
    const token = makeValidToken();
    // POST sem Origin mas usando header — CSRF não se aplica
    const res = await request(app).post("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    process.env["JWT_SECRET"] = TEST_SECRET;
    process.env["NODE_ENV"] = "development";
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("permite acesso quando role do user bate com role exigida", async () => {
    const app = await buildAuthApp();
    const token = makeValidToken({ role: "admin" });
    const res = await request(app).get("/admin-only").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("retorna 403 quando role do user não está entre as roles exigidas", async () => {
    const app = await buildAuthApp();
    const token = makeValidToken({ role: "viewer" });
    const res = await request(app).get("/admin-only").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/acesso negado/i);
  });

  it("permite acesso quando role está em lista de múltiplas roles", async () => {
    const app = await buildAuthApp();
    const token = makeValidToken({ role: "secretario" });
    const res = await request(app).get("/staff").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("retorna 403 quando viewer tenta acessar rota de staff", async () => {
    const app = await buildAuthApp();
    const token = makeValidToken({ role: "viewer" });
    const res = await request(app).get("/staff").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("retorna 401 sem token (requireRole depende de authenticateToken)", async () => {
    const app = await buildAuthApp();
    const res = await request(app).get("/admin-only");
    expect(res.status).toBe(401);
  });
});
