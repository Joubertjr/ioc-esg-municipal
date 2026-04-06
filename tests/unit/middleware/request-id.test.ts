/**
 * Testes unitários para backend/middleware/request-id.ts
 *
 * Casos cobertos:
 *   requestIdMiddleware — adiciona header X-Request-Id na resposta
 *   requestIdMiddleware — valor do header é UUID v4 válido
 *   requestIdMiddleware — popula req.requestId com o mesmo UUID
 *   requestIdMiddleware — cada requisição recebe ID único
 */

import { describe, it, expect } from "vitest";
import express, { type Request, type Response } from "express";
import request from "supertest";
import { requestIdMiddleware } from "../../../backend/middleware/request-id.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildApp() {
  const app = express();
  app.use(requestIdMiddleware);

  app.get("/test", (req: Request, res: Response) => {
    res.json({ requestId: req.requestId });
  });

  return app;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("requestIdMiddleware", () => {
  it("deve adicionar header X-Request-Id na resposta", async () => {
    const app = buildApp();

    const res = await request(app).get("/test");

    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("valor do header X-Request-Id deve ser UUID v4 válido", async () => {
    const app = buildApp();

    const res = await request(app).get("/test");

    expect(res.headers["x-request-id"]).toMatch(UUID_V4_REGEX);
  });

  it("deve popular req.requestId com o mesmo valor do header", async () => {
    const app = buildApp();

    const res = await request(app).get("/test");

    const headerValue = res.headers["x-request-id"];
    expect(res.body.requestId).toBe(headerValue);
  });

  it("cada requisição deve receber um ID único", async () => {
    const app = buildApp();

    const [res1, res2, res3] = await Promise.all([
      request(app).get("/test"),
      request(app).get("/test"),
      request(app).get("/test"),
    ]);

    const ids = [
      res1.headers["x-request-id"],
      res2.headers["x-request-id"],
      res3.headers["x-request-id"],
    ];

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });
});
