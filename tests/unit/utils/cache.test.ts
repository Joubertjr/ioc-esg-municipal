import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do modulo redis completo — simula o cliente retornado por createClient
const mockRedisClient = {
  isReady: true,
  get: vi.fn(),
  setEx: vi.fn(),
  connect: vi.fn(),
  on: vi.fn(),
};

vi.mock("redis", () => ({
  createClient: vi.fn(() => mockRedisClient),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Importar apos mocks para garantir que o modulo usa os mocks
import { withCache, buildRedisUrl } from "../../../backend/utils/cache.js";

describe("buildRedisUrl", () => {
  it("retorna URL original quando password esta vazio", () => {
    expect(buildRedisUrl("redis://localhost:6379", "")).toBe("redis://localhost:6379");
  });

  it("injeta password na URL quando nao ha credenciais presentes", () => {
    const result = buildRedisUrl("redis://redis.example.com:6379", "minhaSenha");
    expect(result).toBe("redis://:minhaSenha@redis.example.com:6379");
  });

  it("nao substitui credenciais se URL ja contem @", () => {
    const urlComCredenciais = "redis://:senhaExistente@redis.example.com:6379";
    expect(buildRedisUrl(urlComCredenciais, "outraSenha")).toBe(urlComCredenciais);
  });

  it("funciona com schema rediss (TLS)", () => {
    const result = buildRedisUrl("rediss://redis.example.com:6380", "senhaSegura");
    expect(result).toBe("rediss://:senhaSegura@redis.example.com:6380");
  });

  it("codifica caracteres especiais na password via encodeURIComponent", () => {
    const result = buildRedisUrl("redis://localhost:6379", "senha@especial!");
    expect(result).toBe("redis://:senha%40especial!@localhost:6379");
  });
});

describe("withCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Por padrao o cliente esta pronto
    mockRedisClient.isReady = true;
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.setEx.mockResolvedValue("OK");
  });

  it("deve_retornar_valor_cacheado_sem_chamar_fn", async () => {
    // Arrange
    const valorCacheado = { ibgeCode: "4204202", populacao: 508826 };
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(valorCacheado));
    const fn = vi.fn();

    // Act
    const resultado = await withCache("ibge:4204202", 86400, fn);

    // Assert
    expect(resultado).toEqual(valorCacheado);
    expect(fn).not.toHaveBeenCalled();
  });

  it("deve_armazenar_resultado_no_redis_com_ttl", async () => {
    // Arrange
    const dadosFrescos = { fpm: 1_500_000.0 };
    mockRedisClient.get.mockResolvedValueOnce(null); // cache miss
    const fn = vi.fn().mockResolvedValueOnce(dadosFrescos);

    // Act
    const resultado = await withCache("siconfi:420420:fpm", 21600, fn);

    // Assert
    expect(resultado).toEqual(dadosFrescos);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockRedisClient.setEx).toHaveBeenCalledWith(
      "siconfi:420420:fpm",
      21600,
      JSON.stringify(dadosFrescos),
    );
  });

  it("deve_chamar_fn_quando_redis_indisponivel", async () => {
    // Arrange — simula Redis fora do ar na conexao
    mockRedisClient.isReady = false;
    mockRedisClient.connect.mockRejectedValueOnce(new Error("ECONNREFUSED — Redis offline"));
    const dadosFrescos = { ideb: 6.5 };
    const fn = vi.fn().mockResolvedValueOnce(dadosFrescos);

    // Act — nao deve lancar excecao, deve degradar graciosamente
    const resultado = await withCache("inep:4204202", 604800, fn);

    // Assert
    expect(resultado).toEqual(dadosFrescos);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("deve_chamar_fn_quando_redis_get_falha", async () => {
    // Arrange — conexao OK mas get lanca erro
    mockRedisClient.get.mockRejectedValueOnce(new Error("OOM command not allowed"));
    const dadosFrescos = { score: 72 };
    const fn = vi.fn().mockResolvedValueOnce(dadosFrescos);

    // Act — erro no get deve acionar degradacao gracosa
    const resultado = await withCache("ods:4204202:ods1", 3600, fn);

    // Assert
    expect(resultado).toEqual(dadosFrescos);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("deve_deserializar_json_do_cache_corretamente", async () => {
    // Arrange — JSON com tipos aninhados
    const objetoOriginal = {
      municipio: "Chapeco",
      indicadores: { agua: 98.5, esgoto: 87.3 },
      dataReferencia: "2023-12-31T00:00:00.000Z",
    };
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(objetoOriginal));
    const fn = vi.fn();

    // Act
    const resultado = await withCache("snis:4204202:2023", 86400, fn);

    // Assert — objeto deve ser identico ao original serializado/deserializado
    expect(resultado).toEqual(objetoOriginal);
    expect(fn).not.toHaveBeenCalled();
  });
});
