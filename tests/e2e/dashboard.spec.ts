/**
 * Testes E2E — Página de Dashboard (Painel ODS)
 *
 * Pré-requisitos:
 *  - PostgreSQL rodando com dados de municípios (pnpm db:seed)
 *  - Migrations aplicadas (pnpm db:migrate)
 *  - Backend em http://localhost:3000
 *  - Frontend em http://localhost:5173
 *  - Redis rodando — usado para cache dos scores ODS (pnpm docker:up)
 *
 * Nota sobre dados ODS:
 *  Os scores ODS dependem de dados reais das APIs governamentais (IBGE, SICONFI
 *  etc.). Em ambiente de CI sem acesso às APIs externas, alguns testes verificam
 *  apenas a estrutura da UI (skeletons, mensagens de erro, cards) sem validar
 *  valores numéricos específicos.
 */

import { test, expect } from "@playwright/test";
import { ensureTestUser, loginViaApi } from "./helpers/auth";

test.describe("Dashboard — Painel ODS", () => {
  test.beforeAll(async () => {
    await ensureTestUser();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/dashboard");
  });

  // ---------------------------------------------------------------------------
  // Estrutura da página
  // ---------------------------------------------------------------------------

  test("deve_exibir_header_com_navegacao_e_seletor_de_municipio", async ({ page }) => {
    // Assert
    await expect(page.getByText("IOC ESG Municipal", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Painel ODS" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Simulador" })).toBeVisible();
    await expect(page.locator('input[placeholder="Buscar município..."]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  });

  test("deve_exibir_grid_de_dimensoes_ods", async ({ page }) => {
    // Assert — o dashboard organiza os ODS por dimensão (Social, Econômico, etc.)
    // O CardTitle é um div, usar locator específico para o card de dimensão
    await expect(page.getByText("Social", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Ambiental", { exact: true }).first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Cards ODS — estado de carregamento
  // ---------------------------------------------------------------------------

  test("deve_exibir_skeleton_cards_enquanto_dados_carregam", async ({ page }) => {
    // Arrange — intercepta a requisição ODS para simular lentidão
    let shouldDelay = true;
    await page.route("**/api/ods/**", async (route) => {
      if (shouldDelay) {
        await new Promise((r) => setTimeout(r, 3_000));
      }
      await route.continue();
    });

    // Act
    await page.goto("/dashboard");

    // Assert — skeletons renderizados imediatamente (5 dimension cards)
    const skeletons = page.locator(".animate-pulse");
    await expect(skeletons.first()).toBeVisible({ timeout: 3_000 });

    // Cleanup
    shouldDelay = false;
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("deve_exibir_scores_ods_apos_carregamento_dos_dados", async ({ page }) => {
    // Assert — após carregamento, os ODS individuais aparecem como botões clicáveis
    // dentro dos cards de dimensão (Social, Econômico, Ambiental, etc.)
    const odsButton = page.getByRole("button", { name: /Pobreza/i });
    await expect(odsButton).toBeVisible({ timeout: 15_000 });
  });

  // ---------------------------------------------------------------------------
  // Score global
  // ---------------------------------------------------------------------------

  test("deve_exibir_area_de_score_global_no_dashboard", async ({ page }) => {
    // Assert — GlobalScore e CoverageSummary são renderizados na seção superior
    // O GlobalScore exibe um número ou skeleton; verificamos o contêiner
    const topSection = page.locator("section").first();
    await expect(topSection).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Erro de API
  // ---------------------------------------------------------------------------

  test("deve_exibir_banner_de_erro_quando_api_ods_retorna_500", async ({ page }) => {
    // Arrange — força erro 500 na API ODS
    await page.route("**/api/ods/**", (route) =>
      route.fulfill({ status: 500, body: '{"error":"Erro interno"}' }),
    );

    // Act
    await page.goto("/dashboard");

    // Assert — banner de erro com botão "Tentar novamente"
    await expect(page.getByText("Erro ao carregar dados ODS")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });

  test("deve_tentar_recarregar_dados_ao_clicar_em_tentar_novamente", async ({ page }) => {
    // Arrange — todas as requisições retornam erro inicialmente
    let shouldFail = true;
    await page.route("**/api/ods/**", (route) => {
      if (shouldFail) {
        route.fulfill({ status: 500, body: '{"error":"Erro interno"}' });
      } else {
        route.continue();
      }
    });

    await page.goto("/dashboard");
    await expect(page.getByText("Erro ao carregar dados ODS")).toBeVisible({
      timeout: 10_000,
    });

    // Act — libera requests e clica "Tentar novamente"
    shouldFail = false;
    await page.getByRole("button", { name: "Tentar novamente" }).click();

    // Assert — dados carregam após retry
    await expect(page.getByText("Erro ao carregar dados ODS")).not.toBeVisible({
      timeout: 15_000,
    });
  });

  // ---------------------------------------------------------------------------
  // Drawer de detalhe do ODS (requer dados reais)
  // ---------------------------------------------------------------------------

  test("deve_abrir_painel_de_detalhe_ao_clicar_em_ods", async ({ page }) => {
    // Arrange — aguarda os ODS carregarem nas dimensões
    const odsButton = page.getByRole("button", { name: /Pobreza/i });
    await expect(odsButton).toBeVisible({ timeout: 15_000 });

    // Act — clica no primeiro ODS disponível
    await odsButton.click();

    // Assert — painel de detalhe aparece (OdsDetailPanel)
    // O painel mostra detalhes do ODS selecionado
    await expect(page.getByText("ODS 1", { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // Radar chart
  // ---------------------------------------------------------------------------

  test("deve_renderizar_area_do_radar_chart_no_dashboard", async ({ page }) => {
    // Assert — DimensionRadarChart renderiza um SVG via Recharts
    // O radar fica ao lado do grid de dimensões (visível apenas em xl)
    // Verificamos que o contêiner do chart existe
    await expect(page.getByText("Visão por Dimensão")).toBeVisible({
      timeout: 15_000,
    });
  });
});
