---
name: screenshot
description: Captura screenshots de evidência visual para uma feature (desktop+mobile, light+dark). Salva em docs/evidence/ com REPORT.md. Use standalone ou como parte do /visual-qa.
allowed-tools: Read, Bash, Glob, Write
model: claude-sonnet-4-6
---

# Skill: Screenshot — Captura de Evidências Visuais

## Argumento: `/screenshot <nome-da-feature> [--interactive <script.ts>]`

## Pipeline

### 1. Verificar servidores

```bash
curl -s --max-time 5 http://localhost:5173 > /dev/null || echo "FRONTEND_DOWN"
curl -s --max-time 5 http://localhost:3000/api/health > /dev/null || echo "BACKEND_DOWN"
```

Se qualquer servidor estiver down:

> "Servidores não estão rodando. Inicie com `pnpm dev` antes de tirar screenshots."

### 2. Capturar screenshots

**Modo padrão (desktop + mobile, light + dark):**

```bash
npx tsx scripts/take-screenshots.ts --feature "$ARGUMENTS" --mobile
```

**Modo interativo (se --interactive fornecido):**

```bash
npx tsx scripts/take-screenshots.ts --feature "$ARGUMENTS" --mobile --interactive <script.ts>
```

### 3. Listar resultados

Use `Glob` para listar todos os `*.png` em `docs/evidence/YYYY-MM-DD-$ARGUMENTS/`.
Exiba a contagem: "N screenshots capturados (X desktop, Y mobile)".

### 4. Staging

```bash
git add docs/evidence/$(date +%Y-%m-%d)-$ARGUMENTS/
```

### 5. Relatório

```
Screenshots: N capturados
Diretório: docs/evidence/YYYY-MM-DD-$ARGUMENTS/
REPORT.md: gerado automaticamente
Status: Staged para commit. Inclua no próximo git commit.
```
