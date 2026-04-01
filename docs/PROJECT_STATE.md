# Estado do Projeto — IOC ESG Municipal
Atualizado: 2026-04-01 — PNCP integrado, 216 testes, 12/17 ODS cobertos

## Status geral
7 coletores ativos + ODS Score Service orquestrando todos em paralelo. PNCP foi o último a ser integrado (ODS 16 complementado). Zero erros TypeScript. 216 testes passando.

---

## Coletores (7/7 implementados)

| Coletor | Arquivo principal | ODS cobertos | Indicadores | Testes |
|---------|------------------|--------------|-------------|--------|
| IBGE | `ibge_collector.ts` | 1, 2, 8, 9, 10, 11 | pct_baixa_renda, producao_agricola, taxa_ocupacao, pib_per_capita, empresas_por_10k, razao_dependencia, densidade_demografica | 12 |
| SICONFI | `siconfi_collector.ts` | 3, 4, 11, 16, 17 | despesa_saude, despesa_educacao, despesa_urbanismo, equilibrio_fiscal, dependencia_FPM | 14 |
| DATASUS | `datasus_collector.ts` | 3 | previne_prenatal, previne_diabetes, previne_hipertensao, previne_crescimento, previne_cancer, previne_saude_bucal | 11 |
| INEP | `inep_collector.ts` | 4 | ideb_anos_iniciais, ideb_anos_finais | 12 |
| SNIS | `snis_collector.ts` | 6 | atendimento_agua (IN023), atendimento_esgoto (IN056), esgoto_tratado (IN046), perda_faturamento (IN049) | 15 |
| INPE | `inpe_collector.ts` | 13, 15 | desmatamento_anual, desmatamento_acumulado, tendencia_climatica, tendencia_vida_terrestre | 32 |
| PNCP | `pncp_collector.ts` | 16 | total_contratacoes, percentual_dispensas, taxa_homologacao, percentual_srp | 21 |

---

## Cobertura ODS (12/17)

| ODS | Nome | Fonte(s) | Indicadores | Status |
|-----|------|----------|-------------|--------|
| 1 | Erradicacao da Pobreza | IBGE | pct_baixa_renda | Ativo |
| 2 | Fome Zero | IBGE | producao_agricola (proxy PAM) | Ativo* |
| 3 | Saude e Bem-Estar | SICONFI + DATASUS | despesa_saude + 6 Previne Brasil | Ativo |
| 4 | Educacao de Qualidade | SICONFI + INEP | despesa_educacao + 2 IDEB | Ativo |
| 5 | Igualdade de Genero | — | — | Pendente |
| 6 | Agua e Saneamento | SNIS | agua + esgoto + tratamento + perdas | Ativo |
| 7 | Energia Limpa | — | — | Pendente |
| 8 | Trabalho Decente | IBGE | taxa_ocupacao + pib_per_capita | Ativo |
| 9 | Infraestrutura | IBGE | empresas_por_10k_hab (proxy CEMPRE) | Ativo* |
| 10 | Reducao das Desigualdades | IBGE | razao_dependencia (proxy — Gini ausente) | Ativo* |
| 11 | Cidades Sustentaveis | IBGE + SICONFI | densidade_demografica + despesa_urbanismo | Ativo |
| 12 | Consumo Responsavel | — | — | Pendente |
| 13 | Acao Climatica | INPE | desmatamento_anual + tendencia | Ativo |
| 14 | Vida na Agua | — | — | Pendente |
| 15 | Vida Terrestre | INPE | desmatamento_acumulado + tendencia | Ativo |
| 16 | Instituicoes Eficazes | SICONFI + PNCP | equilibrio_fiscal + 4 indicadores licitacao | Ativo |
| 17 | Parcerias | SICONFI | dependencia_FPM | Ativo |

*ODS 2 (proxy agricola, nao contempla seguranca alimentar urbana), ODS 9 (proxy empresarial, sem dados de infraestrutura fisica), ODS 10 (razao dependencia demografica, nao e coeficiente Gini)

