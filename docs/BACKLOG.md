# Backlog — IOC ESG Municipal

Atualizado: 2026-04-07

**Escopo:** Santa Catarina (295 municípios). Escala nacional adiada.
**Escala de agentes:** Maximizar paralelismo com múltiplos agentes Claude em cada fase.

---

## Legenda

- **Concluido** — implementado, testado, mergeado
- **Em andamento** — implementacao ativa
- **Planejado** — aprovado, aguardando implementacao
- **Backlog** — identificado, nao priorizado

---

## Fase 1 — Comunicar Significado (UX Redesign) — Concluido

> Auditoria UX: 47 problemas (8 criticos, 22 altos). Tooltips, IndicatorRow, WCAG 2.1 AA, acentuacao.

| Item                                                  | Status    | Arquivos                                         |
| ----------------------------------------------------- | --------- | ------------------------------------------------ |
| ods-descriptions.ts (dados de contexto 17 ODS)        | Concluido | shared/constants/ods-descriptions.ts             |
| OdsTooltip (hover com descricao + meta 2030)          | Concluido | frontend/src/components/ods/OdsTooltip.tsx       |
| IndicatorRow (valor + unidade + barra + icone)        | Concluido | frontend/src/components/ods/IndicatorRow.tsx     |
| OdsCard redesign (score/100, icones, progress bar)    | Concluido | frontend/src/components/ods/OdsCard.tsx          |
| GlobalScore redesign (tooltip, legenda 3 faixas)      | Concluido | frontend/src/components/ods/GlobalScore.tsx      |
| OdsDetailDrawer WCAG (aria-dialog, focus trap)        | Concluido | frontend/src/components/ods/OdsDetailDrawer.tsx  |
| OdsRadarChart (excluir null, meta 70, tooltip custom) | Concluido | frontend/src/components/charts/OdsRadarChart.tsx |
| DashboardPage (titulo, subtitulo dinamico, legenda)   | Concluido | frontend/src/pages/DashboardPage.tsx             |
| SimulatorPage (area->ODS, R$ format, placeholder)     | Concluido | frontend/src/pages/SimulatorPage.tsx             |
| ReportsPage (barras, unidades, legenda impressao)     | Concluido | frontend/src/pages/ReportsPage.tsx               |
| MonitoringPage ("Mais urgente", legenda permanente)   | Concluido | frontend/src/pages/MonitoringPage.tsx            |
| AppShell (logo->link, combobox populares, ESC mobile) | Concluido | frontend/src/components/layout/AppShell.tsx      |
| Acentuacao (todas as 5 paginas + LoginPage)           | Concluido | 6 arquivos                                       |

---

## Fase 2 — Benchmarking + Ranking Estadual — Concluido

> Prefeito precisa de contexto comparativo: "Meu score e bom comparado com SC?"

| Item                            | Status    | Arquivos                                                      |
| ------------------------------- | --------- | ------------------------------------------------------------- |
| Tipos TypeScript benchmark      | Concluido | frontend/src/types/benchmark.ts                               |
| Hook useBenchmark (React Query) | Concluido | frontend/src/hooks/useBenchmark.ts                            |
| MunicipalityMultiSelect         | Concluido | frontend/src/components/benchmark/MunicipalityMultiSelect.tsx |
| RankingTable                    | Concluido | frontend/src/components/benchmark/RankingTable.tsx            |
| ComparisonRadar (Recharts)      | Concluido | frontend/src/components/benchmark/ComparisonRadar.tsx         |
| OdsComparisonTable              | Concluido | frontend/src/components/benchmark/OdsComparisonTable.tsx      |
| BenchmarkPage                   | Concluido | frontend/src/pages/BenchmarkPage.tsx                          |
| Rota /benchmark + nav item      | Concluido | App.tsx + AppShell.tsx                                        |

---

## Fase 3 — Historico Temporal + Tendencias — Concluido

> ODS History endpoint ja existe. Frontend implementado com chart e trend badges.

