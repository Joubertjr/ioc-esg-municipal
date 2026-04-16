# Pipeline de Ingestão Assíncrona — Especificação de Backend

**Feature:** ingestion-pipeline  
**Data:** 2026-04-13  
**Status:** Especificação aprovada, aguarda implementação  
**Motivação:** Dashboard leva 15.3s no cold path; PNCP tem 93 timeouts/dia; cliente exige dados sempre disponíveis com rastreabilidade de quando foram coletados.

---

## 1. Visão Geral da Arquitetura

### Situação atual (problema)

```
Usuário abre dashboard
       ↓
GET /api/ods/:ibgeCode
       ↓
Promise.all([15 collectors.collect(ibgeCode)])   ← 15s cold, falhas cascata
       ↓
mapToOdsIndicators() por fonte
       ↓
calcScore() → JSON → cache Redis 1h
```

### Situação alvo (solução)

```
[CRON 02:00 UTC diário]
       ↓
IngestionOrchestrator.runFull()
       ↓
Por fonte (sequencial entre fontes, paralelo dentro dos lotes):
  - IbgeCollector.collectBatch(295 codes)
  - SiconfiCollector.collectBatch(295 codes)
  - ... (15 coletores)
       ↓
mapToOdsIndicators() → OdsIndicator[] → upsert no PostgreSQL
       ↓
calcScore() por município → upsert OdsScore no PostgreSQL
       ↓
IngestionRun registrado com status, métricas, erros por fonte

[Usuário abre dashboard]
       ↓
GET /api/ods/:ibgeCode
       ↓
OdsScoreReader.fromDatabase(ibgeCode)  ← <50ms, zero HTTP externo
       ↓
Se não há dados no banco → fallback para _fetchAndCalculate() (comportamento atual)
```

### Princípio central

O dashboard nunca mais espera APIs externas. O pipeline roda de madrugada, popula o banco, e o dashboard lê do banco. Se o pipeline falha parcialmente (ex: PNCP down), os dados da ingestão anterior permanecem disponíveis.

---

## 2. Decisões Arquiteturais (ADRs)

### ADR-005: Scheduler embutido no processo Express via node-cron

**Status:** Proposed  
**Contexto:** Precisamos de um scheduler recorrente. As alternativas são: container separado, cron do sistema operacional via docker, BullMQ/Redis queue, ou biblioteca no processo.  
**Decisão:** `node-cron` embutido no processo Express, inicializado no `backend/index.ts` após o servidor subir.  
**Consequências:**

- Zero configuração adicional no Docker Compose
- O scheduler morre se o processo api morrer (aceitável: Docker restart=unless-stopped reinicia)
- Uma única instância em produção (sem problema — SC tem 295 municípios, não há concorrência)
- Overlap protection obrigatória: se a ingestão anterior ainda estiver rodando quando o cron dispara, a nova execução é abortada com log de aviso
  **Alternativas rejeitadas:**
- Container separado: aumenta complexidade de deploy e o Dockerfile teria que ser duplicado
- BullMQ: introduz dependência em Redis como broker de filas — o Redis atual é apenas cache, mudar a semântica adiciona risco
- Cron do SO: requer acesso ao host, incompatível com Docker Compose sem volume extra

### ADR-006: Leitura do dashboard via PostgreSQL, sem chamadas em tempo real

**Status:** Proposed  
**Contexto:** O route `GET /api/ods/:ibgeCode` atualmente chama `calculateMunicipalOds()` que dispara 15 coletores. O banco tem `OdsScore` e `OdsIndicator` que nunca foram populados pelo caminho normal.  
**Decisão:** Adicionar `OdsScoreReader` que lê `OdsScore` + `OdsIndicator` do banco e monta um `MunicipalOdsReport` idêntico ao atual. O route tenta o banco primeiro; se não há dados, usa o fallback atual (`_fetchAndCalculate`).  
**Consequências:**

- Resposta do dashboard cai de 15s para <50ms quando dados existem
- Período de transição seguro: fallback garante que nenhum município fica sem dados enquanto a primeira ingestão roda
- Cache Redis ainda pode ser aplicado sobre a leitura do banco (TTL 15min para evitar queries repetidas do mesmo município)
  **Alternativas rejeitadas:**
- Remover completamente o caminho real-time: risco — se a primeira ingestão falhar, o dashboard quebraria para todos os municípios antes de ter dados históricos

