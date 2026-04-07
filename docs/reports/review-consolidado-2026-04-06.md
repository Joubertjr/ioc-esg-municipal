# Relatório Consolidado de Revisão — IOC ESG Municipal

> Data: 2026-04-06
> Fontes: 10 documentos de revisão em `docs/plans/`
> Objetivo: Consolidar todos os findings em prioridade de ação única

---

## Sumário Executivo

| Categoria           | Criticos | Importantes | Melhorias |
| ------------------- | -------- | ----------- | --------- |
| Scoring ODS         | 6        | 3           | 4         |
| Banco de Dados      | 3        | 3           | 2         |
| Frontend/Integração | 2        | 2           | 1         |
| Segurança           | 3        | 6           | 7         |
| Performance         | 4        | 3           | 2         |
| Cobertura de Testes | 2        | 5           | 3         |
| **Total**           | **20**   | **22**      | **19**    |

Estado atual: 231 testes passando, 12/17 ODS cobertos, 7/7 coletores ativos, zero testes de integração/e2e.

---

## 1. Scoring ODS — Problemas Críticos

Fonte: `docs/plans/ods-scoring-review.md`

### 1.1 ODS 10 duplicado no mapeador IBGE (CRITICO)

`backend/agents/ibge/ibge_ods_mapper.ts` gera ODS 10 tanto via `razao2020` quanto via `gini`. Os dois blocos existem separados e produzem dois registros `OdsIndicator` com `odsNumber: 10` para o mesmo município na mesma coleta. O aggregator de score calcula a média simples dos dois, diluindo o sinal do Gini (mais importante).

**Correcao:** Mesclar os dois indicadores em um único bloco ODS 10, usando média ponderada interna (Gini 70% + razão 30%).

### 1.2 ODS 11 usava densidade demográfica como proxy (RESOLVIDO)

Corrigido nesta sessão: substituído por `urbanizacaoAdequada` (% domicílios urbanos com infraestrutura adequada — Censo IBGE 2022). Score curve com inflexão em 70% e saturação em 90%.

### 1.3 Mortalidade infantil ausente do ODS 3 (CRITICO)

O DATASUS collector coleta `mortalidade_infantil` mas `ibge_ods_mapper.ts` não inclui ODS 3. A especificação exige mortalidade infantil como indicador primário do ODS 3 (peso 60%). Atualmente ODS 3 não existe no sistema — score retorna null para todos os municípios.

**Correcao:** Adicionar bloco ODS 3 no mapper usando `ind.mortalidadeInfantil` (menor = melhor, inverter normalizando).

### 1.4 Base de cálculo da despesa pública (ODS 3 e 4) usa receita total em vez de LRF (CRITICO)

O `siconfi_ods_mapper.ts` divide `despesaSaude` e `despesaEducacao` pela receita total corrente. A Lei de Responsabilidade Fiscal exige o cálculo sobre a Receita Líquida de Transferências (RLT). Usar receita total subestima o percentual real para municípios com alta arrecadação própria.

**Correcao:** Usar `receitaLiquidaTransferencias` (disponível na API SICONFI, endpoint `/api/v1/municipios/{cod}/receitas`) como denominador.

### 1.5 Score global usa média simples — deveria ser média ponderada (CRITICO)

`backend/services/ods/ods_aggregator.ts` soma os scores e divide por `indicators.length`. A especificação define pesos por ODS calibrados por impacto. Municípios com ODS de saúde e educação ruins recebem score global inflado se tiverem muitos ODS cobrindo áreas secundárias.

**Correcao:** Implementar pesos conforme `CLAUDE.md` — ODS 3, 4, 6 com peso maior no score global.

### 1.6 `referenceYear` no score ODS usa data de coleta, não ano do dado (CRITICO)

Todos os calculators gravam `referenceDate: new Date()` (hoje). O IDEB é bienal (último: 2023), o SNIS chega com 18 meses de atraso (dado de 2022 publicado em 2024). O frontend mostra "Dados de 2026-04-06" para dados que na verdade são de 2022.

