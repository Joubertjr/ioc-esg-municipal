---
name: visual-qa
description: Ciclo completo de QA visual para features de UI. Captura screenshots (desktop+mobile, light+dark), aplica checklist via visual-qa-auditor, e gera veredicto pass/fail. Se aprovado, faz staging das evidências para commit atômico.
allowed-tools: Read, Bash, Glob, Grep, Write, Agent, Task
model: claude-sonnet-4-6
---

# Skill: Visual QA — Ciclo Completo de Qualidade Visual

## Argumento: `/visual-qa <nome-da-feature> [--interactive <script.ts>]`

## Referências

- Política: `.claude/rules/visual-qa.md` (checklist e estrutura de evidências)
- Padrão de skill: `docs/architecture/SKILLS_PATTERN.md`

## Pipeline (6 passos sequenciais)

### 1. Checkpoint de segurança

```bash
git add -A && git commit -m "checkpoint: antes de visual-qa/$ARGUMENTS" 2>/dev/null || true
```

### 2. Verificar servidores

```bash
curl -s --max-time 5 http://localhost:5173 > /dev/null || echo "FRONTEND_DOWN"
curl -s --max-time 5 http://localhost:3000/api/health > /dev/null || echo "BACKEND_DOWN"
```

Se qualquer servidor estiver down, pare e instrua:

> "Servidores não estão rodando. Inicie com `pnpm dev` antes de executar visual-qa."

### 3. Capturar screenshots

```bash
npx tsx scripts/take-screenshots.ts --feature "$ARGUMENTS" --mobile
```

Se `--interactive` fornecido:

```bash
npx tsx scripts/take-screenshots.ts --feature "$ARGUMENTS" --mobile --interactive <script.ts>
```

Determine o diretório de output: `docs/evidence/$(date +%Y-%m-%d)-$ARGUMENTS/`

### 4. Auditoria visual

Invoque o agente `visual-qa-auditor` com o diretório de evidências:

> "Audite os screenshots em docs/evidence/YYYY-MM-DD-$ARGUMENTS/. Aplique o checklist completo (11 critérios) e retorne o veredicto estruturado."

### 5. Avaliar veredicto

**Se APROVADO:**

```bash
git add docs/evidence/$(date +%Y-%m-%d)-$ARGUMENTS/
```

Exiba:

> "Visual QA APROVADO. Evidências staged para commit atômico. Inclua `docs/evidence/` no próximo `git commit`."

**Se REPROVADO:**

- Exiba todos os critérios FAIL com sugestões de fix
- NÃO faça staging
- Exiba:
  > "Visual QA REPROVADO. Corrija os problemas listados e execute `/visual-qa $ARGUMENTS` novamente."

### 6. Relatório final

```markdown
## Visual QA: $ARGUMENTS

**Status:** APROVADO / REPROVADO
**Screenshots:** N (X desktop, Y mobile, light + dark)
**Critérios:** N/11 aprovados
**Evidências:** docs/evidence/YYYY-MM-DD-$ARGUMENTS/
**Próximo passo:** [commit atômico | corrigir e repetir]
```

## Regras invioláveis (do Visual QA Framework)

1. **Commit Atômico:** Nunca commitar UI sem screenshots
2. **Dark Mode:** Toda tela precisa de prova em dark mode
3. **Empty State:** Nenhuma tela pode quebrar sem dados
