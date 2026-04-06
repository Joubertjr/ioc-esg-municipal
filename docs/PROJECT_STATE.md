# Estado do Projeto — IOC ESG Municipal
Atualizado: 2026-04-06 — 17/17 ODS, 14 coletores, simulador FPM, relatórios ESG, benchmarks, 5 páginas frontend, E2E CI, RBAC completo, Swagger, graceful shutdown, 861+ testes, segurança production-ready

## Status geral
14 coletores (todos com testes + expostos via /api/agents) + ODS Score Service + ODS History (auto-persist + /history endpoint) + Simulador FPM + Report Service + Benchmark Service + Env Validator. Frontend com React Router, auth com JWT httpOnly cookie + refresh token rotation, 5 páginas com nav completa. Playwright E2E + CI job. Redis auth. Dockerfile multi-stage production-ready. PrismaClient singleton. Paginação em /municipalities. RBAC em todas as rotas protegidas. Swagger/OpenAPI em /api/docs. Graceful shutdown. **861+ testes passando em 41 arquivos**, TSC clean.

---

## Coletores (14/14 implementados)

| Coletor | Arquivo principal | ODS cobertos | Indicadores | Testes |
|---------|------------------|--------------|-------------|--------|
| IBGE | `ibge_collector.ts` | 1, 2, 8, 9, 10, 11 | pct_baixa_renda, producao_agricola, taxa_ocupacao, pib_per_capita, empresas_por_10k, coeficiente_gini, razao_20_20, urbanizacao_adequada | 65 |
| SICONFI | `siconfi_collector.ts` | 3, 4, 11, 16, 17 | despesa_saude, despesa_educacao, despesa_urbanismo, equilibrio_fiscal, dependencia_FPM | 14 |
| DATASUS | `datasus_collector.ts` | 3 | previne_prenatal, previne_diabetes, previne_hipertensao, previne_crescimento, previne_cancer, previne_saude_bucal | 11 |
| INEP | `inep_collector.ts` | 4 | ideb_anos_iniciais, ideb_anos_finais | 12 |
| SNIS | `snis_collector.ts` | 6 | atendimento_agua, atendimento_esgoto, esgoto_tratado, perda_faturamento | 15 |
| INPE | `inpe_collector.ts` | 13, 15 | desmatamento_anual, desmatamento_acumulado, tendencia_climatica, tendencia_vida_terrestre | 32 |
| PNCP | `pncp_collector.ts` | 16 | total_contratacoes, percentual_dispensas, taxa_homologacao, percentual_srp | 21 |
| TSE | `tse_collector.ts` | 5 | pct_mulheres_eleitas, pct_candidatas_mulheres, pct_vereadoras | 34 |
| ANEEL | `aneel_collector.ts` | 7 | potencia_instalada_gd, unidades_gd, pct_energia_renovavel | 22 |
| SNIS-RS | `snis_rs_collector.ts` | 12 | coleta_seletiva, reciclagem, compostagem, aterro_sanitario | 22 |
| ANA | `ana_collector.ts` | 14 | iqa_medio, pct_corpos_bom, monitoramento_ativo | 39 |
| Convenios | `convenios_collector.ts` | 17 | convenios_federais, pct_orcamento_convenios, consorcios_intermunicipais | 22 |
| ANATEL | `anatel_collector.ts` | 9 | banda_larga_fixa, cobertura_4g, pct_fibra_optica | 24 |
| SISVAN | `sisvan_collector.ts` | 2 | cobertura_alimentar, deficit_peso, sobrepeso | 21 |

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
| 10 | Reducao das Desigualdades | IBGE | coeficiente_gini + razao_20_20 | Ativo |
| 11 | Cidades Sustentaveis | IBGE + SICONFI | urbanizacao_adequada + despesa_urbanismo | Ativo |
| 12 | Consumo Responsavel | SNIS-RS | coleta_seletiva + reciclagem + compostagem + aterro | Ativo |
| 13 | Acao Climatica | INPE | desmatamento_anual + tendencia | Ativo |
| 14 | Vida na Agua | ANA | iqa_medio + corpos_bom + monitoramento | Ativo |
| 15 | Vida Terrestre | INPE | desmatamento_acumulado + tendencia | Ativo |
| 16 | Instituicoes Eficazes | SICONFI + PNCP | equilibrio_fiscal + 4 indicadores licitacao | Ativo |
| 17 | Parcerias | SICONFI + Convenios | dependencia_FPM + convenios_federais + consorcios | Ativo |

---

## Auth e Seguranca (production-ready)

