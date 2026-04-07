# Revisao de Contratos de API — IOC ESG Municipal

**Data:** 2026-04-06
**Escopo:** backend/routes/_.ts + backend/middleware/_.ts
**Agente:** backend-architect
**Status:** Revisao somente-leitura. Nenhuma edicao foi feita.

---

## 1. Inventario completo de endpoints

### 1.1 Auth (`/api/auth`) — sem versionamento de prefixo

| #   | Metodo | Path               | Auth   | Rate Limit              | Zod                              | Paginacao | Roles                |
| --- | ------ | ------------------ | ------ | ----------------------- | -------------------------------- | --------- | -------------------- |
| 1   | POST   | /api/auth/register | public | authLimiter (10/15min)  | RegisterSchema                   | nao       | —                    |
| 2   | POST   | /api/auth/login    | public | authLimiter (10/15min)  | LoginSchema                      | nao       | —                    |
| 3   | POST   | /api/auth/refresh  | public | authLimiter (10/15min)  | RefreshSchema inline             | nao       | —                    |
| 4   | POST   | /api/auth/logout   | public | authLimiter (10/15min)  | nao (body opcional, cast manual) | nao       | —                    |
| 5   | GET    | /api/auth/me       | JWT    | generalLimiter (60/min) | nao                              | nao       | qualquer autenticado |

### 1.2 Municipalities (`/api/municipalities`)

| #   | Metodo | Path                          | Auth                       | Rate Limit     | Zod                                   | Paginacao              | Roles                |
| --- | ------ | ----------------------------- | -------------------------- | -------------- | ------------------------------------- | ---------------------- | -------------------- |
| 6   | GET    | /api/municipalities           | JWT (duplo: router + rota) | generalLimiter | PageSchema + PageSizeSchema (parcial) | offset (page/pageSize) | qualquer autenticado |
| 7   | GET    | /api/municipalities/:ibgeCode | JWT (duplo)                | generalLimiter | IbgeCodeSchema                        | nao                    | qualquer autenticado |

### 1.3 ODS (`/api/ods`)

| #   | Metodo | Path                       | Auth        | Rate Limit           | Zod                              | Paginacao | Roles                       |
| --- | ------ | -------------------------- | ----------- | -------------------- | -------------------------------- | --------- | --------------------------- |
| 8   | GET    | /api/ods/:ibgeCode         | JWT (duplo) | generalLimiter       | regex manual (nao Zod)           | nao       | qualquer autenticado        |
| 9   | GET    | /api/ods/:ibgeCode/history | JWT (duplo) | generalLimiter       | regex manual + Number() manual   | nao       | qualquer autenticado        |
| 10  | POST   | /api/ods/compare           | JWT (duplo) | batchLimiter (5/min) | validacao manual (Array.isArray) | nao       | admin, prefeito, secretario |

### 1.4 Simulator (`/api/simulator`)

| #   | Metodo | Path                             | Auth        | Rate Limit           | Zod                            | Paginacao                  | Roles                       |
| --- | ------ | -------------------------------- | ----------- | -------------------- | ------------------------------ | -------------------------- | --------------------------- |
| 11  | POST   | /api/simulator/simulate          | JWT (duplo) | generalLimiter       | SimulationInputSchema completo | nao                        | admin, prefeito, secretario |
| 12  | POST   | /api/simulator/compare           | JWT (duplo) | batchLimiter (5/min) | CompareBodySchema completo     | nao                        | admin, prefeito, secretario |
| 13  | GET    | /api/simulator/history/:ibgeCode | JWT (duplo) | generalLimiter       | regex manual + parseInt manual | limit query (nao paginado) | admin, prefeito, secretario |

### 1.5 Reports (`/api/reports`)

| #   | Metodo | Path                   | Auth        | Rate Limit     | Zod          | Paginacao | Roles                |
| --- | ------ | ---------------------- | ----------- | -------------- | ------------ | --------- | -------------------- |
| 14  | GET    | /api/reports/:ibgeCode | JWT (duplo) | generalLimiter | regex manual | nao       | qualquer autenticado |

### 1.6 Benchmarks (`/api/benchmarks`)

| #   | Metodo | Path                    | Auth        | Rate Limit     | Zod                    | Paginacao | Roles                       |
| --- | ------ | ----------------------- | ----------- | -------------- | ---------------------- | --------- | --------------------------- |
| 15  | POST   | /api/benchmarks         | JWT (duplo) | generalLimiter | BenchmarkRequestSchema | nao       | admin, prefeito, secretario |
| 16  | POST   | /api/benchmarks/compare | JWT (duplo) | generalLimiter | CompareRequestSchema   | nao       | admin, prefeito, secretario |

