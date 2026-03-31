---
name: context-save
description: Salva estado completo da sessão antes de /compact ou /clear. Use quando contexto atingir 70%.
allowed-tools: Read, Write, Bash(git *)
---
# Context Save

## Execute em ordem

### 1. Git state
```bash
git log --oneline -10
git status
git stash list
```

### 2. Escreva em docs/PROJECT_STATE.md
```markdown
# Estado do Projeto
Atualizado: [data e hora]
Branch: [nome]
Contexto: SALVO ANTES DE COMPACTAÇÃO

## Concluído nesta sessão
[lista do que foi implementado e testado]

## Em progresso NO MOMENTO
[exatamente o que estava sendo feito]

## Próxima ação imediata ao retomar
[instrução literal para o próximo Claude]

## Contexto crítico
[decisões recentes, bugs conhecidos, padrões descobertos]

## Comandos para retomar
\`\`\`bash
git checkout [branch]
pnpm docker:up
pnpm dev
\`\`\`

## Arquivos modificados não commitados
[lista]
```

### 3. Commit de segurança
```bash
git add -A
git commit -m "wip: checkpoint antes de compactação — $(date '+%Y-%m-%d %H:%M')"
```

### 4. Confirme
"Estado salvo em docs/PROJECT_STATE.md e commitado. Pode executar /compact com segurança."
