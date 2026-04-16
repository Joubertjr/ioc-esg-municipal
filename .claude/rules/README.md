---
scope: global
applies_to: all
---

# Regras Globais — Índice

> Estes arquivos contêm invariantes de qualidade do projeto IOC ESG Municipal.
> Devem ser consultados pelos agentes **antes de implementar** qualquer feature.
> São a fonte de verdade para padrões — o CLAUDE.md contém os resumos, estes arquivos contêm os detalhes.

## Como usar

Agentes devem referenciar o arquivo relevante para a dimensão da tarefa antes de escrever código.
Quando há conflito entre um arquivo de regra e uma instrução ad-hoc, as regras prevalecem — exceto se houver ADR documentado em `docs/decisions/`.

## Arquivos disponíveis

| Arquivo                  | Escopo   | O que cobre                                                                  |
| ------------------------ | -------- | ---------------------------------------------------------------------------- |
| `typescript.md`          | all      | strict mode, zero `any`, Zod para I/O externo, Decimal.js para finanças      |
| `backend.md`             | backend  | Controllers finos, Services, Winston, cache Redis, retry, rate limit         |
| `database.md`            | backend  | Prisma Migrate, soft delete, índices obrigatórios, tratamento de erros P2xxx |
| `security.md`            | all      | Credenciais, PII, validação Zod em rotas, bcrypt, JWT, rate limiting         |
| `testing.md`             | all      | Vitest, Playwright, cobertura obrigatória, integração com banco real, AAA    |
| `docker.md`              | all      | Build obrigatório antes de "concluído", multi-stage, HUSKY=0, health checks  |
| `git-commits.md`         | all      | Formato `tipo(escopo): desc`, tipos e escopos aprovados, push obrigatório    |
| `visual-qa.md`           | frontend | Screenshot obrigatório, dark mode, estrutura de evidências, checklist        |
| `memory-policy.md`       | all      | O que vai em memory vs rules vs CLAUDE.md vs logs. Checklist de 5 critérios  |
| `dependency-analysis.md` | backend  | Análise de impacto com madge antes de refactors estruturais                  |

## Relação com outros documentos

- **CLAUDE.md**: instruções operacionais e contexto de sessão (tem prioridade sobre tudo)
- **docs/decisions/**: ADRs que podem sobrescrever regras específicas com justificativa
- **docs/plans/**: planos de feature aprovados que refinam aplicação das regras
- **docs/architecture/RULES_MAP.md**: classificação canônica (global / domain / workflow / governance) de cada regra
- **docs/architecture/SKILLS_PATTERN.md**: contrato canônico para qualquer nova skill
- **docs/architecture/AGENTS_DELEGATION.md**: matriz de delegação para os 26 subagentes
- **~/obsidian-vault/ioc-esg-municipal/long-term/gotchas.md**: exceções e casos especiais conhecidos
