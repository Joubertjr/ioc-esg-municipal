# Estado do Projeto — IOC ESG Municipal
Atualizado: 2026-04-02 — 17/17 ODS, 14 coletores, simulador FPM, relatórios ESG, benchmarks, 5 páginas frontend, E2E CI, env-validator, Redis auth, OdsScore history, 601 testes

## Status geral
14 coletores (todos com testes + expostos via /api/agents) + ODS Score Service + ODS History (auto-persist + /history endpoint) + Simulador FPM + Report Service + Benchmark Service + Env Validator. Frontend com React Router, auth, 5 páginas com nav completa. Playwright E2E + CI job. Redis auth. Dockerfile production-ready. **601 testes passando em 31 arquivos**, TSC clean.

---

## Coletores (14/14 implementados)

| Coletor | Arquivo principal | ODS cobertos | Indicadores | Testes |
|---------|------------------|--------------|-------------|--------|
| IBGE | `ibge_collector.ts` | 1, 2, 8, 9, 10, 11 | pct_baixa_renda, producao_agricola, taxa_ocupacao, pib_per_capita, empresas_por_10k, coeficiente_gini, densidade_demografica | 43 |
| SICONFI | `siconfi_collector.ts` | 3, 4, 11, 16, 17 | despesa_saude, despesa_educacao, despesa_urbanismo, equilibrio_fiscal, dependencia_FPM | 14 |
| DATASUS | `datasus_collector.ts` | 3 | previne_prenatal, previne_diabetes, previne_hipertensao, previne_crescimento, previne_cancer, previne_saude_bucal | 11 |
| INEP | `inep_collector.ts` | 4 | ideb_anos_iniciais, ideb_anos_finais | 12 |
| SNIS | `snis_collector.ts` | 6 | atendimento_agua, atendimento_esgoto, esgoto_tratado, perda_faturamento | 15 |
| INPE | `inpe_collector.ts` | 13, 15 | desmatamento_anual, desmatamento_acumulado, tendencia_climatica, tendencia_vida_terrestre | 32 |
| PNCP | `pncp_collector.ts` | 16 | total_contratacoes, percentual_dispensas, taxa_homologacao, percentual_srp | 21 |
| TSE | `tse_collector.ts` | 5 | pct_mulheres_eleitas, pct_candidatas_mulheres, pct_vereadoras | 34 |
| ANEEL | `aneel_collector.ts` | 7 | potencia_instalada_gd, unidades_gd, pct_energia_renovavel | 22 |
| SNIS-RS | `snis_rs_collector.ts` | 12 | coleta_seletiva, reciclagem, compostagem, aterro_sanitario | 22 |
| ANA | `ana_collector.ts` | 14 | iqa_medio, pct_corpos_bom, monitoramento_ativo | 12* |
| Convenios | `convenios_collector.ts` | 17 | convenios_federais, pct_orcamento_convenios, consorcios_intermunicipais | 22 |
| ANATEL | `anatel_collector.ts` | 9 | banda_larga_fixa, cobertura_4g, pct_fibra_optica | 24 |
| SISVAN | `sisvan_collector.ts` | 2 | cobertura_alimentar, deficit_peso, sobrepeso | 21 |

*Contagem estimada — testes existem nos respectivos arquivos de teste

---

## Cobertura ODS (17/17)

