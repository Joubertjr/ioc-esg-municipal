/**
 * Testes unitários para backend/middleware/rate-limit.ts
 *
 * Estratégia:
 * - rate-limit-redis é mockado com FakeRedisStore que implementa a interface
 *   Store do express-rate-limit sem depender do protocolo Lua/EVALSHA.
 * - getRedisClient resolve (Redis disponível) → RedisStore é instanciado.
 * - Cenário de fallback: getRedisClient rejeita → MemoryStore real.
 * - App Express importada uma vez em beforeAll; stores reiniciados por teste.
 *
 * Casos cobertos:
 *   generalLimiter — permite requisições abaixo do limite (max 60 req/min)
 *   generalLimiter — bloqueia com 429 ao atingir limite de 60 req/min
 *   generalLimiter — header 'ratelimit' presente no formato draft-7
 *   generalLimiter — sem headers X-RateLimit-* legados (legacyHeaders: false)
 *   authLimiter    — limite estrito de 10 req / 15 min
 *   authLimiter    — mensagem de erro menciona 15 minutos
 *   batchLimiter   — limite de 5 req / min em rotas de batch
 *   batchLimiter   — mensagem de erro menciona batch
 *   fallback       — usa MemoryStore quando Redis indisponível
 *   fallback       — loga aviso de Redis indisponível
 *   fallback       — MemoryStore bloqueia com 429 após esgotar limite
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import express, { type Request, type Response } from "express";
import request from "supertest";
import type { Store, IncrementResponse } from "express-rate-limit";

// ─── Mock do logger ───────────────────────────────────────────────────────────

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── FakeRedisStore ───────────────────────────────────────────────────────────
//
// Implementa a interface Store do express-rate-limit sem tocar no protocolo
// Redis/Lua. Mantém um Map em memória por chave, reiniciável por teste.

class FakeRedisStore implements Store {
  private counts = new Map<string, number>();
  private windowMs = 60_000;

  init(options: { windowMs: number }) {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const current = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, current);
    return {
      totalHits: current,
      resetTime: new Date(Date.now() + this.windowMs),
    };
  }

  async decrement(key: string): Promise<void> {
    const n = this.counts.get(key) ?? 0;
    if (n > 0) this.counts.set(key, n - 1);
  }

  async resetKey(key: string): Promise<void> {
    this.counts.delete(key);
  }

  reset() {
    this.counts.clear();
  }
}

const fakeGeneralStore = new FakeRedisStore();
const fakeBatchStore = new FakeRedisStore();
const fakeAuthStore = new FakeRedisStore();

// O construtor mockado entrega as instâncias na ordem em que são chamados
const storeInstances = [fakeGeneralStore, fakeBatchStore, fakeAuthStore];
let storeIndex = 0;

vi.mock("rate-limit-redis", () => ({
  RedisStore: vi.fn().mockImplementation(() => storeInstances[storeIndex++] ?? new FakeRedisStore()),
}));

// ─── Mock do Redis client (disponível por padrão) ─────────────────────────────

vi.mock("../../../backend/utils/cache.js", () => ({
  getRedisClient: vi.fn().mockResolvedValue({ sendCommand: vi.fn() }),
}));

// ─── App de teste (importada uma vez) ────────────────────────────────────────

let app: ReturnType<typeof express>;

beforeAll(async () => {
  storeIndex = 0;
  const { generalLimiter, authLimiter, batchLimiter } = await import(
    "../../../backend/middleware/rate-limit.js"
  );

  app = express();
  app.use(express.json());

  app.get("/general", generalLimiter, (_req: Request, res: Response) => {
    res.json({ ok: true });
  });
  app.post("/auth/login", authLimiter, (_req: Request, res: Response) => {
    res.json({ ok: true });
  });
  app.post("/batch", batchLimiter, (_req: Request, res: Response) => {
    res.json({ ok: true });
  });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function sendN(method: "get" | "post", path: string, n: number): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < n; i++) {
    const res = await request(app)[method](path);
    statuses.push(res.status);
  }
  return statuses;
}

// ─── generalLimiter ───────────────────────────────────────────────────────────

describe("generalLimiter — Redis disponível", () => {
  it("permite requisição quando contador está abaixo do limite (max: 60)", async () => {
    fakeGeneralStore.reset();
    const res = await request(app).get("/general");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("retorna 429 quando limite de 60 req/min é atingido", async () => {
    fakeGeneralStore.reset();
    const statuses = await sendN("get", "/general", 61);
    expect(statuses.filter((s) => s === 200).length).toBe(60);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
  });

  it("inclui header 'ratelimit' no formato draft-7 com limit=60", async () => {
    fakeGeneralStore.reset();
    const res = await request(app).get("/general");
    // standardHeaders: "draft-7" emite um único header: "limit=60, remaining=59, reset=60"
    expect(res.headers["ratelimit"]).toBeDefined();
    expect(res.headers["ratelimit"]).toMatch(/limit=60/);
  });

  it("não inclui headers X-RateLimit-* legados (legacyHeaders: false)", async () => {
    fakeGeneralStore.reset();
    const res = await request(app).get("/general");
    expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
    expect(res.headers["x-ratelimit-remaining"]).toBeUndefined();
    expect(res.headers["x-ratelimit-reset"]).toBeUndefined();
  });
});

// ─── authLimiter ──────────────────────────────────────────────────────────────

describe("authLimiter — limite estrito de 10 req / 15 min", () => {
  it("permite requisição dentro do limite de 10 tentativas", async () => {
    fakeAuthStore.reset();
    const res = await request(app).post("/auth/login");
    expect(res.status).toBe(200);
  });

  it("retorna 429 quando limite de 10 tentativas é excedido", async () => {
    fakeAuthStore.reset();
    const statuses = await sendN("post", "/auth/login", 11);
    expect(statuses.filter((s) => s === 200).length).toBe(10);
    expect(statuses.filter((s) => s === 429).length).toBe(1);
  });

  it("mensagem de erro menciona 15 minutos", async () => {
    fakeAuthStore.reset();
    await sendN("post", "/auth/login", 10);
    const res = await request(app).post("/auth/login");
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/15 minutos/i);
  });
});

// ─── batchLimiter ─────────────────────────────────────────────────────────────

describe("batchLimiter — limite de 5 req / min", () => {
  it("permite requisição dentro do limite de 5 por minuto", async () => {
    fakeBatchStore.reset();
    const res = await request(app).post("/batch");
    expect(res.status).toBe(200);
  });

  it("retorna 429 quando limite de 5 requisições é excedido", async () => {
    fakeBatchStore.reset();
    const statuses = await sendN("post", "/batch", 6);
    expect(statuses.filter((s) => s === 200).length).toBe(5);
    expect(statuses.filter((s) => s === 429).length).toBe(1);
  });

  it("mensagem de erro menciona batch", async () => {
    fakeBatchStore.reset();
    await sendN("post", "/batch", 5);
    const res = await request(app).post("/batch");
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/batch/i);
  });
});

// ─── Fallback para MemoryStore ────────────────────────────────────────────────

describe("fallback para MemoryStore quando Redis está indisponível", () => {
  let fallbackApp: ReturnType<typeof express>;

  beforeAll(async () => {
    // Reconfigura getRedisClient para rejeitar antes de reimportar o módulo
    const { getRedisClient } = await import("../../../backend/utils/cache.js");
    vi.mocked(getRedisClient).mockRejectedValue(new Error("ECONNREFUSED"));

    vi.resetModules();

    const { generalLimiter, batchLimiter, authLimiter } = await import(
      "../../../backend/middleware/rate-limit.js"
    );

    fallbackApp = express();
    fallbackApp.use(express.json());

    fallbackApp.get("/general", generalLimiter, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });
    fallbackApp.post("/auth/login", authLimiter, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });
    fallbackApp.post("/batch", batchLimiter, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });
  });

  it("loga aviso de Redis indisponível ao fazer fallback para MemoryStore", async () => {
    const { logger } = await import("../../../backend/utils/logger.js");
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining("Redis indisponível"),
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it("primeira requisição passa com MemoryStore (graceful degradation)", async () => {
    const res = await request(fallbackApp).get("/general");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("MemoryStore bloqueia com 429 após esgotar limite do batchLimiter (max: 5)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(fallbackApp).post("/batch");
      statuses.push(res.status);
    }
    expect(statuses.filter((s) => s === 200).length).toBe(5);
    expect(statuses.filter((s) => s === 429).length).toBe(1);
  });
});
