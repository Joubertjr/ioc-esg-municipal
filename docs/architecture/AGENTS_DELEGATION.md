# Matriz de Delegação de Agentes — IOC ESG Municipal

> **Documento único, versionado.** Define taxonomia e política de delegação dos 26 subagentes em `.claude/agents/`.
> Fonte canônica para decidir _qual_ agente usar, _quando_ usar, e _quando não_ usar.
> Revisão: quando um agente for criado, reformado ou aposentado.

---

## 0. Princípios

1. **Contexto isolado tem preço.** Invocar um agente custa uma nova janela de contexto. Use quando há ganho de paralelismo, persona especializada, ou proteção do contexto principal — não para atalhos de conveniência.
2. **Design ≠ implementação.** Arquitetos produzem specs; implementadores escrevem código. Essas responsabilidades não se misturam no mesmo agente.
3. **Revisor não pode ser implementador.** O agente que escreveu o código não é o que revisa.
4. **Menor privilégio de tools.** `allowed-tools` declarado explicitamente. Read-only agents **nunca** têm Write/Edit.
5. **Escopo declarado.** Todo agente tem um "quando NÃO usar" tão claro quanto o "quando usar".

---

## 1. Frontmatter canônico de agente

```yaml
---
name: <kebab-case> # obrigatório
description: <quando usar; o que entrega> # obrigatório
allowed-tools: <CSV de tools> # obrigatório — sem array YAML legado
model: <claude-opus-4-6 | claude-sonnet-4-6 | claude-haiku-4-5-20251001> # obrigatório
effort: low | medium | high # opcional
---
```

**Regras:**

- `allowed-tools` em CSV. Agentes com legado `tools:` YAML array devem migrar (ver §6).
- `model` com ID completo. Shorthand (`sonnet`, `haiku`) não é aceito — normalize na próxima edição.
- Agentes de **design/revisão** declaram read-only (`Read, Glob, Grep` + Bash mínimo).
- Agentes de **implementação** podem ter `Write, Edit`.

---

## 2. Taxonomia

| Classe                | Papel                                                                  | Exemplo                                                                                       |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **coordinator**       | Orquestra outros agentes; roteia trabalho; não implementa diretamente. | `orchestrator`, `improvement-coordinator`                                                     |
| **architect**         | Produz specs/contratos; **não** escreve código de produto.             | `backend-architect`, `frontend-architect`, `database-architect`                               |
| **implementor**       | Implementa código a partir de specs.                                   | `api-developer`                                                                               |
| **domain-specialist** | Conhecimento de domínio específico (APIs externas, ODS).               | `data-collector`, `ods-analyst`                                                               |
| **reviewer**          | Revisa trabalho alheio, independente.                                  | `code-reviewer`, `security-auditor`, `visual-qa-auditor`, `audit-agent`                       |
| **verifier**          | Fecha ciclo de correção — valida binário pass/fail.                    | `fix-verifier`, `resolution-reporter`                                                         |
| **tester**            | Escreve e executa testes.                                              | `test-writer`, `integration-tester`                                                           |
| **debugger**          | Investiga causa raiz de bugs.                                          | `debugger`                                                                                    |
| **monitor**           | Análise contínua, dashboards, indicadores.                             | `project-monitor`, `observability-engineer`, `performance-analyzer`, `ux-performance-monitor` |
| **documenter**        | Documentação técnica, memória de longo prazo.                          | `docs-writer`, `memory-manager`                                                               |
| **ops**               | Infraestrutura, deploy, Docker.                                        | `devops-engineer`, `docker-ops`                                                               |
| **ux**                | Análise de experiência do usuário.                                     | `ux-reviewer`                                                                                 |

---

## 3. Matriz por agente (26 agentes)

### 3.1 Coordinators

| Agente                    | Modelo | Quando usar                                            | Quando NÃO usar                                                           |
| ------------------------- | ------ | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `orchestrator`            | opus   | Feature grande com múltiplos especialistas em paralelo | Tarefa de 1 arquivo; ciclo de improvement (use `improvement-coordinator`) |
| `improvement-coordinator` | opus   | Ciclo audit→fix→verify de melhorias auto-gerenciado    | Features novas; investigação ad-hoc                                       |

### 3.2 Architects (design-only, read-only)

| Agente               | Modelo | Quando usar                                        | Quando NÃO usar                            |
| -------------------- | ------ | -------------------------------------------------- | ------------------------------------------ |
| `backend-architect`  | opus   | Antes de implementar rota/service/módulo backend   | Alterações pontuais que não mudam contrato |
| `frontend-architect` | opus   | Antes de criar página/feature de UI                | Ajustes cosméticos; fix de bug de CSS      |
| `database-architect` | opus   | Mudança de schema, migration complexa, query lenta | CRUD simples seguindo padrão existente     |