### ADR-007: Modelo IngestionRun para rastreabilidade

**Status:** Proposed  
**Contexto:** O cliente exige saber quando os dados foram coletados e de qual fonte. O schema atual não tem tabela de log de ingestão.  
**Decisão:** Adicionar model `IngestionRun` no Prisma com: id, status, startedAt, completedAt, municipalitiesTotal, municipalitiesSucceeded, sourceResults (JSON com resultado por fonte), triggeredBy (cron|manual|api).  
**Consequências:**

- Rastreabilidade completa: prefeito pode ver "dados coletados em 13/04/2026 às 02:17"
- Exposto via `GET /api/ingestion/status` (rota admin) e campo `dataCollectedAt` no response do dashboard
- Um registro por execução completa do pipeline (não por município)
  **Alternativas rejeitadas:**
- Logar apenas no Winston: logs não são queryáveis pela API, não aparecem no dashboard

---

## 3. Modelo de Dados — Adições ao Schema Prisma

### 3.1 Novo model: IngestionRun

```prisma
model IngestionRun {
  id                     String    @id @default(cuid())
  /// "running" | "completed" | "failed" | "partial"
  status                 String
  triggeredBy            String    /// "cron" | "manual" | "api"
  startedAt              DateTime  @default(now())
  completedAt            DateTime?
  durationMs             Int?

  /// Contagem geral
  municipalitiesTotal    Int       @default(0)
  municipalitiesSucceeded Int      @default(0)
  indicatorsUpserted     Int       @default(0)
  scoresUpserted         Int       @default(0)

  /// JSON: { ibge: { success: 280, failed: 15, errorSample: "timeout after 30s" }, ... }
  sourceResults          Json      @default("{}")

  /// Erros não recuperáveis (ex: banco indisponível)
  errorMessage           String?

  createdAt              DateTime  @default(now())

  @@index([status])
  @@index([startedAt])
  @@index([triggeredBy])
}
```

**Campos-chave:**

- `status = "partial"` significa que pelo menos 1 fonte falhou mas dados foram gravados parcialmente
- `sourceResults` é um objeto JSON chaveado por nome da fonte, com contagens e amostra de erro
- `durationMs` permite alertar no Grafana se a ingestão demorou mais que o esperado

### 3.2 Alteração em OdsScore: adicionar ingestionRunId

```prisma
model OdsScore {
  // ... campos existentes ...
  ingestionRunId  String?   // FK para IngestionRun que gerou este score
  // sem @relation explícita para evitar cascade delete acidental

  @@index([ingestionRunId])
}
```

Isso permite rastrear: "este score veio da ingestão de 13/04/2026".

---

## 4. API Contracts

### 4.1 Endpoint: Status do dashboard (alteração no existente)

O response de `GET /api/ods/:ibgeCode` ganha campos novos. O schema do response existente é preservado — os campos são adicionados, não substituídos.

```
GET /api/ods/:ibgeCode
Auth: required — JWT + requireMunicipalityScope()
Response 200 (sem alteração de campos existentes, novos campos adicionados):
{
  ibgeCode: string,
  municipalityName: string | null,
  referenceYear: number,
  globalScore: number | null,
  globalStatus: "verde" | "amarelo" | "vermelho" | null,
  geometricScore: number | null,
  geometricStatus: "verde" | "amarelo" | "vermelho" | null,
  odsCount: { total: 17, withData: number, verde: number, amarelo: number, vermelho: number },
  dataFreshness: DataFreshness,
  ods: OdsSummary[],

  // NOVOS:
  dataSource: "database" | "realtime",        // de onde vieram os dados
  dataCollectedAt: string | null,             // ISO8601 — quando a ingestão rodou
  ingestionRunId: string | null               // ID do IngestionRun que gerou estes dados
}
```

**Regras de negócio:**

- `dataSource = "database"` quando OdsScore do banco foi usado
- `dataSource = "realtime"` quando o fallback de APIs externas foi usado (sem dados no banco)
- `dataCollectedAt` = `calculatedAt` do OdsScore mais recente para o município, ou null

### 4.2 Endpoint: Status da ingestão (novo, somente admin)

