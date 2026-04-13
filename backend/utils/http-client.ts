import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { logger } from "./logger.js";
import { outboundApiDuration, resolveSource } from "./metrics.js";

interface FetchOptions {
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 3;

/**
 * HTTP GET com retry e backoff exponencial (1s, 2s, 4s).
 * Segue o padrão obrigatório do CLAUDE.md para chamadas a APIs governamentais.
 */
export async function fetchWithRetry<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, maxRetries = DEFAULT_RETRIES, headers } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    try {
      const config: AxiosRequestConfig = {
        timeout: timeoutMs,
        headers,
      };

      const response: AxiosResponse<T> = await axios.get(url, config);
      outboundApiDuration.observe(
        { source: resolveSource(url), success: "true" },
        Date.now() - start,
      );
      return response.data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      outboundApiDuration.observe(
        { source: resolveSource(url), success: "false" },
        Date.now() - start,
      );

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        logger.warn(
          `HTTP attempt ${attempt}/${maxRetries} failed for ${url}, retrying in ${delayMs}ms`,
          { error: lastError.message },
        );
        await sleep(delayMs);
      }
    }
  }

  logger.error(`HTTP failed after ${maxRetries} attempts: ${url}`, {
    error: lastError?.message,
  });
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
