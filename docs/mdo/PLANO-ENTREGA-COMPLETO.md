# Plano de entrega completo — IOC ESG Municipal × MDO v0.1.5

**Produto:** SaaS B2G ESG municipal (ODS, FPM, 14 coletores)  
**Metodologia:** [metodologia-mdo](https://github.com/Joubertjr/metodologia-mdo)  
**Arquétipo MDO:** D (regulado / GovTech)  
**PMF:** validado — sem etapa de descoberta com piloto  
**Piloto técnico:** Florianópolis · IBGE `4205407` · ODS 3, 4, 6

---

## 1. Visão do que foi entregue

| Fase              | Entrega                                                              | Status             |
| ----------------- | -------------------------------------------------------------------- | ------------------ |
| Day 0 MDO         | Glossário, tool-scope, HITL doc, 7 schemas Zod, LLM client, 50 evals | ✅                 |
| API agêntica      | `GET …/executive`, `POST /query`, `POST /hitl/check`                 | ✅                 |
| Qualidade         | `pnpm eval:agent` (50/50), `eval:agent:fast` no CI                   | ✅                 |
| Frontend          | Dashboard: executivo + Q&A + HITL; Reports: executivo no topo        | ✅                 |
| Produto base      | Coletores, simulador FPM, relatório legado, 641+ testes              | ✅ (pré-existente) |
| Compliance formal | RoPA / DPIA assinados                                                | 🔜 backlog         |
| LLM em produção   | Respostas via `llm_client` com guardrails                            | 🔜 fase 2          |

---

## 2. APIs da camada agêntica

| Método | Rota                                     | Descrição                                       |
| ------ | ---------------------------------------- | ----------------------------------------------- |
| GET    | `/api/agent/reports/:ibgeCode/executive` | Relatório executivo (`ExecutiveReportSchema`)   |
| POST   | `/api/agent/query`                       | Q&A determinístico (`AgentQueryResponseSchema`) |
| POST   | `/api/agent/hitl/check`                  | Verifica se ação exige HITL                     |

**Autenticação:** JWT + escopo municipal (`requireMunicipalityScope`).  
**Q&A:** sem LLM na resposta (P-011); parse de “ODS N” e score global.  
**HITL:** `persist_scenario` e `publish_report` → aprovação admin/prefeito.

---

## 3. Frontend

| Tela         | Componentes MDO                                              |
| ------------ | ------------------------------------------------------------ |
| `/dashboard` | `ExecutiveReportPanel`, `AgentQueryPanel`, `HitlNoticePanel` |
| `/reports`   | `ExecutiveReportPanel` (resumo MDO + detalhe 17 ODS legado)  |

---

## 4. Comandos operacionais

```bash
# Evals agênticos (com integração)
pnpm eval:agent

# Evals rápidos (CI)
pnpm eval:agent:fast

# Testes unitários
pnpm test:unit

# Dev
pnpm dev
```

---

## 5. Documentação MDO no repositório

| Arquivo                              | Conteúdo                 |
| ------------------------------------ | ------------------------ |
| `docs/mdo/CLASSIFICACAO-MDO.md`      | Arquétipo D, PMF, piloto |
| `docs/mdo/DAY0-CHECKLIST.md`         | Checklist Day 0          |
| `docs/mdo/glossario.md`              | Termos canônicos         |
| `docs/mdo/tool_scope.md`             | Ferramentas permitidas   |
| `docs/mdo/hitl-queue.md`             | Fila e regras G-HITL-IOC |
| `docs/mdo/ROTEIRO-90MIN-IOC.md`      | Roteiro técnico          |
| `docs/mdo/PLANO-ENTREGA-COMPLETO.md` | Este documento           |

---

## 6. Backlog pós-entrega (fase 2)

1. **RoPA / DPIA** — documentos LGPD assinados pelo DPO municipal.
2. **LLM** — conectar `llm_client.ts` ao `/query` com fallback determinístico.
3. **HITL UI** — fila de aprovação com persistência (hoje só aviso + API check).
4. **Simulador** — flag `persistScenario` com gate HITL antes de gravar no Prisma.
5. **Auditoria** — persistir `AuditLogEntry` em tabela append-only.
6. **Evidências visuais** — screenshots reais do dashboard (substituir placeholders em `docs/evidence/`).

---

## 7. Critérios de aceite desta entrega

- [x] Day 0 MDO documentado e implementado no código
- [x] 50 evals passando localmente
- [x] CI com eval fast
- [x] Relatório executivo API + UI
- [x] Q&A determinístico API + UI
- [x] HITL check API + aviso UI
- [x] Integração Reports + link para relatório completo
- [x] Plano mestre consolidado (este arquivo)

---

_Última atualização: 2026-05-28 — entrega pós-validação PMF._