```
GET /api/ingestion/status
Auth: required — JWT + requireRole("admin")
Query params:
  - limit?: number (default 10, max 50) — últimas N execuções
Response 200:
{
  runs: [
    {
      id: string,
      status: "running" | "completed" | "failed" | "partial",
      triggeredBy: "cron" | "manual" | "api",
      startedAt: string,           // ISO8601
      completedAt: string | null,
      durationMs: number | null,
      municipalitiesTotal: number,
      municipalitiesSucceeded: number,
      indicatorsUpserted: number,
      scoresUpserted: number,
      sourceResults: {
        [source: string]: {
          success: number,
          failed: number,
          skipped: number,
          errorSample: string | null
        }
      },
      errorMessage: string | null
    }
  ],
  currentRun: { id: string, status: "running", startedAt: string } | null
}
Regras: currentRun é o run com status="running" mais recente, se houver.
Response 401: { error: "Não autenticado" }
Response 403: { error: "Acesso restrito a administradores" }
```

### 4.3 Endpoint: Disparar ingestão manual (novo, somente admin)

```
POST /api/ingestion/trigger
Auth: required — JWT + requireRole("admin")
Request:
  {
    source?: string   // opcional — força ingestão de fonte específica
                      // se ausente: ingestão completa de todas as fontes
  }
Validação Zod:
  source: z.enum(["ibge","siconfi","datasus","inep","snis","inpe","pncp",
                  "tse","aneel","snis_rs","ana","convenios","anatel","sisvan","ieps"]).optional()
Response 202:
  {
    runId: string,
    message: "Ingestão iniciada em background",
    source: string | "all"
  }
Response 409:
  { error: "Ingestão já em execução", runId: string }
Response 400:
  { error: "source inválido" }

Regras de negócio:
- Retorna 409 se já há um IngestionRun com status="running"
- Inicia a ingestão como fire-and-forget (não bloqueia o response)
- O caller consulta GET /api/ingestion/status para acompanhar
```

---

## 5. Especificação de Implementação — Arquivos a Criar/Modificar

### 5.1 Novos arquivos (a criar)

#### `backend/services/ingestion/ingestion_orchestrator.ts`

**Responsabilidade única:** Orquestrar a execução do pipeline completo. Não coleta dados, não grava no banco diretamente — delega para `IngestionSourceRunner` e `IngestionPersister`.

**Interface pública:**

```typescript
export interface IngestionOptions {
  triggeredBy: "cron" | "manual" | "api";
  sourceFilter?: SourceName; // se definido, roda apenas esta fonte
}

export interface IngestionResult {
  runId: string;
  status: "completed" | "failed" | "partial";
  durationMs: number;
  municipalitiesTotal: number;
  municipalitiesSucceeded: number;
  indicatorsUpserted: number;
  scoresUpserted: number;
  sourceResults: Record<string, SourceRunResult>;
  errorMessage?: string;
}

export interface SourceRunResult {
  success: number;
  failed: number;
  skipped: number;
  errorSample: string | null;
}

export async function runIngestion(options: IngestionOptions): Promise<IngestionResult>;
export function isIngestionRunning(): boolean;
```

**Comportamento esperado:**

1. Verifica `isIngestionRunning()` — se true, loga warning e retorna sem fazer nada
2. Cria `IngestionRun` no banco com `status="running"`, salva o ID
3. Carrega todos os 295 códigos IBGE do banco via `prisma.municipality.findMany({ where: { deletedAt: null } })`
4. Para cada fonte (ou fonte filtrada), chama `runSourceIngestion(source, ibgeCodes)`
5. Após todas as fontes, chama `recalculateAllScores(ibgeCodes, runId)` para popular/atualizar `OdsScore`
6. Atualiza `IngestionRun` com status final, contagens e duração
7. Invalida cache Redis para todos os municípios processados: `del ods:report:*`
8. Retorna `IngestionResult`

**Tratamento de falha parcial:**

- Se uma fonte falha completamente, registra no `sourceResults` e continua para a próxima
- Status final = "partial" se pelo menos 1 fonte falhou mas pelo menos 1 teve sucesso
- Status final = "failed" apenas se NENHUMA fonte teve sucesso
- Status final = "completed" se todas as fontes tiveram pelo menos algum sucesso (mesmo com falhas individuais de município)

---

#### `backend/services/ingestion/ingestion_source_runner.ts`

**Responsabilidade única:** Executar a coleta de uma única fonte para todos os municípios e persistir os indicadores no banco.

**Interface pública:**