### 1.7 Agents (`/api/agents`) — 14 coletores, padrao identico

| #   | Metodo | Path                            | Auth        | Rate Limit     | Zod                                 | Roles                       |
| --- | ------ | ------------------------------- | ----------- | -------------- | ----------------------------------- | --------------------------- |
| 17  | GET    | /api/agents/ibge/:ibgeCode      | JWT (duplo) | generalLimiter | validateIbgeCode (funcao, nao Zod)  | qualquer autenticado        |
| 18  | POST   | /api/agents/ibge/batch          | JWT (duplo) | batchLimiter   | validateBatchBody (funcao, nao Zod) | admin, prefeito, secretario |
| 19  | GET    | /api/agents/siconfi/:ibgeCode   | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 20  | POST   | /api/agents/siconfi/batch       | JWT (duplo) | batchLimiter   | validateBatchBody                   | admin, prefeito, secretario |
| 21  | GET    | /api/agents/datasus/:ibgeCode   | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 22  | GET    | /api/agents/inep/:ibgeCode      | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 23  | GET    | /api/agents/snis/:ibgeCode      | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 24  | GET    | /api/agents/inpe/:ibgeCode      | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 25  | GET    | /api/agents/pncp/:ibgeCode      | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 26  | GET    | /api/agents/tse/:ibgeCode       | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 27  | GET    | /api/agents/aneel/:ibgeCode     | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 28  | GET    | /api/agents/snis-rs/:ibgeCode   | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 29  | GET    | /api/agents/ana/:ibgeCode       | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 30  | GET    | /api/agents/convenios/:ibgeCode | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 31  | GET    | /api/agents/anatel/:ibgeCode    | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |
| 32  | GET    | /api/agents/sisvan/:ibgeCode    | JWT (duplo) | generalLimiter | validateIbgeCode                    | qualquer autenticado        |

### 1.8 Infra

| #   | Metodo | Path      | Auth   | Notes                                             |
| --- | ------ | --------- | ------ | ------------------------------------------------- |
| 33  | GET    | /health   | public | sem rate limit especifico (cai no generalLimiter) |
| —   | GET    | /api/docs | public | Swagger UI                                        |

---

## 2. Analise por dimensao

### 2.1 Consistencia de formato de resposta

**Positivo:**

- Respostas de erro sempre seguem `{ error: string }` com status code semantico.
- Respostas de lista usam envelope `{ data, total, page, pageSize }` em municipalities.
- Respostas de agentes usam envelope consistente `{ municipality, source, referenceYear, indicators, ods }`.
- O `error-handler.ts` adiciona `statusCode` no corpo em erros nao operacionais, mas rotas que retornam erro diretamente NAO incluem `statusCode` no body.

**Inconsistencias encontradas:**

| Issue | Localizacao                                                                                      | Detalhe                                                                                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IC-01 | Formato de erro divergente                                                                       | `error-handler.ts` retorna `{ error, statusCode }`. Rotas retornam apenas `{ error }`. Resposta 400 de auth retorna `{ error, details }`. Sao 3 shapes distintos para erros.                                                                               |
| IC-02 | Envelope de lista inconsistente                                                                  | `GET /municipalities` retorna `{ data, total, page, pageSize }`. `GET /ods/:ibgeCode/history` retorna `{ ibgeCode, total, history }` (campo `data` ausente, chave `history` no lugar de `data`). `GET /simulator/history` retorna array puro sem envelope. |
| IC-03 | Campo `found` inconsistente                                                                      | Batch de agents retorna `{ total, found, data }`. ODS compare retorna `{ total, found, comparison }`. Formato similar mas chave de dados difere (`data` vs `comparison`).                                                                                  |
| IC-04 | `GET /auth/me` retorna `{ user }` mas `POST /auth/login` retorna `{ token, refreshToken, user }` | Shape do objeto `user` aninhado pode diferir — nao validado pela mesma interface declarativa.                                                                                                                                                              |
| IC-05 | Swagger desalinhado com implementacao                                                            | `POST /benchmarks/compare` no Swagger define o campo como `groupIbgeCodes`, mas `CompareRequestSchema` e a rota real usam `benchmarkCodes`.                                                                                                                |

### 2.2 Validacao de input (Zod)

