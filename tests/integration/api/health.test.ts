/**
 * Testes de integração para o endpoint GET /health
 *
 * Estratégia de mock:
 * - logger: silenciado para evitar poluição de saída nos testes
 * - @prisma/client: substituído por instância em memória — health endpoint
 *   não usa banco, mas os routers importados indiretamente precisam que o
 *   construtor PrismaClient seja resolvível
 * - express-rate-limit: passthrough — evita bloqueio por IP em testes
 * - Agentes e serviços ODS: stubs vazios para remover dependências externas
 *
 * O app é construído via createTestApp() que espelha backend/index.ts
 * sem app.listen() e sem os process.on handlers — elimina efeitos colaterais.
 *
 * Casos cobertos:
 * ✅ GET /health → 200
 * ✅ GET /health → body.status === "ok"
 * ✅ GET /health → body.service === "ioc-esg-municipal"
 * ✅ GET /health → body.timestamp é ISO 8601 válido
 * ✅ GET /health → body.uptime é número positivo
 * ✅ GET /health → Content-Type application/json
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

// ─── Mocks (devem ser declarados antes de qualquer import dinâmico) ───────────

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("express-rate-limit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@prisma/client", () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    municipality: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

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
  process.env["JWT_SECRET"] = "test-secret-for-integration-tests-minimum-length";
  const { createTestApp } = await import("./app-factory.js");
  app = await createTestApp();
});

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("deve retornar 200", async () => {
    // Act
    const res = await request(app).get("/health");

    // Assert
    expect(res.status).toBe(200);
  });

  it("deve retornar status 'ok' no body", async () => {
    // Act
    const res = await request(app).get("/health");

    // Assert
    expect(res.body.status).toBe("ok");
  });

  it("deve retornar campo service igual a 'ioc-esg-municipal'", async () => {
    // Act
    const res = await request(app).get("/health");

    // Assert
    expect(res.body.service).toBe("ioc-esg-municipal");
  });

  it("deve retornar timestamp em formato ISO 8601 válido", async () => {
    // Act
    const res = await request(app).get("/health");

    // Assert
    expect(res.body.timestamp).toBeDefined();
    const parsed = new Date(res.body.timestamp as string);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it("deve retornar uptime como número positivo", async () => {
    // Act
    const res = await request(app).get("/health");

    // Assert
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.uptime).toBeGreaterThan(0);
  });

  it("deve retornar Content-Type application/json", async () => {
    // Act
    const res = await request(app).get("/health");

    // Assert
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});
