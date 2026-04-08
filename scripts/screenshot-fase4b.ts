/**
 * screenshot-fase4b.ts — Screenshots de evidência para Fase 4B (clustering peer-to-peer)
 *
 * Captura 3 screenshots da página /benchmark:
 *   1. benchmark-light-before-suggest.png — estado inicial, botão visível
 *   2. benchmark-light-after-suggest.png  — após clicar "Sugerir municípios similares" (badges IA)
 *   3. benchmark-dark-after-suggest.png   — dark mode com badges IA
 *
 * Pré-requisitos:
 *   - Frontend rodando em localhost:5173
 *   - Backend rodando em localhost:3000
 *   - Playwright instalado (npx playwright install chromium)
 */

import { chromium, type Page } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
const API_URL = process.env.API_URL ?? "http://localhost:3000/api";
const OUT_DIR = join(process.cwd(), "docs", "evidence", "2026-04-08-fase4b-clustering");

const EMAIL = `screenshot-4b-${Date.now()}@evidence.test`;
const PASS = "EvidenceTest123!@#";

async function registerAndGetToken(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Screenshot Bot 4B", email: EMAIL, password: PASS }),
  });
  if (!res.ok) throw new Error(`Register failed (${res.status}): ${await res.text()}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

async function assignMunicipality(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ municipalityId: "4205407" }),
  });
  if (!res.ok) throw new Error(`PATCH /me failed (${res.status}): ${await res.text()}`);
}

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.evaluate((t) => localStorage.setItem("ioc-theme", t), theme);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1_000);
}

// eslint-disable-next-line no-console
const log = console.log.bind(console);

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  log("1/5 Registrando usuário de teste...");
  const token = await registerAndGetToken();
  await assignMunicipality(token);

  log("2/5 Abrindo browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    await login(page);
    log("   Login OK");

    // Navigate to benchmark
    await page.goto(`${BASE_URL}/benchmark`, { waitUntil: "networkidle" });
    await setTheme(page, "light");
    await page.waitForTimeout(2_000);

    // Screenshot 1: Light mode, before clicking suggest
    log("3/5 Screenshot: benchmark-light-before-suggest.png");
    await page.screenshot({
      path: join(OUT_DIR, "benchmark-light-before-suggest.png"),
      fullPage: true,
    });

    // Click the suggest button
    const suggestBtn = page.locator("button", { hasText: "Sugerir municípios similares" });
    if (await suggestBtn.isVisible()) {
      await suggestBtn.click();
      // Wait for the API call and UI update
      await page.waitForTimeout(3_000);
    }

    // Screenshot 2: Light mode, after clicking suggest (with IA badges)
    log("4/5 Screenshot: benchmark-light-after-suggest.png");
    await page.screenshot({
      path: join(OUT_DIR, "benchmark-light-after-suggest.png"),
      fullPage: true,
    });

    // Switch to dark mode
    await setTheme(page, "dark");
    await page.waitForTimeout(2_000);

    // Screenshot 3: Dark mode, after suggest (with IA badges)
    log("5/5 Screenshot: benchmark-dark-after-suggest.png");
    await page.screenshot({
      path: join(OUT_DIR, "benchmark-dark-after-suggest.png"),
      fullPage: true,
    });

    log(`\nDone! 3 screenshots saved to:\n   ${OUT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Screenshot failed:", err);
  process.exit(1);
});
