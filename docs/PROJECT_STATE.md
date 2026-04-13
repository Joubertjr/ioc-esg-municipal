# Estado do Projeto — IOC ESG Municipal

Atualizado: 2026-04-13 — PRONTO PARA DEPLOY SC. 6 fases completas, 7 paginas frontend, 17/17 ODS, 15 coletores, GAPs 1+2 resolvidos, nginx HTTP-only, scripts de atualizacao de dados, 540+ testes, docker build OK.

## Premissa de negocio

**FOCO EXCLUSIVO: Santa Catarina (295 municipios).** Nenhuma feature, arquitetura ou escopo sera desenvolvido que nao seja demanda direta do usuario final de SC. Expansao nacional adiada indefinidamente ate aprovacao do produto em SC pelo cliente final.

## Status geral

**Fases 1-4 + 6 concluidas. GAPs de producao resolvidos (2026-04-13).**
15 coletores + ODS Score + History + Simulador FPM + Reports + Benchmarks + Recomendacoes Inteligentes + Onboarding. Frontend com 7 paginas (Login, Dashboard, Simulador, Relatorios, Monitoramento, Benchmark, Onboarding). Auth JWT completo com refresh token rotation. Docker production-ready com nginx HTTP-only (SSL como override opcional). CI/CD com deploy automatico.

---

## Coletores (15/15 implementados)

| Coletor   | Fonte                      | ODS cobertos       | Testes |
| --------- | -------------------------- | ------------------ | ------ |
| IBGE      | servicodados.ibge.gov.br   | 1, 2, 8, 9, 10, 11 | 65     |
| SICONFI   | api.siconfi.tesouro.gov.br | 3, 4, 11, 16, 17   | 14     |
| DATASUS   | datasus.saude.gov.br       | 3                  | 11     |
| INEP      | inep.gov.br                | 4                  | 12     |
| SNIS      | snis.gov.br                | 6                  | 15     |
| INPE      | terrabrasilis.dpi.inpe.br  | 13, 15             | 32     |
| PNCP      | pncp.gov.br                | 16                 | 21     |
| TSE       | tse.jus.br                 | 5                  | 34     |
| ANEEL     | aneel.gov.br               | 7                  | 22     |
| SNIS-RS   | snis.gov.br (residuos)     | 12                 | 22     |
| ANA       | ana.gov.br                 | 14                 | 39     |
| Convenios | convenios.gov.br           | 17                 | 22     |
| ANATEL    | anatel.gov.br              | 9                  | 24     |
| SISVAN    | sisvan.datasus.gov.br      | 2                  | 21     |
| IEPS      | iepsdata.org.br (BigQuery) | 3                  | 36     |

---

## Servicos

| Servico       | Funcionalidade                                         |
| ------------- | ------------------------------------------------------ |
| ODS Score     | Orquestra 15 coletores, calcula scores 0-100           |
| ODS History   | Auto-persist + GET /history endpoint                   |
| Simulador FPM | Projeta impacto de investimento nos ODS                |
| Relatorio ESG | Relatorio executivo com recomendacoes rule-based       |
| Benchmark     | Comparativo entre municipios, ranking, medias          |
| Recomendacoes | Gap analysis vs benchmark SC + acoes concretas por ODS |
| Auth          | Register, login, refresh token rotation, RBAC          |

---

## Frontend (7 paginas)

| Pagina        | Rota        | Funcionalidade                                            |
| ------------- | ----------- | --------------------------------------------------------- |
| Login         | /login      | Auth email/password, registro                             |
| Onboarding    | /onboarding | Selecao de municipio (primeiro acesso)                    |
| Dashboard     | /dashboard  | 17 ODS cards + radar + historico temporal + recomendacoes |
| Simulador     | /simulator  | Simulacao investimento FPM                                |
| Relatorios    | /reports    | Relatorio ESG imprimivel                                  |
| Monitoramento | /monitoring | Acompanhamento metas + trend badges                       |
| Benchmark     | /benchmark  | Ranking SC + comparativo radar + tabela ODS               |

---

## Rotas API

| Rota                             | Metodo     | Auth        |
| -------------------------------- | ---------- | ----------- |
| /api/auth/register               | POST       | Nao\*       |
| /api/auth/login                  | POST       | Nao         |
| /api/auth/refresh                | POST       | Nao         |
| /api/auth/logout                 | POST       | Nao         |
| /api/auth/me                     | GET, PATCH | Sim         |
| /api/ods/:ibgeCode               | GET        | Sim         |
| /api/ods/:ibgeCode/history       | GET        | Sim         |
| /api/ods/compare                 | POST       | Sim         |
| /api/simulator/simulate          | POST       | Sim         |
| /api/simulator/compare           | POST       | Sim         |
| /api/simulator/history/:ibgeCode | GET        | Sim         |
| /api/reports/:ibgeCode           | GET        | Sim         |
| /api/recommendations/:ibgeCode   | GET        | Sim         |
| /api/benchmarks                  | POST       | Sim         |
| /api/benchmarks/compare          | POST       | Sim         |
| /api/municipalities              | GET        | Sim         |
| /api/municipalities/:ibgeCode    | GET        | Sim         |
| /api/agents/:source/:ibgeCode    | GET        | Sim         |
| /api/agents/batch/:ibgeCode      | POST       | Sim (admin) |
| /api/docs                        | GET        | Nao         |
| /health                          | GET        | Nao         |

