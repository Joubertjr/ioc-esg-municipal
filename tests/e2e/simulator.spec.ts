/**
 * Testes E2E — Página do Simulador de Investimentos
 *
 * Pré-requisitos:
 *  - PostgreSQL rodando com municípios seedados (pnpm db:seed)
 *  - Migrations aplicadas (pnpm db:migrate)
 *  - Backend em http://localhost:3000
 *  - Frontend em http://localhost:5173
 *  - Redis rodando (pnpm docker:up)
 *
 * A API POST /api/simulator/simulate requer dados ODS do município.
 * Em CI sem dados reais, os testes de simulação verificam o comportamento
 * de UI (validação de formulário, estados de loading, erros) usando
 * interceptação de rede quando necessário.
 */

import { test, expect } from "@playwright/test";
import { ensureTestUser, loginViaApi } from "./helpers/auth";

// ---------------------------------------------------------------------------
// Fixture: resposta mockada da API de simulação
// ---------------------------------------------------------------------------

const MOCK_SIMULATION_RESPONSE = {
  ibgeCode: "4205407",
  municipalityName: "Florianopolis",
  totalAmount: 1_000_000,
  currentGlobalScore: 58.3,
  projectedGlobalScore: 62.1,
  globalDelta: 3.8,
  ods: Array.from({ length: 17 }, (_, i) => ({
    odsNumber: i + 1,
    shortName: `ODS ${i + 1}`,
    color: "#E5243B",
    currentScore: 55 + i,
    projectedScore: 58 + i,
    delta: 3.0,
  })),
};

// ---------------------------------------------------------------------------
// Fixture: resposta mockada de municípios
// ---------------------------------------------------------------------------

const MOCK_MUNICIPALITIES = [
  { ibgeCode: "4205407", name: "Florianopolis" },
  { ibgeCode: "4209102", name: "Joinville" },
  { ibgeCode: "4202404", name: "Blumenau" },
];

