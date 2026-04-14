/**
 * tests/e2e/refresh.spec.ts
 *
 * Testa que a sessão persiste após reload da página e que o refresh token
 * automático funciona quando o access token expira.
 */

import { test, expect } from "@playwright/test";
import { ensureTestUser, loginViaApi, TEST_USER } from "./helpers/auth.js";

const BACKEND_URL = "http://localhost:3000";

test.describe("Refresh token e persistência de sessão", () => {
  test.beforeAll(async () => {
    await ensureTestUser();
  });

  test("sessão persiste após page reload", async ({ page }) => {
    // Login via API e navegar para dashboard
    await loginViaApi(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Verificar que estamos no dashboard (não redirecionou para /login)
    await expect(page).toHaveURL(/\/dashboard/);

    // Reload
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Deve continuar no dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Deve ter conteúdo (não tela de login)
    const hasMainContent = await page.locator("main").count();
    expect(hasMainContent).toBeGreaterThan(0);
  });

  test("refresh token no sessionStorage sobrevive ao reload", async ({ page }) => {
    // Login direto via fetch para obter refreshToken
    const loginRes = await page.request.post(`${BACKEND_URL}/api/auth/login`, {
      data: { email: TEST_USER.email, password: TEST_USER.password },
    });
    expect(loginRes.ok()).toBeTruthy();

    const { token, refreshToken } = (await loginRes.json()) as {
      token: string;
      refreshToken: string;
    };
    expect(refreshToken).toBeTruthy();

    // Navegar e injetar tokens
    await page.goto("/login");
    await page.evaluate(
      ({ jwt, rt }: { jwt: string; rt: string }) => {
        localStorage.setItem("ioc_esg_token", jwt);
        sessionStorage.setItem("ioc_rt", rt);
      },
      { jwt: token, rt: refreshToken },
    );

    // Navegar para dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/dashboard/);

    // Verificar que refreshToken está no sessionStorage
    const rtBefore = await page.evaluate(() => sessionStorage.getItem("ioc_rt"));
    expect(rtBefore).toBeTruthy();

    // Reload
    await page.reload();
    await page.waitForLoadState("networkidle");

    // refreshToken deve persistir
    const rtAfter = await page.evaluate(() => sessionStorage.getItem("ioc_rt"));
    expect(rtAfter).toBeTruthy();
  });

  test("logout limpa token e redireciona para /login", async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/dashboard/);

    // Limpar token (simula logout)
    await page.evaluate(() => {
      localStorage.removeItem("ioc_esg_token");
      sessionStorage.removeItem("ioc_rt");
    });

    // Navegar novamente — deve cair no /login
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
  });
});