### 3.3 Implementor

| Agente          | Modelo | Quando usar                                                          | Quando NÃO usar                          |
| --------------- | ------ | -------------------------------------------------------------------- | ---------------------------------------- |
| `api-developer` | sonnet | Implementar endpoint/service a partir de spec do `backend-architect` | Sem spec; bugs isolados (use `debugger`) |

### 3.4 Domain specialists

| Agente           | Modelo | Quando usar                                               | Quando NÃO usar                                |
| ---------------- | ------ | --------------------------------------------------------- | ---------------------------------------------- |
| `data-collector` | sonnet | Implementar/debugar coletor de API gov (IBGE, SICONFI, …) | Outras APIs; transformação de dados pós-coleta |
| `ods-analyst`    | sonnet | Calculator de score ODS, benchmarking, alertas de gap     | Modelagem de banco; UI; coleta de dados        |

### 3.5 Reviewers (independentes, read-only)

| Agente              | Modelo | Quando usar                                          | Quando NÃO usar                                   |
| ------------------- | ------ | ---------------------------------------------------- | ------------------------------------------------- |
| `code-reviewer`     | sonnet | Revisão de diff depois de feature implementada       | Revisar código que o próprio revisor escreveu     |
| `security-auditor`  | opus   | Antes de deploy; após auth/pagamento/PII; trimestral | Mudanças cosméticas sem impacto de segurança      |
| `visual-qa-auditor` | sonnet | Validar screenshots após `/visual-qa` — 11 critérios | Análise funcional de UI (use `ux-reviewer`)       |
| `audit-agent`       | sonnet | Auditoria end-to-end periódica — 5 dimensões         | Revisão de um PR específico (use `code-reviewer`) |

### 3.6 Verifiers

| Agente                | Modelo | Quando usar                                    | Quando NÃO usar                           |
| --------------------- | ------ | ---------------------------------------------- | ----------------------------------------- |
| `fix-verifier`        | sonnet | Após fix de achado — retorna pass/fail binário | Revisão qualitativa (use `code-reviewer`) |
| `resolution-reporter` | sonnet | Fechar ciclo de improvement — persiste decisão | Antes de fix ser verificado               |

### 3.7 Testers

| Agente               | Modelo | Quando usar                                     | Quando NÃO usar                                     |
| -------------------- | ------ | ----------------------------------------------- | --------------------------------------------------- |
| `test-writer`        | sonnet | Cobertura unitária/integração de código novo    | E2E contra stack rodando (use `integration-tester`) |
| `integration-tester` | sonnet | E2E contra Docker rodando — requests HTTP reais | Teste unit; lint; tipos                             |

### 3.8 Debugger

| Agente     | Modelo | Quando usar                                         | Quando NÃO usar                              |
| ---------- | ------ | --------------------------------------------------- | -------------------------------------------- |
| `debugger` | opus   | Bug cuja causa raiz não é óbvia após 2-3 tentativas | Typo; erro claro de compilação; feature nova |

### 3.9 Monitors (análise contínua)

| Agente                   | Modelo | Quando usar                                         | Quando NÃO usar                                        |
| ------------------------ | ------ | --------------------------------------------------- | ------------------------------------------------------ |
| `project-monitor`        | opus   | Auditoria de coerência, gargalos, KPIs do projeto   | Medir performance técnica (use `performance-analyzer`) |
| `observability-engineer` | opus   | Saúde do sistema, logs, métricas, tempo de resposta | Análise UX; QA visual                                  |
| `performance-analyzer`   | opus   | Sistema lento; antes de otimizar; escala antecipada | Bug funcional; ajustes de UX                           |
| `ux-performance-monitor` | sonnet | Core Web Vitals, bundle size, friction de UX        | Causa raiz backend (use `performance-analyzer`)        |

### 3.10 Documenters

| Agente           | Modelo | Quando usar                                      | Quando NÃO usar                               |
| ---------------- | ------ | ------------------------------------------------ | --------------------------------------------- |
| `docs-writer`    | sonnet | README, API docs, guia de contribuição — técnico | ADRs (escreva inline no `docs/decisions/`)    |
| `memory-manager` | sonnet | Consolidar memória persistente no Obsidian vault | Memória do operador (`~/.claude/.../memory/`) |

### 3.11 Ops

