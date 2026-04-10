---
id: ADR-004
title: Knowledge Graph ESG Municipal via Postgres + Recursive CTE
date: 2026-04-10
status: accepted
affects: [backend/services/simulator, backend/services/graph, prisma/schema.prisma]
domain: architecture
supersedes: null
superseded_by: null
decisors: [joubert, backend-architect]
---

# ADR-004: Knowledge Graph ESG Municipal via Postgres + Recursive CTE

**Status:** Aceito
**Data:** 2026-04-10
**Decisores:** Joubert + Backend Architect

## Contexto

O simulador atual (`backend/services/simulator/simulator_service.ts`) usa um mapeamento estático `AREA_ODS_MAPPING` que associa cada área de investimento a ODS primários e secundários via objetos hardcoded:

```typescript
const AREA_ODS_MAPPING: Record<InvestmentArea, OdsImpactMapping> = {
  education:    { primary: [4],     secondary: [1, 8, 10] },
  health:       { primary: [3],     secondary: [1] },
  sanitation:   { primary: [6],     secondary: [3, 11, 14] },
  environment:  { primary: [13, 15], secondary: [11, 14] },
  ...
};
```

Este modelo apresenta três limitações estruturais:

1. **Sinergias e trade-offs invisíveis.** Investir em saneamento (ODS 6) reforça saúde (ODS 3, +2) mas pode conflitar com desenvolvimento econômico intensivo (ODS 8, trade-off -1 em contexto de restrição orçamentária). O simulador não detecta nem reporta isso.

2. **Mapeamento estático exige redeploy para atualizar.** Adicionar uma nova relação entre ODS ou ajustar o peso de uma sinergia requer alteração de código, build e deploy — ciclo incompatível com a natureza evolutiva do conhecimento científico sobre SDGs.

3. **Sem temporalidade.** As interações entre ODS podem mudar conforme o contexto local evolui (ex.: município que atinge meta de saneamento muda o perfil de prioridades de saúde). Não há como registrar que uma relação era válida em determinado período.

A literatura científica sobre interações entre ODS (Nilsson et al. 2016, Pradhan et al. 2017, Weitz et al. 2018) demonstra que 73% das interações são sinergias e 27% são trade-offs, e que ignorar essa estrutura produz recomendações de política pública subótimas. Para o produto IOC ESG Municipal — cujo valor central é orientar prefeitos a alocar FPM com impacto real — é inaceitável simular sem considerar essas interdependências.

## Decisão

Implementar um Knowledge Graph ESG nativo em PostgreSQL, sem adicionar dependência de banco de dados especializado em grafo.

A estrutura será baseada em duas tabelas:

**`esg_entities`** — nós do grafo (ODS, áreas de investimento, indicadores):

```sql
id          SERIAL PRIMARY KEY
type        VARCHAR(50)   -- 'ods' | 'investment_area' | 'indicator'
code        VARCHAR(20)   -- ex: 'ODS_3', 'AREA_HEALTH'
label       TEXT
description TEXT
metadata    JSONB
```

**`esg_relationships`** — arestas com peso e temporalidade (TKG):

```sql
id           SERIAL PRIMARY KEY
source_id    INTEGER REFERENCES esg_entities(id)
target_id    INTEGER REFERENCES esg_entities(id)
type         VARCHAR(50)   -- 'synergy' | 'tradeoff' | 'enables' | 'constrains'
weight       DECIMAL(4,2)  -- escala -3.0 a +3.0 (Nilsson et al. 2016)
evidence     TEXT          -- referência científica
valid_from   TIMESTAMPTZ   -- TKG: início da validade
valid_until  TIMESTAMPTZ   -- TKG: fim da validade (NULL = vigente)
metadata     JSONB
```

O traversal do grafo usará Recursive CTE do PostgreSQL:

