/**
 * take-screenshots.ts — Script automatizado de screenshots para evidências visuais.
 *
 * Captura screenshots de todas as rotas protegidas em light e dark mode.
 * Resultado salvo em docs/evidence/<date>-<feature>/
 *
 * Uso:
 *   npx tsx scripts/take-screenshots.ts [--feature <nome>] [--pages <p1,p2>] [--width <px>]
 *
 * Exemplos:
 *   npx tsx scripts/take-screenshots.ts --feature fase35-polish-premium
 *   npx tsx scripts/take-screenshots.ts --feature fase36 --pages dashboard,simulator
 *   npx tsx scripts/take-screenshots.ts --feature fase36 --width 1280
 *
 * Pré-requisitos:
 *   - Backend rodando em localhost:3000 (pnpm dev:backend)
 *   - Frontend rodando em localhost:5173 (pnpm dev:frontend ou Vite já ativo)
 *   - PostgreSQL + Redis rodando (docker compose up -d)
 *   - Playwright instalado (npx playwright install chromium)
 */

import { chromium, type Page, type Browser } from "playwright";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

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
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    feature: "unnamed",
    pages: DEFAULT_PAGES,
    width: 1440,
    municipalityIbge: "4205407", // Florianópolis
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
  // Register
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

  // Fill login form
  await page.fill('input[type="email"]', SCREENSHOT_EMAIL);
  await page.fill('input[type="password"]', SCREENSHOT_PASS);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard (user already has municipality set)
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem("ioc-theme", t);
    // Dispatch storage event to trigger useTheme hook
    window.dispatchEvent(new Event("storage"));
  }, theme);

  // Apply class to document
  if (theme === "dark") {
    await page.evaluate(() => document.documentElement.classList.add("dark"));
  } else {
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
  }

  // Brief wait for CSS transitions
  await page.waitForTimeout(300);
}

async function takePageScreenshot(
  page: Page,
  route: string,
  outDir: string,
  pageName: string,
  theme: "light" | "dark",
): Promise<string> {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
  await setTheme(page, theme);

  // Wait for skeletons to resolve
  await page.waitForTimeout(2_000);

  const filename = `${pageName}-${theme}.png`;
  const filepath = join(outDir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filename;
}

// ---------------------------------------------------------------------------
// REPORT.md generator
// ---------------------------------------------------------------------------

function generateReport(
  feature: string,
  date: string,
  pages: string[],
  screenshots: Array<{ page: string; theme: string; file: string }>,
): string {
  const lines: string[] = [
    `# Evidence Report: ${feature}`,
    "",
    `**Data:** ${date}`,
    `**Páginas capturadas:** ${pages.join(", ")}`,
    `**Resolução:** Desktop (1440px)`,
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
    lines.push("| Light | Dark |");
    lines.push("|-------|------|");

    const light = screenshots.find((s) => s.page === pageName && s.theme === "light");
    const dark = screenshots.find((s) => s.page === pageName && s.theme === "dark");

    lines.push(
      `| ${light ? `![${pageName}-light](${light.file})` : "N/A"} | ${dark ? `![${pageName}-dark](${dark.file})` : "N/A"} |`,
    );
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

  console.log(`\n📸 Screenshot automation`);
  console.log(`   Feature: ${config.feature}`);
  console.log(`   Pages:   ${config.pages.join(", ")}`);
  console.log(`   Width:   ${config.width}px`);
  console.log(`   Output:  ${outDir}\n`);

  // Ensure output directory
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Step 1: Create user via API and assign municipality
  console.log("1/4 Creating test user via API...");
  const token = await ensureUserViaApi();

  console.log("2/4 Assigning municipality...");
  await assignMunicipality(token, config.municipalityIbge);

  // Step 2: Launch browser and login via UI
  console.log("3/4 Launching browser...");
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: config.width, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    await loginViaUI(page);
    console.log("   Logged in successfully\n");

    // Step 3: Take screenshots
    console.log("4/4 Taking screenshots...");
    const screenshots: Array<{ page: string; theme: string; file: string }> = [];

    for (const pageName of config.pages) {
      const route = ALL_PAGES[pageName];
      if (!route) {
        console.warn(`   ⚠️  Unknown page: ${pageName}, skipping`);
        continue;
      }

      for (const theme of ["light", "dark"] as const) {
        const file = await takePageScreenshot(page, route, outDir, pageName, theme);
        screenshots.push({ page: pageName, theme, file });
        console.log(`   ✅ ${file}`);
      }
    }

    // Step 4: Generate REPORT.md
    const report = generateReport(config.feature, date, config.pages, screenshots);
    const reportPath = join(outDir, "REPORT.md");
    writeFileSync(reportPath, report, "utf-8");
    console.log(`   ✅ REPORT.md\n`);

    console.log(`Done! ${screenshots.length} screenshots saved to:\n   ${outDir}\n`);
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((err) => {
  console.error("❌ Screenshot automation failed:", err);
  process.exit(1);
});
