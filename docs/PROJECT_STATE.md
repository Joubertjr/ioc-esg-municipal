# Estado do Projeto — IOC ESG Municipal

Atualizado: 2026-04-09 — 6 fases completas, 7 paginas frontend, 17/17 ODS, 15 coletores, recomendacoes inteligentes, onboarding, deploy-ready, 954+ testes, Obsidian vault integrado, 21 agentes especializados

## Status geral

**Fases 1-4 + 6 concluidas.** Fase 5 (escala nacional) adiada — foco em SC (295 municipios).
15 coletores + ODS Score + History + Simulador FPM + Reports + Benchmarks + Recomendacoes Inteligentes + Onboarding. Frontend com 7 paginas (Login, Dashboard, Simulador, Relatorios, Monitoramento, Benchmark, Onboarding). Auth JWT completo com refresh token rotation. Docker production-ready com nginx reverse proxy. CI/CD com deploy automatico.

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

- Dockerfile multi-stage (Node 20, dumb-init, non-root, healthcheck)
- docker-compose.yml (dev: postgres + redis)
- docker-compose.prod.yml (postgres + redis + api + nginx)
- nginx reverse proxy (HTTPS, security headers, gzip)
- GitHub Actions: CI (lint+test+build) + Docker build GHCR + Deploy SSH
- Redis cache com TTL por fonte
- Graceful shutdown
- Obsidian vault (~/obsidian-vault/ioc-esg-municipal/) + MCP filesystem server
- Memoria de longo prazo: architecture, decisions, gotchas, lessons-learned

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

- 954+ testes passando (918 anteriores + 36 novos IEPS)
- TSC clean (frontend e backend)
- Playwright E2E configurado

---

## Proximos passos (ver docs/BACKLOG.md)

| #   | Item                                                            | Status    |
| --- | --------------------------------------------------------------- | --------- |
| 1   | Testes para fases 3-6 (33 novos testes)                         | Concluido |
| 2   | Fix debitos tecnicos (AuthContext + simulator tsc)              | Concluido |
| 3   | Memoria longo prazo (Obsidian vault + MCP + memory-manager)     | Concluido |
| 4   | Integracao simulador <-> recomendacoes (auto-preencher cenario) | Concluido |
| 5   | Coletor IEPS Data (ODS 3 saude — 6 indicadores, BigQuery)       | Concluido |
| 6   | Scripts BigQuery dados reais (IDEB, SNIS, IEPS)                 | Concluido |
| 7   | Multi-tenant: isolamento de dados por municipio                 | Planejado |
| 8   | Exportar relatorio PDF                                          | Backlog   |
| 9   | Dashboard admin (gestao de usuarios, metricas uso)              | Backlog   |

---

## Git

- Branch: main
- Remote: https://github.com/Joubertjr/ioc-esg-municipal (publico)
- Ultimo commit: feat(ieps): fase 4D — coletor IEPS Data para ODS 3 + scripts BigQuery