| Item                                      | Status    | Arquivos                                           |
| ----------------------------------------- | --------- | -------------------------------------------------- |
| Tipos OdsScoreRecord + OdsHistoryResponse | Concluido | frontend/src/types/api.ts                          |
| Hook useOdsHistory                        | Concluido | frontend/src/hooks/useOdsHistory.ts                |
| OdsHistoryChart (LineChart Recharts)      | Concluido | frontend/src/components/charts/OdsHistoryChart.tsx |
| Integracao DashboardPage                  | Concluido | frontend/src/pages/DashboardPage.tsx               |
| Trend badges no MonitoringPage (setas)    | Concluido | frontend/src/pages/MonitoringPage.tsx              |

---

## Fase 4 — Recomendacoes Inteligentes — Concluido

> Motor de recomendacao com gap analysis vs benchmark SC + acoes concretas por ODS.

| Item                                             | Status    | Arquivos                                                        |
| ------------------------------------------------ | --------- | --------------------------------------------------------------- |
| recommendation_service.ts (gap + acoes)          | Concluido | backend/services/recommendations/recommendation_service.ts      |
| GET /api/recommendations/:ibgeCode               | Concluido | backend/routes/recommendations.ts                               |
| Tipos SmartRecommendation + RecommendationReport | Concluido | frontend/src/types/api.ts                                       |
| Hook useRecommendations                          | Concluido | frontend/src/hooks/useRecommendations.ts                        |
| RecommendationCard                               | Concluido | frontend/src/components/recommendations/RecommendationCard.tsx  |
| RecommendationPanel no DashboardPage             | Concluido | frontend/src/components/recommendations/RecommendationPanel.tsx |

---

## Fase 5 — Multi-estado + Escala Nacional — Adiado

> **Decisao:** Foco em SC (295 municipios). Escala nacional somente apos validacao do piloto.

---

## Fase 6 — Deploy Producao + Onboarding — Concluido

> Onboarding flow + infra de deploy pronta. Dominio/SSL e billing dependem de decisoes externas.

| Item                                     | Status    | Arquivos                                   |
| ---------------------------------------- | --------- | ------------------------------------------ |
| PATCH /api/auth/me (atualizar municipio) | Concluido | backend/routes/auth.ts                     |
| OnboardingPage (selecao de municipio)    | Concluido | frontend/src/pages/OnboardingPage.tsx      |
| useAuth com user + redirect onboarding   | Concluido | frontend/src/hooks/useAuth.ts              |
| Rota /onboarding                         | Concluido | frontend/src/App.tsx                       |
| docker-compose.yml (dev simplificado)    | Concluido | docker-compose.yml                         |
| nginx reverse proxy (HTTPS + headers)    | Concluido | nginx/nginx.conf + docker-compose.prod.yml |
| deploy.yml workflow (SSH + healthcheck)  | Concluido | .github/workflows/deploy.yml               |
| Dominio + SSL                            | Pendente  | Requer compra de dominio                   |
| Multi-tenant (isolamento por municipio)  | Pendente  | Decisao arquitetural necessaria            |
| Billing integration                      | Pendente  | Requer escolha de payment provider         |

---

## Proximas Prioridades

| #   | Item                                                            | Tipo        | Impacto |
| --- | --------------------------------------------------------------- | ----------- | ------- |
| 1   | Testes para fases 3-6 (recommendations, onboarding, history)    | Qualidade   | Alto    |
| 2   | Fix debitos tecnicos (ProtectedRoute cache, simulator tsc)      | Tech debt   | Medio   |
| 3   | Integracao simulador <-> recomendacoes (auto-preencher cenario) | Feature     | Alto    |
| 4   | Multi-tenant: isolamento de dados por municipio                 | Seguranca   | Alto    |
| 5   | Exportar relatorio PDF                                          | Feature     | Medio   |
| 6   | Dashboard admin (gestao de usuarios, metricas uso)              | Feature     | Medio   |
| 7   | Notificacoes por email (alertas ODS critico)                    | Feature     | Medio   |
| 8   | API rate limiting por municipio                                 | Performance | Medio   |

---

## Bugs e Debitos Tecnicos

| Item                                              | Severidade | Status                      |
| ------------------------------------------------- | ---------- | --------------------------- |
| Vitest SIGSEGV com 41+ arquivos                   | Baixa      | Workaround (batches)        |
| ProtectedRoute round-trip a cada mount            | Media      | Pendente (cache em context) |
| simulator_service.ts tsc error (Prisma JSON type) | Baixa      | Pendente                    |
