# Estado do Projeto — IOC ESG Municipal
Atualizado: 2026-04-01 — 17/17 ODS cobertos, 364 testes, auth JWT + error handler

## Status geral
12 coletores ativos + ODS Score Service orquestrando todos em paralelo. Cobertura completa dos 17 ODS da ONU. Auth JWT implementado. Error handler global. Zero erros TypeScript. 364 testes passando.

---

## Coletores (12/12 implementados)

| Coletor | Arquivo principal | ODS cobertos | Indicadores | Testes |
|---------|------------------|--------------|-------------|--------|
| IBGE | `ibge_collector.ts` | 1, 2, 8, 9, 10, 11 | pct_baixa_renda, producao_agricola, taxa_ocupacao, pib_per_capita, empresas_por_10k, razao_dependencia, densidade_demografica | 27 |
| SICONFI | `siconfi_collector.ts` | 3, 4, 11, 16, 17 | despesa_saude, despesa_educacao, despesa_urbanismo, equilibrio_fiscal, dependencia_FPM | 14 |
| DATASUS | `datasus_collector.ts` | 3 | previne_prenatal, previne_diabetes, previne_hipertensao, previne_crescimento, previne_cancer, previne_saude_bucal | 11 |
| INEP | `inep_collector.ts` | 4 | ideb_anos_iniciais, ideb_anos_finais | 12 |
| SNIS | `snis_collector.ts` | 6 | atendimento_agua, atendimento_esgoto, esgoto_tratado, perda_faturamento | 15 |
| INPE | `inpe_collector.ts` | 13, 15 | desmatamento_anual, desmatamento_acumulado, tendencia_climatica, tendencia_vida_terrestre | 32 |
| PNCP | `pncp_collector.ts` | 16 | total_contratacoes, percentual_dispensas, taxa_homologacao, percentual_srp | 21 |
| TSE | `tse_collector.ts` | 5 | pct_mulheres_eleitas, pct_candidatas_mulheres, pct_vereadoras | 12* |
| ANEEL | `aneel_collector.ts` | 7 | potencia_instalada_gd, unidades_gd, pct_energia_renovavel | 22 |
| SNIS-RS | `snis_rs_collector.ts` | 12 | coleta_seletiva, reciclagem, compostagem, aterro_sanitario | 22 |
| ANA | `ana_collector.ts` | 14 | iqa_medio, pct_corpos_bom, monitoramento_ativo | 12* |
| Convenios | `convenios_collector.ts` | 17 | convenios_federais, pct_orcamento_convenios, consorcios_intermunicipais | 22 |

*Contagem estimada — testes existem nos respectivos arquivos de teste

---

## Cobertura ODS (17/17)

| ODS | Nome | Fonte(s) | Indicadores | Status |
|-----|------|----------|-------------|--------|
| 1 | Erradicacao da Pobreza | IBGE | pct_baixa_renda | Ativo |
| 2 | Fome Zero | IBGE | producao_agricola (proxy PAM) | Ativo* |
| 3 | Saude e Bem-Estar | SICONFI + DATASUS | despesa_saude + 6 Previne Brasil | Ativo |
| 4 | Educacao de Qualidade | SICONFI + INEP | despesa_educacao + 2 IDEB | Ativo |
| 5 | Igualdade de Genero | TSE | pct_mulheres_eleitas + candidatas + vereadoras | Ativo |
| 6 | Agua e Saneamento | SNIS | agua + esgoto + tratamento + perdas | Ativo |
| 7 | Energia Limpa | ANEEL | potencia_gd + unidades_gd + pct_renovavel | Ativo |
| 8 | Trabalho Decente | IBGE | taxa_ocupacao + pib_per_capita | Ativo |
| 9 | Infraestrutura | IBGE | empresas_por_10k_hab (proxy CEMPRE) | Ativo* |
| 10 | Reducao das Desigualdades | IBGE | razao_dependencia (proxy — Gini ausente) | Ativo* |
| 11 | Cidades Sustentaveis | IBGE + SICONFI | densidade_demografica + despesa_urbanismo | Ativo |
| 12 | Consumo Responsavel | SNIS-RS | coleta_seletiva + reciclagem + compostagem + aterro | Ativo |
| 13 | Acao Climatica | INPE | desmatamento_anual + tendencia | Ativo |
| 14 | Vida na Agua | ANA | iqa_medio + corpos_bom + monitoramento | Ativo |
| 15 | Vida Terrestre | INPE | desmatamento_acumulado + tendencia | Ativo |
| 16 | Instituicoes Eficazes | SICONFI + PNCP | equilibrio_fiscal + 4 indicadores licitacao | Ativo |
| 17 | Parcerias | SICONFI + Convenios | dependencia_FPM + convenios_federais + consorcios | Ativo |

