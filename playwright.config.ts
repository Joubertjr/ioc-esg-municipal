import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    // Token JWT gravado em localStorage pela lib/api.ts
    storageState: undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: [
    {
      command: "pnpm run dev:backend",
      port: 3000,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "pnpm run dev:frontend",
      port: 5173,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