**Cobertura:**

| Rota                        | Validacao                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| auth/\*                     | Zod completo (RegisterSchema, LoginSchema, RefreshSchema)                                |
| simulator/\*                | Zod completo com refinamento (soma = 100%)                                               |
| benchmarks/\*               | Zod com schema declarado                                                                 |
| municipalities/list         | Zod parcial — safeParse sem erro explicito ao usuario, fallback silencioso para defaults |
| municipalities/:ibgeCode    | Zod (IbgeCodeSchema)                                                                     |
| ods/:ibgeCode               | Regex manual — NAO usa Zod                                                               |
| ods/:ibgeCode/history       | Regex + Number() manual — NAO usa Zod                                                    |
| ods/compare                 | Validacao manual (Array.isArray + typeof) — NAO usa Zod                                  |
| reports/:ibgeCode           | Regex manual — NAO usa Zod                                                               |
| simulator/history/:ibgeCode | Regex + parseInt manual — NAO usa Zod                                                    |
| agents/\* (todos)           | Funcoes `validateIbgeCode` e `validateBatchBody` — NAO usam Zod                          |

**Issues encontrados:**

| Issue | Localizacao                        | Detalhe                                                                                                                                                                               |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----------------------------------------------------------------------------- |
| VZ-01 | `GET /municipalities`              | Falha silenciosa de validacao: `PageSchema.safeParse(...).data ?? 1` descarta erros sem notificar o cliente. Um valor invalido (ex: `page=abc`) retorna pagina 1 sem feedback.        |
| VZ-02 | `POST /api/auth/logout`            | Body lido com `as { refreshToken?: string }` sem validacao Zod. Nao e critico (revogacao falha silenciosamente), mas e inconsistente.                                                 |
| VZ-03 | Todos os agentes                   | `validateIbgeCode` e `validateBatchBody` sao funcoes caseiras que duplicam logica que deveria estar em um schema Zod centralizado (ex: `IbgeCodeSchema` ja existe em municipalities). |
| VZ-04 | `GET /ods/:ibgeCode/history`       | `Number(rawOdsNumber)` converte `""` (string vazia) para `0`, aceitando `odsNumber=` (vazio) como valido.                                                                             |
| VZ-05 | `GET /simulator/history/:ibgeCode` | `parseInt(String(rawLimit), 10)                                                                                                                                                       |     | 20`—`parseInt("1.5")`retorna`1` sem aviso. Deveria ser validado como inteiro. |

### 2.3 Documentacao OpenAPI/Swagger

**Positivo:**

- Swagger UI funcional em `/api/docs`.
- Esquemas de componentes bem definidos para `OdsScore`, `Municipality`, `SimulationResult`, `EsgReport`, `Error`.
- Seguranca declarada (`bearerAuth`, `cookieAuth`).
- Tags organizadas por dominio.

**Issues encontrados:**

| Issue | Localizacao                                 | Detalhe                                                                                                                                                                                                        |
| ----- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SW-01 | Rotas de agentes ausentas                   | Nenhum dos 16 endpoints `/api/agents/*` esta documentado no Swagger.                                                                                                                                           |
| SW-02 | Campo `benchmarkCodes` vs `groupIbgeCodes`  | Swagger define `groupIbgeCodes` em `/benchmarks/compare`, codigo usa `benchmarkCodes`.                                                                                                                         |
| SW-03 | `GET /ods/:ibgeCode/history` ausente        | Nao esta no Swagger.                                                                                                                                                                                           |
| SW-04 | `GET /simulator/history/:ibgeCode` ausente  | Nao esta no Swagger.                                                                                                                                                                                           |
| SW-05 | `GET /health` ausente                       | Endpoint de health check nao documentado (aceitavel, mas inconsistente).                                                                                                                                       |
| SW-06 | Resposta de `GET /municipalities/:ibgeCode` | Swagger referencia `Municipality` schema que inclui `id` e `region`, mas a rota retorna `{ ibgeCode, siconfiCode, name, state, population }` — sem `id` nem `region`, com `siconfiCode` extra nao documentado. |
| SW-07 | Swagger e codigo estatico                   | `apis: []` — nenhuma JSDoc annotation e lida. O spec e 100% manual e pode divergir silenciosamente do codigo.                                                                                                  |

### 2.4 Versionamento de API

**Status atual:** Sem versionamento. Todos os endpoints estao em `/api/*` sem prefixo de versao (ex: `/api/v1/*`).

**Riscos:**

