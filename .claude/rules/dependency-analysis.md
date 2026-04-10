# Regra: Análise de Impacto de Dependências

Aplicável a todos os agentes que alteram, movem ou deletam arquivos em `backend/`.

## Quando executar

- **Antes de deletar** qualquer função, service, model ou rota core.
- **Antes de aprovar** refactors estruturais (renomear módulos, reorganizar pastas, dividir services).
- **Após refactors grandes** (remoção de mais de 1 arquivo).

## Comandos

```bash
# Checar ciclos de dependência no backend
pnpm madge:circular

# Encontrar arquivos sem importadores (candidatos a remoção segura)
pnpm madge:orphans

# Gerar grafo visual (útil para análise manual)
pnpm madge:graph   # gera /tmp/ioc-dep-graph.svg
```

## Regras de bloqueio

| Situação                            | Ação                                    |
| ----------------------------------- | --------------------------------------- |
| Novos ciclos introduzidos pelo diff | Bloquear — reportar como bloqueador     |
| Ciclos pré-existentes (baseline)    | Documentar, não bloquear                |
| Novos órfãos após remoção           | Reportar como melhoria recomendada      |
| Arquivo deletado ainda importado    | Bloquear — erro de compilação garantido |

## Baseline atual (2026-04-10)

`pnpm madge:circular` rodado em `backend/` (122 arquivos): **nenhum ciclo encontrado**.

Qualquer ciclo reportado a partir desta data é regressão introduzida por mudança posterior.