---

## Testes

- **Total:** 216 testes passando em 13 arquivos
- **Erros TypeScript:** 0 (`tsc --noEmit` limpo)
- **Cobertura por modulo:**
  - utils/http-client: 6 testes
  - inpe_collector: 32 testes
  - pncp_collector: 21 testes
  - routes/agents: 11 testes
  - demais coletores + boundary values + cache: ~146 testes
- **E2E (Playwright):** 0 — nao iniciado

---

## Infraestrutura e servicos

- ODS Score Service: orquestra 7 coletores em paralelo com `withTimeout`
  - Budgets: IBGE 10s, SICONFI 15s, DATASUS 10s, INEP 1s, SNIS 1s, INPE 15s, PNCP 15s
- Seguranca: helmet, CORS restrito, rate limiting (60/min global, 5/min batch)
- Cache: Redis com TTL por fonte (IBGE 24h, SICONFI 6h, DATASUS 12h, INPE 24h, PNCP 1h)
- Circuit breaker: por coletor, skip sleep em cache hit
- Logger: Winston estruturado (substituiu console.log em producao)
- Docker Compose: PostgreSQL + Redis + Adminer
- CI/CD: GitHub Actions configurado
- Frontend: 10 componentes React (dashboard, ODS cards, charts)

---

## Proximos passos (prioridade)

### ODS faltantes (5 pendentes)
| ODS | Nome | Fonte recomendada | Complexidade |
|-----|------|-------------------|--------------|
| 5 | Igualdade de Genero | TSE (eleicoes.tse.jus.br) + SSP-SC | Media |
| 7 | Energia Limpa | ANEEL (dadosabertos.aneel.gov.br) | Media |
| 12 | Consumo Responsavel | SNIS-RS (residuos solidos) | Baixa |
| 14 | Vida na Agua | ANA (dadosabertos.ana.gov.br) + MapBiomas | Alta |

### Qualidade dos ODS existentes
1. ODS 10: substituir razao_dependencia por Coeficiente Gini (IBGE Censo 2022, tabela 9543)
2. ODS 9: adicionar dados de infraestrutura viaria/digital (ANATEL + DNIT)
3. ODS 2: complementar com dados SISVAN (vigilancia alimentar) alem da producao agricola

### Features de produto
1. Auth JWT + multi-tenancy por municipio
2. Simulador de cenarios de investimento FPM
3. Prisma schema v2: tabela `ods_scores` para historico
4. Testes E2E com Playwright (dashboard + score endpoint)
5. Seeding de 295 municipios SC com dados reais

---

## Riscos conhecidos

| Risco | Severidade | Mitigacao |
|-------|-----------|-----------|
| DATASUS instavel (cai com frequencia) | Alta | timeout 10s + retry 3x + withTimeout no Score Service |
| SNIS dados com 18 meses de atraso | Media | referenceYear sempre exibido na resposta |
| INEP bienal (anos pares) | Baixa | interpolacao — documentada no collector |
| Municípios <5k hab: indicadores suprimidos | Media | retornar `dataAvailable: false`, nao score 0 |
| IBGE codigo 7 digitos vs SICONFI 6 digitos | Media | conversao implementada nos collectors |
| ODS 10 com proxy inadequado (razao dependencia != Gini) | Media | marcado como Ativo* — nao bloqueante mas enganoso |

---

## Git

- Branch: main
- Commits: 15
- Ultimo commit: `feat(pncp,ibge): add PNCP collector + IBGE ODS 2/9 indicators`

## Stack

- Backend: Node.js 18 + TypeScript strict + Express + Prisma + PostgreSQL + Redis + Bull
- Frontend: React 18 + Vite + Tailwind CSS + Shadcn/ui + Recharts + React Query
- Testes: Vitest (216 unit) + Playwright (0 e2e)
- Infra: Docker Compose + GitHub Actions + Dockerfile
