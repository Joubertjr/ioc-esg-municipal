import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock do logger para evitar saída no console durante testes
vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Importar após mock
import { validateEnv } from "../../../backend/utils/env-validator.js";
import { logger } from "../../../backend/utils/logger.js";

// Variáveis de ambiente válidas para desenvolvimento
const validDevEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "development",
  PORT: "3000",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ioc_esg_municipal",
  JWT_SECRET: "troque-por-chave-segura-em-producao",
  JWT_EXPIRATION: "7d",
  REDIS_URL: "redis://localhost:6379",
  REDIS_PASSWORD: "",
  ALLOWED_ORIGINS: "http://localhost:5173",
  IBGE_API_URL: "https://servicodados.ibge.gov.br/api/v1",
  SICONFI_API_URL: "https://api.siconfi.tesouro.gov.br/v1",
  DATASUS_API_URL: "https://datasus.saude.gov.br",
  INPE_API_URL: "https://terrabrasilis.dpi.inpe.br/api/v1",
  PNCP_API_URL: "https://pncp.gov.br/api/pncp/v1",
  AGENT_TIMEOUT: "30000",
  AGENT_RETRY_COUNT: "3",
  AGENT_RETRY_DELAY: "1000",
  LOG_LEVEL: "info",
};

// Variáveis de ambiente válidas para produção
const validProdEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  PORT: "8080",
  DATABASE_URL: "postgresql://user:pass@db.example.com:5432/ioc_esg",
  JWT_SECRET: "supersecretkey-that-is-long-enough-for-production",
  JWT_EXPIRATION: "1d",
  REDIS_URL: "redis://redis.example.com:6379",
  REDIS_PASSWORD: "redisSecurePass123",
  ALLOWED_ORIGINS: "https://app.example.com,https://admin.example.com",
  IBGE_API_URL: "https://servicodados.ibge.gov.br/api/v1",
  SICONFI_API_URL: "https://api.siconfi.tesouro.gov.br/v1",
  DATASUS_API_URL: "https://datasus.saude.gov.br",
  INPE_API_URL: "https://terrabrasilis.dpi.inpe.br/api/v1",
  PNCP_API_URL: "https://pncp.gov.br/api/pncp/v1",
  AGENT_TIMEOUT: "30000",
  AGENT_RETRY_COUNT: "3",
  AGENT_RETRY_DELAY: "1000",
  LOG_LEVEL: "info",
};