- Qualquer mudanca breaking afeta todos os clientes imediatamente.
- Nao ha mecanismo de deprecacao.
- Para expansao para 5.570 municipios com clientes mobile futuros, isso sera um problema.

**Issues encontrados:**

| Issue | Localizacao | Detalhe                                                                                           |
| ----- | ----------- | ------------------------------------------------------------------------------------------------- |
| VR-01 | index.ts    | Prefixo `/api` sem versao. Mudancas breaking exigem coordenacao simultanea de frontend + backend. |
| VR-02 | Swagger     | `version: "1.0.0"` declarado mas nao refletido na URL.                                            |

### 2.5 Paginacao

| Rota                             | Estilo                 | Problema                                                                                        |
| -------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| GET /municipalities              | offset (page/pageSize) | Funcional, mas sem metadados de paginacao completos (faltam `totalPages`, `hasNext`, `hasPrev`) |
| GET /ods/:ibgeCode/history       | nenhum                 | Retorna tudo sem limite declarado                                                               |
| GET /simulator/history/:ibgeCode | limit simples          | Nao e paginacao real — apenas trunca. Sem `total`, sem cursor.                                  |
| Todos os outros                  | nao se aplica          | Endpoints de recurso unico ou POST de analise                                                   |

**Issues encontrados:**

| Issue | Localizacao                         | Detalhe                                                                                           |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| PG-01 | GET /municipalities                 | Resposta nao inclui `totalPages`, `hasNext`, `hasPrev`. Clientes precisam calcular.               |
| PG-02 | GET /ods/:ibgeCode/history          | Sem paginacao. Em producao com historico longo (anos de snapshots), retornara todos os registros. |
| PG-03 | GET /simulator/history              | Parametro `limit` nao retorna `total` — cliente nao sabe se ha mais itens.                        |
| PG-04 | Ausencia de cursor-based pagination | Para listas longas (295→5570 municipios), offset pode ser lento. Cursor e mais adequado.          |

### 2.6 HATEOAS / Link patterns

**Status atual:** Nenhum. A API e puramente de dados — nenhuma resposta inclui links de navegacao, `_links`, ou `next`/`prev` URLs.

**Avaliacao:** Para o estagio atual (MVP B2G) isso e aceitavel. HATEOAS e raramente necessario em APIs privadas com frontend SPA acoplado. Nao e um issue critico.

### 2.7 Rate limiting por rota

| Limiter        | Rotas                                                   | Janela | Max req |
| -------------- | ------------------------------------------------------- | ------ | ------- |
| authLimiter    | POST /auth/register, /login, /refresh, /logout          | 15 min | 10      |
| batchLimiter   | POST /agents/\*/batch, /ods/compare, /simulator/compare | 1 min  | 5       |
| generalLimiter | Todos os demais (global)                                | 1 min  | 60      |

**Positivo:**

- Tres niveis de limite bem pensados.
- Uso de RedisStore com fallback gracioso para MemoryStore.
- Headers padrao `draft-7` (RateLimit-\*) em todos os limiters.

**Issues encontrados:**

| Issue | Localizacao                                  | Detalhe                                                                                                                                                                                                                                                |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RL-01 | generalLimiter em /health                    | O health check consome quota do generalLimiter. Em kubernetes com liveness probe a cada 5s com 10 pods, pode esgotar os 60 req/min. Deve ser excluido.                                                                                                 |
| RL-02 | authLimiter sem `standardHeaders: "draft-7"` | `authLimiter` usa `standardHeaders: true` (formato legado), os demais usam `"draft-7"`. Inconsistencia no formato dos headers de rate-limit.                                                                                                           |
| RL-03 | Ausencia de rate limit por usuario           | Rate limit atual e por IP. Um usuario autenticado com IP dinamico (mobile, VPN) pode circumvir; um usuario malicioso atras de CGNAT pode bloquear outros. Rate limit adicional por `req.user.sub` seria mais preciso para rotas autenticadas custosas. |
| RL-04 | POST /benchmarks nao usa batchLimiter        | `POST /api/benchmarks` aceita ate 50 municipios (operacao muito custosa) mas usa apenas o generalLimiter (60/min), enquanto `/ods/compare` com maximos de 10 ja usa batchLimiter. Inconsistencia de protecao.                                          |

### 2.8 Requisitos de auth por rota