*ODS 2 (proxy agricola), ODS 9 (proxy empresarial), ODS 10 (razao dependencia != Gini)

---

## Auth e Seguranca

- **Auth JWT**: register/login/me endpoints em `/api/auth`
- **Middleware**: `authenticateToken` protege `/api/agents` e `/api/ods`
- **Error handler**: `AppError` class + `globalErrorHandler` + `notFoundHandler`
- **Process handlers**: `uncaughtException` + `unhandledRejection`
- **Input validation**: IBGE code regex `/^\d{7}$/` em todos os coletores
- **Helmet + CORS + Rate limiting**: configurados

---

## Testes

- **Total:** 364 testes passando em 19 arquivos
- **Erros TypeScript:** 0 (`tsc --noEmit` limpo)
- **E2E (Playwright):** 0 — nao iniciado

---

## Infraestrutura e servicos

- ODS Score Service: orquestra 12 coletores em paralelo com `withTimeout`
  - Budgets API: IBGE 10s, SICONFI 15s, DATASUS 10s, INPE 15s, PNCP 15s
  - Budgets JSON local: INEP 1s, SNIS 1s, TSE 1s, ANEEL 1s, SNIS-RS 1s, ANA 1s, Convenios 1s
- Cache: Redis com TTL por fonte
- Logger: Winston estruturado
- Docker Compose: PostgreSQL + Redis + Adminer

---

## Proximos passos (prioridade)

### Qualidade dos ODS existentes
1. ODS 10: substituir razao_dependencia por Coeficiente Gini (IBGE Censo 2022)
2. ODS 9: adicionar dados de infraestrutura viaria/digital (ANATEL + DNIT)
3. ODS 2: complementar com dados SISVAN (vigilancia alimentar)

### Features de produto
1. Simulador de cenarios de investimento FPM
2. Prisma schema v2: tabela `ods_scores` para historico
3. Testes E2E com Playwright (dashboard + score endpoint)
4. Seeding de 295 municipios SC com dados reais
5. Frontend dashboard completo com React Query

### Seguranca pendente
1. JWT_SECRET validacao em producao (nao aceitar placeholder)
2. Redis com auth em producao
3. CORS: remover localhost fallback em producao

---

## Riscos conhecidos

| Risco | Severidade | Mitigacao |
|-------|-----------|-----------|
| DATASUS instavel | Alta | timeout 10s + retry 3x + withTimeout |
| SNIS dados com 18 meses de atraso | Media | referenceYear sempre exibido |
| INEP bienal (anos pares) | Baixa | interpolacao documentada |
| Municipios <5k hab: indicadores suprimidos | Media | retornar dataAvailable: false |
| ODS 10 com proxy inadequado | Media | marcado como Ativo* |

---

## Git

- Branch: main
- Ultimo commit: `feat(ods): integrate 12 collectors for 17/17 ODS coverage`

## Stack

- Backend: Node.js 18 + TypeScript strict + Express + Prisma + PostgreSQL + Redis + Bull
- Frontend: React 18 + Vite + Tailwind CSS + Shadcn/ui + Recharts + React Query
- Testes: Vitest (364 unit) + Playwright (0 e2e)
- Infra: Docker Compose + GitHub Actions + Dockerfile