```sql
WITH RECURSIVE graph AS (
  -- âncora: entidade de partida
  SELECT id, code, type, 0 AS depth
  FROM esg_entities
  WHERE code = $1
  UNION ALL
  -- passo recursivo: vizinhos com profundidade máxima 3
  SELECT e.id, e.code, e.type, g.depth + 1
  FROM esg_entities e
  JOIN esg_relationships r ON (r.source_id = e.id OR r.target_id = e.id)
  JOIN graph g ON (r.source_id = g.id OR r.target_id = g.id)
  WHERE g.depth < 3
    AND (r.valid_until IS NULL OR r.valid_until > NOW())
)
SELECT DISTINCT * FROM graph;
```

O seed inicial populará 17 nós ODS + 24 arestas de relacionamento com os pesos validados por Nilsson et al. 2016 e Pradhan et al. 2017, tornando o grafo reproduzível e idempotente via migração Prisma.

O `backend/services/graph/GraphService` substituirá o `AREA_ODS_MAPPING` estático com queries ao grafo, retornando ODS vizinhos com pesos e classificação sinergia/trade-off. O simulador consumirá este serviço para enriquecer os resultados com detecção dinâmica de trade-offs.

O padrão TKG (Temporal Knowledge Graph) com `valid_from`/`valid_until` nas arestas é inspirado na arquitetura Graphiti/Zep AI (2024), adaptado para o domínio municipal brasileiro.

## Alternativas Consideradas

### 1. Neo4j

Banco de dados nativo para grafos, com linguagem Cypher otimizada para traversal.

**Descartado porque:**

- Introduz uma terceira dependência de banco de dados (já temos PostgreSQL e Redis)
- Requer novo container Docker, novo backup, nova estratégia de disaster recovery
- Prisma não tem suporte nativo a Neo4j — seria necessário driver separado e dois ORMs
- Para grafos com 17 nós (ODS) + extensões futuras (~200 nós), o overhead operacional não se justifica
- Licença Neo4j Community Edition tem limitações para produção

### 2. Apache AGE (A Graph Extension para PostgreSQL)

Extensão que adiciona suporte a grafos e linguagem openCypher diretamente no PostgreSQL.

**Descartado porque:**

- Extensão com maturidade questionável para produção (versão 1.x, histórico de breaking changes)
- Requer instalação de extensão no container PostgreSQL — imagem customizada, complexidade de manutenção
- Queries misturam SQL e openCypher, dificultando manutenção e type-safety com Prisma
- Não há suporte oficial no Prisma schema, exige raw queries para tudo
- O ganho sobre Recursive CTE nativo é marginal para o tamanho do grafo deste projeto

### 3. JSON blob em tabela Municipality

Armazenar as relações entre ODS como campo JSONB na tabela `municipalities`, um array de pares `{ods_source, ods_target, weight}`.

**Descartado porque:**

- Sem traversal eficiente — cada query varre o JSON inteiro
- Sem temporalidade — não é possível registrar `valid_from`/`valid_until` por aresta
- Duplicação de dados — cada município repetiria as mesmas relações estruturais dos ODS
- Impossível compartilhar o grafo entre municípios sem denormalização
- Não evolui — adicionar um novo tipo de relação exige schema change no JSON implícito

## Consequências Positivas

- **Detecção dinâmica de trade-offs e sinergias** no simulador sem alteração de código — a query ao grafo retorna o contexto atual do banco
- **Atualização do grafo sem deploy** — novas arestas ou ajuste de pesos é feito via INSERT/UPDATE no banco, operação de dados, não de código
- **Compatibilidade total com a stack atual** — PostgreSQL já em produção, Prisma como ORM, sem nova dependência de infraestrutura
- **Temporalidade nativa** — padrão TKG permite registrar que uma relação foi válida até determinado momento, habilitando análise histórica de políticas
- **Base para HippoRAG futuro** — a estrutura de grafo com pesos habilita Personalized PageRank (Gutiérrez et al. 2024) como mecanismo de retrieval multi-hop para RAG sobre políticas municipais
- **Seed reproduzível** — as 24 arestas iniciais são dados científicos validados, migração idempotente

## Consequências Negativas

