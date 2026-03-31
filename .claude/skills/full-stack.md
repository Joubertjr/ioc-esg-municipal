---
name: full-stack
description: Feature completa multi-camada coordenando backend-architect, database-architect, frontend-architect e api-developer em sequência. Use para features que tocam banco + API + UI.
allowed-tools: Read, Glob, Task
model: claude-opus-4-6
effort: high
---

# Skill: Full-Stack Feature

## Argumento: `/full-stack <nome-da-feature>`

## Pipeline obrigatório

### 1. Checkpoint
```bash
git add -A && git commit -m "checkpoint: antes de full-stack/$ARGUMENTS"
git checkout -b feature/$ARGUMENTS
```

### 2. Arquitetura (SEQUENCIAL — aguardar output de cada etapa)

**2a.** "Use o agente backend-architect para projetar a API de $ARGUMENTS. Leia o codebase e produza contratos de endpoints em docs/plans/$ARGUMENTS-backend.md"

**2b.** "Use o agente database-architect para projetar o schema de $ARGUMENTS. Use docs/plans/$ARGUMENTS-backend.md como referência. Produza em docs/plans/$ARGUMENTS-database.md"

**2c.** "Use o agente frontend-architect para projetar os componentes de $ARGUMENTS. Use docs/plans/$ARGUMENTS-backend.md como referência. Produza em docs/plans/$ARGUMENTS-frontend.md"

### 3. APRESENTE o plano consolidado ao usuário
**AGUARDE aprovação explícita antes de continuar.**

### 4. Implementação

**4a.** "Use o agente api-developer para implementar os endpoints de $ARGUMENTS conforme docs/plans/$ARGUMENTS-backend.md"

**4b.** `/tdd $ARGUMENTS` — testes para o backend implementado

**4c.** Implementar frontend conforme docs/plans/$ARGUMENTS-frontend.md

### 5. Qualidade

**5a.** "Use o agente code-reviewer para revisar $ARGUMENTS com contexto limpo"

**5b.** Se tocar auth/pagamentos/dados sensíveis: "Use o agente security-auditor para auditar $ARGUMENTS"

### 6. Commit e documentação
```bash
git commit -m "feat($ARGUMENTS): [descrição]"
```
Atualize docs/PROJECT_STATE.md e docs/decisions/ se houver decisões.

## Relatório final
```
Full-stack concluído: $ARGUMENTS
Agentes: [lista com outputs]
Entregáveis: endpoints criados, componentes criados, testes N
Decisões: [link para docs/decisions/]
```
