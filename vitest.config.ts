import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["backend/**/*.ts", "shared/**/*.ts"],
      exclude: [
        "node_modules/",
        "tests/",
        "prisma/",
        "frontend/",
        "scripts/",
        "docs/",
        "**/*.test.ts",
        "**/index.ts",
      ],
    },
  },
});