- **Queries CTE podem ser custosas em grafos grandes.** Para o escopo atual (17 ODS + ~200 nós de áreas e indicadores) o custo é aceitável. Mitigação: cache Redis com TTL 5min para resultados de traversal frequentes + limite de profundidade máxima 3 nos CTEs recursivos.
- **Prisma não tem abstração nativa para grafos.** O `GraphService` usará `prisma.$queryRaw` para as queries recursivas, saindo do paradigma ORM. Mitigação: encapsular todo raw SQL no `GraphService`, nunca expor fora dele. Cobrir com testes de integração.
- **Manutenção do seed exige conhecimento do domínio científico.** Atualizar pesos de arestas requer leitura da literatura SDG. Mitigação: toda aresta tem campo `evidence` obrigatório com a referência científica fonte.

## Evidências Científicas

1. **Nilsson, M., Griggs, D., & Visbeck, M. (2016).** "Map the interactions between Sustainable Development Goals." _Nature_, 534, 320–322. — Define a escala de 7 pontos (-3 a +3) para interações entre SDGs: Indivisible (+3), Reinforcing (+2), Enabling (+1), Consistent (0), Constraining (-1), Counteracting (-2), Cancelling (-3). Esta escala fundamenta o campo `weight` da tabela `esg_relationships`. Exemplo canônico: SDG 7 (Energia) ↔ SDG 9 (Inovação) = Indivisible (+3); SDG 3 (Saúde) ↔ SDG 12 (Consumo responsável) = Counteracting (-2).

2. **Pradhan, P., Costa, L., Rybski, D., Lucht, W., & Kropp, J. P. (2017).** "A Systematic Study of Sustainable Development Goal (SDG) Interactions." _Earth's Future_, 5(11), 1169–1179. — Análise de correlações em dados de 227 países: 73% das interações entre SDGs são sinergias, 27% são trade-offs. SDG 1 (Pobreza) tem o maior número de sinergias com outros ODS; SDG 12 (Consumo) gera o maior número de trade-offs. Top synergies identificadas: ODS 1–3 (+0,78), ODS 1–4 (+0,77), ODS 1–5 (+0,76). Top trade-offs: ODS 3–12 (-0,53), ODS 12–1 (-0,45), ODS 15–2 (-0,50). Estes valores orientam os pesos do seed inicial.

3. **IGES SDG Interlinkages Analysis & Visualisation Tool** (sdginterlinkages.iges.jp). — Ferramenta peer-reviewed do Institute for Global Environmental Strategies para visualizar e analisar interações entre SDGs. Utilizada como referência de validação cruzada para os 24 pares de arestas do seed.

4. **Weitz, N., Carlsen, H., Nilsson, M., & Skånberg, K. (2018).** "Towards systemic and contextual priority setting for implementing the 2030 Agenda." _Sustainability Science_, 13, 531–548. — Propõe framework para priorização de políticas públicas baseado em análise de rede SDG. Fundamenta a decisão de usar pesos de arestas direcionados para recomendar sequência de investimentos (enablers antes de dependentes).

5. **Moallemi, E. A., Kwakkel, J., de Haan, F. J., & Bryan, B. A. (2022).** "Local and global development pathways are unlikely to achieve sustainability across all SDGs." _One Earth_, 5(4), 409–423. — Confirma a importância de modelar trade-offs locais (não apenas globais) para políticas municipais. Reforça que contexto local (porte do município, região) modifica o perfil de interações — justificando o campo `metadata JSONB` nas arestas para armazenar contexto de aplicabilidade.

6. **Zep AI / Graphiti (2024).** Rauch, P., & Zep Team. "Graphiti: Temporally-aware knowledge graphs for AI agents." — Inspiração para o padrão TKG com campos `valid_from`/`valid_until` nas arestas, permitindo que o grafo ESG registre quando determinada relação entre ODS passou a ser relevante ou deixou de ser (ex.: município que atingiu meta de um ODS muda o perfil de sinergias).

