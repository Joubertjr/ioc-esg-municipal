/**
 * Helpers de autenticação para testes E2E.
 *
 * Pré-requisito de execução:
 *  - Backend rodando em http://localhost:3000
 *  - Banco de dados com migrations aplicadas (`pnpm db:migrate`)
 *
 * Estratégia de autenticação:
 *  - O backend usa httpOnly cookies para o access token (Set-Cookie header).
 *  - O refresh token é armazenado em sessionStorage sob a chave "ioc_rt".
 *  - `page.request.post` ao /api/auth/login recebe o Set-Cookie e o Playwright
 *    armazena o cookie automaticamente no contexto do navegador.
 *  - Após o login, injetamos o refreshToken em sessionStorage para que o
 *    mecanismo de refresh automático do frontend funcione.
 */

import { type Page } from "@playwright/test";

/** Credenciais do usuário de teste. Devem existir no banco antes dos testes. */
export const TEST_USER = {
  name: "Prefeito Teste",
  email: "prefeito.teste@municipio.sc.gov.br",
  password: "Teste@12345",
} as const;

/** Código IBGE de Florianópolis — usado como município padrão nos testes. */
export const DEFAULT_IBGE_CODE = "4205407";

/** Chave do refresh token em sessionStorage — deve coincidir com frontend/src/lib/api.ts */
export const RT_KEY = "ioc_rt";

const BACKEND_URL = "http://localhost:3000";

/**
 * Aguarda o backend estar saudável antes de prosseguir.
 * Útil em test.beforeAll quando o servidor acabou de iniciar.
 */
async function waitForBackend(maxAttempts = 15, delayMs = 2_000): Promise<void> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) return;
    } catch {
      // server not ready yet — fall through to sleep
    }
    if (i < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`Backend did not become healthy after ${maxAttempts} attempts`);
}

/**
 * Cria o usuário de teste via API de registro (bootstrap — sem auth necessária
 * para o primeiro usuário). Ignora 409 caso o usuário já exista.
 *
 * Aguarda automaticamente o backend iniciar antes de tentar o registro.
 */
export async function ensureTestUser(): Promise<void> {
  await waitForBackend();

  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: TEST_USER.name,
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    throw new Error(`Falha ao criar usuário de teste (${res.status}): ${body}`);
  }
}

/**
 * Autentica via API e configura o contexto do navegador.
 *
 * O `page.request.post` envia a requisição de login e o Playwright captura
 * automaticamente o cookie httpOnly retornado pelo backend (Set-Cookie).
 * Após isso, injetamos o refreshToken em sessionStorage para que o mecanismo
 * de refresh automático do frontend funcione corretamente.
 *
 * Chame esta função em `test.beforeEach` nos specs que requerem sessão.
 */
export async function loginViaApi(page: Page): Promise<void> {
  // Navega primeiro para inicializar o contexto de origem (necessário para cookies)
  await page.goto("/login");

  const res = await page.request.post(`${BACKEND_URL}/api/auth/login`, {
    data: { email: TEST_USER.email, password: TEST_USER.password },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Login via API falhou (${res.status()}): ${body}`);
  }

  const { refreshToken } = (await res.json()) as { token: string; refreshToken: string };

  // Injeta o refresh token em sessionStorage — mesma chave usada por lib/api.ts
  await page.evaluate((rt: string) => {
    sessionStorage.setItem("ioc_rt", rt);
  }, refreshToken);
}
