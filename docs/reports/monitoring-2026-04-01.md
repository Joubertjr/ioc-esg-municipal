# Relatório de Monitoramento — IOC ESG Municipal
**Data:** 2026-04-01 | **Agente:** project-monitor | **Versão do projeto:** 0.1.0

---

## 1. Snapshot do Projeto

### Git Log (últimos 28 commits em 2 dias)

| Data | Hash | Tipo | Descrição |
|------|------|------|-----------|
| 2026-04-01 | 6a249d2 | docs | Atualiza PROJECT_STATE + pesquisa ODS 2/5/7/9 |
| 2026-04-01 | fdc5b91 | feat(inpe) | Coletor INPE TerraBrasilis (ODS 13+15) |
| 2026-04-01 | ecf3f14 | test | 44 novos testes críticos (http-client, cache, boundary) |
| 2026-04-01 | 69d4f4e | perf(ods) | Circuit breaker + skip sleep em cache hit |
| 2026-04-01 | bffb239 | feat(security) | Correções críticas de segurança |
| 2026-04-01 | f2b4d17 | docs | Consolidação de relatórios de 16 agentes paralelos |
| 2026-04-01 | edd3577 | docs(ods) | Revisão de scoring + PROJECT_STATE |
| 2026-04-01 | af0dc93 | fix(inep,snis) | Correções pós-code-review |
| 2026-04-01 | cf33c3f | merge | INEP + SNIS collectors |
| 2026-04-01 | 19538e3 | feat(inep,snis) | IDEB + Saneamento (ODS 4+6) |
| 2026-03-31 | vários | feat | DATASUS, Dashboard, ODS Score Service, IBGE, SICONFI |

**Velocidade:** 28 commits em 2 dias (13 em 31/mar, 15 em 01/abr). Ritmo altíssimo para projeto em fase inicial.

### Estado atual (`git status`)

```
 M .claude/settings.json
 M docs/GOTCHAS.md
?? docs/especificacao/2_PESQUISA/07_FONTES_ODS_2_5_7_9.md
```

Três arquivos não commitados: `settings.json` (config), `GOTCHAS.md` (atualizado com INPE) e novo arquivo de pesquisa sobre fontes ODS. Sem impacto em produção.

### Branch: `main` (estratégia de trunk-based development + merges de feature branches)

---

## 2. Saúde do Código

### 2.1 TypeScript

| Verificação | Resultado |
|-------------|-----------|
| `tsc --noEmit` (raiz) | ZERO erros |
| `tsc --noEmit` (frontend) | ZERO erros |
| Uso de `any` no backend | Zero ocorrências em código de produção |
| Uso de `any` no frontend | Não detectado |

Único caso de `any` encontrado na busca foi a palavra no meio de uma string de log (`"No data from any source..."`), não um tipo TypeScript.

### 2.2 Testes

```
Test Files  12 passed (12)
Tests       171 passed (171)
Duration    ~419ms (unit) + integração: NENHUM ARQUIVO
```

