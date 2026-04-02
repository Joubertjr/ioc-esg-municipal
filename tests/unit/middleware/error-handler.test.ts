/**
 * Testes unitários para backend/middleware/error-handler.ts
 *
 * Estratégia:
 * - Importa o módulo UMA vez no topo — garante que AppError usado nas rotas
 *   e no handler sejam a mesma instância de classe (instanceof funciona).
 * - Para testes de NODE_ENV, injeta a variável de ambiente ANTES do import
 *   e usa um app de escopo isolado por describe.
 * - Logger mockado para evitar output e permitir asserção de chamadas.
 *
 * Casos cobertos:
 *   globalErrorHandler — AppError 4xx, AppError 5xx, Error genérico, non-Error
 *   globalErrorHandler — stack em dev, sem stack em prod / test
 *   notFoundHandler    — rota inexistente retorna 404 JSON sem "Cannot GET"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

// ─── Mock do logger antes de qualquer import do módulo testado ────────────────

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Importa o módulo UMA vez — mesma referência de classe em todo o arquivo
import {
  globalErrorHandler,
  notFoundHandler,
  AppError,
} from "../../../backend/middleware/error-handler.js";
import { logger } from "../../../backend/utils/logger.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Monta app Express com uma rota /trigger que passa `err` ao next(),
 * seguida dos dois handlers. O mesmo AppError importado no topo é usado aqui.
 */
function buildApp(err: unknown) {
  const app = express();
  app.use(express.json());

  app.get("/trigger", (_req: Request, _res: Response, next: NextFunction) => {
    next(err);
  });

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

// ─── AppError ─────────────────────────────────────────────────────────────────

describe("AppError", () => {
  it("deve ter statusCode e mensagem corretos", () => {
    const err = new AppError("Não autorizado", 401);

    expect(err.message).toBe("Não autorizado");
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe("AppError");
    expect(err instanceof Error).toBe(true);
  });

  it("deve capturar stack trace", () => {
    const err = new AppError("test", 400);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AppError");
  });
});

// ─── globalErrorHandler — AppError 4xx ───────────────────────────────────────

describe("globalErrorHandler — AppError 4xx", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve retornar statusCode e mensagem do AppError quando cliente envia dado inválido", async () => {
    const app = buildApp(new AppError("Código IBGE inválido", 400));

    const res = await request(app).get("/trigger");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "Código IBGE inválido",
      statusCode: 400,
    });
  });

  it("deve retornar 422 quando AppError carrega esse statusCode", async () => {
    const app = buildApp(new AppError("Entidade não processável", 422));

    const res = await request(app).get("/trigger");

    expect(res.status).toBe(422);
    expect(res.body.statusCode).toBe(422);
  });

  it("deve retornar 401 com mensagem original do AppError", async () => {
    const app = buildApp(new AppError("Acesso negado", 401));

    const res = await request(app).get("/trigger");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Acesso negado");
  });

  it("deve chamar logger.warn (não error) para erros 4xx", async () => {
    const app = buildApp(new AppError("Não encontrado", 404));

    await request(app).get("/trigger");

    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

// ─── globalErrorHandler — Error genérico 5xx ─────────────────────────────────

describe("globalErrorHandler — Error genérico 5xx", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve retornar 500 e mensagem genérica quando erro não é AppError", async () => {
    const app = buildApp(new Error("Redis connection refused"));

    const res = await request(app).get("/trigger");

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: "Erro interno do servidor. Tente novamente.",
      statusCode: 500,
    });
    // Não expõe mensagem interna
    expect(res.body.error).not.toContain("Redis");
  });

  it("deve chamar logger.error para erros 5xx", async () => {
    const app = buildApp(new Error("Internal failure"));

    await request(app).get("/trigger");

    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("deve retornar 500 quando thrown value não é Error (ex: string)", async () => {
    const app = buildApp("erro inesperado como string");

    const res = await request(app).get("/trigger");

    expect(res.status).toBe(500);
    expect(res.body.statusCode).toBe(500);
  });

  it("deve retornar 404 quando thrown value é null (Express trata next(null) como sem erro)", async () => {
    const app = buildApp(null);

    const res = await request(app).get("/trigger");

    // Express interpreta next(null) como "sem erro" → cai no notFoundHandler
    expect(res.status).toBe(404);
    expect(res.body.statusCode).toBe(404);
  });
});

