const { chromium } = require("playwright");

const VIEWPORT = { width: 390, height: 844 }; // iPhone 14 Pro
const BASE = "http://localhost:5174";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW5wY3A4eXAwMDc0cnJrZnlhcWdzajUxIiwiZW1haWwiOiJ0ZXN0QGlvYy5kZXYiLCJyb2xlIjoicHJlZmVpdG8iLCJtdW5pY2lwYWxpdHlJZCI6bnVsbCwiaWF0IjoxNzc1NjEwNTkxLCJleHAiOjE3NzU2OTY5OTF9.w6cerzXHPBKhYz-d4m_phHw_lHa5XpONwS4Bp03-1ZU";

async function capture() {
  const browser = await chromium.launch({ headless: true });

  // --- LIGHT MODE ---
  const lightCtx = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "light",
    deviceScaleFactor: 3,
  });
  await lightCtx.addCookies([{
    name: "token", value: TOKEN,
    domain: "localhost", path: "/",
    httpOnly: true, sameSite: "Lax",
  }]);
  const lightPage = await lightCtx.newPage();

  // Ensure light theme
  await lightPage.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await lightPage.evaluate(() => localStorage.setItem("ioc-theme", "light"));
  await lightPage.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 30000 });
  await lightPage.waitForTimeout(4000);

  // Debug
  const lightUrl = lightPage.url();
  console.log("Light URL:", lightUrl);
  const lightH2 = await lightPage.$$eval("h2", els => els.map(e => e.textContent?.trim()));
  console.log("Light H2:", lightH2);

  await lightPage.screenshot({ path: "/tmp/dash-light-fold.png", fullPage: false });
  await lightPage.screenshot({ path: "/tmp/dash-light-full.png", fullPage: true });
  console.log("Light done");
  await lightCtx.close();

  // --- DARK MODE ---
  const darkCtx = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "dark",
    deviceScaleFactor: 3,
  });
  await darkCtx.addCookies([{
    name: "token", value: TOKEN,
    domain: "localhost", path: "/",
    httpOnly: true, sameSite: "Lax",
  }]);
  const darkPage = await darkCtx.newPage();

  // Set dark theme BEFORE navigation
  await darkPage.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await darkPage.evaluate(() => {
    localStorage.setItem("ioc-theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await darkPage.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 30000 });
  await darkPage.waitForTimeout(4000);

  // Verify dark class is applied
  const hasDark = await darkPage.evaluate(() => document.documentElement.classList.contains("dark"));
  console.log("Dark class applied:", hasDark);

  await darkPage.screenshot({ path: "/tmp/dash-dark-fold.png", fullPage: false });
  await darkPage.screenshot({ path: "/tmp/dash-dark-full.png", fullPage: true });
  console.log("Dark done");
  await darkCtx.close();

  await browser.close();
  console.log("All screenshots at /tmp/dash-{light,dark}-{fold,full}.png");
}

capture().catch((err) => { console.error(err); process.exit(1); });
