/**
 * take-screenshots.ts — Script automatizado de screenshots para evidências visuais.
 *
 * Captura screenshots de todas as rotas protegidas em light e dark mode.
 * Resultado salvo em docs/evidence/<date>-<feature>/
 *
 * Uso:
 *   npx tsx scripts/take-screenshots.ts [--feature <nome>] [--pages <p1,p2>] [--width <px>]
 *                                        [--mobile] [--interactive <script.ts>]
 *
 * Exemplos:
 *   npx tsx scripts/take-screenshots.ts --feature fase35-polish-premium
 *   npx tsx scripts/take-screenshots.ts --feature fase36 --pages dashboard,simulator
 *   npx tsx scripts/take-screenshots.ts --feature fase36 --width 1280
 *   npx tsx scripts/take-screenshots.ts --feature fase4b --mobile
 *   npx tsx scripts/take-screenshots.ts --feature fase4b --interactive scripts/screenshot-fase4b.ts
 *
 * Pré-requisitos:
 *   - Backend rodando em localhost:3000 (pnpm dev:backend)
 *   - Frontend rodando em localhost:5173 (pnpm dev:frontend ou Vite já ativo)
 *   - PostgreSQL + Redis rodando (docker compose up -d)
 *   - Playwright instalado (npx playwright install chromium)
 */

import { chromium, type Page, type Browser } from "playwright";
import { mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { writeFile } from "fs/promises";

// eslint-disable-next-line no-console
const log = console.log.bind(console);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
const API_URL = process.env.API_URL ?? "http://localhost:3000/api";

const ALL_PAGES: Record<string, string> = {
  dashboard: "/dashboard",
  simulator: "/simulator",
  benchmark: "/benchmark",
  reports: "/reports",
  monitoring: "/monitoring",
};

const DEFAULT_PAGES = ["dashboard", "simulator", "benchmark"];

interface Config {
  feature: string;
  pages: string[];
  width: number;
  municipalityIbge: string;
  mobile: boolean;
  interactive: string;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    feature: "unnamed",
    pages: DEFAULT_PAGES,
    width: 1440,
    municipalityIbge: "4205407", // Florianópolis
    mobile: false,
    interactive: "",
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--feature":
        config.feature = args[++i] ?? "unnamed";
        break;
      case "--pages":
        config.pages = (args[++i] ?? "").split(",").filter(Boolean);
        break;
      case "--width":
        config.width = parseInt(args[++i] ?? "1440", 10);
        break;
      case "--municipality":
        config.municipalityIbge = args[++i] ?? "4205407";
        break;
      case "--mobile":
        config.mobile = true;
        break;
      case "--interactive":
        config.interactive = args[++i] ?? "";
        break;
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const SCREENSHOT_EMAIL = `screenshot-${Date.now()}@evidence.test`;
const SCREENSHOT_PASS = "EvidenceTest123!@#";

async function ensureUserViaApi(): Promise<string> {
  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Screenshot Bot",
      email: SCREENSHOT_EMAIL,
      password: SCREENSHOT_PASS,
    }),
  });

  if (!regRes.ok) {
    const body = await regRes.text();
    throw new Error(`Register failed (${regRes.status}): ${body}`);
  }

  const { token } = (await regRes.json()) as { token: string };
  return token;
}

async function assignMunicipality(token: string, ibgeCode: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ municipalityId: ibgeCode }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PATCH /me failed (${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

async function loginViaUI(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

  await page.fill('input[type="email"]', SCREENSHOT_EMAIL);
  await page.fill('input[type="password"]', SCREENSHOT_PASS);
  await page.click('button[type="submit"]');

  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem("ioc-theme", t);
  }, theme);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
}

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

async function takePageScreenshot(
  page: Page,
  route: string,
  outDir: string,
  pageName: string,
  theme: "light" | "dark",
  viewport: ViewportConfig,
): Promise<string> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
  await setTheme(page, theme);

  // Wait for skeletons to resolve
  await page.waitForTimeout(2_000);

  const filename = `${pageName}-${viewport.name}-${theme}.png`;
  const filepath = join(outDir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filename;
}

// ---------------------------------------------------------------------------
// Interactive script support
// ---------------------------------------------------------------------------

type InteractiveHandler = (page: Page, outDir: string) => Promise<void>;

async function loadInteractiveScript(scriptPath: string): Promise<InteractiveHandler | null> {
  const absPath = resolve(process.cwd(), scriptPath);
  if (!existsSync(absPath)) {
    log(`   Interactive script not found: ${absPath}`);
    return null;
  }
  const mod = (await import(absPath)) as { default?: InteractiveHandler };
  return mod.default ?? null;
}

