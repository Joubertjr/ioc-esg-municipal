/**
 * check-visual-evidence.ts — Pre-commit guard para Visual QA.
 *
 * Bloqueia commits que alteram arquivos .tsx de UI (pages/ ou components/)
 * sem incluir evidências visuais em docs/evidence/.
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

const hasEvidence = staged.some((f) => f.startsWith("docs/evidence/"));

if (hasEvidence) {
  process.exit(0);
}

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
