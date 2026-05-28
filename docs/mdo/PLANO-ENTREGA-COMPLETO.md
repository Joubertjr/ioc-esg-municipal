# Plano de entrega completo — IOC ESG Municipal × MDO v0.1.5

**Produto:** SaaS B2G ESG municipal (ODS, FPM, 14 coletores)  
**Metodologia:** [metodologia-mdo](https://github.com/Joubertjr/metodologia-mdo)  
**Arquétipo MDO:** D (regulado / GovTech)  
**PMF:** validado — sem etapa de descoberta com piloto  
**Piloto técnico:** Florianópolis · IBGE `4205407` · ODS 3, 4, 6

---

## 1. Visão do que foi entregue

| Fase             | Entrega                                                              | Status             |
| ---------------- | -------------------------------------------------------------------- | ------------------ |
| Day 0 MDO        | Glossário, tool-scope, HITL doc, 7 schemas Zod, LLM client, 50 evals | ✅                 |
| API agêntica     | `GET …/executive`, `POST /query`, `POST /hitl/check`                 | ✅                 |
| Qualidade        | `pnpm eval:agent` (50/50), `eval:agent:fast` no CI                   | ✅                 |
| Frontend         | Dashboard: executivo + Q&A + HITL; Reports: executivo no topo        | ✅                 |
| Produto base     | Coletores, simulador FPM, relatório legado, 641+ testes              | ✅ (pré-existente) |
| Compliance       | Templates RoPA/DPIA (`docs/compliance/`)                             | ✅ template        |
| LLM em produção  | `AGENT_LLM_QA_ENABLED` + fallback determinístico                     | ✅                 |
| HITL + auditoria | `HitlRequest`, `AgentAuditLog`, fila UI, `persistScenario`           | ✅ fase 2          |

---

## 2. APIs da camada agêntica

| Método | Rota                                           | Descrição                                       |
| ------ | ---------------------------------------------- | ----------------------------------------------- |
| GET    | `/api/agent/reports/:ibgeCode/executive`       | Relatório executivo (`ExecutiveReportSchema`)   |
| POST   | `/api/agent/query`                             | Q&A determinístico (`AgentQueryResponseSchema`) |
| POST   | `/api/agent/hitl/check`                        | Verifica se ação exige HITL                     |
| GET    | `/api/agent/hitl/pending`                      | Fila pendente (admin/prefeito)                  |
| POST   | `/api/agent/hitl/:id/approve`                  | Aprova e executa ação                           |
| POST   | `/api/agent/hitl/:id/reject`                   | Rejeita pedido                                  |
| POST   | `/api/agent/reports/:ibgeCode/publish-request` | Solicita publicação (HITL)                      |
| GET    | `/api/agent/reports/:ibgeCode/published`       | Último relatório publicado + carimbo            |
| GET    | `/api/agent/audit/logs`                        | Trilha de auditoria agêntica                    |

**Autenticação:** JWT + escopo municipal (`requireMunicipalityScope`).  
**Q&A:** determinístico por padrão; LLM opcional com fallback (P-011).  
**HITL:** `persist_scenario` no simulador → fila antes de gravar no Prisma.

---

## 3. Frontend

| Tela         | Componentes MDO                                             |
| ------------ | ----------------------------------------------------------- |
| `/dashboard` | Executivo, Q&A, `HitlQueuePanel`, aviso HITL                |
| `/simulator` | Checkbox `persistScenario` → fila HITL                      |
| `/reports`   | `ExecutiveReportPanel` (resumo MDO + detalhe 17 ODS legado) |

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

## 6. Fase 3 (entregue)

| Item                                                     | Status |
| -------------------------------------------------------- | ------ |
| `publish_report` HITL + `PublishedExecutiveReport`       | ✅     |
| Carimbo institucional na impressão (`/reports`)          | ✅     |
| `GET /audit/logs`                                        | ✅     |
| `.env.example` camada MDO                                | ✅     |
| `docs/mdo/MIGRACAO-MDO.md` + `docs/compliance/README.md` | ✅     |

## 7. Backlog residual

1. **RoPA / DPIA assinados** pelo DPO municipal.
2. **Screenshots reais** em `docs/evidence/`.
3. **Retenção/purge** automatizado de `AgentAuditLog`.

---

## 8. Critérios de aceite desta entrega

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