**Correcao:** Cada indicador deve registrar `referenceYear` com o ano real do dado. ODS 4/IDEB → 2023, ODS 6/SNIS → 2022, ODS 13/PRODES → 2024.

### 1.7 ODS sem implementacao (5 ausentes)

ODS 5, 7, 9, 12, 14 não têm calculators nem coletores ativos.

- ODS 5: TSE (representação política) + IBGE SIDRA (renda por sexo) — mapeamento TSE→IBGE necessário (códigos diferentes)
- ODS 7: ANEEL — dataset CSV de instalações solares
- ODS 9: IBGE SIDRA T/5938 (VAB industrial, dados até 2021) + ANATEL CSV (banda larga)
- ODS 12: SNIS RS (resíduos sólidos — coleta seletiva e reciclagem)
- ODS 14: ANA (qualidade da água — IQA) + mapeamento por bacia hidrográfica

---

## 2. Banco de Dados — Problemas Críticos

Fonte: `docs/plans/database-architecture-review.md`

### 2.1 Múltiplas instâncias PrismaClient (CRITICO)

`backend/lib/prisma.ts` instancia `new PrismaClient()` sem singleton pattern. Em ambiente de desenvolvimento com hot-reload, o Vitest + Node cria novas instâncias a cada re-import, esgotando o pool de conexões PostgreSQL (default: 10 conexões). Em produção com múltiplos workers, idem.

**Correcao:**