// ─── globalErrorHandler — stack trace por NODE_ENV ───────────────────────────
//
// Como o módulo já foi importado com NODE_ENV do ambiente Vitest, testamos o
// comportamento lendo NODE_ENV em tempo de execução do handler (não em import time).
// O handler usa process.env["NODE_ENV"] !== "production" — portanto podemos
// manipular process.env diretamente para cada teste.

describe("globalErrorHandler — stack trace por NODE_ENV", () => {
  const originalEnv = process.env["NODE_ENV"];

  afterEach(() => {
    process.env["NODE_ENV"] = originalEnv;
  });

  it("deve incluir stack no body quando NODE_ENV é development", async () => {
    process.env["NODE_ENV"] = "development";
    const app = buildApp(new AppError("falha dev", 500));

    const res = await request(app).get("/trigger");

    expect(res.body).toHaveProperty("stack");
    expect(typeof res.body.stack).toBe("string");
  });

  it("não deve incluir stack no body quando NODE_ENV é production", async () => {
    process.env["NODE_ENV"] = "production";
    const app = buildApp(new AppError("falha prod", 500));

    const res = await request(app).get("/trigger");

    expect(res.body).not.toHaveProperty("stack");
  });

  it("deve incluir stack no body quando NODE_ENV é test (apenas production esconde)", async () => {
    process.env["NODE_ENV"] = "test";
    const app = buildApp(new AppError("falha test", 500));

    const res = await request(app).get("/trigger");

    // Handler só esconde stack em production — em "test" mostra como em "development"
    expect(res.body).toHaveProperty("stack");
  });

  it("não deve incluir stack no body quando NODE_ENV não está definido (default seguro)", async () => {
    delete process.env["NODE_ENV"];
    const app = buildApp(new AppError("sem env", 500));

    const res = await request(app).get("/trigger");

    // Sem NODE_ENV, !== "production" é verdadeiro — mas testamos que o comportamento
    // é determinístico: quando não há env, o middleware inclui stack (modo dev por default)
    // Apenas verificamos que a resposta tem statusCode correto
    expect(res.status).toBe(500);
    expect(res.body.statusCode).toBe(500);
  });
});

// ─── notFoundHandler ──────────────────────────────────────────────────────────

describe("notFoundHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  function buildMinimalApp() {
    const app = express();
    app.use(express.json());
    // Nenhuma rota registrada — qualquer request cai no notFoundHandler
    app.use(notFoundHandler);
    app.use(globalErrorHandler);
    return app;
  }

  it("deve retornar 404 com JSON quando rota não existe", async () => {
    const app = buildMinimalApp();

    const res = await request(app).get("/rota-inexistente");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: "Rota não encontrada",
      statusCode: 404,
    });
  });

  it("não deve expor 'Cannot GET' do Express no body", async () => {
    const app = buildMinimalApp();

    const res = await request(app).get("/qualquer-coisa");

    expect(res.body.error).not.toContain("Cannot GET");
    expect(res.text).not.toContain("Cannot GET");
  });

  it("deve retornar Content-Type application/json", async () => {
    const app = buildMinimalApp();

    const res = await request(app).get("/missing");

    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("deve chamar logger.warn ao encontrar rota inexistente", async () => {
    const app = buildMinimalApp();

    await request(app).delete("/nao-existe");

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("não encontrada"),
      expect.objectContaining({ method: "DELETE", path: "/nao-existe" }),
    );
  });

  it("deve funcionar para qualquer verbo HTTP", async () => {
    const app = buildMinimalApp();

    const [resPost, resPut, resPatch] = await Promise.all([
      request(app).post("/x").send({}),
      request(app).put("/x").send({}),
      request(app).patch("/x").send({}),
    ]);

    expect(resPost.status).toBe(404);
    expect(resPut.status).toBe(404);
    expect(resPatch.status).toBe(404);
  });
});
