# Tool-scope manifest — camada agêntica IOC ESG

- **Projeto:** IOC ESG Municipal
- **Versão:** 0.1
- **Última atualização:** 2026-05-27
- **Arquétipo MDO:** D regulado

## Princípios

1. Máximo **6 ferramentas** Day 0 para o agente LLM de produto (coletores ficam fora deste manifest).
2. Write em efeito institucional exige **HITL**.
3. Agente **não** altera scores determinísticos diretamente — apenas lê e interpreta.

---

## Ferramentas autorizadas

### 1. `postgres-read-municipal`

- **Tipo:** Prisma / SQL read-only
- **Escopo:** `read-only`
- **Permitido:** SELECT em scores, indicadores, histórico, metadados de município do tenant autenticado
- **Proibido:** INSERT/UPDATE/DELETE; acesso cross-tenant; tabelas de credenciais
- **Risco:** médio (vazamento entre municípios se RBAC falhar)

### 2. `api-collectors-read`

- **Tipo:** serviços internos de coleta (IBGE, SICONFI, DATASUS, …)
- **Escopo:** `read-only` (disparar re-coleta só via job agendado humano, não pelo LLM)
- **Permitido:** consultar último snapshot persistido; status de frescor
- **Proibido:** trigger em massa de 14 coletores pelo agente
- **Risco:** médio (carga em APIs governamentais)

### 3. `simulation-engine`

- **Tipo:** API interna simulador FPM
- **Escopo:** `read-only` para o LLM (executa simulação efêmera); persistência `write+HITL`
- **HITL:** salvar ou exportar cenário exige aprovação `prefeito` ou `admin`
- **Risco:** alto se persistido sem revisão

### 4. `report-generator`

- **Tipo:** geração PDF/Markdown relatório executivo
- **Escopo:** `write+HITL`
- **HITL:** publicar relatório com carimbo institucional exige confirmação na UI
- **Risco:** alto (decisão percebida como oficial)

### 5. `llm-inference`

- **Tipo:** `LLMClient` (Anthropic primário, OpenAI fallback)
- **Escopo:** `read-only` (sem side effects diretos)
- **Config:** `LLM_ROUTING_CONFIG` — tarefas `report`, `qa`, `judge` separadas
- **Risco:** médio (alucinação — mitigado por evals + procedência obrigatória)

### 6. `audit-log-append`

- **Tipo:** trilha imutável de ações do agente
- **Escopo:** `write` (append-only, sem delete)
- **Permitido:** registrar prompt hash, tools chamadas, usuário, timestamp
- **Proibido:** alterar ou apagar entradas
- **Risco:** baixo (compliance LGPD Art. 37)

---

## Explicitamente proibido para o agente LLM

- Criar usuários ou elevar RBAC
- Chamar APIs governamentais externas diretamente (bypass coletores)
- Multi-agent orchestration em runtime sem ADR aprovado (AP-EXC-04)
- Persistir recomendação como política oficial sem HITL

---

## Revisão

Qualquer nova ferramenta → PR + atualizar este arquivo + eval de regressão em `evals/agent-esg/`.
