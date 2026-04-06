import { defineConfig } from "@playwright/test";

// In CI the backend and frontend are started externally (see .github/workflows/main.yml).
// Setting PLAYWRIGHT_SKIP_WEBSERVER=1 skips the webServer block so Playwright
// connects to the already-running processes instead of spawning new ones.
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  // Global timeout per test (30 s). Slow gov APIs justify a generous limit.
  timeout: 30_000,
  // One retry catches transient flakiness (network jitter, race conditions).
  retries: process.env.CI ? 1 : 0,
  // Run specs in parallel in CI; sequentially locally for easier debugging.
  workers: process.env.CI ? 2 : 1,

  reporter: [
    // Always show a compact summary in the terminal.
    ["list"],
    // HTML report is generated in every run and uploaded as an artifact on failure.
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Token JWT is stored in localStorage by the app (key: ioc_esg_token).
    storageState: undefined,
  },

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],

  // webServer is skipped in CI (PLAYWRIGHT_SKIP_WEBSERVER=1) because the workflow
  // already starts the backend (`pnpm start`) and serves the frontend via vite preview.
  webServer: skipWebServer
    ? undefined
    : [
        {
          // Local development: start the backend in watch mode.
          command: "pnpm run dev:backend",
          url: "http://localhost:3000/health",
          reuseExistingServer: true,
          // 60 s for first cold start (Prisma client generation, TS compilation).
          timeout: 60_000,
          stdout: "pipe",
          stderr: "pipe",
        },
        {
          // Local development: start the Vite dev server.
          command: "pnpm run dev:frontend",
          url: "http://localhost:5173",
          reuseExistingServer: true,
          timeout: 30_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      ],
});