// ---------------------------------------------------------------------------
// REPORT.md generator
// ---------------------------------------------------------------------------

function generateReport(
  feature: string,
  date: string,
  pages: string[],
  screenshots: Array<{ page: string; theme: string; viewport: string; file: string }>,
  hasMobile: boolean,
): string {
  const lines: string[] = [
    `# Evidence Report: ${feature}`,
    "",
    `**Data:** ${date}`,
    `**Páginas capturadas:** ${pages.join(", ")}`,
    `**Resolução:** Desktop (1440px)${hasMobile ? " + Mobile (375px)" : ""}`,
    `**Temas:** Light + Dark`,
    "",
    "---",
    "",
    "## Screenshots",
    "",
  ];

  for (const pageName of pages) {
    lines.push(`### ${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`);
    lines.push("");

    if (hasMobile) {
      lines.push("| Viewport | Light | Dark |");
      lines.push("|----------|-------|------|");

      for (const vp of ["desktop", "mobile"]) {
        const light = screenshots.find(
          (s) => s.page === pageName && s.theme === "light" && s.viewport === vp,
        );
        const dark = screenshots.find(
          (s) => s.page === pageName && s.theme === "dark" && s.viewport === vp,
        );
        const vpLabel = vp.charAt(0).toUpperCase() + vp.slice(1);
        lines.push(
          `| ${vpLabel} | ${light ? `![${light.file}](${light.file})` : "N/A"} | ${dark ? `![${dark.file}](${dark.file})` : "N/A"} |`,
        );
      }
    } else {
      lines.push("| Light | Dark |");
      lines.push("|-------|------|");

      const light = screenshots.find(
        (s) => s.page === pageName && s.theme === "light" && s.viewport === "desktop",
      );
      const dark = screenshots.find(
        (s) => s.page === pageName && s.theme === "dark" && s.viewport === "desktop",
      );
      lines.push(
        `| ${light ? `![${light.file}](${light.file})` : "N/A"} | ${dark ? `![${dark.file}](${dark.file})` : "N/A"} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("*Gerado automaticamente por `scripts/take-screenshots.ts`*");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const config = parseArgs();
  const date = new Date().toISOString().slice(0, 10);
  const outDir = join(process.cwd(), "docs", "evidence", `${date}-${config.feature}`);

  const viewports: ViewportConfig[] = [{ name: "desktop", width: config.width, height: 900 }];
  if (config.mobile) {
    viewports.push({ name: "mobile", width: 375, height: 812 });
  }

  log(`\nScreenshot automation`);
  log(`   Feature:    ${config.feature}`);
  log(`   Pages:      ${config.pages.join(", ")}`);
  log(`   Viewports:  ${viewports.map((v) => `${v.name} (${v.width}px)`).join(", ")}`);
  log(`   Output:     ${outDir}\n`);

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Step 1: Create user via API and assign municipality
  log("1/5 Creating test user via API...");
  const token = await ensureUserViaApi();

  log("2/5 Assigning municipality...");
  await assignMunicipality(token, config.municipalityIbge);

  // Step 2: Launch browser and login via UI
  log("3/5 Launching browser...");
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: config.width, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    await loginViaUI(page);
    log("   Logged in successfully\n");

    // Step 3: Take screenshots for each viewport × page × theme
    log("4/5 Taking screenshots...");
    const screenshots: Array<{ page: string; theme: string; viewport: string; file: string }> = [];

    for (const viewport of viewports) {
      for (const pageName of config.pages) {
        const route = ALL_PAGES[pageName];
        if (!route) {
          log(`   Unknown page: ${pageName}, skipping`);
          continue;
        }

        for (const theme of ["light", "dark"] as const) {
          const file = await takePageScreenshot(page, route, outDir, pageName, theme, viewport);
          screenshots.push({ page: pageName, theme, viewport: viewport.name, file });
          log(`   ${file}`);
        }
      }
    }

    // Step 3.5: Run interactive script if provided
    if (config.interactive) {
      log(`\n   Running interactive script: ${config.interactive}`);
      const handler = await loadInteractiveScript(config.interactive);
      if (handler) {
        await handler(page, outDir);
        log("   Interactive script completed");
      }
    }

    // Step 4: Generate REPORT.md
    log("\n5/5 Generating report...");
    const report = generateReport(config.feature, date, config.pages, screenshots, config.mobile);
    const reportPath = join(outDir, "REPORT.md");
    await writeFile(reportPath, report, "utf-8");
    log(`   REPORT.md\n`);

    log(`Done! ${screenshots.length} screenshots saved to:\n   ${outDir}\n`);
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Screenshot automation failed:", err);
  process.exit(1);
});