| ODS | Nome | Fonte(s) | Indicadores | Status |
|-----|------|----------|-------------|--------|
| 1 | Erradicacao da Pobreza | IBGE | pct_baixa_renda | Ativo |
| 2 | Fome Zero | IBGE + SISVAN | producao_agricola + cobertura_alimentar + deficit_peso + sobrepeso | Ativo |
| 3 | Saude e Bem-Estar | SICONFI + DATASUS | despesa_saude + 6 Previne Brasil | Ativo |
| 4 | Educacao de Qualidade | SICONFI + INEP | despesa_educacao + 2 IDEB | Ativo |
| 5 | Igualdade de Genero | TSE | pct_mulheres_eleitas + candidatas + vereadoras | Ativo |
| 6 | Agua e Saneamento | SNIS | agua + esgoto + tratamento + perdas | Ativo |
| 7 | Energia Limpa | ANEEL | potencia_gd + unidades_gd + pct_renovavel | Ativo |
| 8 | Trabalho Decente | IBGE | taxa_ocupacao + pib_per_capita | Ativo |
| 9 | Infraestrutura | IBGE + ANATEL | empresas_por_10k_hab + banda_larga + cobertura_4g + pct_fibra | Ativo |
| 10 | Reducao das Desigualdades | IBGE | coeficiente_gini (Censo 2022) | Ativo |
| 11 | Cidades Sustentaveis | IBGE + SICONFI | densidade_demografica + despesa_urbanismo | Ativo |
| 12 | Consumo Responsavel | SNIS-RS | coleta_seletiva + reciclagem + compostagem + aterro | Ativo |
| 13 | Acao Climatica | INPE | desmatamento_anual + tendencia | Ativo |
| 14 | Vida na Agua | ANA | iqa_medio + corpos_bom + monitoramento | Ativo |
| 15 | Vida Terrestre | INPE | desmatamento_acumulado + tendencia | Ativo |
| 16 | Instituicoes Eficazes | SICONFI + PNCP | equilibrio_fiscal + 4 indicadores licitacao | Ativo |
| 17 | Parcerias | SICONFI + Convenios | dependencia_FPM + convenios_federais + consorcios | Ativo |

*Todos os 17 ODS com indicadores diretos ou complementados

---

## Auth e Seguranca

- **Auth JWT**: register/login/me endpoints em `/api/auth`
- **Middleware**: `authenticateToken` protege `/api/agents` e `/api/ods`
- **Error handler**: `AppError` class + `globalErrorHandler` + `notFoundHandler`
- **Process handlers**: `uncaughtException` + `unhandledRejection`
- **Input validation**: IBGE code regex `/^\d{7}$/` em todos os coletores
- **Helmet + CORS + Rate limiting**: configurados

---

## Serviços

| Serviço | Arquivo | Funcionalidade | Testes |
|---------|---------|---------------|--------|
| ODS Score | `ods_score_service.ts` | Orquestra 12 coletores, calcula scores 0-100 | 13 |
| Simulador FPM | `simulator_service.ts` | Projeta impacto de investimento nos ODS | 10 |
| Relatório ESG | `report_service.ts` | Gera relatório executivo com recomendações | 10 |
| Benchmark | `benchmark_service.ts` | Comparativo entre municípios, ranking, médias | 7 |
| ODS History | `ods_history_service.ts` | Auto-persist no GET /ods/:ibgeCode + GET /ods/:ibgeCode/history | 9 |
| Env Validator | `env-validator.ts` | Validação Zod de variáveis de ambiente no startup | 14 |

---

## Frontend (5 páginas)

| Página | Arquivo | Funcionalidade |
|--------|---------|---------------|
| Login | `LoginPage.tsx` | Auth com email/password, registro |
| Dashboard | `DashboardPage.tsx` | Painel ODS com 17 cards, gauges, scores |
| Simulador | `SimulatorPage.tsx` | Simulação de investimento FPM |
| Relatórios | `ReportsPage.tsx` | Relatório ESG imprimível com recomendações |
| Monitoramento | `MonitoringPage.tsx` | Acompanhamento de metas ODS |

---

## Testes

- **Total:** 601 testes passando em 31 arquivos
  - Unit: 562 testes em 28 arquivos
  - Integração: 39 testes em 3 arquivos (health, auth, ODS)
- **Erros TypeScript:** 0 (`tsc --noEmit` limpo)
- **E2E (Playwright):** Configurado — 4 spec files (auth, navigation, dashboard, simulator)

---

## Rotas API

