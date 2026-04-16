# Adoção Arquitetural Claude Code — IOC ESG Municipal

> **Documento único, versionado.** Responde três perguntas: o que adotamos, o que falta, o que fica fora.
> Fonte canônica — nenhum outro doc deve contradizer este.
> Revisão: antes de cada release de produção (mínimo trimestral).

---

## 0. Classificação do Projeto

| Dimensão             | Valor                                                          |
| -------------------- | -------------------------------------------------------------- |
| Natureza             | Projeto com **estado persistente** (Postgres + Redis)          |
| Modelo de agentes    | **Multiagente moderado** (26 subagentes, 15 skills, 12 cmds)   |
| Integrações externas | 7 APIs governamentais reais + 7 coletores estáticos            |
| Criticidade          | Alta — produto B2G pago, SLA implícito, auditoria TCE possível |
| Mercado alvo         | Exclusivo: 295 municípios de Santa Catarina                    |
| Posição no ciclo     | Código pronto para go-live; infraestrutura aguarda provisão    |

---

## 1. Arquitetura-alvo

O objetivo é que toda sessão do Claude Code neste projeto consiga provar, com evidência:

1. qual instrução persistente foi carregada (CLAUDE.md + rules + settings)
2. qual prompt foi submetido e sua classificação
3. quais tools foram permitidas, bloqueadas e executadas
4. quais mutações relevantes foram feitas em arquivos
5. qual contexto foi injetado em cada sessão
6. qual regra enforçou qual decisão

Isso se materializa em cinco componentes:

