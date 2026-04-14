# Estado Atual do Projeto — Foco SC

**Data da Última Atualização:** 13 de abril de 2026
**Objetivo Único:** Entregar a plataforma funcionando perfeitamente para os 295 municípios de Santa Catarina (SC) e obter aprovação do cliente final. Nenhuma feature além desse escopo deve ser desenvolvida.

---

## 1. Visão Geral da Prontidão (Readiness)

A plataforma IOC ESG Municipal encontra-se **pronta para uso em ambiente de produção (SC)**. Todos os bloqueadores técnicos e gaps de dados que impediam a utilização real por um prefeito catarinense foram resolvidos.

| Componente Crítico               | Status         | Detalhes                                                                                                                                  |
| -------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Infraestrutura Docker (Prod)** | ✅ Operacional | `docker-compose.prod.yml` com Nginx (HTTP-only) + Node.js + Postgres + Redis. SSL opt-in configurado.                                     |
| **Segurança e Autenticação**     | ✅ Operacional | JWT com Refresh Token, senhas hasheadas, middleware anti-IDOR (prefeito só acessa seu município).                                         |
| **Onboarding de Usuários**       | ✅ Operacional | Fluxo restrito aos 295 municípios de SC. Usuários vinculam-se via código IBGE.                                                            |
| **Integração de Dados Reais**    | ✅ Operacional | 15 coletores (7 API + 7 estáticos + TSE). Pipeline de ingestão diária (02:00 UTC) importa para PostgreSQL. Dashboard lê do banco (<50ms). |
| **Pipeline de Ingestão**         | ✅ Operacional | node-cron 02:00 UTC, 15 fontes, IngestionRun/Log com auditoria, score recalculation, cache invalidation. Admin: GET/POST /api/ingestion.  |
| **Dashboard e Simulação**        | ✅ Operacional | Interface responsiva, simulação de FPM, ranking SC (Benchmark) e relatórios de recomendações por IA.                                      |
| **Observabilidade**              | ✅ Operacional | Prometheus + Grafana + prom-client. Métricas: latência p95, cache hit/miss, APIs gov, Core Web Vitals. Alertas automáticos.               |

---

## 2. Inventário de Coletores de Dados (Os 14 Agentes)

A credibilidade do sistema depende da atualidade dos dados. A tabela abaixo reflete a fonte real de cada coletor no momento do deploy em SC.

### 2.1. Coletores em Tempo Real (APIs Governamentais)

1. **DATASUS:** API REST (datasus.saude.gov.br)
2. **INPE:** API REST (terrabrasilis.dpi.inpe.br)
3. **PNCP:** API REST (pncp.gov.br)
4. **SICONFI:** API REST (api.siconfi.tesouro.gov.br)
5. **IBGE:** API REST (servicodados.ibge.gov.br)
6. **ANA:** Integração direta
7. **SNIS-RS:** Integração direta

### 2.2. Coletores de Dados Estáticos (Arquivos JSON)

Estes coletores dependem de bases que o governo atualiza anualmente ou bienalmente via planilhas/dumps. Os dados são mantidos em `shared/data/*_latest.json` e podem ser atualizados a qualquer momento executando os scripts `pnpm data:update:*`.

1. **IEPS (Saúde):** Lê `ieps_latest.json` (Atualizado via script TypeScript).
2. **INEP (Educação - IDEB):** Lê `ideb_latest.json` (Atualizado via script TypeScript).
3. **SNIS (Saneamento):** Lê `snis_latest.json` (Atualizado via script TypeScript).
4. **SISVAN (Nutrição):** Lê `sisvan_latest.json` (Atualizado via script TypeScript).
5. **ANATEL (Conectividade):** Lê `anatel_latest.json` (Atualizado via script TypeScript).
6. **ANEEL (Energia):** Lê `aneel_latest.json` (Atualizado via script TypeScript).
7. **Convênios (Transferências):** Lê `convenios_latest.json` (Atualizado via script TypeScript).

_Nota: Todos os 7 JSONs possuem a chave `__meta` com o `referenceYear` lido dinamicamente pelo coletor._

---

## 3. Bugs UX Corrigidos (2026-04-13 — Auditoria Funcional)

Auditoria end-to-end como prefeito de Florianópolis identificou e corrigiu:

| Bug                                    | Impacto                                                  | Commit    |
| -------------------------------------- | -------------------------------------------------------- | --------- |
| ibgeCode não sincroniza com auth async | Prefeito de outra cidade via Florianópolis por default   | `bec945a` |
| Trend dead-band ±0.5 inconsistente     | "→ 1 pts" quando deveria mostrar seta direcional         | `bec945a` |
| Benchmark skeleton infinito            | Compound isLoading bloqueava seções independentes        | `e4020ef` |
| Ranking "—" no Dashboard               | Backend exclui target do ranking, frontend não calculava | `e4020ef` |