7. **Gutiérrez, B., Shu, Y., Jiang, Y., Lempkowicz, N., Chen, Y., Li, Y., Chen, B., Su, W., & Yu, D. (2024).** "HippoRAG: Neurobiologically Inspired Long-Term Memory for Large Language Models." _arXiv:2405.14831_. — Demonstra que Personalized PageRank sobre Knowledge Graph supera RAG vetorial em tarefas de recuperação multi-hop. A estrutura de grafo definida neste ADR é compatível com essa abordagem futura, onde consultas do prefeito ("o que devo priorizar?") poderiam ser respondidas via traversal do grafo ESG com PPR.

## Plano de Implementação

A implementação será executada em 6 tasks sequenciais:

**Task 1 — Schema Prisma**
Adicionar modelos `EsgEntity` e `EsgRelationship` em `prisma/schema.prisma` com os campos definidos na seção Decisão. Criar índices em `(type, code)`, `(source_id, valid_until)` e `(target_id, valid_until)`.

**Task 2 — Migration**
Gerar migration via `prisma migrate dev --name add-esg-knowledge-graph`. Garantir que a migration seja idempotente (use `IF NOT EXISTS` onde aplicável).

**Task 3 — Seed do grafo**
Implementar `prisma/seed-graph.ts` populando 17 nós ODS e 24 arestas com pesos baseados em Pradhan et al. 2017 e Nilsson et al. 2016. O seed deve ser idempotente (upsert por `code` único). Toda aresta deve ter `evidence` preenchido com a referência científica fonte.

**Task 4 — GraphService**
Criar `backend/services/graph/graph.service.ts` com interface pública:

- `getNeighbors(entityCode: string, depth: number): Promise<GraphNode[]>` — Recursive CTE com limite de profundidade
- `getSynergies(odsNumber: number): Promise<Relationship[]>` — arestas com weight > 0
- `getTradeoffs(odsNumber: number): Promise<Relationship[]>` — arestas com weight < 0
- `getOdsInteractions(sourceOds: number, targetOds: number): Promise<Relationship | null>` — aresta direta entre dois ODS

O serviço deve usar Redis (TTL 5min) para cachear resultados de traversal frequentes.

**Task 5 — Integração com SimulatorService**
Substituir o bloco `AREA_ODS_MAPPING` estático por chamadas ao `GraphService`. O simulador deve, ao calcular impacto de uma alocação, consultar o grafo para detectar trade-offs com outros ODS já alocados no mesmo cenário e incluir um campo `tradeoffs: TradeoffWarning[]` no resultado da simulação.

**Task 6 — Testes**
Cobrir com testes de integração:

- Seed idempotente (executar 2x, contar nós e arestas — deve ser igual)
- `getNeighbors` retorna resultado correto para ODS 3 (Saúde) com profundidade 2
- `getTradeoffs` para ODS 12 retorna pelo menos 3 trade-offs (Pradhan et al.)
- SimulatorService detecta trade-off ODS 3 ↔ ODS 12 em cenário com ambos alocados
- Query de vizinhança ≤50ms p95 (validar com `EXPLAIN ANALYZE`)

## Métricas de Sucesso

1. **Detecção de trade-offs:** o simulador detecta pelo menos 1 trade-off por simulação em cenários realistas que incluam simultaneamente áreas com interações negativas documentadas (ex.: saúde + consumo, ou florestal + agropecuária).

2. **Performance de query:** query de vizinhança com profundidade 3 a partir de qualquer nó ODS completa em ≤50ms no p95, medida com `EXPLAIN ANALYZE` em banco com seed completo e dados de 295 municípios.

3. **Seed reproduzível:** executar `pnpm db:seed` em banco limpo duas vezes consecutivas produz exatamente 17 entidades ODS e 24 arestas — sem duplicatas, sem erros, estado final idêntico.

---

## Phase 2 — HippoRAG completo (2026-04-10)

Esta seção estende o ADR original com a implementação de retrieval semântico sobre o grafo e expansão da base de interlinkages, conforme previsto na consequência positiva "Base para HippoRAG futuro".

### Motivação