describe("validateEnv", () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Captura process.exit para evitar que o processo de teste encerre
    mockProcessExit = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: string | number | null | undefined) => {
        throw new Error(`process.exit(${_code}) called`);
      });
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
  });

  // ── Desenvolvimento ─────────────────────────────────────────────────────────

  it("ambiente de desenvolvimento válido passa sem erros", () => {
    const result = validateEnv(validDevEnv);

    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(3000);
    expect(result.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5432/ioc_esg_municipal",
    );
    expect(result.REDIS_URL).toBe("redis://localhost:6379");
  });

  it("em desenvolvimento usa defaults quando variáveis ausentes", () => {
    // Apenas NODE_ENV definido — o resto deve assumir defaults
    const result = validateEnv({ NODE_ENV: "development" });

    expect(result.PORT).toBe(3000);
    expect(result.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5432/ioc_esg_municipal",
    );
    expect(result.REDIS_URL).toBe("redis://localhost:6379");
    expect(result.JWT_EXPIRATION).toBe("1d");
  });

  it("em desenvolvimento não emite warning de localhost em ALLOWED_ORIGINS", () => {
    validateEnv({ ...validDevEnv, ALLOWED_ORIGINS: "http://localhost:5173" });

    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("localhost em produção"),
      expect.anything(),
    );
  });

  // ── Produção ─────────────────────────────────────────────────────────────────

  it("ambiente de produção válido passa sem erros", () => {
    const result = validateEnv(validProdEnv);

    expect(result.NODE_ENV).toBe("production");
    expect(result.PORT).toBe(8080);
    expect(result.JWT_SECRET).toBe("supersecretkey-that-is-long-enough-for-production");
  });

  it("JWT_SECRET ausente em produção causa process.exit(1)", () => {
    const envSemJwt = { ...validProdEnv };
    delete envSemJwt["JWT_SECRET"];

    expect(() => validateEnv(envSemJwt)).toThrow("process.exit(1)");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("JWT_SECRET com placeholder 'troque' em produção causa process.exit(1)", () => {
    const envComPlaceholder = {
      ...validProdEnv,
      JWT_SECRET: "troque-por-chave-segura-em-producao",
    };

    expect(() => validateEnv(envComPlaceholder)).toThrow("process.exit(1)");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("JWT_SECRET com 'dev-secret' em produção causa process.exit(1)", () => {
    const envComDevSecret = {
      ...validProdEnv,
      JWT_SECRET: "dev-secret-change-in-production-min-32-chars",
    };

    expect(() => validateEnv(envComDevSecret)).toThrow("process.exit(1)");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("JWT_SECRET com 'change-in-production' em produção causa process.exit(1)", () => {
    const envComChangeInProduction = {
      ...validProdEnv,
      JWT_SECRET: "my-change-in-production-secret-that-is-long-enough",
    };

    expect(() => validateEnv(envComChangeInProduction)).toThrow("process.exit(1)");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("ALLOWED_ORIGINS com localhost em produção emite warning mas não bloqueia", () => {
    const envComLocalhost = {
      ...validProdEnv,
      ALLOWED_ORIGINS: "http://localhost:5173",
    };

    const result = validateEnv(envComLocalhost);
    expect(result.ALLOWED_ORIGINS).toBe("http://localhost:5173");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("localhost"),
      expect.objectContaining({ ALLOWED_ORIGINS: "http://localhost:5173" }),
    );
  });

  it("REDIS_PASSWORD ausente em produção causa process.exit(1)", () => {
    const envSemRedisPassword = { ...validProdEnv };
    delete envSemRedisPassword["REDIS_PASSWORD"];

    expect(() => validateEnv(envSemRedisPassword)).toThrow("process.exit(1)");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("REDIS_PASSWORD vazio em produção causa process.exit(1)", () => {
    const envRedisPasswordVazio = { ...validProdEnv, REDIS_PASSWORD: "" };

    expect(() => validateEnv(envRedisPasswordVazio)).toThrow("process.exit(1)");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("REDIS_PASSWORD com menos de 8 caracteres em produção causa process.exit(1)", () => {
    const envRedisPasswordCurto = { ...validProdEnv, REDIS_PASSWORD: "abc123" };

    expect(() => validateEnv(envRedisPasswordCurto)).toThrow("process.exit(1)");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("REDIS_PASSWORD com exatamente 8 caracteres em produção passa", () => {
    const result = validateEnv({ ...validProdEnv, REDIS_PASSWORD: "abc12345" });

    expect(result.REDIS_PASSWORD).toBe("abc12345");
  });

  it("em desenvolvimento REDIS_PASSWORD vazio é aceito sem warning extra", () => {
    const result = validateEnv({ ...validDevEnv, REDIS_PASSWORD: "" });

    expect(result.REDIS_PASSWORD).toBe("");
  });

  // ── PORT ─────────────────────────────────────────────────────────────────────

  it("PORT inválida (string não-numérica) emite warning e usa default em desenvolvimento", () => {
    const envPortInvalida = { ...validDevEnv, PORT: "abc" };

    const result = validateEnv(envPortInvalida);

    expect(logger.warn).toHaveBeenCalled();
    // Resultado usa o default 3000 via fallback
    expect(result.PORT).toBe(3000);
  });

  it("PORT abaixo do mínimo (0) emite warning em desenvolvimento", () => {
    const envPortZero = { ...validDevEnv, PORT: "0" };

    validateEnv(envPortZero);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("PORT acima do máximo (65536) emite warning em desenvolvimento", () => {
    const envPortAlta = { ...validDevEnv, PORT: "65536" };

    validateEnv(envPortAlta);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("PORT válida no limite superior (65535) passa", () => {
    const result = validateEnv({ ...validDevEnv, PORT: "65535" });
    expect(result.PORT).toBe(65535);
  });

  it("PORT válida no limite inferior (1) passa", () => {
    const result = validateEnv({ ...validDevEnv, PORT: "1" });
    expect(result.PORT).toBe(1);
  });

  // ── DATABASE_URL ──────────────────────────────────────────────────────────────

  it("DATABASE_URL sem prefixo postgresql:// emite warning em desenvolvimento", () => {
    const envDbInvalida = { ...validDevEnv, DATABASE_URL: "mysql://localhost/db" };

    validateEnv(envDbInvalida);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("DATABASE_URL sem prefixo postgresql:// em produção causa process.exit(1)", () => {
    const envDbInvalida = { ...validProdEnv, DATABASE_URL: "mysql://db.example.com/db" };

    expect(() => validateEnv(envDbInvalida)).toThrow("process.exit(1)");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });
});
