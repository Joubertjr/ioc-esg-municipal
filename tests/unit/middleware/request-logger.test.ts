/**
 * Testes unitários para backend/middleware/request-logger.ts
 *
 * Casos cobertos:
 *   requestLoggerMiddleware — loga em debug para respostas 2xx
 *   requestLoggerMiddleware — loga em debug para respostas 3xx
 *   requestLoggerMiddleware — loga em warn para respostas 4xx
 *   requestLoggerMiddleware — loga em error para respostas 5xx
 *   requestLoggerMiddleware — payload inclui method, path, status, durationMs, requestId
 *   requestLoggerMiddleware — não crasha quando req.requestId está ausente
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response } from "express";
import request from "supertest";

// ─── Mock do logger antes de qualquer import do módulo testado ────────────────

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { requestLoggerMiddleware } from "../../../backend/middleware/request-logger.js";
import { logger } from "../../../backend/utils/logger.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildApp(statusCode: number, withRequestId = true) {
  const app = express();

  if (withRequestId) {
    app.use((req: Request, _res: Response, next) => {
      req.requestId = "test-request-id-123";
      next();
    });
  }

  app.use(requestLoggerMiddleware);

  app.get("/test", (_req: Request, res: Response) => {
    res.status(statusCode).json({ ok: true });
  });

  // Rota para forçar 5xx sem lançar exceção não tratada
  app.get("/error", (_req: Request, res: Response) => {
    res.status(statusCode).json({ error: "server error" });
  });

  return app;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("requestLoggerMiddleware — nível de log por status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve logar em debug para resposta 200", async () => {
    const app = buildApp(200);

    await request(app).get("/test");

    expect(logger.debug).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("deve logar em debug para resposta 201", async () => {
    const app = buildApp(201);

    await request(app).get("/test");

    expect(logger.debug).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("deve logar em debug para resposta 301 (3xx)", async () => {
    const app = express();
    app.use((req: Request, _res: Response, next) => {
      req.requestId = "test-request-id-301";
      next();
    });
    app.use(requestLoggerMiddleware);
    // supertest segue redirects por padrão — configura rota que termina em 301
    app.get("/redirect", (_req: Request, res: Response) => {
      // Usa send para que o evento "finish" dispare normalmente
      res.status(301).set("Location", "/other").send();
    });

    await request(app).get("/redirect").redirects(0);

    expect(logger.debug).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("deve logar em warn para resposta 400", async () => {
    const app = buildApp(400);

    await request(app).get("/test");

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("deve logar em warn para resposta 404", async () => {
    const app = buildApp(404);

    await request(app).get("/test");

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("deve logar em error para resposta 500", async () => {
    const app = buildApp(500);

    await request(app).get("/error");

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("deve logar em error para resposta 503", async () => {
    const app = buildApp(503);

    await request(app).get("/error");

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("requestLoggerMiddleware — payload do log", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve incluir method, path, status, durationMs e requestId no payload", async () => {
    const app = buildApp(200);

    await request(app).get("/test");

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("GET /test 200"),
      expect.objectContaining({
        method: "GET",
        path: "/test",
        status: 200,
        durationMs: expect.any(Number),
        requestId: "test-request-id-123",
      }),
    );
  });

  it("durationMs deve ser número não-negativo", async () => {
    const app = buildApp(200);

    await request(app).get("/test");

    const [, payload] = vi.mocked(logger.debug).mock.calls[0] as [
      string,
      { durationMs: number },
    ];
    expect(payload.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("mensagem de log deve conter method, path e status concatenados", async () => {
    const app = buildApp(404);

    await request(app).get("/test");

    const [message] = vi.mocked(logger.warn).mock.calls[0] as [string];
    expect(message).toContain("GET");
    expect(message).toContain("/test");
    expect(message).toContain("404");
  });
});

describe("requestLoggerMiddleware — requestId ausente", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não deve lançar erro quando req.requestId está indefinido", async () => {
    const app = buildApp(200, false);

    const res = await request(app).get("/test");

    expect(res.status).toBe(200);
    expect(logger.debug).toHaveBeenCalledOnce();
  });

  it("deve incluir requestId como undefined no payload quando ausente", async () => {
    const app = buildApp(200, false);

    await request(app).get("/test");

    expect(logger.debug).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        requestId: undefined,
      }),
    );
  });
});
