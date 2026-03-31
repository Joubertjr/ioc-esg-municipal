---
name: bug-fix
description: Diagnostica causa raiz de bugs com ciclo reproduce→diagnose→fix→regressão. Use quando há um comportamento inesperado.
allowed-tools: Read, Edit, Glob, Grep, Bash(git *), Bash(pnpm test *)
model: claude-sonnet-4-6
---
# Bug Fix — Causa Raiz

## 1. Reproduza o bug
Descreva: comportamento atual vs esperado.
Se não conseguir reproduzir de forma consistente: investigue antes de corrigir.

## 2. Checkpoint
```bash
git add -A && git commit -m "checkpoint: antes de fix/[bug]"
git checkout -b fix/[descrição-curta]
```

## 3. Diagnostique
- Trace o fluxo de execução até o ponto de falha
- Leia o stack trace de baixo para cima (causa raiz está no fundo)
- Se recorrente: `git log --oneline -20` para identificar quando foi introduzido

## 4. Teste de regressão PRIMEIRO
Escreva teste que reproduz o bug. Confirme que FALHA antes de corrigir.

## 5. Corrija a causa raiz (não o sintoma)
Mínimo de mudança necessária.

## 6. Verifique
```bash
pnpm test  # suite completa — zero regressões
```

## 7. Commit
```bash
git commit -m "fix([escopo]): [descrição]
- Causa raiz: [explicação]
- Teste de regressão: [nome do teste]"
```

Reporte: causa raiz, o que foi corrigido, teste adicionado.