test.describe("Simulador de Investimentos", () => {
  test.beforeAll(async () => {
    await ensureTestUser();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/simulator");
  });

  // ---------------------------------------------------------------------------
  // Estrutura do formulário
  // ---------------------------------------------------------------------------

  test("deve_exibir_titulo_simulador_de_investimentos", async ({ page }) => {
    // Assert
    await expect(
      page.getByRole("heading", { name: "Simulador de Investimentos" }),
    ).toBeVisible();
  });

  test("deve_exibir_secao_de_parametros_da_simulacao", async ({ page }) => {
    // Assert
    await expect(
      page.getByRole("heading", { name: "Parametros da simulacao" }),
    ).toBeVisible();
  });

  test("deve_exibir_campo_valor_total_a_investir", async ({ page }) => {
    // Assert
    await expect(page.getByLabel("Valor total a investir (R$)")).toBeVisible();
  });

  test("deve_exibir_secao_de_distribuicao_por_area", async ({ page }) => {
    // Assert
    await expect(
      page.getByRole("heading", { name: "Distribuicao por area (%)" }),
    ).toBeVisible();
  });

  test("deve_exibir_botao_simular_impacto", async ({ page }) => {
    // Assert
    await expect(
      page.getByRole("button", { name: "Simular impacto" }),
    ).toBeVisible();
  });

  test("deve_exibir_sliders_de_alocacao_para_cada_area_de_investimento", async ({
    page,
  }) => {
    // Assert — pelo menos um slider de range presente
    const sliders = page.locator('input[type="range"]');
    await expect(sliders.first()).toBeVisible();
    const count = await sliders.count();
    expect(count).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Validação do formulário
  // ---------------------------------------------------------------------------

  test("deve_exibir_total_100_porcento_quando_alocacao_padrao_esta_correta", async ({
    page,
  }) => {
    // Assert — alocação padrão (buildDefaultAllocation) soma exatamente 100%
    await expect(page.getByText("Total: 100%")).toBeVisible();
  });

  test("deve_exibir_alerta_quando_soma_das_alocacoes_nao_e_100_porcento", async ({
    page,
  }) => {
    // Arrange — altera o primeiro slider para 0% (quebra o total)
    const firstSlider = page.locator('input[type="range"]').first();
    await firstSlider.fill("0");

    // Assert — mensagem de validação aparece
    await expect(
      page.getByText("A soma das porcentagens deve ser exatamente 100%."),
    ).toBeVisible();
  });

  test("deve_desabilitar_botao_simular_quando_soma_nao_e_100_porcento", async ({
    page,
  }) => {
    // Arrange — quebra o total
    const firstSlider = page.locator('input[type="range"]').first();
    await firstSlider.fill("0");

    // Assert
    await expect(
      page.getByRole("button", { name: "Simular impacto" }),
    ).toBeDisabled();
  });

  test("deve_desabilitar_botao_simular_quando_valor_total_e_zero", async ({
    page,
  }) => {
    // Arrange — apaga o valor do campo de investimento
    const amountInput = page.getByLabel("Valor total a investir (R$)");
    await amountInput.clear();
    await amountInput.fill("0");

    // Assert
    await expect(
      page.getByRole("button", { name: "Simular impacto" }),
    ).toBeDisabled();
  });

  test("deve_formatar_valor_em_reais_abaixo_do_campo_de_investimento", async ({
    page,
  }) => {
    // Arrange
    const amountInput = page.getByLabel("Valor total a investir (R$)");
    await amountInput.clear();
    await amountInput.fill("5000000");

    // Assert — formato brasileiro exibido
    await expect(page.getByText(/R\$\s*5\.000\.000/)).toBeVisible();
  });

  test("deve_ignorar_caracteres_nao_numericos_no_campo_de_investimento", async ({
    page,
  }) => {
    // Arrange
    const amountInput = page.getByLabel("Valor total a investir (R$)");
    await amountInput.clear();
    await amountInput.fill("abc123xyz");

    // Assert — apenas dígitos permanecem
    const value = await amountInput.inputValue();
    expect(value).toMatch(/^\d*$/);
  });

  // ---------------------------------------------------------------------------
  // Simulação com mock de API
  // ---------------------------------------------------------------------------

  test("deve_exibir_resultado_da_simulacao_apos_resposta_bem_sucedida", async ({
    page,
  }) => {
    // Arrange — intercepta POST /api/simulator/simulate
    await page.route("**/api/simulator/simulate", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SIMULATION_RESPONSE),
      }),
    );

    // Act
    await page.getByRole("button", { name: "Simular impacto" }).click();

    // Assert — resultado exibido
    await expect(
      page.getByText("Resultado da simulacao", { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("deve_exibir_score_atual_e_projetado_no_resultado_da_simulacao", async ({
    page,
  }) => {
    // Arrange
    await page.route("**/api/simulator/simulate", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SIMULATION_RESPONSE),
      }),
    );

    // Act
    await page.getByRole("button", { name: "Simular impacto" }).click();

    // Assert — labels dos scores
    await expect(page.getByText("Score atual", { exact: false })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText("Score projetado", { exact: false }),
    ).toBeVisible();
  });

  test("deve_exibir_nome_do_municipio_no_resultado_da_simulacao", async ({
    page,
  }) => {
    // Arrange
    await page.route("**/api/simulator/simulate", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SIMULATION_RESPONSE),
      }),
    );

    // Act
    await page.getByRole("button", { name: "Simular impacto" }).click();

    // Assert
    await expect(
      page.getByText("Florianopolis", { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("deve_exibir_grid_de_resultados_por_ods_apos_simulacao", async ({
    page,
  }) => {
    // Arrange
    await page.route("**/api/simulator/simulate", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SIMULATION_RESPONSE),
      }),
    );

    // Act
    await page.getByRole("button", { name: "Simular impacto" }).click();

    // Assert — seção de ODS individuais
    await expect(
      page.getByText(
        "Impacto por Objetivo de Desenvolvimento Sustentavel",
        { exact: false },
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("deve_exibir_valor_investido_no_resultado_da_simulacao", async ({
    page,
  }) => {
    // Arrange
    await page.route("**/api/simulator/simulate", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SIMULATION_RESPONSE),
      }),
    );

    // Act
    await page.getByRole("button", { name: "Simular impacto" }).click();

    // Assert — "Investimento simulado: R$ 1.000.000"
    await expect(
      page.getByText(/Investimento simulado/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // Erro da API de simulação
  // ---------------------------------------------------------------------------

  test("deve_exibir_mensagem_de_erro_quando_api_simulacao_retorna_500", async ({
    page,
  }) => {
    // Arrange
    await page.route("**/api/simulator/simulate", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Erro interno ao simular" }),
      }),
    );

    // Act
    await page.getByRole("button", { name: "Simular impacto" }).click();

    // Assert
    await expect(
      page.locator(".text-red-700, .border-red-200").first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("deve_exibir_estado_simulando_no_botao_durante_requisicao", async ({
    page,
  }) => {
    // Arrange — delay na resposta para capturar o estado transitório
    await page.route("**/api/simulator/simulate", async (route) => {
      await page.waitForTimeout(1_500);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SIMULATION_RESPONSE),
      });
    });

    // Act
    await page.getByRole("button", { name: "Simular impacto" }).click();

    // Assert — texto "Simulando..." aparece enquanto aguarda
    await expect(
      page.getByRole("button", { name: "Simulando..." }),
    ).toBeVisible({ timeout: 3_000 });
  });

  // ---------------------------------------------------------------------------
  // Seletor de município no simulador (quando lista carrega)
  // ---------------------------------------------------------------------------

  test("deve_exibir_select_de_municipio_quando_lista_carrega", async ({
    page,
  }) => {
    // Arrange — intercepta GET /api/municipalities
    await page.route("**/api/municipalities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_MUNICIPALITIES),
      }),
    );

    // Act
    await page.goto("/simulator");

    // Assert — select element aparece com opções
    const select = page.getByLabel("Municipio");
    await expect(select).toBeVisible({ timeout: 5_000 });
  });

  test("deve_exibir_mensagem_alternativa_quando_lista_de_municipios_esta_vazia", async ({
    page,
  }) => {
    // Arrange — retorna lista vazia
    await page.route("**/api/municipalities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );

    // Act
    await page.goto("/simulator");

    // Assert — mensagem de fallback renderizada
    await expect(
      page.getByText("Usando o seletor do cabecalho acima."),
    ).toBeVisible({ timeout: 5_000 });
  });
});
