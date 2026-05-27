# Classificação MDO — IOC ESG Municipal

> **Metodologia:** MDO v0.1.5 · **Data:** 2026-05-27  
> **Sub-SADR:** `06-decisao-arquitetural/05-sub-sadr-D-infra.md` (D regulado B2G)

---

## Resumo executivo

| Campo                | Valor                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Arquétipo**        | **D — Solo Infra / Workflow** (variante **D regulado** GovTech BR)                    |
| **Vertical**         | GovTech / ESG municipal — ODS, FPM, indicadores públicos brasileiros                  |
| **Quem paga**        | Prefeitura / secretarias municipais (B2G)                                             |
| **Como vende**       | SaaS B2G — licença por município / contrato institucional (não PLG consumer)          |
| **Regulado**         | Sim — LGPD (dados municipais e de gestão), transparência pública, APIs governamentais |
| **Stage Day 0**      | Stage 1 — `schema_contracts` + glossário + evals + tool-scope                         |
| **Arquitetura alvo** | D027 — Typed Workflow + Evals First (não multi-agent runtime por padrão)              |

**Não é arquétipo B:** apesar do label “SaaS”, o cliente é instituição pública com ciclo de compra lento, não consumidor self-serve. P-002 (distribuição PLG) é secundário.

**Não é arquétipo C:** o produto não é só síntese de corpus — é plataforma operacional (scores, simulador, relatórios, integrações).

**Não é arquétipo A:** não é consultoria outcome pura; é produto de workflow com entrega contínua via software.

---

## Princípios prioritários (ler primeiro)

| Princípio | Peso  | Aplicação em IOC ESG                                                          |
| --------- | ----- | ----------------------------------------------------------------------------- |
| **P-001** | ALTO  | Glossário ODS/FPM + schemas Zod nos contratos do agente                       |
| **P-006** | ALTO  | Tool-scope explícito nas 14 integrações + writeback (simulação, relatório)    |
| **P-007** | ALTO  | Vertical regulado BR — GovTech como caso de referência no corpus              |
| **P-010** | ALTO  | Soberania de dados — APIs públicas + dados municipais no território BR        |
| **P-008** | ALTO  | Hybrid routing quando relatórios/recomendações usarem LLM em escala           |
| P-003     | ALTO  | Stage 2 (semantic layer) só com gatilho — já há muitas integrações (ver G-01) |
| P-004     | MÉDIO | Se vender outcome (“economia de FPM comprovada”), eval ≥30 tasks              |

---

## Mínimos Day 0 (D enterprise / regulado)

| Artefato     | Piso universal | **Meta IOC ESG (D)**                | Onde no repo                           |
| ------------ | -------------- | ----------------------------------- | -------------------------------------- |
| Glossário    | ≥10 termos     | **≥15 termos**                      | `docs/mdo/glossario.md`                |
| Schemas      | ≥3             | **≥5–7 schemas**                    | `backend/services/agent/schemas.ts`    |
| Evals agente | ≥10 tasks      | **≥50 tasks** (iterar em 2 semanas) | `evals/agent-esg/`                     |
| Tool-scope   | ≤6 ferramentas | **≤6 declaradas**                   | `docs/mdo/tool_scope.md`               |
| LLM client   | abstração      | **implementado**                    | `backend/services/agent/llm_client.ts` |

**Já existente (fora do pacote MDO agente):** 641 testes Vitest, tipos em `shared/types/`, coletores, `backend/evaluation/longmemeval` (memória LLM — complementar, não substitui eval vertical).

---

## Gatilhos a monitorar

| Gatilho  | Status provável                                | Ação                                                                             |
| -------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| **G-01** | ⚠️ Parcialmente ativo (14 APIs governamentais) | Documentar contratos por integração; considerar Stage 2 semântico leve por fonte |
| **G-02** | Ativo (LGPD)                                   | RoPA/DPIA, audit trail em ações do agente, HITL em writeback                     |
| **G-04** | Futuro (multi-município em escala)             | Stage 2 quando ≥1k tenants                                                       |
| **G-11** | Contínuo                                       | Se camada semântica custar mais que ROI → não escalar                            |

---

## Anti-patterns críticos para este projeto

| AP                | Risco no IOC ESG                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| **AP-EXC-04**     | Multi-agent no **runtime** do produto sem 4 condições — dev agents Claude ≠ arquitetura de produção   |
| **AP-EXC-03**     | KG/ontology Day 0 antes de PMF municipal                                                              |
| **AP-EXC-01**     | Replicar Foundry solo                                                                                 |
| **Eval genérico** | LongMemEval útil para memória; **não** substitui eval de score ODS, simulador FPM, relatório prefeito |

---

## Piloto Day 0

| Campo                     | Valor                                                                           |
| ------------------------- | ------------------------------------------------------------------------------- |
| **Município piloto**      | **Florianópolis/SC** (IBGE `4205407`)                                           |
| **Justificativa**         | Capital, dados completos no seed, referência para expansão SC                   |
| **ODS prioritários**      | **3** (Saúde), **4** (Educação), **6** (Saneamento) — alinhado ao MVP 8 semanas |
| **Contato institucional** | _A preencher_ (prefeito/secretário)                                             |

Evals de integração usam `4205407` em `evals/agent-esg/tasks.json`.

---

## Próximos passos

1. Completar checklist em `docs/mdo/DAY0-CHECKLIST.md`
2. Expandir `evals/agent-esg/tasks/` até ≥50 tasks
3. Ligar `pnpm eval:agent` (script a criar) ao CI
4. Revisar `docs/mdo/tool_scope.md` a cada nova integração ou ferramenta LLM

**Referência MDO (repo separado):** [metodologia-mdo](https://github.com/Joubertjr/metodologia-mdo)