| Agente            | Modelo | Quando usar                                               | Quando NÃO usar                               |
| ----------------- | ------ | --------------------------------------------------------- | --------------------------------------------- |
| `devops-engineer` | haiku  | CI/CD, envs, scripts de deploy, infraestrutura não-Docker | Troubleshoot Docker local (use `docker-ops`)  |
| `docker-ops`      | haiku  | Build, networking, volumes, container crashando           | Pipeline CI do GitHub (use `devops-engineer`) |

### 3.12 UX

| Agente        | Modelo | Quando usar                                       | Quando NÃO usar                                                                    |
| ------------- | ------ | ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ux-reviewer` | sonnet | Análise de fluxo, mensagens, loading/error states | Validar screenshots (use `visual-qa-auditor`); perf (use `ux-performance-monitor`) |

---

## 4. Resolução de sobreposições conhecidas

| Par suspeito de overlap                            | Regra de desempate                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `devops-engineer` vs `docker-ops`                  | CI/CD pipelines e provisionamento → devops. Container local e Dockerfile → docker-ops.                        |
| `ux-reviewer` vs `ux-performance-monitor`          | Fluxo e acessibilidade → ux-reviewer. Web Vitals e bundle → ux-performance-monitor.                           |
| `ux-reviewer` vs `visual-qa-auditor`               | Crítica de UX subjetiva → ux-reviewer. Checklist objetivo sobre screenshot → visual-qa-auditor.               |
| `audit-agent` vs `project-monitor`                 | Auditoria pontual e-to-e → audit-agent. Indicadores contínuos de saúde do projeto → project-monitor.          |
| `observability-engineer` vs `performance-analyzer` | Saúde, logs, erros, métricas operacionais → observability. Gargalo específico a medir → performance-analyzer. |
| `code-reviewer` vs `security-auditor`              | Diff de feature geral → code-reviewer. Auth/PII/cripto/pagamento → security-auditor.                          |

---

## 5. Padrões de delegação

### 5.1 Feature nova (implementação grande)

```
orchestrator
 ├─ backend-architect      (spec)
 ├─ frontend-architect     (spec)
 └─ database-architect     (spec)
       ↓ (specs prontos, depois)
    api-developer          (implementa backend)
    [humano implementa UI guiado por frontend-architect]
       ↓
    test-writer            (cobertura)
    integration-tester     (E2E)
       ↓
    code-reviewer          (independente)
    security-auditor       (se tocou auth/PII)
    visual-qa-auditor      (se tocou UI)
```

### 5.2 Melhoria auto-gerenciada

```
improvement-coordinator
 ├─ audit-agent           (identifica achados)
 ├─ [fix]                 (implementador apropriado)
 ├─ fix-verifier          (pass/fail)
 └─ resolution-reporter   (fecha ciclo)
```

### 5.3 Bug difícil

```
debugger                  (causa raiz)
  → [implementador apropriado] (fix)
  → test-writer           (regressão)
  → code-reviewer         (revisão)
```

---

## 6. Débito técnico a ser liquidado

**Frontmatter legado (`tools:` array YAML):**

- `integration-tester.md` — migrar para `allowed-tools:` CSV + model ID completo
- `ux-reviewer.md` — migrar para `allowed-tools:` CSV + model ID completo
- `docker-ops.md` — migrar para `allowed-tools:` CSV + model ID completo

**Model shorthand** (`sonnet`, `haiku` sem sufixo de versão):

- Mesmos três agentes acima. Normalizar para IDs completos.

Essas migrações são aplicadas no bundle P1 (Fase 9) — nenhum agente novo pode nascer com o formato legado.

---

## 7. Critérios para criar / reformar / aposentar agente

**Criar novo agente:**

- [ ] Responsabilidade não cabe em nenhum dos 26 existentes
- [ ] Tem "quando usar" e "quando NÃO usar" não triviais
- [ ] Justifica contexto isolado (persona, paralelismo, proteção de contexto)
- [ ] Define `allowed-tools` mínimo, `model` e `description` conforme §1

**Reformar:**

- Mudar `description`, `model` ou `allowed-tools` em edit atômico; registrar motivo no commit.
- Se o escopo muda de forma que afeta delegação, atualizar esta matriz no mesmo commit.

**Aposentar:**

- Agente não foi invocado em ≥1 trimestre e sua responsabilidade está coberta por outro agente
- ADR em `docs/decisions/` aprova a remoção
- Entrada removida desta matriz no mesmo commit

---

## 8. Histórico

- **2026-04-16** — criado no bundle P1. Classifica 26 agentes, documenta 6 overlaps, identifica débito de 3 frontmatters legados.