Rotina de auditoria permanente criada: `/audit` (skill) + `scripts/audit.sh` + `tests/e2e/audit.spec.ts` (`5cf899a`).

---

## 4. Pipeline de Ingestão (2026-04-13)

Dashboard antes: **15.3s** (chamadas real-time a 15 APIs). Dashboard agora: **27ms cold / 3ms cached** (leitura do PostgreSQL).

| Aspecto        | Detalhe                                                                          |
| -------------- | -------------------------------------------------------------------------------- |
| **Scheduler**  | node-cron `0 2 * * *` UTC, embutido no Express (ADR-010)                         |
| **Fontes**     | 10 estáticas (paralelo, ~1s) + 5 APIs (sequencial, rate limited)                 |
| **Auditoria**  | IngestionRun por fonte + IngestionLog apenas falhas (ADR-012)                    |
| **Fallback**   | Dashboard sem dados no banco cai no real-time transparentemente (ADR-011)        |
| **Response**   | `dataSource: "database"\|"realtime"` + `dataCollectedAt` em toda resposta ODS    |
| **Admin**      | `GET /api/ingestion/status` + `POST /api/ingestion/trigger` (role admin)         |
| **Métricas**   | 4 Prometheus: duration, indicators_upserted, municipalities_failed, last_success |
| **Verificado** | 10 fontes estáticas: 295 municípios, 8389 indicadores, 0 falhas                  |

---

## 5. Correções Estruturais do Diagnóstico Arquitetural (2026-04-13)

Auditoria arquitetural profunda identificou 5 problemas de correção de dados e performance. Todos corrigidos no commit `3a0111e`.

| Problema                                    | Impacto                                                                                                     | Correção                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **SC_BENCHMARK_CODES errados**              | 8/10 códigos IBGE apontavam municípios incorretos — todo ranking e recomendação IA eram contra grupo errado | Corrigidos: Blumenau, Criciúma, São José, Lages, Balneário Camboriú, Chapecó, Itajaí, Palhoça |
| **Peer clustering hardcoded 20 municípios** | 275/295 municípios retornavam 404 na rota /peers                                                            | Reescrito para ler 295 do PostgreSQL com cache 24h, z-score (população + FPM per capita)      |
| **Trend/History misturava odsNumber**       | useTrend e OdsHistoryChart faziam média de 18 rows (global + 17 ODS) em vez de usar odsNumber=0             | Filtro odsNumber=0 no hook e componente                                                       |
| **geometricScore não persistido**           | Calculado em ods_score_service mas nunca gravado no banco pelo history_service                              | Adicionado ao upsert do odsNumber=0                                                           |
| **Benchmark N×4 queries**                   | benchmark_service chamava calculateMunicipalOds por município (N chamadas API)                              | Novo bulk reader readOdsReportsForCodes — 3 queries para qualquer N municípios                |
| **Refresh token perdido no reload**         | Token armazenado em variável JS — perdido ao recarregar página                                              | Migrado para sessionStorage + checkSession tenta refresh antes de falhar                      |

---

## 6. Próximos Passos Imediatos (Go-Live SC)

A plataforma não requer mais código para funcionar em SC. Os próximos passos são puramente operacionais:

1. **Smoke Test Final:** Executar o script de smoke test (`smoke-test-stack.sh`) garantindo que os 295 municípios completem o ciclo de cálculo ODS sem falhas de timeout ou validação Zod.
2. **Provisionamento de Infraestrutura:**
   - Configurar o servidor (e.g., AWS EC2, DigitalOcean).
   - Apontar o domínio oficial (e.g., `app.ioc.com.br`).
   - Preencher o `.env` de produção (senhas fortes, JWT_SECRET gerado via OpenSSL).
3. **Deploy:** Executar `docker compose -f docker-compose.prod.yml up -d`.
4. **SSL (Opcional, mas recomendado):** Executar `./scripts/setup-ssl.sh` com o domínio configurado.

---

## 7. O Que NÃO Fazer (Regras de Ouro)

Até que o cliente final (Prefeitura em SC) valide e aprove o produto em produção:

- **NÃO** adicione suporte a municípios fora de SC.
- **NÃO** crie novas telas de relatórios ou dashboards administrativos.
- **NÃO** altere a arquitetura do banco de dados (Prisma) para suportar multi-tenant complexo (o isolamento atual por `municipalityId` é suficiente).
- **NÃO** gaste tempo otimizando performance prematuramente a menos que um endpoint específico esteja falhando em produção.