- **Auth JWT**: httpOnly cookie (prioritario) + Authorization header (fallback mobile)
- **Refresh token rotation**: POST /auth/refresh com reuse detection (revoga todos tokens do user em caso de reuse)
- **CSRF protection**: Origin/Referer validation para auth via cookie, com try/catch em URL parse
- **RBAC**: `authenticateToken` + `requireRole("admin","prefeito","secretario")` em todas as rotas protegidas
- **IDOR protection**: `/simulator/history/:ibgeCode` verifica municipalityId do user
- **Rate limiting**: Redis-backed com MemoryStore fallback graceful
  - `generalLimiter`: 60 req/min (todas as rotas)
  - `authLimiter`: 10 tentativas/15min (login/register/refresh/logout)
  - `batchLimiter`: 5 req/min (compare/batch)
- **Helmet**: CSP strict, HSTS preload, X-Frame-Options DENY, noSniff, COOP/COEP/CORP
- **CORS**: whitelist via ALLOWED_ORIGINS (não wildcard), credentials:true
- **Env Validator**: Zod validation de JWT_SECRET, REDIS_PASSWORD, ALLOWED_ORIGINS, DATABASE_URL em produção
- **Request ID**: UUID por request (X-Request-Id header)
- **Request Logger**: structured logging com debug/warn/error por status code
- **Error handler**: `AppError` class + `globalErrorHandler` + `notFoundHandler`
- **Graceful shutdown**: `SIGTERM`/`SIGINT` handlers, `server.close()`, `prisma.$disconnect()`, 10s timeout
- **Process handlers**: `uncaughtException` + `unhandledRejection`
- **Input validation**: Zod em todas as rotas

---

## Servicos

| Servico | Arquivo | Funcionalidade | Testes |
|---------|---------|---------------|--------|
| ODS Score | `ods_score_service.ts` | Orquestra 14 coletores, calcula scores 0-100 | 13 |
| Simulador FPM | `simulator_service.ts` | Projeta impacto de investimento nos ODS | 10 |
| Relatorio ESG | `report_service.ts` | Gera relatorio executivo com recomendacoes | 10 |
| Benchmark | `benchmark_service.ts` | Comparativo entre municipios, ranking, medias | 7 |
| ODS History | `ods_history_service.ts` | Auto-persist no GET /ods/:ibgeCode + GET /ods/:ibgeCode/history | 14 |
| Auth | `auth_service.ts` | Register, login, refresh token rotation, JWT, RBAC | 33 |
| Env Validator | `env-validator.ts` | Validacao Zod de variaveis de ambiente no startup | 19 |

---

## Frontend (5 paginas)

| Pagina | Arquivo | Funcionalidade |
|--------|---------|---------------|
| Login | `LoginPage.tsx` | Auth com email/password, registro, JWT expiry check |
| Dashboard | `DashboardPage.tsx` | Painel ODS com 17 cards, gauges, scores, skeleton loaders |
| Simulador | `SimulatorPage.tsx` | Simulacao de investimento FPM, toast notifications |
| Relatorios | `ReportsPage.tsx` | Relatorio ESG imprimivel com recomendacoes |
| Monitoramento | `MonitoringPage.tsx` | Acompanhamento de metas ODS |

Componentes UI: ErrorBoundary, Toast/ToastProvider, Skeleton, ProtectedRoute

---

## Testes

- **Total:** 861+ testes passando em 41 arquivos
  - Unit agents: 354 testes (14 arquivos)
  - Unit middleware: 65 testes (5 arquivos — auth, error-handler, rate-limit, request-id, request-logger)
  - Unit routes: 116 testes (7 arquivos)
  - Unit services/scoring/utils: ~230 testes (8 arquivos)
  - Integration: 96 testes (7 arquivos — health, auth, ODS, municipalities, benchmarks, simulator, reports)
- **Erros TypeScript:** 0 (`tsc --noEmit` limpo)
- **Frontend build:** OK em 1.6s
- **E2E (Playwright):** Configurado — 4 spec files (auth, navigation, dashboard, simulator)
- **Nota:** vitest crash (SIGSEGV) ao rodar todos 41 arquivos juntos — Node.js memory issue. Rodar em batches resolve (todos passam).

---

## Rotas API