```typescript
export type SourceName =
  | "ibge"
  | "siconfi"
  | "datasus"
  | "inep"
  | "snis"
  | "inpe"
  | "pncp"
  | "tse"
  | "aneel"
  | "snis_rs"
  | "ana"
  | "convenios"
  | "anatel"
  | "sisvan"
  | "ieps";

export interface SourceRunOptions {
  ibgeCodes: string[];
  ingestionRunId: string;
}

export async function runSourceIngestion(
  source: SourceName,
  options: SourceRunOptions,
): Promise<SourceRunResult>;
```

**Comportamento esperado por tipo de fonte:**

Para fontes com API HTTP (ibge, siconfi, datasus, inpe, pncp — as 5 que têm latência real):

- Usa `collector.collectBatch(ibgeCodes)` — que já tem throttle de 500ms entre requests
- Para cada município com dados retornados: chama `mapToOdsIndicators()` e salva via `IngestionPersister.upsertIndicators()`
- Para cada município sem dados (null): registra como `skipped`
- Erros individuais de município não param o batch — são contados em `failed`

Para fontes estáticas (inep, snis, anatel, aneel, sisvan, ieps, convenios, tse, ana, snis_rs — as 10 que leem JSON):

- `collector.collect(ibgeCode)` é O(1) — não faz HTTP, apenas lookup no JSON em memória
- Pode processar todos os 295 municípios em paralelo com `Promise.all()` — sem throttle necessário
- O lote pode ser processado em ~2s para todos os 295

**Nota sobre collectBatch para fontes HTTP:**

- O `collectBatch` existente já tem throttle de 500ms entre cache-miss. Para a ingestão, este comportamento é desejado.
- 295 municípios × 500ms = ~2.5min por fonte HTTP no pior caso (cache completamente frio)
- Com o cron diário, após a primeira ingestão o cache Redis estará quente por 6h-24h dependendo da fonte

---

#### `backend/services/ingestion/ingestion_persister.ts`

**Responsabilidade única:** Gravar/atualizar indicadores e scores no PostgreSQL. Toda a lógica de upsert fica aqui.

**Interface pública:**

```typescript
export interface IndicatorInput {
  municipalityId: string;
  odsNumber: number;
  indicatorName: string;
  value: number | null;
  score: number | null;
  status: string | null;
  source: string;
  referenceYear: number;
  referenceDate: Date;
  dataAvailable: boolean;
}

export async function upsertIndicators(indicators: IndicatorInput[]): Promise<number>; // retorna count de registros upsertados

export async function upsertScores(
  municipalityId: string,
  scores: ScoreInput[],
  ingestionRunId: string,
): Promise<number>;

export async function getMunicipalityId(ibgeCode: string): Promise<string | null>;
```

**Comportamento de upsert:**

- Usa `prisma.odsIndicator.upsertMany()` em batches de 100 registros (evitar query muito grande)
- Chave de upsert: `(municipalityId, indicatorName, referenceYear)` — conforme unique constraint existente
- Nunca deleta indicadores — apenas atualiza

**Lote de 100 para OdsIndicator:**

- 295 municípios × ~20 indicadores/município × 15 fontes = ~88.500 indicadores por ingestão completa
- Batches de 100: ~885 queries — aceitável para uma operação noturna

---

#### `backend/services/ingestion/score_recalculator.ts`

**Responsabilidade única:** Após a ingestão de indicadores, recalcular `OdsScore` para todos os municípios a partir do que está no banco.

**Interface pública:**

```typescript
export async function recalculateAllScores(
  ibgeCodes: string[],
  ingestionRunId: string,
): Promise<{ scoresUpserted: number; municipalitiesProcessed: number }>;

export async function recalculateMunicipalityScore(
  ibgeCode: string,
  ingestionRunId: string,
): Promise<void>;
```

**Comportamento:**

- Para cada município: busca todos `OdsIndicator` do banco agrupados por `odsNumber`
- Aplica a mesma lógica de cálculo de score que `ods_score_service.ts` já usa (média dos scores por ODS, média ponderada global)
- Upsert em `OdsScore` com `ingestionRunId` preenchido
- Pode processar municípios em paralelo com `p-limit` (concorrência 10) — operações de leitura do banco são leves

---

#### `backend/services/ingestion/ods_score_reader.ts`

