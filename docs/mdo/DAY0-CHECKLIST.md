# Checklist Day 0 MDO — IOC ESG Municipal

Arquétipo **D regulado** · Meta ≤2 semanas full-time

```
[x] AÇÃO 1 — Glossário ≥15 termos com procedência     → docs/mdo/glossario.md
[x] AÇÃO 2 — Schemas Zod ≥7 (input/output/estado…)    → backend/services/agent/schemas.ts
[x] AÇÃO 3 — Eval set ≥50 tasks (**50** em `tasks.json`, runner OK) → evals/agent-esg/
[x] AÇÃO 4 — Tool-scope ≤6 ferramentas + HITL        → docs/mdo/tool_scope.md
[x] AÇÃO 5 — Abstração LLM multi-provedor            → backend/services/agent/llm_client.ts
```

**Status:** **5/5 Day 0 camada agêntica** · `pnpm eval:agent:fast` (44 tasks) · `pnpm eval:agent` (50 tasks c/ integração)

**Pós-Day 0 (entrega PMF):**

```
[x] Relatório executivo API + dashboard + /reports
[x] Q&A determinístico POST /api/agent/query + AgentQueryPanel
[x] HITL check API + HitlNoticePanel
[x] Plano mestre → PLANO-ENTREGA-COMPLETO.md
[ ] RoPA / DPIA formal
[ ] LLM em /query com fallback determinístico
[ ] Fila HITL com persistência e aprovação na UI
```

**5/5 cumpridos** = aderente à Tese Revisada Day 0 para a camada agêntica do produto.