---

## Infraestrutura

- Dockerfile multi-stage 5 estagios (Node 20, dumb-init, non-root, healthcheck)
- docker-compose.yml (dev: postgres + redis + adminer)
- docker-compose.prod.yml (postgres + redis + api + nginx HTTP-only)
- docker-compose.prod.ssl.yml (override para SSL com certbot)
- nginx HTTP-only por default (sem SSL, sem HSTS) — compativel com LB
- scripts/setup-ssl.sh para provisionar certificados quando necessario
- GitHub Actions: CI (lint+test+build) + Docker build GHCR + Deploy SSH
- Redis cache com TTL por fonte
- Graceful shutdown
- 7 scripts de atualizacao de dados (`pnpm data:update:all`)
- Obsidian vault (~/obsidian-vault/ioc-esg-municipal/) + MCP filesystem server

---

## Agentes Claude (21 especializados)

| Tier   | Agente             | Responsabilidade                          |
| ------ | ------------------ | ----------------------------------------- |
| Opus   | orchestrator       | Feature multi-camada — coordena todos     |
| Opus   | backend-architect  | Design de API ou servico                  |
| Opus   | database-architect | Schema ou migration                       |
| Opus   | frontend-architect | UI complexa                               |
| Opus   | security-auditor   | Antes de deploy, auth, dados sensiveis    |
| Opus   | code-reviewer      | Apos qualquer feature — contexto limpo    |
| Opus   | project-monitor    | Monitoramento continuo, KPIs, coerencia   |
| Sonnet | data-collector     | Implementar/debugar coletor de API gov    |
| Sonnet | ods-analyst        | Scores e indicadores dos 17 ODS           |
| Sonnet | api-developer      | Implementar endpoints a partir de specs   |
| Sonnet | test-writer        | Cobertura de testes                       |
| Sonnet | debugger           | Bug persistente                           |
| Sonnet | docs-writer        | README, documentacao de API               |
| Sonnet | memory-manager     | Sincroniza decisoes/aprendizados no vault |
| Haiku  | devops-engineer    | Docker, CI/CD, infra                      |

**Nota:** `memory-manager` adicionado para manter o Obsidian vault sincronizado com decisoes arquiteturais, gotchas e lessons-learned da sessao.

---

## Testes

- 540+ testes passando (14 suites)
- TSC clean (zero erros)
- Docker build: OK (imagem multi-stage produz imagem funcional)
- Playwright E2E configurado

---

## GAPs resolvidos (2026-04-13)

| GAP         | Problema                                      | Solucao                                                                              |
| ----------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| GAP 1       | 8 coletores liam JSONs estaticos sem \_\_meta | 7 JSONs renomeados para \*\_latest.json + \_\_meta injetado + scripts de atualizacao |
| GAP 2       | nginx crashava sem cert.pem/key.pem           | nginx HTTP-only por default, SSL como docker-compose override                        |
| Armadilha 1 | HSTS no nginx HTTP-only                       | Removido Strict-Transport-Security                                                   |
| Armadilha 2 | IEPS script gerava dados fake                 | Reescrito com CSV-first + fallback JSON existente                                    |
| Armadilha 3 | Scripts gravavam JSON sem validacao           | Zod safeParse obrigatorio antes de writeFile                                         |

---

## Dados estaticos (cobertura SC)

| JSON                  | Ano ref | Municipios | Notas                                   |
| --------------------- | ------- | ---------- | --------------------------------------- |
| snis_latest.json      | 2022    | 284/295    | 11 mun. sem dados SNIS                  |
| ideb_latest.json      | 2023    | 295/295    | Completo                                |
| sisvan_latest.json    | 2023    | 284/295    | 11 mun. sem dados SISVAN                |
| anatel_latest.json    | 2023    | 295/295    | Completo                                |
| aneel_latest.json     | 2023    | 295/295    | Completo                                |
| convenios_latest.json | 2023    | 295/295    | Completo                                |
| ieps_latest.json      | 2021    | 295/295    | Completo (dados IEPS mais recentes)     |
| tse_2024.json         | 2024    | 295/295    | Fixo ate 2028 (proximo ciclo eleitoral) |
| ibge_2022.json        | 2022    | 295/295    | Censo                                   |
| gini_2022.json        | 2022    | 295/295    | Censo                                   |
| ana_2022.json         | 2022    | 295/295    | ANA                                     |
| snis_rs_2022.json     | 2022    | 295/295    | Residuos solidos                        |

---

## Proximos passos (SOMENTE demandas de uso SC)

| #   | Item                                                     | Status            |
| --- | -------------------------------------------------------- | ----------------- |
| 1   | Deploy em servidor de producao para teste com cliente SC | Proximo           |
| 2   | Feedback do cliente SC → ajustes                         | Aguardando deploy |
| 3   | Multi-tenant: isolamento de dados por municipio          | Pos-aprovacao     |
| 4   | Exportar relatorio PDF                                   | Pos-aprovacao     |
| 5   | Dashboard admin (gestao de usuarios, metricas uso)       | Pos-aprovacao     |

---

## Git

- Branch: main
- Remote: https://github.com/Joubertjr/ioc-esg-municipal (publico)
- Ultimo commit: fix(agents): ESM compat nos scripts + injeta \_\_meta nos 7 JSONs