**Responsabilidade única:** Montar um `MunicipalOdsReport` a partir do banco de dados (o equivalente "lento" do `calculateMunicipalOds()` mas lendo do banco).

**Interface pública:**

```typescript
export async function readOdsReportFromDatabase(
  ibgeCode: string,
): Promise<
  (MunicipalOdsReport & { dataCollectedAt: string | null; ingestionRunId: string | null }) | null
>;
```

**Comportamento:**

1. Busca `municipality` pelo `ibgeCode`
2. Busca todos `OdsScore` do município para o `referenceYear` mais recente no banco
3. Busca todos `OdsIndicator` do município para o mesmo ano
4. Reconstrói `OdsSummary[]` agrupando indicadores por `odsNumber`
5. Monta `MunicipalOdsReport` — **mesmo formato** que `calculateMunicipalOds()` retorna
6. Adiciona `dataCollectedAt` a partir do `calculatedAt` do score global (odsNumber=0)
7. Retorna `null` se não há nenhum `OdsScore` no banco para este município

**Invariante crítica:** O objeto retornado deve ser type-compatible com `MunicipalOdsReport`. O frontend não deve saber a diferença entre dados do banco e dados em tempo real.

---

#### `backend/services/ingestion/ingestion_scheduler.ts`

**Responsabilidade única:** Inicializar o cron job e registrar no Express. Apenas scheduling — sem lógica de negócio.

**Interface pública:**

```typescript
export function initIngestionScheduler(): void;
export function stopIngestionScheduler(): void;
```

**Comportamento:**

- Usa `node-cron` (adicionar ao `package.json`)
- Expressão cron: `0 2 * * *` — 02:00 UTC todo dia
- Antes de disparar: verifica `isIngestionRunning()` — se true, loga e sai
- Loga início e fim da execução com `logger.info()`
- Captura erros não tratados com `catch` e loga com `logger.error()` (nunca deixa o processo crashar)
- `stopIngestionScheduler()` chamado no graceful shutdown do Express

---

#### `backend/routes/ingestion.ts`

**Responsabilidade única:** Expor os endpoints de status e trigger da ingestão.

**Interface pública:**

- `GET /api/ingestion/status` — lista últimas execuções
- `POST /api/ingestion/trigger` — dispara ingestão manual

Ver contratos completos na seção 4.2 e 4.3.

**Validação Zod para POST /trigger:**

```typescript
const TriggerSchema = z.object({
  source: z
    .enum([
      "ibge",
      "siconfi",
      "datasus",
      "inep",
      "snis",
      "inpe",
      "pncp",
      "tse",
      "aneel",
      "snis_rs",
      "ana",
      "convenios",
      "anatel",
      "sisvan",
      "ieps",
    ])
    .optional(),
});
```

---

### 5.2 Arquivos a modificar

#### `backend/routes/ods.ts` — modificação no GET /:ibgeCode

**Mudança:** Antes de chamar `calculateMunicipalOds()`, tenta `readOdsReportFromDatabase()`.

```typescript
// NOVO fluxo no handler:
const dbReport = await withCache(`ods:db:${ibgeCode}`, 900, () =>
  readOdsReportFromDatabase(ibgeCode),
);

if (dbReport) {
  res.json({ ...dbReport, dataSource: "database" });
  return;
}

// Fallback: comportamento atual
const report = await withCache(`ods:report:${ibgeCode}`, 3600, () =>
  calculateMunicipalOds(ibgeCode),
);

if (report) {
  res.json({ ...report, dataSource: "realtime", dataCollectedAt: null, ingestionRunId: null });
}
```

**Nota:** `withCache` com TTL 900s (15min) para leitura do banco — evita queries repetidas em dashboards com múltiplos usuários do mesmo município.

---

#### `backend/index.ts` — adicionar inicialização do scheduler

```typescript
// Após app.listen():
import {
  initIngestionScheduler,
  stopIngestionScheduler,
} from "./services/ingestion/ingestion_scheduler.js";
initIngestionScheduler();

// No gracefulShutdown():
stopIngestionScheduler();
```

---

#### `backend/routes/` — registrar a nova rota

Em `backend/index.ts`:

```typescript
import ingestionRouter from "./routes/ingestion.js";
// ...
app.use("/api/ingestion", authenticateToken, ingestionRouter);
```

---

#### `prisma/schema.prisma` — adicionar IngestionRun e alterar OdsScore