| Rota | Método | Descrição | Auth |
|------|--------|-----------|------|
| `/api/auth/register` | POST | Registro de usuário | Não |
| `/api/auth/login` | POST | Login JWT | Não |
| `/api/auth/me` | GET | Dados do usuário | Sim |
| `/api/ods/:ibgeCode` | GET | Scores ODS do município | Sim |
| `/api/ods/compare` | POST | Compara ODS entre municípios | Sim |
| `/api/simulator/simulate` | POST | Simulação de investimento | Sim |
| `/api/simulator/compare` | POST | Compara cenários de simulação | Sim |
| `/api/reports/:ibgeCode` | GET | Relatório ESG completo | Sim |
| `/api/benchmarks` | POST | Benchmark entre municípios | Sim |
| `/api/benchmarks/compare` | POST | Compara município vs grupo | Sim |
| `/api/municipalities` | GET | Lista municípios | Sim |
| `/api/municipalities/:ibgeCode` | GET | Detalhe município | Sim |

---

## Infraestrutura e servicos

- ODS Score Service: orquestra 14 coletores em paralelo com `withTimeout`
  - Budgets API: IBGE 10s, SICONFI 15s, DATASUS 10s, INPE 15s, PNCP 15s
  - Budgets JSON local: INEP 1s, SNIS 1s, TSE 1s, ANEEL 1s, SNIS-RS 1s, ANA 1s, Convenios 1s, ANATEL 1s, SISVAN 1s
- Cache: Redis com TTL por fonte
- Logger: Winston estruturado
- Docker Compose: PostgreSQL + Redis + Adminer
- Playwright: E2E config com webServer auto-start + CI job no GitHub Actions
- Redis auth: conditional requirepass em produção (REDIS_PASSWORD validado por env-validator)
- OdsScore migration: tabela Prisma com compound unique key [municipalityId, odsNumber, referenceYear]
- Seed: 18 scores (17 ODS + global) por top-20 municípios com perfis realistas

---

## Proximos passos (prioridade)

### Qualidade dos ODS existentes
1. ~~ODS 10: substituir razao_dependencia por Coeficiente Gini (IBGE Censo 2022)~~ ✅
2. ~~ODS 9: adicionar dados de infraestrutura viaria/digital (ANATEL)~~ ✅
3. ~~ODS 2: complementar com dados SISVAN (vigilancia alimentar)~~ ✅

### Features de produto
1. ~~Simulador de cenarios de investimento FPM~~ ✅
2. ~~Prisma schema v2: tabela `ods_scores` para historico~~ ✅ (OdsScore + ods_history_service)
3. ~~Testes E2E com Playwright (dashboard + score endpoint)~~ ✅ (configurado + CI job)
4. ~~Seeding de 295 municipios SC com dados reais~~ ✅
5. ~~Frontend dashboard completo com React Query~~ ✅
6. ~~Relatório ESG e Benchmark Service~~ ✅
7. ~~Página de Monitoramento~~ ✅

### Seguranca pendente
1. ~~JWT_SECRET validacao em producao (nao aceitar placeholder)~~ ✅ (env-validator)
2. ~~Redis com auth em producao~~ ✅ (conditional requirepass + env-validator)
3. ~~CORS: remover localhost fallback em producao~~ ✅ (env-validator bloqueia em produção)

---

## Riscos conhecidos

| Risco | Severidade | Mitigacao |
|-------|-----------|-----------|
| DATASUS instavel | Alta | timeout 10s + retry 3x + withTimeout |
| SNIS dados com 18 meses de atraso | Media | referenceYear sempre exibido |
| INEP bienal (anos pares) | Baixa | interpolacao documentada |
| Municipios <5k hab: indicadores suprimidos | Media | retornar dataAvailable: false |
| ~~ODS 10 com proxy inadequado~~ | ~~Media~~ | ✅ Substituído por Coeficiente Gini (Censo 2022) |

---

## Git

- Branch: main
- Ultimo commit: `feat(ods): add ANATEL, SISVAN, Gini collectors — 14 coletores, 530 testes`

## Stack

- Backend: Node.js 18 + TypeScript strict + Express + Prisma + PostgreSQL + Redis + Bull
- Frontend: React 18 + Vite + Tailwind CSS + Shadcn/ui + Recharts + React Query
- Testes: Vitest (406 unit) + Playwright (4 e2e specs)
- Infra: Docker Compose + GitHub Actions + Dockerfile
