/**
 * Helpers de autenticação para testes E2E.
 *
 * Pré-requisito de execução:
 *  - Backend rodando em http://localhost:3000
 *  - Banco de dados com migrations aplicadas (`pnpm db:migrate`)
 *
 * A estratégia de autenticação injeta o JWT diretamente em localStorage
 * para evitar repetir o fluxo de login em todos os testes que precisam
 * de uma sessão autenticada.
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
    throw new Error(
      `Falha ao criar usuário de teste (${res.status}): ${body}`,
    );
  }
}

/**
 * Obtém JWT via API de login e injeta em localStorage para que a aplicação
 * React reconheça o usuário como autenticado sem passar pelo fluxo visual.
 *
 * Chame esta função em `test.beforeEach` nos specs que requerem sessão.
 */
export async function loginViaApi(page: Page): Promise<void> {
  const res = await page.request.post(
    `${BACKEND_URL}/api/auth/login`,
    {
      data: { email: TEST_USER.email, password: TEST_USER.password },
    },
  );

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Login via API falhou (${res.status()}): ${body}`);
  }

  const { token } = (await res.json()) as { token: string };

  // Navega para uma página qualquer para inicializar o contexto de origem
  await page.goto("/login");

  // Injeta o token no localStorage — mesma chave usada por lib/api.ts
  await page.evaluate((jwt: string) => {
    localStorage.setItem("ioc_esg_token", jwt);
  }, token);
}