```typescript
// backend/lib/prisma.ts
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 2.2 OdsIndicator sem unique constraint — duplicata silenciosa (CRITICO)

`prisma/schema.prisma`: a tabela `OdsIndicator` não tem `@@unique` em `[municipalityId, odsNumber, source, referenceDate]`. O collector pode ser rodado duas vezes para o mesmo município/data e dobra os registros. O aggregator calcula médias sobre dados duplicados, inflando artificialmente a confiança nos scores.

**Correcao:** Adicionar na migration:

```prisma
@@unique([municipalityId, odsNumber, source, referenceDate])
```

E usar `upsert` em vez de `create` no collector.

### 2.3 Migration nomeada `init` cobre schema completo (IMPORTANTE)

A migration `20240101000000_init` contém todo o schema incluindo tabelas que foram adicionadas posteriormente. Isso torna o histórico de migrations ilegível e dificulta rollback seletivo.

**Nota:** Não alterar migrations já aplicadas. Criar novas migrations para cada alteração de schema futura com nomes descritivos.

### 2.4 findMany sem paginação — risco de OOM (IMPORTANTE)

`backend/services/ods/ods_history_service.ts`: `prisma.odsIndicator.findMany({ where: { municipalityId } })` sem `take`/`skip`. Para municípios com histórico longo, retorna todos os registros em memória.

**Correcao:** Adicionar `take: 100, orderBy: { referenceDate: "desc" }` como default.

### 2.5 Bug confirmado: 5 municípios com ibgeCode/nome trocados no seed (IMPORTANTE)

`backend/prisma/seed.ts` — TOP_20 contém 5 municípios com código IBGE atribuído ao município errado (ex: código de Chapecó com nome de Blumenau). Afeta todos os relatórios de benchmark e comparativo entre municípios.

**Correcao:** Auditar TOP_20 completo contra lista oficial IBGE em `shared/constants/municipalities.ts`.

---

## 3. Frontend/Integração — Problemas

Fonte: `docs/plans/frontend-integration-review.md`

### 3.1 CSRF bloqueia POST em producao same-origin (CRITICO)

`frontend/src/lib/api.ts` linhas 99-107: `apiPost` envia `credentials: "include"` sem header `X-Requested-With`. Em produção com nginx proxy (frontend e backend no mesmo domínio), o browser não envia `Origin` em requisições same-origin. O `verifyCsrf` em `backend/middleware/auth.ts` rejeita com 403. Afeta: simulador, logout.

**Correcao:**

1. Adicionar `"X-Requested-With": "XMLHttpRequest"` no `apiPost`
2. Atualizar `verifyCsrf` para aceitar esse header como prova de intenção CSRF

### 3.2 ibgeCode não sincronizado entre paginas (CRITICO)

`frontend/src/pages/SimulatorPage.tsx` linha 140-148: consulta `GET /api/municipalities` para o `<select>` e mantém `ibgeCode` local inicializado em `DEFAULT_IBGE_CODE` (Florianópolis). O usuário seleciona município X no dashboard, navega para o simulador, e vê Florianópolis selecionado. Executa simulação para o município errado sem perceber.

**Correcao:** Criar store Zustand `useMunicipalityStore` com `ibgeCode` global compartilhado entre todas as páginas. O simulator-frontend.md já especifica essa store — implementar conforme spec.

### 3.3 AuthResponse duplicado e inconsistente (IMPORTANTE)

`frontend/src/types/api.ts` linha 109-116: `AuthResponse` sem `refreshToken`. `frontend/src/hooks/useAuth.ts` linha 16-18: interface local com `refreshToken` mas sem `user`. Backend retorna ambos. Qualquer dev que importe `AuthResponse` de `api.ts` e tente acessar `.refreshToken` recebe erro TypeScript.

**Correcao:** Unificar em `api.ts` com ambos os campos; remover interface local de `useAuth.ts`.

### 3.4 ProtectedRoute reinicia checkSession em cada navegacao (IMPORTANTE)

`frontend/src/App.tsx` linhas 35-47: cada rota protegida é uma instância separada de `ProtectedRoute` com `useState("loading")` inicial. A cada troca de página, dispara `GET /api/auth/me` e exibe spinner por 100-300ms.

**Correcao:** Elevar estado de sessão para o nível do `App` com `useState` + `useEffect` único, ou usar React Query com `queryKey: ["session"]` e `staleTime: Infinity`.

---

## 4. Segurança

Fonte: `docs/plans/security-audit.md`

### 4.1 Endpoints sem autenticacao (CRITICO)

`GET /api/municipalities`, `GET /api/municipalities/:ibgeCode`, `GET /api/ods/:ibgeCode` não passam pelo middleware `authenticateToken`. Qualquer usuário não autenticado pode acessar todos os dados de ODS de qualquer município de SC.

**Correcao:** Adicionar `authenticateToken` como middleware nas rotas municipais e ODS.

### 4.2 CORS aberto para qualquer origem (CRITICO)

`backend/app.ts`: `cors({ origin: "*" })` (ou `origin: true`). Em produção, qualquer site pode fazer requisições autenticadas com cookies do usuário.

**Correcao:** Definir `ALLOWED_ORIGINS` como variável de ambiente e validar contra lista explícita.

### 4.3 Zero rate limiting nos endpoints principais (CRITICO)

Apenas `/api/auth/*` tem rate limiter. `GET /api/ods/:ibgeCode` e `POST /api/simulator/simulate` não têm limite. Um atacante pode fazer 1000 req/s para o simulador, consumindo CPU e slots de conexão do banco.

**Correcao:** Aplicar `rateLimiter` (já existe para auth) em todas as rotas de API.

### 4.4 JWT_SECRET com valor placeholder em .env.example (ALTO)

`.env.example` tem `JWT_SECRET=changeme`. Se alguém copiar sem trocar, todos os tokens JWT da produção podem ser forjados.

**Correcao:** Validar na inicialização que `JWT_SECRET` tem pelo menos 32 caracteres e não é "changeme".

### 4.5 Sem headers de segurança HTTP (ALTO)

Sem `helmet`. Respostas sem `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`. Vulnerável a clickjacking e MIME sniffing.

**Correcao:** `app.use(helmet())` — zero esforço, muito impacto.

### 4.6 POST /api/benchmarks/compare sem validacao de ibgeCodes (ALTO)

Recebe array de `ibgeCodes` sem validar se são códigos IBGE válidos (7 dígitos, existem no banco). Um array com 10.000 elementos dispara 10.000 queries.

**Correcao:** Validar com Zod `z.array(z.string().regex(/^\d{7}$/)).max(50)`.

### 4.7 SSRF potencial via ibgeCode em chamadas a APIs externas (ALTO)

Coletores usam `ibgeCode` interpolado em URLs de APIs externas sem sanitização. Se um endpoint aceitar `ibgeCode` de rota e repassar para o coletor, um ibgeCode malformado pode manipular a URL da API governamental.

**Correcao:** Validar ibgeCode com regex `/^\d{7}$/` no middleware antes de qualquer uso em URL.

### 4.8 Redis sem autenticacao (ALTO)

`docker-compose.yml`: Redis sem `requirepass`. Em redes onde o container é acessível, qualquer processo pode ler/escrever no cache — incluindo dados de sessão.

**Correcao:** Adicionar `command: redis-server --requirepass ${REDIS_PASSWORD}` no compose e `REDIS_PASSWORD` no `.env`.

### 4.9 Adminer exposto em producao (ALTO)

`docker-compose.yml`: Adminer na porta 8080 sem autenticação de aplicação (apenas senha do banco). Em produção, remover o serviço adminer do compose ou restringir com nginx auth básica.

---

## 5. Performance — Gargalos Críticos

Fonte: `docs/plans/performance-analysis.md`

### 5.1 DATASUS bloqueia Promise.all — timeout de 93 segundos (CRITICO)

`backend/agents/datasus/datasus_collector.ts`: o coletor DATASUS faz scraping de TABNET via POST. Timeout padrão de 30s × 3 tentativas = 90s de bloqueio por município. Em `collectBatch`, se DATASUS está fora, todos os coletores do batch esperem em `Promise.all`.

**Correcao:** `Promise.allSettled` em vez de `Promise.all`. Isolar DATASUS com timeout próprio de 15s (TABNET é instável). Marcar dados como `dataAvailable: false` quando DATASUS falha, continuar com outros coletores.

### 5.2 SICONFI com chamadas sequenciais para FPM (CRITICO)

`backend/agents/siconfi/siconfi_collector.ts`: busca FPM em 3 calls sequenciais (décimos 10, 20, 30) com `await` em série. 3 × 2s = 6s mínimo por município só para FPM.

**Correcao:** `Promise.all([fetch10, fetch20, fetch30])` — as 3 calls são independentes.

### 5.3 collectBatch sequential para 295 municipios — 7 a 30 minutos (CRITICO)

`backend/services/collection_orchestrator.ts`: loop `for...of` com `await collectMunicipality(ibgeCode)`. 295 municípios × 2-6s = 590s a 1770s.

**Correcao:** Processar em batches paralelos de 10 municípios com rate limiting (2 req/s por API):

```typescript
const BATCH_SIZE = 10;
for (let i = 0; i < municipios.length; i += BATCH_SIZE) {
  const batch = municipios.slice(i, i + BATCH_SIZE);
  await Promise.allSettled(batch.map((m) => collectMunicipality(m)));
}
```

### 5.4 POST /api/benchmarks/compare sem throttle — 50 chamadas HTTP paralelas (CRITICO)

`backend/routes/benchmarks.ts`: `Promise.all(ibgeCodes.map(code => getOdsScore(code)))` sem limite. Para 50 municípios, dispara 50 queries simultâneas ao banco + potencialmente 50 chamadas a APIs externas.

**Correcao:** Usar `p-limit` com concurrency 5, ou implementar throttling manual.

---

## 6. Cobertura de Testes — Lacunas

Fonte: `docs/plans/test-coverage-gaps.md`

**Estado atual:** 231 testes, ~45% cobertura de linhas, zero testes de integração, zero e2e.

### 6.1 Arquivos com zero testes (CRITICO)

- `backend/services/reports/report_generator.ts`
- `backend/services/benchmarks/benchmark_service.ts`
- `backend/routes/municipalities.ts`
- `backend/routes/simulator.ts`

Estes 4 arquivos têm lógica de negócio real e zero cobertura.

### 6.2 26 casos de fronteira faltando (CRITICO)

Críticos ausentes:

- ODS scores com `null` em todos os indicadores → deve retornar `null`, não `0`
- Município com 0 habitantes (divisão por zero em per capita)
- IBGE retorna HTTP 429 (rate limit) → retry com backoff
- Gini = 0.0 e Gini = 1.0 (valores extremos da normalização)
- Score global com apenas 1 ODS disponível

### 6.3 Testes de integração ausentes (IMPORTANTE)

Nenhum teste exercita o fluxo completo HTTP → banco → response. O contrato de cada endpoint é verificado apenas por tipos TypeScript, não por testes reais.

**Prioridade de implementação:**

1. Auth flow: register → login → me → refresh → logout
2. ODS score: coleta → cálculo → persistência → leitura via API
3. Simulador: payload válido → motor de projeção → resposta estruturada
4. Benchmark: array de ibgeCodes → scores comparativos

---

## 7. Especificacoes Pendentes de Implementacao

### 7.1 Simulador (Backend + Frontend)

Fonte: `docs/plans/simulator-backend.md` e `docs/plans/simulator-frontend.md`

**Backend:** Motor de projeção com função de eficiência por ODS:

```
ΔScore_i = Σ_a [ coef(a,i) × f_sat(score_i) × f_pop(pop) × f_hor(H) × (amount_a / fpmAnual) ]
```

Fatores: saturação `1 - (s/150)`, porte (0.70–1.20), horizonte `1 + 0.15×(H-1)`.

Prisma models necessários: `SimulationBaseline`, `Simulation` (com `SimulationStatus` enum), `SimulationAllocation`, `InvestmentArea` enum (8 áreas).

**Frontend:** Store Zustand `useSimulatorStore` + fluxo de 3 steps (BudgetSetup → AllocationEditor → SimulationResult). Componente `SimulatorPage` lê `ibgeCode` do `useMunicipalityStore` global.

**Integração crítica:** O simulador frontend já chama `POST /api/simulator/simulate` (correto), mas o backend ainda não tem o motor de projeção implementado — retorna mock ou 501.

### 7.2 Coletores INPE e PNCP

Fonte: `docs/plans/inpe-collector-spec.md` e `docs/plans/pncp-collector-spec.md`

**INPE TerraBrasilis:**

- URL real: `https://terrabrasilis.dpi.inpe.br/geoserver/ows?service=WFS&version=2.0.0` (não `/api/v1`)
- Workflow de 2 passos: bbox por geocodigo → desmatamento por bbox
- Sem autenticação (PRODES é público)
- Rate limit: ~10 req/s

**PNCP:**

- URL correta: `https://pncp.gov.br/api/consulta` (não `/api/pncp`)
- Endpoint: `GET /v1/contratacoes/publicacao` com parâmetros `dataInicial`, `dataFinal`, `codigoMunicipioIbge`
- Sem autenticação para consulta
- Código IBGE de 7 dígitos no parâmetro

### 7.3 ODS 5, 9, 12, 14 — Fontes de dados identificadas

Fonte: `docs/plans/ods5-fontes-dados.md` e `docs/plans/ods-9-12-14-fontes-dados.md`

**ODS 5 (Gênero):**

- TSE: download ZIP do CDN (não tem API REST) — `consulta_cand_2024.zip`
- Gotcha: código TSE (5 dígitos) ≠ IBGE (7 dígitos) — necessário mapeamento via `munic.zip`
- IBGE SIDRA: renda por sexo disponível via REST

**ODS 9 (Inovação):**

- IBGE SIDRA T/5938: VAB industrial por município (dados até 2021 com abertura setorial)
- ANATEL: CSV de banda larga por município (download semestral de dados.gov.br)

**ODS 12 (Consumo):**

- SNIS RS: resíduos sólidos — coleta seletiva e reciclagem (download anual)

**ODS 14 (Vida na Água):**

- ANA: IQA dos corpos hídricos — mapeamento por bacia hidrográfica necessário

---

## 8. Plano de Acao Prioritizado

### Semana 1 — Críticos de segurança e dados corretos

| #   | Acao                                    | Arquivo principal                        | Impacto           |
| --- | --------------------------------------- | ---------------------------------------- | ----------------- |
| 1   | Auth em todos os endpoints de API       | `backend/routes/`                        | Segurança crítica |
| 2   | Singleton PrismaClient                  | `backend/lib/prisma.ts`                  | Estabilidade      |
| 3   | Unique constraint em OdsIndicator       | `prisma/schema.prisma`                   | Integridade dados |
| 4   | CORS restrito + helmet                  | `backend/app.ts`                         | Segurança         |
| 5   | Corrigir ODS 10 duplicado               | `backend/agents/ibge/ibge_ods_mapper.ts` | Score correto     |
| 6   | Adicionar ODS 3 (mortalidade) no mapper | `backend/agents/ibge/ibge_ods_mapper.ts` | ODS 3 ausente     |

### Semana 2 — Correções de scoring e performance

| #   | Acao                                    | Arquivo principal                            | Impacto              |
| --- | --------------------------------------- | -------------------------------------------- | -------------------- |
| 7   | Score global com pesos por ODS          | `backend/services/ods/ods_aggregator.ts`     | Score global correto |
| 8   | referenceYear com ano real do dado      | Todos os mappers                             | Transparência        |
| 9   | Promise.allSettled + isolamento DATASUS | `collection_orchestrator.ts`                 | -90s por batch       |
| 10  | SICONFI chamadas paralelas (FPM)        | `siconfi_collector.ts`                       | -4s por município    |
| 11  | CSRF fix (X-Requested-With)             | `frontend/lib/api.ts` + `middleware/auth.ts` | Produção funcional   |
| 12  | ibgeCode global (Zustand store)         | Criar `useMunicipalityStore`                 | UX correta           |

### Semana 3 — Simulador e testes

| #   | Acao                                      | Arquivo principal               | Impacto      |
| --- | ----------------------------------------- | ------------------------------- | ------------ |
| 13  | Motor de simulação backend                | `backend/services/simulator/`   | Feature core |
| 14  | UI simulador 3-steps                      | `frontend/src/pages/simulator/` | Feature core |
| 15  | Testes de integração auth + ODS           | `tests/integration/`            | Confiança    |
| 16  | Testes para 4 arquivos com zero cobertura | `tests/unit/`                   | Cobertura    |
| 17  | 26 casos de fronteira faltando            | `tests/unit/`                   | Robustez     |

### Semana 4 — ODS faltantes e coletores novos

| #   | Acao                            | Arquivo principal      | Impacto     |
| --- | ------------------------------- | ---------------------- | ----------- |
| 18  | INPE collector (ODS 13 + 15)    | `backend/agents/inpe/` | 2 ODS novos |
| 19  | PNCP collector (ODS 16)         | `backend/agents/pncp/` | 1 ODS novo  |
| 20  | ODS 9 (IBGE SIDRA + ANATEL CSV) | `backend/agents/ibge/` | 1 ODS novo  |
| 21  | ODS 5 (TSE + IBGE SIDRA)        | `backend/agents/tse/`  | 1 ODS novo  |

---

## 9. Metricas de Sucesso

| Metrica                | Hoje      | Meta Semana 4 |
| ---------------------- | --------- | ------------- |
| ODS cobertos           | 12/17     | 17/17         |
| Cobertura de testes    | ~45%      | >80%          |
| Testes unitarios       | 231       | >400          |
| Testes de integração   | 0         | >30           |
| Endpoints sem auth     | 3         | 0             |
| Score ODS 10 duplicado | sim       | nao           |
| ODS 3 calculado        | nao       | sim           |
| Simulador funcional    | nao       | sim           |
| CSRF em producao       | bloqueado | funcional     |

---

_Gerado por consolidação de 10 documentos de revisão: ods-scoring-review.md, database-architecture-review.md, frontend-integration-review.md, security-audit.md, performance-analysis.md, test-coverage-gaps.md, simulator-backend.md, simulator-frontend.md, inpe-collector-spec.md, pncp-collector-spec.md, ods-9-12-14-fontes-dados.md, ods5-fontes-dados.md_
