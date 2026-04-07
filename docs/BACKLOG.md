# Backlog — IOC ESG Municipal

Atualizado: 2026-04-07

---

## Legenda

- **Concluído** — implementado, testado, mergeado
- **Em andamento** — implementação ativa
- **Planejado** — aprovado, aguardando implementação
- **Backlog** — identificado, não priorizado

---

## Fase 1 — Comunicar Significado (UX Redesign) — Concluído

> Auditoria UX: 47 problemas (8 críticos, 22 altos). Tooltips, IndicatorRow, WCAG 2.1 AA, acentuação.

| Item                                                  | Status    | Arquivos                                         |
| ----------------------------------------------------- | --------- | ------------------------------------------------ |
| ods-descriptions.ts (dados de contexto 17 ODS)        | Concluído | shared/constants/ods-descriptions.ts             |
| OdsTooltip (hover com descrição + meta 2030)          | Concluído | frontend/src/components/ods/OdsTooltip.tsx       |
| IndicatorRow (valor + unidade + barra + ícone)        | Concluído | frontend/src/components/ods/IndicatorRow.tsx     |
| OdsCard redesign (score/100, ícones, progress bar)    | Concluído | frontend/src/components/ods/OdsCard.tsx          |
| GlobalScore redesign (tooltip, legenda 3 faixas)      | Concluído | frontend/src/components/ods/GlobalScore.tsx      |
| OdsDetailDrawer WCAG (aria-dialog, focus trap)        | Concluído | frontend/src/components/ods/OdsDetailDrawer.tsx  |
| OdsRadarChart (excluir null, meta 70, tooltip custom) | Concluído | frontend/src/components/charts/OdsRadarChart.tsx |
| DashboardPage (título, subtítulo dinâmico, legenda)   | Concluído | frontend/src/pages/DashboardPage.tsx             |
| SimulatorPage (área→ODS, R$ format, placeholder)      | Concluído | frontend/src/pages/SimulatorPage.tsx             |
| ReportsPage (barras, unidades, legenda impressão)     | Concluído | frontend/src/pages/ReportsPage.tsx               |
| MonitoringPage ("Mais urgente", legenda permanente)   | Concluído | frontend/src/pages/MonitoringPage.tsx            |
| AppShell (logo→link, combobox populares, ESC mobile)  | Concluído | frontend/src/components/layout/AppShell.tsx      |
| Acentuação (todas as 5 páginas + LoginPage)           | Concluído | 6 arquivos                                       |

---

## Fase 2 — Benchmarking + Ranking Estadual — Em andamento

> Prefeito precisa de contexto comparativo: "Meu score é bom comparado com SC?"

| Item                            | Status       | Arquivos                                                      |
| ------------------------------- | ------------ | ------------------------------------------------------------- |
| Tipos TypeScript benchmark      | Em andamento | frontend/src/types/benchmark.ts                               |
| Hook useBenchmark (React Query) | Em andamento | frontend/src/hooks/useBenchmark.ts                            |
| MunicipalityMultiSelect         | Em andamento | frontend/src/components/benchmark/MunicipalityMultiSelect.tsx |
| RankingTable                    | Em andamento | frontend/src/components/benchmark/RankingTable.tsx            |
| ComparisonRadar (Recharts)      | Em andamento | frontend/src/components/benchmark/ComparisonRadar.tsx         |
| OdsComparisonTable              | Em andamento | frontend/src/components/benchmark/OdsComparisonTable.tsx      |
| BenchmarkPage                   | Em andamento | frontend/src/pages/BenchmarkPage.tsx                          |
| Rota /benchmarks + nav item     | Em andamento | App.tsx + AppShell.tsx                                        |

---

## Fase 3 — Histórico Temporal + Tendências — Planejado

> ODS History endpoint já existe (GET /ods/:ibgeCode/history). Falta frontend.

| Item                                         | Status    | Arquivos |
| -------------------------------------------- | --------- | -------- |
| Gráfico de evolução temporal por ODS         | Planejado | —        |
| Indicador de tendência (melhorando/piorando) | Planejado | —        |
| Comparação ano a ano no dashboard            | Planejado | —        |

---

## Fase 4 — Recomendações por IA — Planejado

> Motor de recomendação baseado em gap analysis + benchmarks + simulação.

| Item                                              | Status    | Arquivos |
| ------------------------------------------------- | --------- | -------- |
| Endpoint de recomendações priorizadas             | Planejado | —        |
| Card "Próximos passos" no dashboard               | Planejado | —        |
| Integração com simulador (auto-preencher cenário) | Planejado | —        |

---

## Fase 5 — Multi-estado + Escala Nacional — Backlog

> Escalar de 295 SC → 5.570 Brasil. Requer: seed nacional, performance tuning.

| Item                                         | Status  | Arquivos |
| -------------------------------------------- | ------- | -------- |
| Seed municípios Brasil (5.570)               | Backlog | —        |
| Filtro por estado/região na UI               | Backlog | —        |
| Performance: paginação/virtualização ranking | Backlog | —        |
| Cache hierárquico (estado → município)       | Backlog | —        |

---

## Fase 6 — Deploy Produção + Onboarding — Backlog

> Primeiro cliente piloto em SC.

| Item                                    | Status  | Arquivos |
| --------------------------------------- | ------- | -------- |
| Deploy cloud (AWS/GCP)                  | Backlog | —        |
| Domínio + SSL                           | Backlog | —        |
| Onboarding flow (primeiro acesso)       | Backlog | —        |
| Multi-tenant (isolamento por município) | Backlog | —        |
| Billing integration                     | Backlog | —        |

---

## Bugs e Débitos Técnicos

| Item                                              | Severidade | Status                      |
| ------------------------------------------------- | ---------- | --------------------------- |
| Vitest SIGSEGV com 41+ arquivos                   | Baixa      | Workaround (batches)        |
| ProtectedRoute round-trip a cada mount            | Média      | Pendente (cache em context) |
| simulator_service.ts tsc error (Prisma JSON type) | Baixa      | Pendente                    |