| Rota | Metodo | Descricao | Auth | Docs |
|------|--------|-----------|------|------|
| `/api/auth/register` | POST | Registro de usuario (bootstrap ou admin) | Nao* | Swagger |
| `/api/auth/login` | POST | Login JWT + cookie httpOnly | Nao | Swagger |
| `/api/auth/refresh` | POST | Refresh token rotation + cookie update | Nao | Swagger |
| `/api/auth/logout` | POST | Revoga refresh token + limpa cookie | Nao | Swagger |
| `/api/auth/me` | GET | Dados do usuario | Sim | Swagger |
| `/api/ods/:ibgeCode` | GET | Scores ODS do municipio (cached 1h) | Sim | Swagger |
| `/api/ods/compare` | POST | Compara ODS entre municipios | Sim | Swagger |
| `/api/ods/:ibgeCode/history` | GET | Historico de scores ODS | Sim | Swagger |
| `/api/simulator/simulate` | POST | Simulacao de investimento | Sim | Swagger |
| `/api/simulator/compare` | POST | Compara cenarios de simulacao | Sim | Swagger |
| `/api/simulator/history/:ibgeCode` | GET | Historico simulacoes (IDOR protected) | Sim | Swagger |
| `/api/reports/:ibgeCode` | GET | Relatorio ESG completo | Sim | Swagger |
| `/api/benchmarks` | POST | Benchmark entre municipios | Sim | Swagger |
| `/api/benchmarks/compare` | POST | Compara municipio vs grupo | Sim | Swagger |
| `/api/municipalities` | GET | Lista municipios (paginado) | Sim | Swagger |
| `/api/municipalities/:ibgeCode` | GET | Detalhe municipio | Sim | Swagger |
| `/api/agents/:source/:ibgeCode` | GET | Dados brutos de coletor | Sim | Swagger |
| `/api/agents/batch/:ibgeCode` | POST | Coleta batch de municipio | Sim (admin) | Swagger |
| `/api/docs` | GET | Swagger UI + OpenAPI spec | Nao | — |
| `/health` | GET | Health check | Nao | — |

*Primeiro usuario = bootstrap sem auth; demais = requer admin

---

## Infraestrutura (production-ready)

- **Dockerfile**: multi-stage (base → deps → builder → production), Node 20, dumb-init, non-root user, healthcheck
- **docker-compose.prod.yml**: PostgreSQL 15 + Redis 7 + API, resource limits, log rotation, health checks, depends_on
- **.dockerignore**: completo (exclui tests, docs, .git, .env)
- **.env.production.example**: template completo com todos env vars
- **GitHub Actions**: CI (lint + test + build) + Docker build GHCR
- ODS Score Service: orquestra 14 coletores em paralelo com `withTimeout`
- Cache: Redis com TTL por fonte + withCache no ODS report (1h)
- Logger: Winston estruturado
- Redis auth: conditional requirepass em producao
- PrismaClient singleton: pool unico compartilhado
- Graceful shutdown: SIGTERM/SIGINT handlers

---

## Correcoes de seguranca aplicadas (2026-04-06)

1. **CSRF URL parse** — `backend/middleware/auth.ts`: try/catch em `new URL(referer)` para evitar TypeError
2. **Cookie no /refresh** — `backend/routes/auth.ts`: endpoint /refresh agora atualiza httpOnly cookie
3. **IDOR protection** — `backend/routes/simulator.ts`: /history verifica municipalityId do user
4. **Redundant index** — `prisma/schema.prisma`: removido `@@index([token])` redundante com `@unique`
5. **Frontend API URL warning** — `frontend/src/lib/api.ts`: warning em produção se VITE_API_URL não definida

---

## Riscos conhecidos

| Risco | Severidade | Mitigacao |
|-------|-----------|-----------|
| DATASUS instavel | Alta | timeout 10s + retry 3x + withTimeout |
| SNIS dados com 18 meses de atraso | Media | referenceYear sempre exibido |
| INEP bienal (anos pares) | Baixa | interpolacao documentada |
| Municipios <5k hab: indicadores suprimidos | Media | retornar dataAvailable: false |
| Vitest SIGSEGV com 41+ arquivos | Baixa | Rodar em batches; nao afeta CI (jobs separados) |
| ProtectedRoute faz round-trip a cada mount | Media | Funciona, mas adicionar cache em context futuro |

---

## Git

- Branch: main
- Ultimo commit pendente: security fixes + test corrections + production hardening

## Stack

- Backend: Node.js 20 + TypeScript strict + Express + Prisma + PostgreSQL + Redis
- Frontend: React 18 + Vite + Tailwind CSS + Shadcn/ui + Recharts + React Query
- Testes: Vitest (765 unit + 96 integration = 861) + Playwright (4 e2e specs)
- Infra: Docker Compose + GitHub Actions + Dockerfile multi-stage
- Docs: Swagger/OpenAPI em /api/docs + README.md