| Rota                   | Auth Aplicado                                                             | Observacao                          |
| ---------------------- | ------------------------------------------------------------------------- | ----------------------------------- |
| /health                | nenhum                                                                    | correto                             |
| /api/docs              | nenhum                                                                    | correto, mas expoe estrutura da API |
| /api/auth/\*           | nenhum (exceto /me)                                                       | correto                             |
| /api/auth/me           | authenticateToken (rota)                                                  | correto                             |
| /api/municipalities/\* | authenticateToken (router index.ts) + nenhum adicional na rota            | duplo                               |
| /api/ods/\*            | authenticateToken (router index.ts) + authenticateToken (rota individual) | duplo                               |
| /api/reports/\*        | authenticateToken (router index.ts) + authenticateToken (rota individual) | duplo                               |
| /api/agents/\*         | authenticateToken (router index.ts) + authenticateToken (rota individual) | duplo                               |
| /api/simulator/\*      | authenticateToken (router index.ts) + authenticateToken (rota individual) | duplo                               |
| /api/benchmarks/\*     | authenticateToken (router index.ts) + nenhum adicional                    | duplo                               |

**Issues encontrados:**

| Issue | Localizacao                                 | Detalhe                                                                                                                                                                                                                                                                                                                                          |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AU-01 | Dupla aplicacao de authenticateToken        | `index.ts` aplica `authenticateToken` no router e varias rotas internas tambem o aplicam individualmente. Isso causa duas verificacoes JWT por request — ineficiencia e risco de comportamento divergente se um for removido.                                                                                                                    |
| AU-02 | Role "viewer" definida mas nunca autorizada | `UserRole` define `"viewer"` no middleware/auth.ts, mas nenhuma rota aceita essa role. Usuarios com role viewer nao conseguem acessar nada alem de `/auth/me`. Lacuna de intencao.                                                                                                                                                               |
| AU-03 | IDOR em simulator/history                   | A protecao IDOR existe (verifica `municipalityId` do token), mas a role check em `requireRole("admin", "prefeito", "secretario")` acontece antes — o usuario com role correta mas municipio errado e bloqueado no 403 correto, mas a mensagem de erro ("Acesso negado. Permissao insuficiente") e enganosa pois o problema e o IDOR, nao a role. |
| AU-04 | /api/municipalities nao tem IDOR protection | Um prefeito autenticado pode listar e ver detalhes de qualquer municipio. Para o modelo SaaS (cada prefeito ve apenas seu municipio), isso pode ser intencional ou nao — nao esta documentado.                                                                                                                                                   |

---

## 3. Resumo de issues por prioridade

### Criticos (bloqueiam deploy ou causam bugs)

| ID    | Descricao                                             | Arquivo                      | Impacto                                                 |
| ----- | ----------------------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| SW-02 | Campo `benchmarkCodes` vs `groupIbgeCodes` no Swagger | swagger.ts vs benchmarks.ts  | Cliente que segue o Swagger recebe erro 400             |
| AU-01 | Dupla aplicacao de authenticateToken                  | index.ts + rotas individuais | Overhead dobrado; risco de inconsistencia em manutencao |

### Altos (impactam qualidade e escalabilidade)

| ID    | Descricao                                                          | Arquivo                            | Impacto                                                         |
| ----- | ------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------- |
| IC-02 | Envelope de lista inconsistente (data vs history vs array puro)    | ods.ts, simulator.ts               | Frontend precisa tratar 3 formatos diferentes                   |
| IC-01 | Shape de erro inconsistente entre error-handler e rotas diretas    | error-handler.ts vs todas as rotas | Cliente nao pode parsear erros uniformemente                    |
| VZ-01 | Falha silenciosa de paginacao em municipalities                    | municipalities.ts                  | Parametros invalidos sao ignorados sem feedback                 |
| VZ-03 | Validacao caseira nos agents (nao usa Zod)                         | agents.ts                          | Lógica duplicada, sem type safety, sem mensagens de erro padrao |
| PG-02 | Historico ODS sem paginacao                                        | ods.ts                             | Potencial de timeout/OOM em producao com dados historicos       |
| RL-04 | POST /benchmarks usa generalLimiter para operacao de 50 municipios | benchmarks.ts, index.ts            | Risco de sobrecarga da API                                      |

### Medios (tech debt, melhorias de DX)