- Adicionar model `IngestionRun` (ver seção 3.1)
- Adicionar campo `ingestionRunId String?` em `OdsScore` (ver seção 3.2)

---

### 5.3 Dependências a adicionar

```bash
pnpm add node-cron
pnpm add -D @types/node-cron
pnpm add p-limit   # já pode existir — verificar antes
```

---

## 6. Tratamento de Falha por Cenário

| Cenário                                               | Comportamento                                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PNCP completamente down durante ingestão              | `sourceResults.pncp.failed = 295`, outros coletores rodam normalmente. Dashboard serve dados PNCP da última ingestão bem-sucedida. Status do run = "partial".                  |
| DATASUS timeout em 50 municípios                      | `sourceResults.datasus.failed = 50`, restantes gravados. Score dos 50 usa apenas as outras 14 fontes.                                                                          |
| PostgreSQL indisponível durante ingestão              | `runIngestion()` falha com catch, status = "failed", errorMessage preenchido. Próxima execução tenta novamente.                                                                |
| Redis indisponível                                    | Ingestão continua normalmente (Redis é apenas cache). Dashboard faz queries diretas ao banco.                                                                                  |
| Dashboard acessado enquanto ingestão está rodando     | Serve dados do banco da última ingestão concluída. Se banco está vazio (primeira ingestão ainda rodando), usa fallback real-time.                                              |
| Primeira ingestão ainda não rodou                     | Fallback para `calculateMunicipalOds()` — comportamento atual. `dataSource: "realtime"` no response.                                                                           |
| Ingestão começa mas processo Express reinicia no meio | IngestionRun fica com status="running" para sempre. Solução: no startup do Express, verificar se há runs com status="running" com startedAt > 6h atrás e marcar como "failed". |

---

## 7. Observabilidade — Métricas Prometheus

### 7.1 Novas métricas a adicionar em `backend/utils/metrics.ts`

```typescript
// Duração total da ingestão por execução
export const ingestionDuration = new client.Histogram({
  name: "ingestion_duration_ms",
  help: "Duração total do pipeline de ingestão em ms",
  labelNames: ["status"] as const, // completed|failed|partial
  buckets: [60000, 120000, 300000, 600000, 1800000], // 1min a 30min
  registers: [registry],
});

// Indicadores gravados por fonte
export const ingestionIndicatorsUpserted = new client.Counter({
  name: "ingestion_indicators_upserted_total",
  help: "Total de indicadores gravados/atualizados no banco",
  labelNames: ["source"] as const,
  registers: [registry],
});

// Municípios com falha por fonte
export const ingestionMunicipalitiesFailed = new client.Counter({
  name: "ingestion_municipalities_failed_total",
  help: "Municípios com falha de coleta por fonte",
  labelNames: ["source"] as const,
  registers: [registry],
});

// Última ingestão bem-sucedida (Unix timestamp) — para alertas
export const ingestionLastSuccessTimestamp = new client.Gauge({
  name: "ingestion_last_success_timestamp",
  help: "Unix timestamp da última ingestão completada ou parcial com sucesso",
  registers: [registry],
});
```

### 7.2 Alertas sugeridos para prometheus-rules.yml

```yaml
# Ingestão não rodou em mais de 26h (janela de 2h de tolerância)
- alert: IngestionStale
  expr: time() - ingestion_last_success_timestamp > 93600
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Pipeline de ingestão não completou nas últimas 26h"

# Dashboard sendo servido majoritariamente via realtime (banco sem dados)
- alert: DashboardFallingBackToRealtime
  expr: rate(cache_operations_total{operation="MISS", key_prefix="ods"}[1h]) > 5
  for: 30m
  labels:
    severity: warning
  annotations:
    summary: "Alto volume de cache miss em ODS — banco pode estar desatualizado"
```

---

## 8. Sequência de Implementação Recomendada

A sequência abaixo garante zero downtime e rollback seguro em cada etapa.

### Fase 1: Modelo de dados e migration (bloqueante para todo o resto)

1. Adicionar `IngestionRun` ao `schema.prisma`
2. Adicionar `ingestionRunId String?` em `OdsScore`
3. `prisma migrate dev --name add_ingestion_run`
4. Verificar SQL gerado em `prisma/migrations/`

### Fase 2: Camada de persistência