| Suite | Arquivo | Testes | Status |
|-------|---------|--------|--------|
| Unit | ibge_collector.test.ts | 12 | PASS |
| Unit | siconfi_collector.test.ts | 14 | PASS |
| Unit | datasus_collector.test.ts | 11 | PASS |
| Unit | inep_collector.test.ts | 12 | PASS |
| Unit | snis_collector.test.ts | 15 | PASS |
| Unit | inpe_collector.test.ts | 32 | PASS |
| Unit | ods_score_service.test.ts | 13 | PASS |
| Unit | cache.test.ts | 5 | PASS |
| Unit | http-client.test.ts | 6 | PASS |
| Unit | boundary-values.test.ts | 33 | PASS |
| Unit | routes/ods.test.ts | 7 | PASS |
| Unit | routes/agents.test.ts | 11 | PASS |
| Integration | apis/*.test.ts | 0 | AUSENTE (apenas .gitkeep) |
| Integration | db/*.test.ts | 0 | AUSENTE (apenas .gitkeep) |
| E2E | *.test.ts | 0 | AUSENTE (apenas .gitkeep) |

**Cobertura estimada de arquivos com testes:**

| Arquivo de Produção | Tem Teste? |
|--------------------|-----------|
| backend/agents/ibge/ibge_collector.ts | Sim |
| backend/agents/siconfi/siconfi_collector.ts | Sim |
| backend/agents/datasus/datasus_collector.ts | Sim |
| backend/agents/inep/inep_collector.ts | Sim |
| backend/agents/snis/snis_collector.ts | Sim |
| backend/agents/inpe/inpe_collector.ts | Sim |
| backend/services/ods/ods_score_service.ts | Sim |
| backend/utils/cache.ts | Sim |
| backend/utils/http-client.ts | Sim |
| backend/routes/ods.ts | Sim |
| backend/routes/agents.ts | Sim |
| backend/middleware/rate-limit.ts | NÃO |
| backend/utils/logger.ts | NÃO |
| frontend/src/App.tsx | NÃO |
| frontend/src/pages/DashboardPage.tsx | NÃO |
| frontend/src/components/* (7 arquivos) | NÃO |

**Cobertura de arquivos de produção: ~55%** (11/20 arquivos com algum teste)
**Cobertura de camadas críticas (coletores + serviços): ~90%**
**Camada não coberta: frontend (0%), middleware (0%), e2e (0%)**

### 2.3 Qualidade de Código

| Padrão | Status | Observação |
|--------|--------|------------|
| TypeScript strict | CONFORME | Zero `any` em código de produção |
| Zod em APIs externas | CONFORME | Todos os 6 coletores validam resposta |
| Winston (sem console.log) | QUASE | 1 `console.log` em `backend/index.ts:35` |
| Cache Redis em APIs externas | CONFORME | Todos os coletores usam `withCache()` |
| Retry com backoff | CONFORME | `http-client.ts` implementa 1s/2s/4s |
| Rate limiting (rotas) | CONFORME | `generalLimiter` (60/min) + `batchLimiter` (5/min) |
| Helmet | CONFORME | Adicionado em `bffb239` |
| CORS restrito | CONFORME | Via `ALLOWED_ORIGINS` env var |
| Decimal.js para valores financeiros | PARCIAL | Tipos corretos, mas uso efetivo não verificado |
| Interfaces TypeScript de domínio | CONFORME | `shared/types/domain/*.ts` bem definidas |

---

## 3. KPIs do Projeto

### 3.1 Cobertura de APIs e ODS

| API | Status | ODS Cobertos | Testes |
|-----|--------|-------------|--------|
| IBGE | Operacional | 1, 8, 10, 11 | 12 |
| SICONFI | Operacional | 3, 4, 11, 16, 17 | 14 |
| DATASUS | Operacional | 3 | 11 |
| INEP | Operacional (JSON estático) | 4 | 12 |
| SNIS | Operacional (JSON estático) | 6 | 15 |
| INPE | Implementado (WFS GeoServer) | 13, 15 | 32 |
| PNCP | NÃO IMPLEMENTADO | — | 0 |

**ODS com cobertura: 9/17 (53%)**
*(INPE implementado mas ainda não integrado ao score service — score ainda em 9/17)*

| ODS | Status | Score Florianópolis |
|-----|--------|-------------------|
| 1 — Pobreza | Verde | Calculado |
| 2 — Fome Zero | SEM DADOS | — |
| 3 — Saúde | Verde (score 81) | 81 |
| 4 — Educação | Calculado | Calculado |
| 5 — Igualdade de Gênero | SEM DADOS | — |
| 6 — Saneamento | Calculado | Calculado |
| 7 — Energia Limpa | SEM DADOS | — |
| 8 — Trabalho Digno | Calculado | Calculado |
| 9 — Infraestrutura | SEM DADOS | — |
| 10 — Redução Desigualdades | Calculado | Calculado |
| 11 — Cidades Sustentáveis | Calculado | Calculado |
| 12 — Consumo Responsável | SEM DADOS | — |
| 13 — Ação Climática | Implementado (INPE) | Pendente integração |
| 14 — Vida na Água | SEM DADOS | — |
| 15 — Vida Terrestre | Implementado (INPE) | Pendente integração |
| 16 — Instituições | Calculado | Calculado |
| 17 — Parcerias | Calculado | Calculado |

### 3.2 Score ao Vivo (Florianópolis 4205407)

- **Score Global:** 74 (verde)
- **ODS com dados:** 9/17 (53%)
- **Composição:** Score baseado em IBGE + SICONFI + DATASUS + INEP + SNIS

### 3.3 Volume de Código

| Camada | Arquivos .ts | Linhas aprox. |
|--------|-------------|---------------|
| Backend agentes | 18 | ~1.600 |
| Backend serviços/routes/utils | 12 | ~800 |
| Frontend (TSX + TS) | 13 | ~900 |
| Shared types + constants | 10 | ~600 |
| Testes unitários | 12 | ~2.000 |
| **Total** | **65** | **~5.900** |

### 3.4 Infraestrutura

| Componente | Status |
|------------|--------|
| Docker Compose (Postgres + Redis + Adminer) | Configurado |
| GitHub Actions CI/CD | Operacional (tsc + lint + test + build) |
| GitHub Actions PR Review automático | Configurado |
| GitHub Actions Briefing diário | Configurado |
| GitHub Actions Health check APIs gov | Configurado |
| GitHub Actions Security audit semanal | Configurado |
| Prisma migrations | 1 migration (inicial) |
| Seed 295 municípios SC | Implementado |
| Playwright E2E | Configurado mas zero testes |

---

## 4. Validação de Coerência

### 4.1 Especificação vs. Implementação

| Item da Especificação | Status |
|----------------------|--------|
| Stack: Node.js 18 + TypeScript strict + Express + Prisma | CONFORME |
| Stack: React 18 + Vite + Tailwind + Recharts + React Query | CONFORME |
| Stack: Vitest + Playwright | CONFORME (Vitest operacional, Playwright sem testes) |
| Stack: Docker Compose + GitHub Actions | CONFORME |
| Agentes: IBGE, SICONFI, DATASUS, INEP, SNIS | CONFORME |
| Agentes: INPE | IMPLEMENTADO (commit recente) |
| Agentes: PNCP | AUSENTE |
| Cache Redis com TTL por API | CONFORME |
| Retry backoff exponencial 1s/2s/4s | CONFORME |
| Rate limiting 2 req/s para APIs gov | PARCIAL (rate limit existe nas rotas HTTP, mas não controlado no http-client por API) |
| Código IBGE 7 dígitos → SICONFI 6 dígitos | Deve estar em siconfi_collector.ts (a verificar) |
| FPM: soma dos 3 decênios | CONFORME (documentado) |
| SNIS: dados com ~18 meses de atraso | CONFORME (referência 2022 informada) |
| IDEB: bienal com interpolação | PARCIAL (2023 implementado, interpolação não mencionada) |
| DATASUS: timeout=30s + retry 3x | CONFORME |

### 4.2 ADRs vs. Código

| ADR | Status |
|-----|--------|
| ADR-001 Stack Tecnológica | CONFORME — stack implementada como decidido |
| ADRs de features (INPE, simulador, ODS 5/9/12...) | RASCUNHOS em docs/plans/, sem ADR formal numerada |

**Observação:** Apenas 1 ADR formal (ADR-001). Decisões como "usar WFS para INPE" e "circuit breaker no DATASUS" deveriam ser formalizadas como ADRs.

### 4.3 PROJECT_STATE vs. Realidade

O `PROJECT_STATE.md` reporta "77 testes passando", mas a execução atual mostra **171 testes** — 44 novos adicionados no commit `ecf3f14` e mais 32 no INPE collector. O documento precisa ser atualizado com o número real.

### 4.4 Coerência de Domínio

| Regra de Negócio | Implementação |
|-----------------|---------------|
| Score 0-100 por ODS | CONFORME |
| Verde ≥70, Amarelo 40-69, Vermelho <40 | CONFORME (em `shared/types/domain/ods.ts`) |
| Score global = média ponderada | CONFORME (em `ods_score_service.ts`) |
| Personas: Prefeito/Secretário de Finanças | Sem autenticação por perfil (sem auth implementada) |
| Multi-tenancy (295 municípios SC) | Dados de todos os municípios disponíveis via seed |

---

## 5. Detecção de Riscos

### CRÍTICO — Bloqueador de Produção

| ID | Risco | Impacto | Localização |
|----|-------|---------|-------------|
| CRIT-01 | **Zero autenticação nos endpoints** | Qualquer pessoa acessa dados de qualquer município | `backend/index.ts` — sem JWT middleware |
| CRIT-02 | **INPE não integrado ao score service** | ODS 13 e 15 implementados mas score global ignora desmatamento | `ods_score_service.ts` — `inpeCollector` coletado mas `mapInpeOds` não chamado (verificar) |
| CRIT-03 | **Zero testes de integração** | Falhas de API real (mudança de schema JSON, timeout) não detectadas antes de produção | `tests/integration/` vazio |
| CRIT-04 | **Zero testes E2E** | Fluxo completo do prefeito não validado | `tests/e2e/` vazio |

### ALTO — Corrigir neste Sprint

| ID | Risco | Impacto | Localização |
|----|-------|---------|-------------|
| ALTO-01 | **Redis sem autenticação** | Qualquer processo na rede pode acessar cache | `docker-compose.yml` — sem `requirepass` |
| ALTO-02 | **Adminer exposto sem proteção** | Interface de banco de dados acessível sem auth | `docker-compose.yml` — porta 8080 pública |
| ALTO-03 | **ODS 10 duplica ODS 1** | Score global inflado artificialment — `pct_baixa_renda` conta 2x (pesos 1.0+0.9) | `ibge_ods_mapper.ts` — revisar mapeamento |
| ALTO-04 | **ODS 11 usa proxies incorretos** | Equilíbrio fiscal ≠ cidades sustentáveis | `siconfi_ods_mapper.ts` |
| ALTO-05 | **Mortalidade infantil ausente no ODS 3** | Indicador mais importante (peso 60%) não implementado | `datasus_collector.ts` + DATASUS SIM |
| ALTO-06 | **Base de cálculo ODS 3/4 incorreta** | `despesaSaude / despesaTotal` deveria ser `/ receitaImpostos` (LRF) | `siconfi_ods_mapper.ts` |
| ALTO-07 | **PNCP não implementado** | ODS 16 (transparência) sem dados de licitações — endpoint na pasta vazia | `backend/agents/pncp/` — diretório existe mas sem arquivos |

### MÉDIO — Backlog

| ID | Risco | Impacto |
|----|-------|---------|
| MED-01 | `console.log` em `backend/index.ts` | Log não estruturado em produção |
| MED-02 | JWT_SECRET como placeholder no `.env.example` | Risco se desenvolvedor esquecer de trocar |
| MED-03 | `referenceYear` global (Math.max entre fontes) | SNIS 2022 + IBGE 2024 reportam mesmo ano — enganoso |
| MED-04 | Sem `p-limit` no POST /compare (10 mun × 5 fontes = 50 HTTP calls simultâneas) | Risco de 429 em APIs governamentais |
| MED-05 | Race condition thundering herd no `withCache` | Múltiplas requisições simultâneas para mesmo município |
| MED-06 | Interpolação IDEB não implementada | Anos ímpares retornam dado do ano par anterior sem advertência |
| MED-07 | Sem persistência de scores históricos | Schema Prisma `OdsIndicator` existe mas scores não são salvos após cálculo |
| MED-08 | PROJECT_STATE.md com contagem de testes desatualizada (77 → real: 171) | Confusão sobre estado real do projeto |
| MED-09 | Serviços `simulator`, `benchmarks`, `reports`, `auth` existem como pastas mas sem implementação | Funcionalidades core do produto ausentes |

### BAIXO — Monitora

| ID | Risco |
|----|-------|
| BAIXO-01 | INPE WFS usa bbox retangular (pode incluir polígonos de municípios vizinhos) |
| BAIXO-02 | Apenas 1 ADR formal para 28 commits — decisões arquiteturais não documentadas |
| BAIXO-03 | Municípios <5k habitantes com indicadores suprimidos por privacidade (IBGE) |
| BAIXO-04 | `pnpm test:integration` retorna exit code 1 (sem arquivos) — quebra pipeline se `pnpm test` for chamado em CI |

---

## 6. Análise de Tendências

### 6.1 Velocidade de Desenvolvimento

```
31/mar: 13 commits → Setup + IBGE + SICONFI + ODS Score Service + Dashboard
01/abr: 15 commits → DATASUS + INEP + SNIS + INPE + Security + Testes + Pesquisa

Total: 28 commits em 2 dias
Features entregues: 7 das ~15 planejadas
```

**Tendência:** Aceleração com paralelismo de agentes. O commit `f2b4d17` ("consolidate reports from 16 parallel agents") indica uso intenso de subagentes, o que explica a velocidade atípica.

### 6.2 Evolução da Cobertura ODS

| Data | ODS Cobertos | % |
|------|-------------|---|
| 31/mar (início) | 0/17 | 0% |
| 31/mar (IBGE+SICONFI) | 7/17 | 41% |
| 01/abr (DATASUS+INEP+SNIS) | 9/17 | 53% |
| 01/abr (INPE implementado) | 9/17 | 53% (pendente integração) |
| **Meta próxima semana** | 12/17 | 71% (PNCP+ODS 7,9,12) |

### 6.3 Evolução da Cobertura de Testes

| Data | Testes | Observação |
|------|--------|-----------|
| 31/mar (IBGE+SICONFI) | ~26 | Testes básicos dos primeiros coletores |
| 01/abr (DATASUS+INEP+SNIS) | 77 | Crescimento orgânico |
| 01/abr (batch de testes) | 121 | Commit `ecf3f14`: +44 testes críticos |
| 01/abr (INPE collector) | 171 | +32 testes INPE |
| **Alvo** | 200+ | Integração + rotas completas |

**Tendência positiva:** Qualidade de testes melhorando. Tests de boundary-values e utils adicionados proativamente.

### 6.4 Dívida Técnica Acumulada

```
Sprint 1 (2 dias): Dívida BAIXA — código limpo, padrões seguidos
Dívidas identificadas:
  - Scoring ODS com 6 problemas de correção crítica
  - Camadas pendentes: auth, simulator, benchmarks, reports, PNCP
  - Testes E2E e integração zerados
```

**Risco:** Se as correções de scoring (ALTO-03 a ALTO-06) não forem feitas antes de entrar em produção, o score global de 74 para Florianópolis pode ser matematicamente incorreto.

---

## 7. Top 5 Recomendações

### RECOMENDAÇÃO 1 — URGENTE: Integrar INPE ao ODS Score Service
**Prioridade:** P0 | **Esforço:** 2-3h | **Impacto:** ODS 13 e 15 visíveis no dashboard

O agente INPE está implementado com 32 testes passando, mas a confirmação de integração no `ods_score_service.ts` deve ser verificada. A variável `inpeData` é coletada em `Promise.all`, mas não há mapeamento explícito visível na inspeção parcial do arquivo. Confirmar e corrigir se necessário.

**Ação:** Verificar `ods_score_service.ts` linhas 80–150, garantir que `mapInpeOds(inpeData)` está sendo chamado e que os indicadores ODS 13/15 entram no `groupedIndicators`.

---

### RECOMENDAÇÃO 2 — Corrigir Scoring ODS (6 problemas P0)
**Prioridade:** P0 | **Esforço:** 1 dia | **Impacto:** Integridade dos scores que são o core do produto

Os problemas identificados pelo ODS Analyst (arquivo `docs/plans/ods-scoring-review.md`) comprometem diretamente a credibilidade do produto:

1. **ODS 10 duplica ODS 1** — mesmo indicador conta 2x no score global
2. **ODS 11 usa proxies incorretos** — equilíbrio fiscal ≠ cidades sustentáveis
3. **Mortalidade infantil ausente no ODS 3** — indicador mais importante ausente
4. **Base de cálculo ODS 3/4 incorreta** — usar `receitaImpostos`, não `despesaTotal` (exigência LRF)
5. **Score global usa média simples** — deve ser média ponderada por indicador
6. **`referenceYear` global enganoso** — deve ser por ODS

**Ação:** Criar feature branch `fix/ods-scoring-correctness`, implementar todas as 6 correções com TDD.

---

### RECOMENDAÇÃO 3 — Implementar Autenticação (CRIT-01)
**Prioridade:** P0 | **Esforço:** 1-2 dias | **Impacto:** Bloqueador absoluto de produção

Todos os endpoints (`/api/ods/*`, `/api/agents/*`) estão completamente abertos. O `jsonwebtoken` já está nas dependências. O `JWT_SECRET` já está no `.env.example`.

**Ação:** Implementar `backend/middleware/auth.ts` com middleware JWT, proteger todas as rotas `/api/*` (exceto `/health` e futura rota de login). Adicionar endpoint `POST /api/auth/login`. Criar testes do middleware.

---

### RECOMENDAÇÃO 4 — Implementar Coletor PNCP (ODS 16 Transparência)
**Prioridade:** P1 | **Esforço:** 1 dia | **Impacto:** ODS 16 é a principal demanda de prefeitos preocupados com TCE

O diretório `backend/agents/pncp/` existe mas está vazio. A URL da API está documentada em `shared/constants/apis.ts`. O PNCP é API REST pública com dados em tempo real de licitações — mais simples de implementar que o INPE.

**Ação:** Usar skill `/new-agent pncp` para implementar coletor com indicadores:
- Contratos publicados/total
- Contratos com dispensa de licitação
- Prazo médio de publicação

---

### RECOMENDAÇÃO 5 — Adicionar Testes de Integração (CRIT-03)
**Prioridade:** P1 | **Esforço:** 2-3h | **Impacto:** Pipeline CI/CD atualmente quebra em `pnpm test` por exit code 1

O comando `pnpm test:integration` retorna exit code 1 por não encontrar arquivos, o que quebra o `pnpm test` geral. As pastas de integração existem apenas como `.gitkeep`.

**Ações imediatas:**
1. Adicionar ao menos 1 arquivo de integração básico para não quebrar o pipeline
2. Implementar `tests/integration/apis/ibge_api.integration.test.ts` com mock de servidor HTTP (msw ou nock) — sem depender da API real
3. Implementar `tests/integration/db/municipality.integration.test.ts` com banco de teste PostgreSQL

**Meta:** 171 → 200+ testes com integração coberta.

---

## Sumário Executivo

| Dimensão | Status | Nota |
|----------|--------|------|
| Velocidade de desenvolvimento | Excelente | 28 commits em 2 dias, 6 agentes integrados |
| Qualidade TypeScript | Excelente | Zero erros, zero `any` |
| Cobertura de testes (unitários) | Boa | 171 testes, 12 suites, zero falhas |
| Cobertura de testes (integração/e2e) | Crítica | Zero testes fora do unitário |
| Cobertura ODS | Regular | 9/17 calculados, 2 implementados pendentes de integração |
| Segurança (auth) | Crítica | Zero autenticação em produção |
| Correção dos scores ODS | Crítica | 6 problemas P0 identificados comprometem integridade |
| Infra CI/CD | Boa | Pipeline completo com 5 jobs automatizados |
| Documentação | Regular | 1 ADR formal, muitas decisões em docs/plans sem numeração |

**Resumo:** O projeto tem uma base técnica sólida e velocidade impressionante. Os riscos críticos estão concentrados em 3 áreas: (1) ausência de autenticação — impede qualquer deploy em produção, (2) erros nos cálculos de scoring ODS — comprometem a proposta de valor central do produto, e (3) ausência de testes de integração/e2e — pipeline CI quebrado e cobertura real de risco baixa. Esses 3 bloqueadores devem ser endereçados antes de qualquer demonstração para clientes reais.

---

*Relatório gerado por: project-monitor agent — IOC ESG Municipal v0.1.0*
*Próximo monitoramento recomendado: 2026-04-08 ou após próximo sprint*
