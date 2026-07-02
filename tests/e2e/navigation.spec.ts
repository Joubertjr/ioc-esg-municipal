/**
 * Testes E2E — Navegação entre páginas
 *
 * Pré-requisitos:
 *  - PostgreSQL rodando (pnpm docker:up)
 *  - Migrations aplicadas (pnpm db:migrate)
 *  - Usuário de teste criado (pnpm db:seed ou auth.spec.ts rodado antes)
 *  - Backend em http://localhost:3000
 *  - Frontend em http://localhost:5173
 *
 * Estratégia: injeta JWT via localStorage antes de cada teste para não
 * repetir o fluxo visual de login — isso é responsabilidade de auth.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { ensureTestUser, loginViaApi, DEFAULT_IBGE_CODE } from "./helpers/auth";

test.describe("Navegação", () => {
  test.beforeAll(async () => {
    await ensureTestUser();
  });

  test.beforeEach(async ({ page }) => {
    // Sessão autenticada sem passar pelo formulário de login
    await loginViaApi(page);
  });

  // ---------------------------------------------------------------------------
  // Rotas protegidas
  // ---------------------------------------------------------------------------

  test("deve_carregar_pagina_dashboard_na_rota_barra_dashboard", async ({ page }) => {
    // Arrange — já autenticado via beforeEach

    // Act
    await page.goto("/dashboard");

    // Assert
    await expect(page).toHaveURL(/\/dashboard/);
    // Header sempre presente em páginas protegidas
    await expect(page.getByText("IOC ESG Municipal", { exact: false })).toBeVisible();
  });

  test("deve_carregar_pagina_simulador_na_rota_barra_simulator", async ({ page }) => {
    // Arrange — já autenticado via beforeEach

    // Act
    await page.goto("/simulator");

    // Assert
    await expect(page).toHaveURL(/\/simulator/);
    await expect(page.getByRole("heading", { name: "Simulador de Investimentos" })).toBeVisible();
  });

  test("deve_redirecionar_rota_desconhecida_para_dashboard_quando_autenticado", async ({
    page,
  }) => {
    // Arrange — já autenticado via beforeEach

    // Act
    await page.goto("/rota-que-nao-existe");

    // Assert — catch-all em App.tsx redireciona para /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  // ---------------------------------------------------------------------------
  // Links de navegação no header (AppShell)
  // ---------------------------------------------------------------------------

  test("deve_navegar_para_simulador_ao_clicar_no_link_simulador_do_header", async ({ page }) => {
    // Arrange
    await page.goto("/dashboard");

    // Act
    await page.getByRole("link", { name: "Simulador" }).click();

    // Assert
    await expect(page).toHaveURL(/\/simulator/);
    await expect(page.getByRole("heading", { name: "Simulador de Investimentos" })).toBeVisible();
  });

  test("deve_navegar_para_dashboard_ao_clicar_no_link_painel_ods_do_header", async ({ page }) => {
    // Arrange
    await page.goto("/simulator");

    // Act
    await page.getByRole("link", { name: "Painel ODS" }).click();

    // Assert
    await expect(page).toHaveURL(/\/dashboard/);
  });

  // ---------------------------------------------------------------------------
  // Seletor de município no header
  // ---------------------------------------------------------------------------

  test("deve_exibir_nome_do_municipio_padrao_no_combobox_do_header", async ({ page }) => {
    // Arrange
    await page.goto("/dashboard");

    // Assert — Florianópolis é o município padrão (DEFAULT_IBGE_CODE = 4205407)
    // O combobox exibe o nome quando não está aberto
    const combobox = page.locator('input[placeholder="Buscar município..."]');
    await expect(combobox).toHaveValue("Florianópolis", { timeout: 5_000 });
  });

  test("deve_filtrar_municipios_ao_digitar_no_combobox_do_header", async ({ page }) => {
    // Arrange
    await page.goto("/dashboard");
    const combobox = page.locator('input[placeholder="Buscar município..."]');

    // Act
    await combobox.focus();
    await combobox.fill("Blumenau");

    // Assert — dropdown deve exibir Blumenau
    await expect(page.getByText("Blumenau", { exact: false }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("deve_trocar_municipio_ao_selecionar_opcao_no_combobox", async ({ page }) => {
    // Arrange
    await page.goto("/dashboard");
    const combobox = page.locator('input[placeholder="Buscar município..."]');

    // Act
    await combobox.focus();
    await combobox.fill("Joinville");
    await page
      .getByRole("button", { name: /Joinville/i })
      .first()
      .click();

    // Assert — combobox fecha e exibe o novo município
    await expect(combobox).toHaveValue(/Joinville/i, { timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // Logout a partir de páginas internas
  // ---------------------------------------------------------------------------

  test("deve_fazer_logout_e_redirecionar_para_login_a_partir_do_dashboard", async ({ page }) => {
    // Arrange
    await page.goto("/dashboard");

    // Act
    await page.getByRole("button", { name: "Sair" }).click();

    // Assert
    await expect(page).toHaveURL(/\/login/);
  });

  test("deve_fazer_logout_e_redirecionar_para_login_a_partir_do_simulador", async ({ page }) => {
    // Arrange
    await page.goto("/simulator");

    // Act
    await page.getByRole("button", { name: "Sair" }).click();

    // Assert
    await expect(page).toHaveURL(/\/login/);
  });

  test("deve_bloquear_acesso_ao_dashboard_apos_logout", async ({ page }) => {
    // Arrange
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);

    // Act — tenta acessar rota protegida sem token
    await page.goto("/dashboard");

    // Assert
    await expect(page).toHaveURL(/\/login/);
  });
});