5. Criar `ingestion_persister.ts` com `upsertIndicators()` e `upsertScores()`
6. Testes unitários: mock do prisma, verificar batching de 100 registros

### Fase 3: Runners por fonte

7. Criar `ingestion_source_runner.ts` — conecta collector existente → persister
8. Testes de integração: usar banco real de teste, coletor mockado, verificar que OdsIndicator é criado

### Fase 4: Score recalculator

9. Criar `score_recalculator.ts` — lê OdsIndicator do banco, grava OdsScore
10. Validar que o score calculado a partir do banco = score calculado em tempo real (para o mesmo município com mesmos dados)

### Fase 5: Reader do banco (inversão do dashboard)

11. Criar `ods_score_reader.ts` — monta MunicipalOdsReport a partir do banco
12. Teste de integração: populate banco com fixtures → `readOdsReportFromDatabase()` → assert formato idêntico ao `calculateMunicipalOds()`
13. Modificar `routes/ods.ts` para tentar banco primeiro (com fallback)
14. Deploy e verificar: dashboard continua funcionando (banco vazio = fallback realtime)

### Fase 6: Orchestrator e scheduler

15. Criar `ingestion_orchestrator.ts` com lógica de overlap protection
16. Criar `ingestion_scheduler.ts` com node-cron
17. Criar `routes/ingestion.ts` com GET /status e POST /trigger
18. Registrar rota e scheduler em `index.ts`
19. Rodar ingestão manual via `POST /api/ingestion/trigger` e verificar banco populado

### Fase 7: Métricas e alertas

20. Adicionar métricas de ingestão em `metrics.ts`
21. Adicionar alertas em `prometheus-rules.yml`
22. Verificar no Grafana

---

## 9. Estimativa de Carga da Ingestão

| Fonte            | Tipo | Municípios | Tempo estimado (cold) | Tempo estimado (warm) |
| ---------------- | ---- | ---------- | --------------------- | --------------------- |
| IBGE             | HTTP | 295        | ~2.5min               | ~5s                   |
| SICONFI          | HTTP | 295        | ~2.5min               | ~5s                   |
| DATASUS          | HTTP | 295        | ~5min (timeout 30s)   | ~10s                  |
| INPE             | HTTP | 295        | ~2.5min               | ~5s                   |
| PNCP             | HTTP | 295        | ~2.5min               | ~5s                   |
| INEP             | JSON | 295        | <5s                   | <5s                   |
| SNIS             | JSON | 295        | <5s                   | <5s                   |
| ANATEL           | JSON | 295        | <5s                   | <5s                   |
| ANEEL            | JSON | 295        | <5s                   | <5s                   |
| SISVAN           | JSON | 295        | <5s                   | <5s                   |
| IEPS             | JSON | 295        | <5s                   | <5s                   |
| CONVENIOS        | JSON | 295        | <5s                   | <5s                   |
| TSE              | JSON | 295        | <5s                   | <5s                   |
| ANA              | JSON | 295        | <5s                   | <5s                   |
| SNIS-RS          | JSON | 295        | <5s                   | <5s                   |
| **Score recalc** | DB   | 295        | ~30s                  | ~30s                  |
| **TOTAL**        |      |            | **~20min**            | **~3min**             |

Ingestão completa cold path: ~20 minutos. Com cache Redis aquecido (após primeira ingestão): ~3 minutos. O cron às 02:00 UTC tem 2h até o início do expediente — margem confortável.

---

## 10. Perguntas Abertas (não bloqueantes para implementação)

1. **Retenção de IngestionRun:** Quantos registros manter? Sugestão: 90 dias (job de limpeza semanal). Sem resposta do cliente = implementar 90 dias.

2. **Notificação de falha:** Se a ingestão falha completamente, deve notificar alguém? Sugestão: apenas alerta no Grafana. Sem email por ora.

3. **Ingestão parcial por região:** Não foi solicitado, não implementar. Uma ingestão sempre processa todos os 295 municípios.

4. **Visibilidade do status no frontend:** `dataSource` e `dataCollectedAt` já vão no response do dashboard. O frontend decide se mostra isso — não é responsabilidade do backend.

5. **Limpeza de OdsIndicator antigos:** Se um município teve dados de 2024 e agora tem de 2025, os registros de 2024 permanecem (constraint unique inclui `referenceYear`). Isso é correto — dados históricos são valiosos para a feature de histórico. Não limpar.
