#!/usr/bin/env npx tsx
/**
 * Smoke test: verifica login end-to-end via Playwright headless.
 *
 * Uso:
 *   npx tsx scripts/smoke-test-login.ts                    # http://localhost (nginx)
 *   npx tsx scripts/smoke-test-login.ts http://localhost:3000  # direto na API
 *
 * Saída:
 *   - Exit 0 = tudo OK
 *   - Exit 1 = algum teste falhou
 *   - Screenshots em docs/evidence/<data>-smoke-login/
 */

import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = process.argv[2] ?? "http://localhost";
const DATE = new Date().toISOString().slice(0, 10);
const EVIDENCE_DIR = path.join(process.cwd(), `docs/evidence/${DATE}-smoke-login`);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@ioc.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin123!";

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
}

async function run(): Promise<TestResult[]> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const results: TestResult[] = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Test 1: Page loads
  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "01-login-page.png"),
      fullPage: true,
    });
    const hasEmailInput = (await page.$('input[type="email"], input[name="email"]')) !== null;
    const hasPasswordInput = (await page.$('input[type="password"]')) !== null;
    results.push({
      name: "Página de login carrega",
      pass: hasEmailInput && hasPasswordInput,
      detail:
        hasEmailInput && hasPasswordInput
          ? "Inputs de email e senha encontrados"
          : "Inputs não encontrados na página",
    });
  } catch (e) {
    results.push({
      name: "Página de login carrega",
      pass: false,
      detail: `Erro: ${e instanceof Error ? e.message : String(e)}`,
    });
    await browser.close();
    return results;
  }

  // Test 2: Wrong password shows correct error (not "Sessão expirada")
  try {
    await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', "senha-errada-12345");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "02-wrong-password.png"),
      fullPage: true,
    });

    const bodyText = (await page.textContent("body")) ?? "";
    const hasSessaoExpirada = bodyText.includes("Sessão expirada");
    const hasCredenciaisInvalidas = bodyText.includes("Credenciais inválidas");

    if (hasSessaoExpirada) {
      results.push({
        name: "Senha errada mostra erro correto",
        pass: false,
        detail: 'REGRESSÃO: mostra "Sessão expirada" em vez de "Credenciais inválidas"',
      });
    } else if (hasCredenciaisInvalidas) {
      results.push({
        name: "Senha errada mostra erro correto",
        pass: true,
        detail: '"Credenciais inválidas" exibido corretamente',
      });
    } else {
      results.push({
        name: "Senha errada mostra erro correto",
        pass: false,
        detail: `Texto inesperado na página: ${bodyText.substring(0, 200)}`,
      });
    }
  } catch (e) {
    results.push({
      name: "Senha errada mostra erro correto",
      pass: false,
      detail: `Erro: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  // Test 3: Correct password → dashboard
  try {
    await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "03-after-login.png"),
      fullPage: true,
    });

    const loggedIn = currentUrl.includes("/dashboard") || currentUrl.includes("/onboarding");

    results.push({
      name: "Login correto redireciona para dashboard",
      pass: loggedIn,
      detail: loggedIn
        ? `Redirecionou para ${currentUrl}`
        : `Ficou em ${currentUrl} — login pode ter falhado`,
    });
  } catch (e) {
    results.push({
      name: "Login correto redireciona para dashboard",
      pass: false,
      detail: `Erro: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  // Test 4: Dashboard loads data (not empty)
  try {
    const bodyText = (await page.textContent("body")) ?? "";
    const hasScore = /\d{1,3}\/100/.test(bodyText) || /score/i.test(bodyText);
    const hasMunicipio =
      bodyText.includes("Florianópolis") ||
      bodyText.includes("município") ||
      bodyText.includes("ODS");

    results.push({
      name: "Dashboard carrega dados",
      pass: hasScore || hasMunicipio,
      detail:
        hasScore || hasMunicipio
          ? "Dados de município/ODS visíveis"
          : "Nenhum dado de município ou ODS encontrado na página",
    });
  } catch (e) {
    results.push({
      name: "Dashboard carrega dados",
      pass: false,
      detail: `Erro: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  await browser.close();
  return results;
}

async function main() {
  console.log("");
  console.log("=============================================");
  console.log(`  Smoke Test Login — ${BASE_URL}`);
  console.log("=============================================");
  console.log("");

  const results = await run();

  let failures = 0;
  for (const r of results) {
    const icon = r.pass ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
    console.log(`${icon} ${r.name}`);
    console.log(`       ${r.detail}`);
    if (!r.pass) failures++;
  }

  console.log("");
  console.log("=============================================");
  if (failures === 0) {
    console.log(`  \x1b[32mTODOS OS TESTES PASSARAM\x1b[0m — ${results.length}/${results.length}`);
  } else {
    console.log(
      `  \x1b[31m${failures} FALHA(S)\x1b[0m — ${results.length - failures}/${results.length} passaram`,
    );
  }
  console.log(`  Evidências: ${EVIDENCE_DIR}`);
  console.log("=============================================");
  console.log("");

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
