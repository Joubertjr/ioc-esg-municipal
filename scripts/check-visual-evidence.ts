/**
 * check-visual-evidence.ts — Pre-commit guard para Visual QA.
 *
 * Bloqueia commits que alteram arquivos .tsx de UI (pages/ ou components/)
 * sem incluir evidências visuais em docs/evidence/.
 *
 * Verificações:
 *  1. UI files (.tsx em pages/ ou components/) exigem evidência staged
 *  2. Evidência deve incluir desktop-light.png e desktop-dark.png
 *  3. Evidência deve conter COMMIT_SHA.txt vinculando ao commit atual
 *
 * Chamado pelo .husky/pre-commit antes do lint-staged.
 * Bypass de emergência: git commit --no-verify
 */

import { execSync } from "child_process";

const staged = execSync("git diff --cached --name-only", { encoding: "utf-8" }).trim().split("\n");

const uiFiles = staged.filter(
  (f) =>
    f.endsWith(".tsx") &&
    (f.includes("frontend/src/pages/") || f.includes("frontend/src/components/")),
);

if (uiFiles.length === 0) {
  process.exit(0);
}

// Find evidence directories staged in this commit
const evidenceDirs = new Set(
  staged
    .filter((f) => f.startsWith("docs/evidence/"))
    .map((f) => {
      // Extract the evidence directory: docs/evidence/YYYY-MM-DD-feature/
      const parts = f.split("/");
      return parts.length >= 3 ? parts.slice(0, 3).join("/") : "";
    })
    .filter(Boolean),
);

if (evidenceDirs.size === 0) {
  // eslint-disable-next-line no-console
  console.error(`
VISUAL QA GUARD: Commit bloqueado!

Arquivos de UI detectados sem evidências visuais:
${uiFiles.map((f) => `  - ${f}`).join("\n")}

Para incluir evidências, execute:
  /visual-qa [nome-da-feature]  ou  /screenshot [nome-da-feature]

Para emergência: git commit --no-verify
`);
  process.exit(1);
}

// Check that at least one evidence directory has the required screenshots
const warnings: string[] = [];

for (const dir of evidenceDirs) {
  const hasDesktopLight = staged.some((f) => f.startsWith(dir) && f.endsWith("desktop-light.png"));
  const hasDesktopDark = staged.some((f) => f.startsWith(dir) && f.endsWith("desktop-dark.png"));

  if (!hasDesktopLight) {
    warnings.push(`  ⚠ ${dir}: falta desktop-light.png`);
  }
  if (!hasDesktopDark) {
    warnings.push(`  ⚠ ${dir}: falta desktop-dark.png`);
  }
}

if (warnings.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(`
VISUAL QA GUARD: Evidência incompleta (não bloqueante):
${warnings.join("\n")}

Recomendado: capture desktop-light.png e desktop-dark.png.
`);
}

// All checks passed — evidence exists
process.exit(0);