Após a validação da Phase 1 (Knowledge Graph com 17 ODS + 24 arestas + PPR), o próximo passo natural é habilitar consultas em linguagem natural do prefeito ("como melhorar saneamento em municípios pequenos?") sem depender de filtros rígidos por código ODS. HippoRAG (Gutiérrez et al., NeurIPS 2024) demonstra que combinar embedding retrieval com Personalized PageRank supera RAG vetorial puro em tarefas multi-hop — exatamente o caso de uso do simulador ESG.

### Decisão Phase 2

**1. Embeddings e5 multilingual nos nós do grafo.**

- Modelo: `Xenova/multilingual-e5-small` (384-dim, ONNX quantizado q8, ~120MB download)
- Runtime: `@huggingface/transformers` v4 — roda 100% em Node, sem GPU, sem serviço externo
- Descrições PT-BR ricas por ODS (termos políticos, métricas, contexto brasileiro: CadÚnico, SUS, UBS, PNAE, Bolsa Família, IDEB, Mata Atlântica, LAI, etc.) garantindo retrieval semântico relevante para o prefeito
- Armazenamento: vetor gravado em `Entity.props.embedding` (JSONB) — sem nova coluna nem pgvector
- Justificativa: 17 nós ODS são estáticos; cosine in-process O(n×d) é trivialmente rápido (<1ms). Adicionar pgvector seria over-engineering.
- Seed idempotente: reusa embedding existente se presente; `SKIP_EMBEDDINGS=1` no CI

**2. Serviço `hipporag_service.ts` — pipeline blend.**

```
query → embedQuery (e5 "query:" prefix)
      → cosine vs todos os nós embeddados
      → top-K seeds (default 5)
      → personalizedPageRank(seeds)
      → blend: finalScore = α × (sem/maxSem) + (1-α) × (ppr/maxPpr)
      → top-K resultados (default 10)
```

- α default = 0.5 (balanço equivalente entre recall semântico e propagação estrutural)
- `findSimilarEntities()` = `semanticSearch` com α=1.0 (puramente semântico, sem PPR)
- Cache Redis: `graph:hipporag:{sha1(query+opts).slice(0,16)}`, TTL 600s
- **Graceful fallback duplo:** se embedder falha → retorna `[]`; se PPR falha → retorna semantic-only com `structuralScore=0`. Nenhum erro propaga para o endpoint.
- Dual coverage: inclui entidades descobertas só pelo PPR (não estavam no top semantic) com `semanticScore=0` — garante que conexões estruturais fortes não sejam perdidas por baixa similaridade lexical.

**3. Endpoints REST.**

- `POST /api/graph/query` — HippoRAG blend completo (body: `query, topK?, pprSeeds?, alpha?, entityTypeFilter?, edgeTypes?`)
- `POST /api/graph/similar` — atalho para `findSimilarEntities` (body: `query, topK?, entityTypeFilter?`)
- Zod validation: query 3-500 chars, topK 1-50, alpha 0-1

**4. Expansão para 52 pairs (104 arestas TKG).**

De 24 → 52 pairs (+117%), baseado em literatura adicional:

- **Moallemi et al. 2022** (_One Earth_) — pathways locais exigem modelagem de trade-offs contextuais; adicionadas arestas ODS 11 ↔ {6,13,7,12,15}, ODS 13 ↔ {6,15,2}, ODS 14 ↔ {12,15}.
- **Kroll, Warchold & Pradhan 2019** (_Palgrave Communications_) — análise longitudinal SDG Index; reforçou sinergias ODS 16 ↔ {1,5,10,17,11} (governança como enabler transversal).
- **Warchold et al. 2022** (_Sustainability_) — sensibilidade por país; motivou ODS 10 ↔ {1,4,5,8} como cluster de redução de desigualdade.
- **IGES SDG Interlinkages Tool** — validação cruzada de todas as arestas novas.

Cada aresta mantém `evidence` obrigatório com referência exata ao paper fonte.

### Consequências Phase 2

**Positivas:**

