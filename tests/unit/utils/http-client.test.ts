import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";

vi.mock("axios");
vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { fetchWithRetry } from "../../../backend/utils/http-client.js";

const mockedAxiosGet = vi.mocked(axios.get);

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deve_retornar_dados_na_primeira_tentativa_em_sucesso", async () => {
    // Arrange
    const dadosEsperados = { municipio: "Florianopolis", populacao: 508826 };
    mockedAxiosGet.mockResolvedValueOnce({ data: dadosEsperados });

    // Act
    const resultado = await fetchWithRetry<typeof dadosEsperados>(
      "https://api.ibge.gov.br/municipio/4205407",
    );

    // Assert
    expect(resultado).toEqual(dadosEsperados);
    expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
  });

  it("deve_fazer_retry_3_vezes_antes_de_lancar_erro", async () => {
    // Arrange — factory cria o erro no momento da chamada, evitando unhandled rejection precoce
    mockedAxiosGet.mockImplementation(() => Promise.reject(new Error("ECONNREFUSED")));

    // Act — atribui handler antes de avancar timers para capturar a rejeicao
    const promessa = fetchWithRetry("https://api.datasus.gov.br/previne", {
      maxRetries: 3,
    });
    const assertPromessa = expect(promessa).rejects.toThrow("ECONNREFUSED");

    // Avanca o tempo para os dois backoffs intermediarios (1s e 2s)
    await vi.runAllTimersAsync();

    // Assert
    await assertPromessa;
    expect(mockedAxiosGet).toHaveBeenCalledTimes(3);
  });

  it("deve_aplicar_backoff_exponencial", async () => {
    // Arrange — factory para evitar unhandled rejection precoce
    mockedAxiosGet.mockImplementation(() => Promise.reject(new Error("timeout")));

    const chamadosSetTimeout: number[] = [];
    const setTimeoutOriginal = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, ms, ...args) => {
      if (ms !== undefined) chamadosSetTimeout.push(ms as number);
      return setTimeoutOriginal(fn as () => void, 0, ...args);
    });

    // Act — registra handler antes de avancar timers
    const promessa = fetchWithRetry("https://api.siconfi.gov.br/rreo", {
      maxRetries: 3,
    });
    const assertPromessa = expect(promessa).rejects.toThrow("timeout");
    await vi.runAllTimersAsync();
    await assertPromessa;

    // Assert: backoffs devem ser 1000ms (2^0) e 2000ms (2^1)
    const backoffs = chamadosSetTimeout.filter((ms) => ms >= 1000);
    expect(backoffs).toEqual([1000, 2000]);
  });

  it("deve_propagar_ultimo_erro_apos_maxRetries", async () => {
    // Arrange — factories para evitar unhandled rejection precoce
    mockedAxiosGet
      .mockImplementationOnce(() => Promise.reject(new Error("erro tentativa 1")))
      .mockImplementationOnce(() => Promise.reject(new Error("erro tentativa 2")))
      .mockImplementationOnce(() => Promise.reject(new Error("erro tentativa 3 — ultimo")));

    // Act — registra handler antes de avancar timers
    const promessa = fetchWithRetry("https://api.ibge.gov.br/falha", {
      maxRetries: 3,
    });
    const assertPromessa = expect(promessa).rejects.toThrow("erro tentativa 3 — ultimo");
    await vi.runAllTimersAsync();

    // Assert: deve propagar o erro da ultima tentativa
    await assertPromessa;
  });

  it("deve_usar_timeout_customizado", async () => {
    // Arrange
    const dadosEsperados = { ibge: "4204202" };
    mockedAxiosGet.mockResolvedValueOnce({ data: dadosEsperados });

    // Act
    await fetchWithRetry("https://api.ibge.gov.br/municipio/4204202", {
      timeoutMs: 30_000,
    });

    // Assert: o timeout customizado deve ser passado ao axios
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      "https://api.ibge.gov.br/municipio/4204202",
      expect.objectContaining({ timeout: 30_000 }),
    );
  });

  it("deve_usar_default_timeout_15s", async () => {
    // Arrange
    const dadosEsperados = { status: "ok" };
    mockedAxiosGet.mockResolvedValueOnce({ data: dadosEsperados });

    // Act — sem passar timeoutMs, deve usar o default de 15s
    await fetchWithRetry("https://api.ibge.gov.br/status");

    // Assert
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      "https://api.ibge.gov.br/status",
      expect.objectContaining({ timeout: 15_000 }),
    );
  });
});