| Componente                | Função                                                           |
| ------------------------- | ---------------------------------------------------------------- |
| **CLAUDE.md**             | Instrução persistente curta, estável, não volátil                |
| **.claude/rules/**        | Política formal por domínio (typescript, backend, security, …)   |
| **.claude/settings.json** | Governança: permissões, hooks, modelo, MCP                       |
| **.claude/hooks/**        | Loop canônico: SessionStart → UserPromptSubmit → Pre/Post → Stop |
| **logs/\*.jsonl**         | Audit trail append-only (sessão, runtime, violações)             |

Estado operacional mutável fica **fora** de CLAUDE.md e vive em `docs/ESTADO_ATUAL_SC.md` (projection humana).

---

## 2. Matriz de Aderência (baseline 2026-04-16)

Legenda: **OK** = adotado e provável | **PARCIAL** = adotado mas incompleto | **AUSENTE** = ainda não adotado | **DESALINHADO** = existe mas contra a arquitetura-alvo | **NÃO ADOTAR AGORA** = decisão explícita de ficar fora

### 2.1 Instrução persistente

| Componente                             | Status | Evidência / Gap                                                                  |
| -------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| CLAUDE.md                              | OK     | §ESTADO OPERACIONAL aponta para fontes vivas — sem status table volátil          |
| .claude/rules/ (9 arquivos)            | OK     | typescript, backend, database, security, testing, docker, git-commits, visual-qa |
| .claude/rules/ — prova de carregamento | OK     | `instructions_loaded` em `logs/claude-sessions.jsonl` com SHA de cada regra      |
| .claude/GOTCHAS.md                     | OK     | Contexto crítico estável do domínio                                              |
| docs/architecture/CLAUDE*CODE_ADOCAO*… | OK     | Este documento                                                                   |

### 2.2 Source of truth de estado

| Componente                                  | Status           | Evidência / Gap                                                       |
| ------------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| docs/ESTADO_ATUAL_SC.md                     | OK               | Única projection humana (referenciado em PR template, /state, README) |
| docs/PROJECT_STATE.md                       | OK               | 4 referências canônicas migradas; artefatos históricos preservados    |
| state/runtime-state.json (machine-readable) | NÃO ADOTAR AGORA | Backlog — só quando houver consumidor automatizado                    |

### 2.3 Loop de Hooks (runtime enforcement)

| Hook                        | Status | Evidência / Gap                                                       |
| --------------------------- | ------ | --------------------------------------------------------------------- |
| SessionStart                | OK     | `session_start.py` emite `session_start` + `instructions_loaded`      |
| UserPromptSubmit            | OK     | `user_prompt_submit.py` classifica categoria+risco em JSONL           |
| PreToolUse Bash             | OK     | `pre_bash_guard.py` bloqueia 14 padrões e emite `pretool_block/allow` |
| PreToolUse Write/Edit       | OK     | `pre_write_guard.py` bloqueia `.env`/chaves e emite `pretool_block`   |
| PostToolUse (Write/Edit)    | OK     | `post_format.sh` auto-formata ts/js/py/md/json                        |
| PostToolUse audit universal | OK     | `post_tool_audit.py` registra `write_mutation` e `tool_failure`       |
| PreCompact                  | OK     | `pre_compact_save.py` salva backup + emite `compact_backup`           |
| Stop                        | OK     | `stop_activity_log.py` emite `session_stop` + mantém log humano       |

### 2.4 Audit trail

| Componente                   | Status | Evidência / Gap                                                        |
| ---------------------------- | ------ | ---------------------------------------------------------------------- |
| logs/claude-runtime.jsonl    | OK     | prompt, pretool_allow, write_mutation, compact_backup                  |
| logs/claude-violations.jsonl | OK     | pretool_block, tool_failure                                            |
| logs/claude-sessions.jsonl   | OK     | session_start, instructions_loaded, session_stop                       |
| logs/SCHEMA.md               | OK     | Esquema documentado, versionado                                        |
| .claude/logs/activity.log    | OK     | Mantido como compat (linha humana); verdade canônica em sessions.jsonl |
| Rotação                      | OK     | 50 MB → tail 5000 linhas (implementado em `_ledger._rotate`)           |

### 2.5 Governança (settings.json)

| Item                                     | Status | Evidência / Gap                                                                  |
| ---------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Perfil default                           | OK     | settings.json com allow/deny e hooks completos                                   |
| Topologia settings vs local              | OK     | Ver `docs/architecture/SETTINGS_TOPOLOGIA.md`                                    |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | OK     | Movido para settings.local.json (experimental isolado)                           |
| MCP                                      | OK     | Baseline zero; `obsidian-vault` classificado como local em `MCP_HYGIENE.md` (P2) |

### 2.6 Memory, Skills, Subagentes

| Componente                                          | Status | Evidência / Gap                                                     |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| Política de memory (.claude/rules/memory-policy.md) | OK     | Define memory vs rules vs CLAUDE.md vs logs (Fase 6)                |
| Memory do usuário                                   | OK     | Escopo de usuário — preferências, não política de projeto           |
| .claude/rules/ (10 regras)                          | OK     | Classificadas em `docs/architecture/RULES_MAP.md` (Fase 7)          |
| .claude/skills/ (15 skills)                         | OK     | Contrato canônico em `docs/architecture/SKILLS_PATTERN.md` (Fase 8) |
| .claude/agents/ (26 agentes)                        | OK     | Matriz em `docs/architecture/AGENTS_DELEGATION.md` (Fase 9)         |
| .claude/commands/ (12 comandos)                     | OK     | Invocáveis via /slash                                               |

### 2.7 Estrutura física

| Diretório            | Status | Função                                                               |
| -------------------- | ------ | -------------------------------------------------------------------- |
| `docs/`              | OK     | Documentação humana (inclui decisions/, evidence/, plans/)           |
| `docs/architecture/` | OK     | 8 documentos canônicos — ver `PHYSICAL_TOPOLOGY.md` (P2)             |
| `docs/evidence/`     | OK     | Evidências visuais de UI                                             |
| `state/`             | OK     | Reservado com README (P2); sem consumidor automatizado hoje          |
| `logs/`              | OK     | Append-only JSONL (schema em `logs/SCHEMA.md`)                       |
| `.claude/backups/`   | OK     | Resiliência local (pre-compact snapshots); gitignored                |
| `.claude/logs/`      | OK     | Mantém `activity.log` humano; trilha auditável em `logs/`            |
| Fronteira canônica   | OK     | Documentada em `docs/architecture/PHYSICAL_TOPOLOGY.md` (P2 Fase 11) |

---

## 3. Estado Consolidado de Adoção (após P0 + P1 + P2)

### 3.1 Adotados

| Componente                  | Documento canônico                                   |
| --------------------------- | ---------------------------------------------------- |
| Instrução persistente       | `CLAUDE.md` + `.claude/rules/` (10 arquivos)         |
| Mapa de rules               | `docs/architecture/RULES_MAP.md`                     |
| Skills padronizadas         | `docs/architecture/SKILLS_PATTERN.md` + 15 skills    |
| Delegação de agents         | `docs/architecture/AGENTS_DELEGATION.md` + 26 agents |
| Topologia de settings       | `docs/architecture/SETTINGS_TOPOLOGIA.md`            |
| Higiene de MCP              | `docs/architecture/MCP_HYGIENE.md` (P2)              |
| Topologia física            | `docs/architecture/PHYSICAL_TOPOLOGY.md` (P2)        |
| Hardening e checklist final | `docs/architecture/HARDENING_CHECKLIST.md` (P2)      |
| Loop de hooks runtime       | `.claude/hooks/` (6 eventos) + `logs/SCHEMA.md`      |
| Audit trail                 | `logs/claude-{runtime,violations,sessions}.jsonl`    |
| Política de memória         | `.claude/rules/memory-policy.md`                     |

### 3.2 Adotados parcialmente

Nenhum. Após o fechamento do P2 não há mais itens PARCIAL na matriz §2.

### 3.3 Explicitamente não adotados (com justificativa arquitetural)

| Item                                     | Razão arquitetural                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Plugins próprios                         | Custo de manutenção > benefício para 1 projeto. Reabrir só via ADR com caso concreto.         |
| Scheduled Tasks / Cron do runtime Claude | Ações cron operacionais estão em crontab do servidor (SSL renew em `setup-ssl.sh`).           |
| Agent Teams como mecanismo padrão        | Experimental; projeto usa orquestração manual via `orchestrator` + `improvement-coordinator`. |
| MCPs adicionais no baseline              | Baseline zero é decisão — ver `MCP_HYGIENE.md` §1. Outros MCPs exigem ADR + smoke test.       |
| `state/runtime-state.json` machine-read  | Sem consumidor automatizado hoje. README em `state/` explica critério de ativação.            |
| Dashboard de métricas Claude Code        | Auditoria manual dos JSONL é suficiente para volume atual (ver `HARDENING_CHECKLIST.md` §4).  |
| CI gate que valida `.claude/`            | Pre-commit hooks locais cobrem; CI gate exigiria ADR separado.                                |

### 3.4 Futuros (sob demanda, não roadmap ativo)

| Item                                   | Quando reconsiderar                                                        |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Machine-readable projections em state/ | Quando existir consumidor automatizado identificado                        |
| Dashboard de métricas                  | Quando volume de sessões ultrapassar capacidade de auditoria manual        |
| Plugin próprio                         | Quando um padrão recorrente se repetir em ≥3 projetos sob o mesmo operador |
| Agent Teams como default               | Quando o flag deixar de ser experimental upstream                          |

Qualquer reabertura requer ADR em `docs/decisions/`.

---

## 4. Critério de Fechamento do Roadmap Claude Code

O projeto considera a arquitetura Claude Code **madura** quando, em uma auditoria aleatória, for possível responder com evidência em arquivo:

1. Qual instrução persistente foi carregada? → `logs/claude-sessions.jsonl` (`instructions_loaded`)
2. Qual prompt foi submetido e classificado como? → `logs/claude-runtime.jsonl` (`prompt_submitted`)
3. Qual tool foi permitida/bloqueada e por quê? → `logs/claude-violations.jsonl` e `logs/claude-runtime.jsonl`
4. Qual mutação relevante ocorreu? → `git log` + `logs/claude-runtime.jsonl` (`write_mutation`)
5. Memory não está substituindo política? → `.claude/rules/memory-policy.md` define limites explícitos
6. Experimental está fora do baseline? → `settings.json` do projeto sem flags experimentais (ver `SETTINGS_TOPOLOGIA.md`)

---

## 5. Referências Cruzadas

- Política de memory: `.claude/rules/memory-policy.md`
- Mapa de regras: `docs/architecture/RULES_MAP.md`
- Padrão canônico de skills: `docs/architecture/SKILLS_PATTERN.md`
- Matriz de delegação de agentes: `docs/architecture/AGENTS_DELEGATION.md`
- Topologia de settings: `docs/architecture/SETTINGS_TOPOLOGIA.md`
- Higiene de MCP: `docs/architecture/MCP_HYGIENE.md`
- Topologia física: `docs/architecture/PHYSICAL_TOPOLOGY.md`
- Hardening e checklist final: `docs/architecture/HARDENING_CHECKLIST.md`
- Schema de eventos: `logs/SCHEMA.md`
- Runbook de produção: `docs/RUNBOOK_PRODUCAO.md`
- Plano mestre executado: §Fases 0-13 (orientação externa). Bundles P0 (Fases 0-6), P1 (Fases 7-9) e P2 (Fases 10-13) concluídos.

---

_Última revisão: 2026-04-16 — Fases 0-13 concluídas (bundles P0 + P1 + P2)._
