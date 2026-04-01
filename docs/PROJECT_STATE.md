# Estado do Projeto — IOC ESG Municipal
Atualizado: 2026-04-01 18:00 — INPE (Florestal) integrado, 11/17 ODS

## Status: DASHBOARD + SCORE SERVICE + 6 COLETORES — 11/17 ODS cobertos

## Concluido
- Setup completo (docs, types, Prisma, Docker, seeds, CI/CD)
- **Agente IBGE:** 6 indicadores → ODS 1, 8, 10, 11 (12 testes)
- **Agente SICONFI:** FPM + despesas por funcao → ODS 3, 4, 11, 16, 17 (14 testes)
- **Agente DATASUS:** 6 indicadores Previne Brasil → ODS 3 (11 testes)
  - API DEMAS: apidadosabertos.saude.gov.br
  - Fallback quadrimestral: Q atual → Q anterior → ano anterior Q3
- **Agente INEP:** IDEB 2023 → ODS 4 (12 testes)
  - 2 indicadores: IDEB anos iniciais + IDEB anos finais
- **Agente SNIS:** Saneamento 2022 → ODS 6 (15 testes)
  - 4 indicadores: agua, esgoto, tratamento, perdas
- **Agente INPE:** Desmatamento PRODES Mata Atlantica → ODS 13, 15 (testes em andamento)
  - WFS GeoServer 2-step: bbox por geocodigo → serie historica desmatamento
  - 4 indicadores: desmatamento anual, acumulado, tendencia, tendencia vida terrestre
  - Cache 24h, timeout 15s, retry 3x
- **ODS Score Service:** orquestra 6 coletores em paralelo com circuit breaker
  - withTimeout: IBGE 10s, SICONFI 15s, DATASUS 10s, INEP 1s, SNIS 1s, INPE 15s
- **Dashboard Frontend:** 10 componentes React
- **Seguranca:** helmet, CORS restrito, rate limiting (60/min + 5/min batch)
  - Validacao batch com regex /^\d{7}$/, body limit 10kb
- **Performance:** circuit breaker por coletor, skip sleep em cache hit
- **Testes:** 121 unitarios passando (boundary values, http-client, cache)
- **Agente project-monitor:** analista continuo de KPIs e coerencia
- **Dockerfile + .dockerignore** para deploy

## Cobertura ODS (11/17)
| ODS | Nome | Fonte | Indicadores | Status |
|-----|------|-------|-------------|--------|
| 1 | Pobreza | IBGE | pct_baixa_renda | Ativo |
| 2 | Fome Zero | — | — | Pendente (FNDE/SISVAN) |
| 3 | Saude | SICONFI+DATASUS | despesa_saude + 6 Previne Brasil | Ativo |
| 4 | Educacao | SICONFI+INEP | despesa_educacao + 2 IDEB | Ativo |
| 5 | Igualdade Genero | — | — | Pendente (SSP-SC/TSE) |
| 6 | Saneamento | SNIS | agua + esgoto + tratamento + perdas | Ativo |
| 7 | Energia | — | — | Pendente (ANEEL/IBGE) |
| 8 | Trabalho | IBGE | ocupacao + PIB per capita | Ativo |
| 9 | Infraestrutura | — | — | Pendente (ANATEL/IBGE) |
| 10 | Desigualdade | IBGE | pct_baixa_renda (proxy — precisa Gini) | Ativo* |
| 11 | Cidades | IBGE+SICONFI | equilibrio_fiscal + urbanismo | Ativo* |
| 12 | Consumo Resp. | — | — | Pendente (SNIS-RS) |
| 13 | Acao Climatica | INPE | desmatamento_anual + tendencia | Ativo |
| 14 | Vida na Agua | — | — | Pendente (ANA/MapBiomas) |
| 15 | Vida Terrestre | INPE | desmatamento_acumulado + tendencia | Ativo |
| 16 | Instituicoes | SICONFI | equilibrio_fiscal | Ativo* |
| 17 | Parcerias | SICONFI | dependencia_FPM | Ativo |

*ODS 10, 11, 16 precisam de indicadores proprios (duplicam ODS 1/proxies errados)

## Em Andamento (agentes background)
- Testes INPE collector (test-inpe)
- Testes rotas Express (test-routes)
- PNCP collector (impl-pncp)
- Analise de monitoramento (monitor-run-1)

## Proximos Passos
1. Commitar PNCP collector quando pronto
2. Corrigir scoring ODS 10 (Gini), ODS 11 (indicadores proprios)
3. Implementar ODS faltantes: 2, 5, 7, 9, 12, 14
4. Simulador de investimentos FPM
5. Auth JWT + multi-tenancy
6. Prisma schema v2 (scores historicos)

## Metricas
- 121 testes passando, 0 erros TypeScript
- 6 coletores ativos, 7o em implementacao (PNCP)
- 15 agentes especializados + 1 project-monitor = 16 agentes

## Stack
- Backend: Node.js 18 + TypeScript strict + Express + Prisma + PostgreSQL + Redis
- Frontend: React 18 + Vite + Tailwind + Recharts + React Query
- Testes: Vitest (121 unit) + Playwright (0 e2e)
- Infra: Docker Compose + GitHub Actions

## Git
- Branch: main (10 commits)
- Ultimo commit: feat(agents) add project-monitor