| ID    | Descricao                                                | Arquivo           | Impacto                                      |
| ----- | -------------------------------------------------------- | ----------------- | -------------------------------------------- |
| VR-01 | Sem versionamento de API                                 | index.ts          | Dificuldade de evolucao sem breaking changes |
| SW-01 | 16 endpoints de agents nao documentados                  | swagger.ts        | Friction para integradores                   |
| SW-03 | /ods/history e /simulator/history nao documentados       | swagger.ts        | Idem                                         |
| SW-06 | Schema Municipality no Swagger difere da resposta real   | swagger.ts        | Confusao de integradores                     |
| PG-01 | Paginacao sem totalPages/hasNext/hasPrev                 | municipalities.ts | Frontend calcula manualmente                 |
| PG-03 | /simulator/history sem total na resposta                 | simulator.ts      | Cliente nao sabe se ha mais itens            |
| RL-01 | /health consome quota do generalLimiter                  | index.ts          | Problema com liveness probes em k8s          |
| RL-02 | authLimiter usa standardHeaders legado                   | rate-limit.ts     | Headers inconsistentes                       |
| RL-03 | Rate limit apenas por IP, nao por usuario                | rate-limit.ts     | Protecao insuficiente para API autenticada   |
| AU-02 | Role "viewer" nunca autorizada em nenhuma rota           | auth.ts           | Usuario com essa role nao acessa nada        |
| VZ-04 | odsNumber="" aceito como valido (Number("") === 0)       | ods.ts            | Resultado potencialmente incorreto           |
| VZ-05 | parseInt("1.5") aceito silenciosamente                   | simulator.ts      | Parametro invalido sem feedback              |
| IC-05 | Swagger schema Municipality inclui campos nao retornados | swagger.ts        | Documentacao falsa                           |
| AU-03 | Mensagem de erro IDOR enganosa em simulator/history      | simulator.ts      | Debugging dificultado                        |

### Baixos (cosmetics, nao funcionais)

| ID    | Descricao                                                  |
| ----- | ---------------------------------------------------------- |
| IC-03 | Campo `data` vs `comparison` em batch responses            |
| IC-04 | Shape de `user` nao validado pela mesma interface          |
| AU-04 | IDOR em municipalities nao documentado como intencional    |
| SW-05 | /health nao documentado no Swagger                         |
| SW-07 | Swagger inteiramente manual, pode divergir silenciosamente |

---

## 4. ADRs recomendados

### ADR-A: Padronizar envelope de resposta

**Contexto:** Tres shapes de resposta de lista coexistem.
**Decisao sugerida:** Adotar envelope unico `{ data, meta: { total, page, pageSize, totalPages, hasNext } }` para todas as listas. Respostas de erro sempre `{ error: string, details?: unknown }` sem `statusCode` no corpo (statusCode esta no HTTP header).
**Consequencias:** Requer migracao coordenada de frontend.

### ADR-B: Centralizar schema ibgeCode em shared/

**Contexto:** `IbgeCodeSchema` existe em municipalities.ts mas agents.ts usa funcao manual equivalente.
**Decisao sugerida:** Mover `IbgeCodeSchema` e `BatchIbgeCodesSchema` para `shared/schemas/ibge.ts`, importar nos dois modulos.

### ADR-C: Versionamento de API

**Contexto:** Expansao de 295 para 5.570 municipios e possivel app mobile futuro exigem estabilidade de contrato.
**Decisao sugerida:** Prefixar todas as rotas com `/api/v1/`. Manter `/api/*` como alias temporario (redirect 308) durante transicao de 30 dias.

### ADR-D: Remover duplicacao de authenticateToken

**Contexto:** Auth e aplicado duas vezes por request.
**Decisao sugerida:** Manter `authenticateToken` apenas no `index.ts` (nivel de router). Remover das rotas individuais que nao precisam de auth diferenciado.

---

## 5. Perguntas para o usuario antes de implementar correcoes

1. **Role "viewer":** Qual e a intencao da role? Deve ter acesso a leitura de ODS e reports mas nao a simulator e benchmarks? Ou foi removida do produto?

2. **IDOR em municipalities:** E intencional que um prefeito de Blumenau possa ver dados de Florianopolis? Ou municipios devem ser filtrados pelo `municipalityId` do JWT?

3. **Versionamento:** Ha planos de app mobile ou integracao de terceiros nos proximos 6 meses? Se sim, vale implementar `/api/v1` agora.

4. **Paginacao:** O historico de ODS e esperado crescer para centenas de registros por municipio? Se sim, paginacao em `/ods/:ibgeCode/history` e urgente.

5. **Swagger:** O Swagger e publico (sem auth) — e intencional expor a estrutura da API sem autenticacao no ambiente de producao?
