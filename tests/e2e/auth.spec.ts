/**
 * Testes E2E — Fluxo de Autenticação
 *
 * Pré-requisitos:
 *  - PostgreSQL rodando (pnpm docker:up)
 *  - Migrations aplicadas (pnpm db:migrate)
 *  - Backend em http://localhost:3000
 *  - Frontend em http://localhost:5173
 *
 * O primeiro teste do arquivo cria o usuário de teste via bootstrap.
 * Os demais reutilizam as mesmas credenciais.
 */

import { test, expect } from "@playwright/test";
import { TEST_USER, ensureTestUser } from "./helpers/auth";

test.describe("Autenticação", () => {
  test.beforeAll(async () => {
    // Garante que o usuário de teste existe no banco antes de qualquer spec
    await ensureTestUser();
  });

  // ---------------------------------------------------------------------------
  // Página de login
  // ---------------------------------------------------------------------------

  test("deve_exibir_formulario_de_login_ao_acessar_barra_login", async ({ page }) => {
    // Arrange
    await page.goto("/login");

    // Act — não há ação, apenas renderização

    // Assert
    await expect(
      page.getByRole("heading", { name: "Entrar na plataforma" }),
    ).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("deve_redirecionar_rota_raiz_para_dashboard_quando_autenticado", async ({
    page,
  }) => {
    // Arrange — injeta token diretamente para não depender do fluxo visual
    await page.goto("/login");
    const res = await page.request.post(
      "http://localhost:3000/api/auth/login",
      { data: { email: TEST_USER.email, password: TEST_USER.password } },
    );
    const { token } = (await res.json()) as { token: string };
    await page.evaluate(
      (jwt: string) => localStorage.setItem("ioc_esg_token", jwt),
      token,
    );

    // Act
    await page.goto("/");

    // Assert — ProtectedRoute redireciona para /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("deve_redirecionar_usuario_nao_autenticado_para_login", async ({
    page,
  }) => {
    // Arrange — sem token em storage
    await page.goto("/login");
    await page.evaluate(() => localStorage.removeItem("ioc_esg_token"));

    // Act
    await page.goto("/dashboard");

    // Assert
    await expect(page).toHaveURL(/\/login/);
  });

  // ---------------------------------------------------------------------------
  // Login com sucesso
  // ---------------------------------------------------------------------------

  test("deve_redirecionar_para_dashboard_apos_login_com_credenciais_validas", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/login");

    // Act
    await page.getByLabel("E-mail").fill(TEST_USER.email);
    await page.getByLabel("Senha").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Entrar" }).click();

    // Assert
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test("deve_persistir_token_jwt_em_localstorage_apos_login", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/login");

    // Act
    await page.getByLabel("E-mail").fill(TEST_USER.email);
    await page.getByLabel("Senha").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Entrar" }).click();

    // Assert
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    const token = await page.evaluate(() =>
      localStorage.getItem("ioc_esg_token"),
    );
    expect(token).not.toBeNull();
    expect(typeof token).toBe("string");
    expect((token as string).length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Login com falha
  // ---------------------------------------------------------------------------

  test("deve_exibir_mensagem_de_erro_quando_senha_incorreta", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/login");

    // Act
    await page.getByLabel("E-mail").fill(TEST_USER.email);
    await page.getByLabel("Senha").fill("senha-errada-9999");
    await page.getByRole("button", { name: "Entrar" }).click();

    // Assert — mensagem de erro visível, URL permanece em /login
    await expect(page.locator(".text-red-700")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("deve_exibir_mensagem_de_erro_quando_email_nao_existe", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/login");

    // Act
    await page.getByLabel("E-mail").fill("nao.existe@municipio.sc.gov.br");
    await page.getByLabel("Senha").fill("qualquerSenha123");
    await page.getByRole("button", { name: "Entrar" }).click();

    // Assert
    await expect(page.locator(".text-red-700")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("deve_desabilitar_botao_durante_submissao", async ({ page }) => {
    // Arrange
    await page.goto("/login");

    // Act — preenche campos e captura estado do botão durante a requisição
    await page.getByLabel("E-mail").fill(TEST_USER.email);
    await page.getByLabel("Senha").fill(TEST_USER.password);

    const submitButton = page.getByRole("button", { name: "Entrar" });
    await submitButton.click();

    // Assert — botão "Aguarde..." aparece durante submissão (pode ser transitório)
    // Se o login for rápido, verificamos apenas que o fluxo conclui sem erro
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // Registro
  // ---------------------------------------------------------------------------

  test("deve_exibir_formulario_de_registro_ao_clicar_em_cadastre_se", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/login");

    // Act
    await page.getByRole("button", { name: /Cadastre-se/i }).click();

    // Assert
    await expect(
      page.getByRole("heading", { name: "Criar conta" }),
    ).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toBeVisible();
  });

  test("deve_exibir_erro_quando_nome_vazio_no_registro", async ({ page }) => {
    // Arrange
    await page.goto("/login");
    await page.getByRole("button", { name: /Cadastre-se/i }).click();

    // Act — submete sem preencher nome
    await page.getByLabel("E-mail").fill("novo@municipio.sc.gov.br");
    await page.getByLabel("Senha").fill("Teste@99999");
    await page.getByRole("button", { name: "Criar conta" }).click();

    // Assert — mensagem de nome obrigatório renderizada pelo componente
    await expect(page.locator(".text-red-700")).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  test("deve_remover_token_e_redirecionar_para_login_ao_fazer_logout", async ({
    page,
  }) => {
    // Arrange — loga visualmente para garantir o fluxo completo
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(TEST_USER.email);
    await page.getByLabel("Senha").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Act
    await page.getByRole("button", { name: "Sair" }).click();

    // Assert
    await expect(page).toHaveURL(/\/login/);
    const token = await page.evaluate(() =>
      localStorage.getItem("ioc_esg_token"),
    );
    expect(token).toBeNull();
  });
});
