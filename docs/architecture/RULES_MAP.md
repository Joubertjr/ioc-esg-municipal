# Mapa de Regras — Topologia Canônica

> **Documento único, versionado.** Classifica cada arquivo em `.claude/rules/` por tipo, escopo e gatilho.
> Complementa (não substitui) `.claude/rules/README.md`, que é o índice operacional para agentes.
> Revisão: trimestral, junto com `CLAUDE_CODE_ADOCAO_IOC_ESG.md`.

---

## 0. Propósito

Responder três perguntas com rastreabilidade:

1. **Que tipo de regra é essa?** — política técnica global, restrição de domínio, gatilho de fluxo
2. **Quando ela se aplica?** — sempre, em arquivos específicos, em atividades específicas
3. **Quem a enforça?** — hook runtime, agente antes de agir, humano em revisão

Regras que não cabem nessa taxonomia devem ser promovidas a ADR (`docs/decisions/`) ou rebaixadas a memory (operador).

---

## 1. Taxonomia

| Tipo                  | Definição operacional                                                         | Exemplo                                                    |
| --------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **global**            | Invariante que vale para qualquer alteração no repo, qualquer agente.         | `typescript.md` (zero `any`), `security.md` (sem segredos) |
| **domain**            | Vale apenas dentro de um subdiretório ou domínio funcional.                   | `backend.md`, `database.md`                                |
| **workflow-adjacent** | Vale quando uma atividade específica acontece (ex: alterar UI, deletar file). | `visual-qa.md`, `dependency-analysis.md`                   |
| **governance**        | Regras sobre como regras, memória e estado coexistem.                         | `memory-policy.md`, `git-commits.md`                       |

---

## 2. Inventário com classificação

| Arquivo                  | Tipo              | Escopo (path)                                          | Gatilho                                     | Enforçado por                           |
| ------------------------ | ----------------- | ------------------------------------------------------ | ------------------------------------------- | --------------------------------------- |
| `typescript.md`          | global            | `**/*.ts`, `**/*.tsx`                                  | Qualquer edição de código TS                | Agente (pré-ação) + `tsc` em CI         |
| `security.md`            | global            | todo o repo                                            | Sempre — toca credenciais, PII, auth, rotas | Agente + `pre_write_guard` hook         |
| `testing.md`             | global            | `**/*.test.ts`, `tests/**`                             | Criar/alterar teste                         | Agente + Vitest/Playwright em CI        |
| `docker.md`              | global            | `Dockerfile`, `docker-compose*.yml`                    | Qualquer mudança que exige rebuild          | Agente + `docker build` em CI           |
| `git-commits.md`         | governance        | commit message                                         | Sempre — ao commitar                        | Agente + humano em revisão              |
| `memory-policy.md`       | governance        | `~/.claude/.../memory/`, `.claude/rules/`, `CLAUDE.md` | Antes de salvar/ler memória                 | Agente (auto-memory) + auditor          |
| `backend.md`             | domain            | `backend/**`                                           | Editar controller/service/agent             | Agente (pré-ação) + code-reviewer       |
| `database.md`            | domain            | `prisma/**`, queries Prisma                            | Schema ou migration                         | Agente + database-architect             |
| `visual-qa.md`           | workflow-adjacent | `frontend/pages/**`, `frontend/components/**`          | Qualquer alteração de UI                    | Agente + `visual-qa` skill + pre-commit |
| `dependency-analysis.md` | workflow-adjacent | `backend/**`                                           | Deletar/mover/renomear módulo               | Agente (pré-refactor) + `pnpm madge:*`  |

---

## 3. Autoridade e conflitos

Ordem de precedência quando instruções colidem (do mais forte ao mais fraco):

1. **ADR ativo** em `docs/decisions/` que cite explicitamente a regra → vence
2. **CLAUDE.md** (instrução de projeto) → vence sobre regras se conflito explícito
3. **`.claude/rules/<arquivo>.md`** → política formal
4. **Plano ativo** em `docs/plans/` → refina aplicação da regra, nunca contradiz
5. **Memory** do operador → preferência local, **nunca** sobrescreve política

Regra não listada no inventário acima não é política — é rascunho. Promova-a a arquivo versionado ou remova.

---

## 4. Critérios de promoção/demoção

**Para promover uma instrução a regra** (ex: de CLAUDE.md ou memory para `.claude/rules/`):

- [ ] Aplica-se a mais de um operador/agente
- [ ] Pode ser violada de forma mensurável (existe teste, check, ou evidência)
- [ ] Tem escopo definível (path, atividade, tipo)
- [ ] Não duplica regra existente — se duplicar, ampliar a regra existente

**Para rebaixar uma regra a memory**:

- Deixou de valer para outros operadores ou para o projeto como um todo
- Virou preferência de estilo sem consequência técnica mensurável

**Para deletar uma regra**:

- ADR explicita sua revogação
- Nenhum agente a invoca em fluxo ativo há ≥1 trimestre
- Não há rastro em `logs/*.jsonl` indicando que ela bloqueou algo útil recentemente

---

## 5. Correspondência com fluxos canônicos

| Fluxo                        | Regras obrigatórias antes de concluir                                              |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Implementar feature backend  | `typescript.md`, `backend.md`, `security.md`, `testing.md`, `docker.md`            |
| Alterar schema Prisma        | `database.md`, `typescript.md`, `testing.md`                                       |
| Alterar UI frontend          | `typescript.md`, `visual-qa.md`, `testing.md`                                      |
| Refactor estrutural backend  | `dependency-analysis.md`, `backend.md`, `typescript.md`, `testing.md`, `docker.md` |
| Commit                       | `git-commits.md`, `visual-qa.md` (se UI), `security.md` (sem .env)                 |
| Coletar dados de API externa | `backend.md` (cache+retry), `typescript.md` (Zod), `security.md` (sem PII)         |

---

## 6. Histórico

- **2026-04-16** — criado no bundle P1 (Fases 7/8/9). Classifica as 10 regras então existentes.
