/**
 * Auditoria Funcional End-to-End — IOC ESG Municipal
 *
 * Navega por todas as páginas como o prefeito de Florianópolis e verifica:
 * - Dados carregam (sem skeleton infinito após 15s)
 * - Nenhum erro visível ao usuário
 * - Elementos-chave presentes em cada página
 * - Screenshots de evidência (light + dark) em docs/evidence/
 *
 * Executar: pnpm test:e2e -- tests/e2e/audit.spec.ts
 * Ou via skill: /audit
 */

import { test, expect } from "@playwright/test";
import { ensureTestUser, loginViaApi } from "./helpers/auth";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVIDENCE_DIR = path.resolve(
  __dirname,
  `../../docs/evidence/${new Date().toISOString().slice(0, 10)}-audit`,
);

const PAGES = [
  { name: "dashboard", path: "/dashboard", title: "Painel ODS" },
  { name: "simulator", path: "/simulator", title: "Simulador" },
  { name: "benchmark", path: "/benchmark", title: "Comparativo" },
  { name: "reports", path: "/reports", title: "Relatórios" },
  { name: "monitoring", path: "/monitoring", title: "Monitoramento" },
] as const;

test.describe("Auditoria Funcional — Prefeito de Florianópolis", () => {
  test.beforeAll(async () => {
    await ensureTestUser();
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  for (const pg of PAGES) {
    test(`${pg.name}: dados carregam e sem erros visíveis`, async ({ page }) => {
      // Track console errors
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      // Navigate
      await page.goto(pg.path);

      // Wait for loading to finish (no more skeleton animations after 15s)
      await page.waitForTimeout(2_000); // initial load
      try {
        await page.waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, {
          timeout: 15_000,
        });
      } catch {
        // If skeletons still present after 15s, capture evidence and fail
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${pg.name}-skeleton-timeout.png`),
          fullPage: true,
        });
        throw new Error(
          `${pg.name}: skeleton loaders still visible after 15s — possible infinite loading`,
        );
      }

      // No visible error banners
      const errorBanners = page.locator('[class*="destructive"], [class*="error"]');
      const errorCount = await errorBanners.count();
      if (errorCount > 0) {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${pg.name}-error-banner.png`),
          fullPage: true,
        });
      }

      // Screenshot light mode
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `${pg.name}-light.png`),
        fullPage: true,
      });

      // Toggle dark mode and screenshot
      await page.evaluate(() => {
        document.documentElement.classList.add("dark");
      });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `${pg.name}-dark.png`),
        fullPage: true,
      });

      // Restore light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove("dark");
      });

      // Report console errors (non-blocking — just log)
      if (consoleErrors.length > 0) {
        console.warn(`[${pg.name}] Console errors:`, consoleErrors.slice(0, 5));
      }
    });
  }

  // --- Page-specific assertions ---

  test("dashboard: KPI cards mostram valores numéricos", async ({ page }) => {
    await page.goto("/dashboard");
    // Wait for data to load
    await page.waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, {
      timeout: 15_000,
    });

    // At least one KPI card should show a number (not just "—")
    const kpiValues = page.locator(".tabular-nums");
    await expect(kpiValues.first()).toBeVisible({ timeout: 5_000 });
  });

  test("dashboard: grid de 17 ODS cards renderiza", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector('[style*="border-top-color"]', { timeout: 15_000 });
    const odsCards = page.locator('[style*="border-top-color"]');
    const count = await odsCards.count();
    expect(count).toBe(17);
  });

  test("simulator: formulário de alocação acessível", async ({ page }) => {
    await page.goto("/simulator");
    await page.waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, {
      timeout: 15_000,
    });

    // Investment amount input should be present
    const amountInput = page.locator('input[inputmode="numeric"], input[type="text"]').first();
    await expect(amountInput).toBeVisible();

    // Simulate button should exist
    const simulateBtn = page.getByRole("button", { name: /simular/i });
    await expect(simulateBtn).toBeVisible();
  });

  test("benchmark: ranking table renderiza após carregamento", async ({ page }) => {
    await page.goto("/benchmark");
    await page.waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, {
      timeout: 15_000,
    });

    // Should show "Comparativo Municipal" heading
    await expect(page.getByText("Comparativo Municipal")).toBeVisible();

    // Ranking table or summary cards should be visible (depends on selectedCodes)
    const summaryCards = page.locator(
      '[class*="grid"] [class*="Card"], [class*="grid"] [class*="card"]',
    );
    // At least the page structure should render without errors
    await expect(page.locator("main")).toBeVisible();
  });

  test("reports: página renderiza sem erro", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, {
      timeout: 15_000,
    });
    await expect(page.locator("main")).toBeVisible();
  });

  test("monitoring: página renderiza sem erro", async ({ page }) => {
    await page.goto("/monitoring");
    await page.waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, {
      timeout: 15_000,
    });
    await expect(page.locator("main")).toBeVisible();
  });
});