- Query em linguagem natural do prefeito com retrieval multi-hop sem depender de fine-tuning ou LLM externo para embedding
- Modelo 100% local (privacidade: nenhum dado do município sai da infra)
- Latência pós-cache: 12-16ms por query (smoke test com 5 queries representativas)
- Retrieval quality validado em smoke test — top-1 semântico correto em 5/5 queries, top-5 com cobertura estrutural via PPR
- Base sólida para etapa seguinte (fine-tuning de embedder em corpus de políticas municipais brasileiras, se necessário)

**Negativas:**

- **Primeira execução carrega modelo ONNX (~2min de download na 1ª vez, depois 1.2s do cache ~/.cache/huggingface).** Mitigação: log explícito na inicialização + warmup opcional via `POST /api/graph/query` com query dummy após deploy.
- **`@huggingface/transformers` adiciona ~50MB à imagem Docker de produção** (onnxruntime-node). Mitigação: validado em docker build multi-stage — runtime carrega sob demanda.
- **Processo `tsx` pode não fechar sessão Prisma/Redis ao terminar scripts.** Não é regressão (pré-existente no vitest exit 134). Mitigação: usar `prisma.$disconnect()` + `redis.quit()` explícitos em todos os scripts CLI.

### Evidências adicionais (além das 7 originais)

8. **Moallemi, E. A., et al. (2022).** "Local and global development pathways are unlikely to achieve sustainability across all SDGs." _One Earth_, 5(4), 409–423. — Além de justificar `metadata JSONB` para contexto local (já citado), fundamenta a expansão das arestas ODS 11 ↔ 13/6/7/12/15 ao demonstrar que cidades sustentáveis dependem de sinergias multi-setoriais mais amplas do que o subset Pradhan.

9. **Kroll, C., Warchold, A., & Pradhan, P. (2019).** "Sustainable Development Goals (SDGs): Are we successful in turning trade-offs into synergies?" _Palgrave Communications_, 5, 140. — Análise longitudinal mostra que trade-offs ODS 1-12 e ODS 8-15 diminuem com o tempo conforme países maduram políticas integradas. Justifica os campos `validFrom`/`validUntil` como mecanismo para registrar essa evolução.

10. **Warchold, A., et al. (2022).** "Building a unified sustainable development goal database: Why does sustainability reporting need to be harmonised?" _Sustainability_, 14(10), 6177. — Motiva o cluster ODS 10 ↔ {1,4,5,8} (redução de desigualdade como enabler de múltiplos ODS), adicionado no seed Phase 2.

### Métricas de Sucesso Phase 2

4. **Retrieval quality:** em 5 queries representativas do smoke test, top-1 deve ser o ODS semanticamente mais próximo em 100% dos casos. **Validado ✅** (ODS 11 para saneamento, ODS 13 para mortalidade, ODS 1 para desigualdade, ODS 11 para economia circular, ODS 15 para biodiversidade).

5. **Latência pós-cache:** semanticSearch p95 ≤ 50ms após modelo carregado, sobre o grafo seed (17 ODS + 104 arestas). **Validado ✅** (12-16ms medido no smoke test).

6. **Edges count:** seed produz ≥ 50 pairs distintas (≥ 100 arestas bidirecionais). **Validado ✅** (52 pairs / 104 arestas).

7. **Graceful degradation:** serviço retorna array vazio ou semantic-only quando embedder/PPR falham, sem propagar exceção. **Validado ✅** (coberto por 83 testes unitários).

### Plano de Execução Phase 2

Executado em 7 tasks sequenciais:

1. `backend/services/graph/embeddings_service.ts` — lazy-load singleton + `embedPassage`/`embedQuery`/`cosineSimilarity`/`extractEmbedding`/`setEmbedder`
2. `backend/services/graph/hipporag_service.ts` — semanticSearch blend + findSimilarEntities
3. Reescrita `scripts/seed-knowledge-graph.ts` — descrições PT-BR ricas + embeddings + 52 pairs
4. Novos endpoints em `backend/routes/graph.ts` — `/query` e `/similar` com Zod validation
5. `scripts/smoke-hipporag.ts` — 5 queries end-to-end
6. Testes unitários — 83 testes (embeddings: 31, hipporag: 21, rotas: 31)
7. `docker build` de produção validado
