# Database Schema Design — IOC ESG Municipal
Produzido por: database-architect
Data: 2026-04-01
Status: APROVADO PARA IMPLEMENTACAO

---

## 1. CONTEXTO E RESTRIÇÕES

### Estado atual do schema (migration 20260331173016_init)
O schema inicial possui 4 modelos funcionais:
- `Municipality` — 295 municípios SC, com soft delete
- `OdsIndicator` — indicadores brutos por fonte (IBGE, SICONFI, DATASUS)
- `Simulation` — cenários de investimento FPM
- `User` — sem organização, sem roles formais, sem relação com Municipality

### Lacunas identificadas na análise do código
1. `OdsScore` separado de `OdsIndicator` — o score consolidado por ODS é calculado em memória no `OdsScoreService` mas nunca persistido. Isso força recálculo a cada request.
2. `ApiCache` — o CLAUDE.md exige Redis para cache, mas sem persistência no PostgreSQL os dados de APIs são perdidos entre reinicializações do Redis.
3. `Organization` ausente — multi-tenancy é requisito (prefeito só vê seu município), mas `User` tem `municipalityId?` solto sem isolamento real.
4. `AuditLog` ausente — requisito explícito de auditoria.
5. `Report` ausente — gerador de relatórios ESG listado como serviço existente em `backend/services/reports/`.
6. `User` sem `deletedAt`, sem relação FK real com `Municipality`.
7. `Simulation` sem `userId` — impossível saber quem criou o cenário.

---

## 2. DECISÕES DE DESIGN

### D1 — CUID como surrogate key (mantido do init)
**Decisão:** Manter CUID (`@default(cuid())`) em todas as entidades.
**Justificativa:** UUIDs seriam seguros mas custosos para índices BTree no PostgreSQL. CUIDs são monotonicamente crescentes, colisão desprezível, não expõem sequência previsível como auto-increment. O `ibgeCode` (7 dígitos) permanece como identificador natural com `@unique`, usado nas URLs da API.

### D2 — OdsScore como tabela separada de OdsIndicator
**Decisão:** `OdsScore` armazena o score consolidado por ODS (1-17) por município por período. `OdsIndicator` armazena os valores brutos por indicador por fonte.
**Justificativa:** O `OdsScoreService` hoje recalcula em memória a cada request chamando 5 APIs externas. Com 5.570 municípios, isso não escala. A tabela `OdsScore` permite:
- Cache de longa duração (score válido até próxima coleta)
- Série histórica de scores (dashboard de evolução temporal)
- Queries de ranking/comparação entre municípios sem chamar APIs
**Trade-off aceito:** Duplicação parcial de dados (score também está em `OdsIndicator`). Resolvido pela responsabilidade clara: `OdsIndicator.score` é o score normalizado de UM indicador específico; `OdsScore.score` é a média ponderada de todos os indicadores daquele ODS.

### D3 — Soft delete apenas em entidades principais
**Decisão:** `deletedAt DateTime?` em: `Municipality`, `User`, `Organization`, `Simulation`, `Report`. Não em: `OdsIndicator`, `OdsScore`, `ApiCache`, `AuditLog`.
**Justificativa:** Indicadores e scores são dados históricos imutáveis — nunca se deleta, se adiciona uma versão nova. Cache e audit são append-only por natureza.

### D4 — Multi-tenancy via Organization (não por Municipality direto)
**Decisão:** `Organization` representa a prefeitura como entidade SaaS. Um `Organization` tem um `Municipality` (1:1). `User` pertence a `Organization`. Municípios sem assinatura existem na tabela `Municipality` mas sem `Organization`.
**Justificativa:** Separa o dado público (município) do cliente SaaS (prefeitura assinante). Permite no futuro: consórcios municipais (1 org, N municípios), consultores externos (1 user, N orgs), plano empresa (N prefeituras num contrato).

### D5 — Enum via String com validação na aplicação, não Postgres ENUM
**Decisão:** Campos de tipo/status usam `String` no Prisma com comentário de valores válidos. Não usar `enum` do PostgreSQL.
**Justificativa:** Migrations de `ALTER TYPE ... ADD VALUE` em Postgres não são transacionais — risco em produção. Com `String` + Zod na aplicação, adicionar novo valor é zero-downtime. Custo: sem constraint no banco. Aceito: a validação Zod no middleware compensa.

### D6 — ApiCache no PostgreSQL como fallback do Redis
**Decisão:** `ApiCache` persiste as respostas brutas das APIs externas no PostgreSQL com TTL.
**Justificativa:** Redis é efêmero. Se o Redis reinicia (deploy, crash), a aplicação chamaria todas as 7 APIs simultaneamente para 295 municípios = 2.065 requests instantâneos = rate limit banido. O PostgreSQL atua como cache de segundo nível, evitando esse spike. A aplicação consulta Redis primeiro; se miss, consulta `ApiCache`; se miss ou expirado, chama a API.

### D7 — ReferenceDate como DATE, não TIMESTAMP
**Decisão:** `referenceDate Date @db.Date` em `OdsIndicator` e `OdsScore`.
**Justificativa:** Os dados são sempre referentes a um período (ano, semestre, quadrimestre) — a hora não tem semântica. `DATE` ocupa 4 bytes vs 8 bytes do `TIMESTAMP`, relevante ao escalar para 5.570 municípios × 17 ODS × N anos × M indicadores.

### D8 — Índices compostos orientados pelas queries do OdsScoreService
As queries críticas identificadas no código:
1. `SELECT * FROM OdsIndicator WHERE municipalityId = ? AND odsNumber = ? ORDER BY referenceDate DESC LIMIT 1` — busca indicador mais recente por ODS
2. `SELECT * FROM OdsScore WHERE municipalityId = ? ORDER BY referenceDate DESC` — dashboard principal
3. `SELECT * FROM OdsScore WHERE municipalityId IN (?) AND referenceDate = ?` — comparação entre municípios
4. `SELECT * FROM Municipality WHERE state = ? AND deletedAt IS NULL` — listagem por estado

---

## 3. SCHEMA PRISMA COMPLETO

```prisma
// =============================================================================
// IOC ESG Municipal — Schema Prisma
// Versão: 2.0.0 — Design completo com multi-tenancy, scores, cache e auditoria
// =============================================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =============================================================================
// BLOCO 1 — TERRITÓRIO E DADOS PÚBLICOS
// Entidades que existem independentemente de assinaturas SaaS.
// Municipios são dados públicos; scores/indicadores são calculados a partir
// de APIs governamentais públicas.
// =============================================================================

/// Município brasileiro conforme IBGE.
/// Existência não implica assinatura ativa (Organization).
/// Soft delete: municipio emancipado ou extinto preserva histórico.
model Municipality {
  id          String    @id @default(cuid())
  /// Código IBGE com 7 dígitos (ex: 4204202 = Florianópolis)
  ibgeCode    String    @unique
  /// Código SICONFI = primeiros 6 dígitos do IBGE (ex: 420420)
  siconfiCode String    @unique
  name        String
  state       String    @default("SC") /// UF de 2 letras (ex: SC, PR, RS)
  /// Mesorregião IBGE para benchmarks regionais
  mesoregion  String?
  /// Microrregião IBGE para benchmarks de proximidade
  microregion String?
  population  Int?      /// Estimativa mais recente disponível
  /// FPM anual mais recente — atualizado pelo agente SICONFI
  fpmAnnual   Decimal?  @db.Decimal(15, 2)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  // Relações
  organization Organization?
  indicators   OdsIndicator[]
  scores       OdsScore[]
  simulations  Simulation[]
  reports      Report[]
  apiCaches    ApiCache[]

  @@index([state])
  @@index([deletedAt])
  @@index([state, deletedAt]) /// Query: listar municípios ativos de um estado
  @@map("municipalities")
}

/// Score ODS consolidado para um município em um período de referência.
/// Calculado pelo OdsScoreService a partir dos OdsIndicators.
/// Uma linha por (município, ODS, referenceDate) — histórico preservado.
model OdsScore {
  id             String   @id @default(cuid())
  municipalityId String
  /// ODS 1-17
  odsNumber      Int
  /// Score consolidado 0-100 (média ponderada dos indicadores do ODS)
  score          Int      /// 0-100
  /// verde (>=70) | amarelo (40-69) | vermelho (<40)
  status         String
  /// Score global ponderado dos 17 ODS (salvo apenas no registro odsNumber=0)
  globalScore    Int?
  globalStatus   String?
  referenceYear  Int
  referenceDate  DateTime @db.Date
  /// Quantos indicadores contribuíram para este score
  indicatorCount Int      @default(0)
  /// Fontes que contribuíram (ex: ["ibge","siconfi"])
  sources        String[]
  createdAt      DateTime @default(now())

  municipality Municipality @relation(fields: [municipalityId], references: [id])

  /// Unicidade: apenas um score por município/ODS/data de referência
  @@unique([municipalityId, odsNumber, referenceDate])
  @@index([municipalityId, referenceDate])       /// Dashboard: scores recentes do município
  @@index([odsNumber, referenceDate, score])     /// Ranking nacional por ODS
  @@index([municipalityId, odsNumber])           /// Série histórica de um ODS
  @@map("ods_scores")
}

/// Indicador individual bruto por fonte (IBGE, SICONFI, DATASUS, INEP, SNIS, INPE, PNCP).
/// Imutável após inserção — nova coleta gera nova linha.
/// Soft delete: não aplicável — dados históricos são preserve-only.
model OdsIndicator {
  id             String   @id @default(cuid())
  municipalityId String
  /// ODS relacionado (1-17)
  odsNumber      Int
  /// Nome do indicador (ex: pct_baixa_renda, taxa_ocupacao)
  indicatorName  String
  /// Valor bruto normalizado (ex: 43.7 para 43.7%)
  value          Decimal? @db.Decimal(12, 4)
  /// Score normalizado 0-100 para este indicador específico
  score          Int?
  /// verde | amarelo | vermelho | null (sem dados)
  status         String?
  /// Fonte: ibge | siconfi | datasus | inep | snis | inpe | pncp
  source         String
  referenceYear  Int
  referenceDate  DateTime @db.Date
  dataAvailable  Boolean  @default(true)
  createdAt      DateTime @default(now())

  municipality Municipality @relation(fields: [municipalityId], references: [id])

  @@index([municipalityId, odsNumber])                   /// Indicadores de um ODS por município
  @@index([municipalityId, odsNumber, referenceDate])    /// Indicador mais recente
  @@index([source, referenceDate])                       /// Reprocessar por fonte
  @@index([referenceDate])                               /// Queries temporais
  @@map("ods_indicators")
}

// =============================================================================
// BLOCO 2 — MULTI-TENANCY SaaS
// Isola dados entre prefeituras assinantes.
// =============================================================================

/// Organização = prefeitura como cliente SaaS.
/// Relação 1:1 com Municipality (um município, uma prefeitura assinante).
/// Planos futuros: consortiums (1:N municipality), consultores (N:N).
model Organization {
  id             String    @id @default(cuid())
  municipalityId String    @unique /// FK para o município representado
  /// Nome da organização (ex: "Prefeitura de Florianópolis")
  name           String
  /// Slug para URL amigável (ex: florianopolis-sc)
  slug           String    @unique
  /// starter | professional | enterprise
  plan           String    @default("starter")
  /// Data de início da assinatura atual
  subscriptionStart DateTime?
  /// Data de expiração da assinatura
  subscriptionEnd   DateTime?
  /// active | trial | suspended | cancelled
  subscriptionStatus String @default("trial")
  /// CNPJ da prefeitura (14 dígitos, sem formatação)
  cnpj           String?   @unique
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  municipality Municipality @relation(fields: [municipalityId], references: [id])
  users        User[]

  @@index([subscriptionStatus])
  @@index([deletedAt])
  @@map("organizations")
}

/// Usuário do sistema. Sempre pertence a uma Organization.
/// Soft delete: desativação sem perda de histórico.
model User {
  id             String    @id @default(cuid())
  organizationId String
  email          String    @unique
  passwordHash   String
  name           String
  /// admin | prefeito | secretario_financas | secretario_planejamento | viewer
  role           String
  /// Se null: acessa o município da organização. Para admins: null = acesso total.
  municipalityId String?
  lastLoginAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  organization Organization  @relation(fields: [organizationId], references: [id])
  simulations  Simulation[]
  reports      Report[]
  auditLogs    AuditLog[]

  @@index([organizationId])
  @@index([email])
  @@index([municipalityId])
  @@index([deletedAt])
  @@map("users")
}

// =============================================================================
// BLOCO 3 — FUNCIONALIDADES DE NEGÓCIO
// Simulações e relatórios produzidos pelos usuários.
// =============================================================================

/// Cenário de simulação de investimento FPM.
/// Criado pelo prefeito ou secretário de planejamento.
/// Soft delete: preserva histórico de decisões.
model Simulation {
  id               String    @id @default(cuid())
  municipalityId   String
  /// Usuário que criou o cenário
  userId           String
  scenarioName     String
  /// Valor total de investimento simulado (R$) — Decimal.js no app
  investmentAmount Decimal   @db.Decimal(15, 2)
  /// education | health | sanitation | security | environment
  investmentType   String
  /// Lista de ODS impactados (ex: [3, 4, 6])
  targetOds        Int[]
  /// Resultado da simulação: scores projetados, impacto por ODS
  projectedImpact  Json
  /// pending | running | completed | failed
  status           String    @default("pending")
  /// Mensagem de erro se status = failed
  errorMessage     String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  completedAt      DateTime?
  deletedAt        DateTime?

  municipality Municipality @relation(fields: [municipalityId], references: [id])
  user         User         @relation(fields: [userId], references: [id])

  @@index([municipalityId])
  @@index([userId])
  @@index([municipalityId, status])   /// Listar simulações ativas do município
  @@index([deletedAt])
  @@map("simulations")
}

/// Relatório ESG gerado (PDF ou JSON estruturado).
/// Imutável após geração — nova versão cria novo registro.
model Report {
  id             String    @id @default(cuid())
  municipalityId String
  userId         String
  /// Título do relatório (ex: "Relatório ESG 2025 — Florianópolis")
  title          String
  /// annual | quarterly | custom
  reportType     String
  /// Ano de referência principal do relatório
  referenceYear  Int
  /// Conteúdo estruturado do relatório (scores, metas, narrativa)
  content        Json
  /// URL do PDF gerado (se aplicável) — S3 ou storage local
  pdfUrl         String?
  /// pending | generating | completed | failed
  status         String    @default("pending")
  createdAt      DateTime  @default(now())
  completedAt    DateTime?
  deletedAt      DateTime?

  municipality Municipality @relation(fields: [municipalityId], references: [id])
  user         User         @relation(fields: [userId], references: [id])

  @@index([municipalityId, referenceYear])
  @@index([userId])
  @@index([deletedAt])
  @@map("reports")
}

// =============================================================================
// BLOCO 4 — INFRAESTRUTURA DE DADOS
// Cache de APIs e auditoria de acessos.
// =============================================================================

/// Cache persistente de respostas de APIs externas (segundo nível após Redis).
/// Previne spike de requests após reinicialização do Redis.
/// TTL gerenciado pela aplicação via expiresAt.
model ApiCache {
  id             String   @id @default(cuid())
  municipalityId String?  /// null para caches globais (ex: lista de municípios)
  /// ibge | siconfi | datasus | inep | snis | inpe | pncp
  source         String
  /// Chave única dentro da fonte (ex: "4205407_2025" ou "indicators_29171_4205407")
  cacheKey       String
  /// Resposta bruta da API (JSON comprimido ou completo)
  payload        Json
  /// HTTP status da resposta original
  httpStatus     Int      @default(200)
  expiresAt      DateTime
  createdAt      DateTime @default(now())

  municipality Municipality? @relation(fields: [municipalityId], references: [id])

  @@unique([source, cacheKey])           /// Chave de lookup: fonte + key
  @@index([source, municipalityId])      /// Invalidar cache de um município por fonte
  @@index([expiresAt])                   /// Job de limpeza de cache expirado
  @@map("api_caches")
}

/// Log de auditoria imutável — append-only.
/// Registra acessos e ações de usuários autenticados.
model AuditLog {
  id             String   @id @default(cuid())
  userId         String
  /// Entidade acessada (ex: Municipality, Simulation, Report)
  entityType     String
  /// ID da entidade acessada
  entityId       String
  /// Ação executada: view | create | update | delete | export | simulate
  action         String
  /// IP do cliente (IPv4 ou IPv6)
  ipAddress      String?
  /// User-Agent do browser/app
  userAgent      String?
  /// Dados extras da ação (ex: ibgeCode consultado, filtros aplicados)
  metadata       Json?
  createdAt      DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])          /// Histórico de ações do usuário
  @@index([entityType, entityId])       /// Quem acessou uma entidade específica
  @@index([createdAt])                  /// Queries temporais (relatórios de uso)
  @@map("audit_logs")
}
```

---

## 4. MIGRATION PLAN

As migrations devem ser executadas na ordem abaixo. Cada migration é incremental sobre o estado anterior.

### Migration 1 — init (existente: 20260331173016_init)
**Status:** Já aplicada em produção.
**Contém:** Municipality, OdsIndicator (sem UNIQUE), Simulation (sem userId), User (sem Organization).
**Notas:** Esta migration NÃO deve ser modificada — ela já está no histórico do Prisma.

---

### Migration 2 — add_ods_scores
```
Nome sugerido: 20260401000001_add_ods_scores

Up:
  - CREATE TABLE ods_scores (...)
  - Índices: municipalityId+referenceDate, odsNumber+referenceDate+score,
             municipalityId+odsNumber
  - UNIQUE: municipalityId + odsNumber + referenceDate

Down (rollback):
  - DROP TABLE ods_scores

Notas de segurança:
  - Totalmente reversível — tabela nova, sem dados existentes afetados
  - Não adiciona FKs em tabelas existentes ainda (Municipality existe)
  - Pode ser aplicada em produção zero-downtime
```

---

### Migration 3 — add_organizations
```
Nome sugerido: 20260401000002_add_organizations

Up:
  - CREATE TABLE organizations (...)
  - ADD COLUMN municipalityId UNIQUE FK em organizations
  - Índices: subscriptionStatus, deletedAt

Down (rollback):
  - DROP TABLE organizations (seguro: sem dados ainda)

Notas de segurança:
  - Totalmente reversível
  - A FK municipalityId é UNIQUE: garante 1 org por município
```

---

### Migration 4 — refactor_users
```
Nome sugerido: 20260401000003_refactor_users

Up:
  - ADD COLUMN organizationId TEXT em users (nullable inicialmente)
  - ADD COLUMN name TEXT em users (DEFAULT '' temporariamente)
  - ADD COLUMN lastLoginAt TIMESTAMP em users
  - ADD COLUMN deletedAt TIMESTAMP em users
  - CREATE INDEX users_organizationId_idx
  - CREATE INDEX users_deletedAt_idx

Down (rollback):
  - DROP COLUMN organizationId
  - DROP COLUMN name
  - DROP COLUMN lastLoginAt
  - DROP COLUMN deletedAt

Notas de segurança:
  - RISCO: organizationId fica nullable na migration de adição.
    Tornar NOT NULL requer: 1) migration com nullable, 2) backfill de dados,
    3) segunda migration adicionando NOT NULL constraint.
  - Se não houver dados de usuários em produção ainda, pode ser NOT NULL direto.
  - name deve receber DEFAULT '' na migration, backfill posterior, depois DROP DEFAULT.
```

---

### Migration 5 — add_simulation_userid
```
Nome sugerido: 20260401000004_add_simulation_userid

Up:
  - ADD COLUMN userId TEXT nullable em simulations
  - ADD COLUMN errorMessage TEXT em simulations
  - ADD COLUMN updatedAt TIMESTAMP em simulations
  - ADD COLUMN deletedAt TIMESTAMP em simulations
  - CREATE INDEX simulations_userId_idx
  - CREATE INDEX simulations_municipalityId_status_idx
  - CREATE INDEX simulations_deletedAt_idx

Down (rollback):
  - DROP COLUMN userId, errorMessage, updatedAt, deletedAt

Notas de segurança:
  - userId nullable inicialmente para não quebrar simulações existentes
  - Tornará NOT NULL após backfill
```

---

### Migration 6 — add_reports
```
Nome sugerido: 20260401000005_add_reports

Up:
  - CREATE TABLE reports (...)
  - FKs: municipalityId → municipalities.id, userId → users.id
  - Índices: municipalityId+referenceYear, userId, deletedAt

Down (rollback):
  - DROP TABLE reports

Notas de segurança:
  - Totalmente reversível — tabela nova
```

---

### Migration 7 — add_api_cache
```
Nome sugerido: 20260401000006_add_api_cache

Up:
  - CREATE TABLE api_caches (...)
  - FK: municipalityId → municipalities.id (nullable)
  - UNIQUE: source + cacheKey
  - Índices: source+municipalityId, expiresAt

Down (rollback):
  - DROP TABLE api_caches

Notas de segurança:
  - Totalmente reversível — tabela nova
  - municipalityId nullable para suportar caches globais
```

---

### Migration 8 — add_audit_logs
```
Nome sugerido: 20260401000007_add_audit_logs

Up:
  - CREATE TABLE audit_logs (...)
  - FK: userId → users.id
  - Índices: userId+createdAt, entityType+entityId, createdAt

Down (rollback):
  - DROP TABLE audit_logs

Notas de segurança:
  - Totalmente reversível — tabela nova
  - Esta tabela cresce rapidamente. Considerar particionamento por mês
    quando volume ultrapassar 10M linhas (estimativa: ~12 meses com 295 municípios).
```

---

### Migration 9 — refactor_municipalities
```
Nome sugerido: 20260401000008_refactor_municipalities

Up:
  - ADD COLUMN mesoregion TEXT nullable em municipalities
  - ADD COLUMN microregion TEXT nullable em municipalities
  - CREATE INDEX municipalities_state_deletedAt_idx (composto — substituir idx simples)

Down (rollback):
  - DROP COLUMN mesoregion, microregion
  - Índice composto pode permanecer (inofensivo)

Notas de segurança:
  - Totalmente reversível
  - mesoregion/microregion são dados do IBGE, populados via seed/backfill
```

---

### Migration 10 — add_ods_indicator_constraints
```
Nome sugerido: 20260401000009_add_ods_indicator_constraints

Up:
  - ALTER COLUMN referenceDate TYPE DATE (de TIMESTAMP para DATE)
  - Isso requer: CREATE new_column DATE, UPDATE new_column = referenceDate::date,
    DROP old_column, RENAME new_column
  - ADD INDEX ods_indicators_municipalityId_odsNumber_referenceDate_idx
  - ADD INDEX ods_indicators_source_referenceDate_idx

Down (rollback):
  - Recriar como TIMESTAMP
  - RISCO: conversão de DATE para TIMESTAMP perde precisão de hora (irrelevante
    pois valor de hora sempre foi zero)

Notas de segurança:
  - ALTO RISCO se tabela já tiver muitos dados: ALTER TYPE em coluna com índice
    requer ACCESS EXCLUSIVE LOCK. Em produção, usar CREATE COLUMN + backfill + rename.
  - Aplicar com janela de manutenção ou usar pg_repack.
  - Se não houver dados na tabela, é seguro aplicar diretamente.
```

---

## 5. SEED DATA STRATEGY

### Seed 1 — Municípios SC (já implementado)
Fonte: `shared/constants/municipalities-sc.ts`
295 registros. Idempotente via `upsert` por `ibgeCode`.

```typescript
// Já implementado no prisma/seed.ts existente
for (const m of SC_MUNICIPALITIES) {
  await prisma.municipality.upsert({
    where: { ibgeCode: m.ibgeCode },
    update: { name: m.name },
    create: { ibgeCode: m.ibgeCode, siconfiCode: m.siconfiCode, name: m.name, state: 'SC' },
  })
}
```

### Seed 2 — Organização e usuário admin de desenvolvimento
Executado apenas em ambiente `development`. Cria org de teste para Florianópolis (4205407) com um usuário admin de cada role.

```typescript
// Apenas em NODE_ENV=development
const floripa = await prisma.municipality.findUnique({ where: { ibgeCode: '4205407' } })
const org = await prisma.organization.upsert({
  where: { municipalityId: floripa.id },
  create: {
    municipalityId: floripa.id,
    name: 'Prefeitura de Florianópolis (DEV)',
    slug: 'florianopolis-sc-dev',
    plan: 'enterprise',
    subscriptionStatus: 'active',
  },
  update: {},
})
// Criar usuários de cada role para testes
```

### Seed 3 — OdsScores iniciais (opcional, pós-coleta)
Após os agentes coletarem dados reais, o seed popula `OdsScore` a partir dos `OdsIndicator` existentes via `OdsScoreService.recalculateAll()`. Este seed é idempotente via `upsert` no `@@unique([municipalityId, odsNumber, referenceDate])`.

---

## 6. ANÁLISE DE PERFORMANCE

### Queries críticas e cobertura por índices

| Query | Tabela | Índice utilizado | Risco |
|-------|--------|-----------------|-------|
| Dashboard principal (scores recentes) | ods_scores | `municipalityId, referenceDate` | Baixo |
| Ranking nacional ODS 3 | ods_scores | `odsNumber, referenceDate, score` | Baixo |
| Série histórica ODS 4 município | ods_scores | `municipalityId, odsNumber` | Baixo |
| Indicadores de uma coleta | ods_indicators | `municipalityId, odsNumber, referenceDate` | Baixo |
| Reprocessar coleta IBGE | ods_indicators | `source, referenceDate` | Baixo |
| Listar municípios SC ativos | municipalities | `state, deletedAt` | Baixo |
| Comparação 10 municípios | ods_scores | `municipalityId, referenceDate` | Médio — IN clause |
| Auditoria usuário | audit_logs | `userId, createdAt` | Médio — cresce rápido |
| Cache miss | api_caches | `source, cacheKey` (UNIQUE) | Baixo |
| Limpeza cache expirado (cron) | api_caches | `expiresAt` | Baixo |

### Projeção de volume (5.570 municípios, 5 anos)

| Tabela | Registros estimados | Estratégia |
|--------|--------------------|-----------  |
| municipalities | 5.570 | Estático, sem problema |
| ods_scores | 5.570 × 18 × 60 meses = ~6M | Particionamento por ano após 3M |
| ods_indicators | ~30M (N indicadores × coletas) | Particionamento por source após 5M |
| api_caches | ~50k (rotatividade por TTL) | Cron de limpeza semanal |
| audit_logs | ~100M/ano em escala total | Particionamento por mês |

### Recomendações de paginação
- `OdsScore` e `OdsIndicator`: usar cursor-based pagination com `createdAt + id` como cursor — evita offset com COUNT em tabelas grandes.
- Dashboard: limitar a 12 meses de histórico por padrão, paginação por ano.

### Riscos identificados

1. **OdsIndicator sem UNIQUE constraint**: O schema atual permite inserir duplicatas (mesmo município, ODS, indicador, data). O agente de coleta deve verificar existência antes de inserir. Solução: adicionar `@@unique([municipalityId, indicatorName, referenceDate, source])` na Migration 10, após confirmar não há duplicatas.

2. **Json em projectedImpact (Simulation) e content (Report)**: Sem schema fixo, queries dentro do Json são lentas sem GIN index. Se houver necessidade de filtrar por campos do Json, adicionar `CREATE INDEX USING GIN (projectedImpact)`.

3. **audit_logs sem particionamento**: Em escala (5.570 municípios, múltiplos users/município, uso diário), pode atingir 100M de linhas em 1 ano. Considerar PostgreSQL Table Partitioning por mês desde o início.

4. **Municipality.fpmAnnual**: Campo desnormalizado (o FPM mais recente também está em `OdsIndicator` via agente SICONFI). Manter apenas como cache de acesso rápido para o dashboard — atualizar via trigger ou job.

---

## 7. QUERIES DE EXEMPLO PARA CASOS DE USO PRINCIPAIS

### Dashboard do prefeito — scores mais recentes
```sql
SELECT os.ods_number, os.score, os.status, os.reference_date, os.sources
FROM ods_scores os
WHERE os.municipality_id = $1
  AND os.reference_date = (
    SELECT MAX(reference_date)
    FROM ods_scores
    WHERE municipality_id = $1
  )
ORDER BY os.ods_number;
```

### Score global mais recente
```sql
SELECT global_score, global_status, reference_date
FROM ods_scores
WHERE municipality_id = $1 AND ods_number = 0
ORDER BY reference_date DESC
LIMIT 1;
```

### Série histórica ODS 4 (Educação) — últimos 5 anos
```sql
SELECT reference_date, score, status, indicator_count
FROM ods_scores
WHERE municipality_id = $1 AND ods_number = 4
ORDER BY reference_date DESC
LIMIT 10;
```

### Ranking dos 10 melhores municípios em ODS 6 (Saneamento) — SC
```sql
SELECT m.name, m.ibge_code, os.score, os.status
FROM ods_scores os
JOIN municipalities m ON m.id = os.municipality_id
WHERE os.ods_number = 6
  AND m.state = 'SC'
  AND m.deleted_at IS NULL
  AND os.reference_date = (SELECT MAX(reference_date) FROM ods_scores WHERE ods_number = 6)
ORDER BY os.score DESC
LIMIT 10;
```

### Verificar cache antes de chamar API
```sql
SELECT payload, expires_at
FROM api_caches
WHERE source = $1 AND cache_key = $2 AND expires_at > NOW();
```

---

## 8. DIAGRAMA DE ENTIDADES E RELACIONAMENTOS

```
municipalities (1) ──── (0..1) organizations
      │                         │
      │                         │ (1)
      │                     (0..N)
      │                       users
      │                         │
      ├──── (0..N) ods_scores   │
      │                         │
      ├──── (0..N) ods_indicators│
      │                         │
      ├──── (0..N) simulations ─┤ (1 user per simulation)
      │                         │
      ├──── (0..N) reports ─────┤ (1 user per report)
      │                         │
      └──── (0..N) api_caches   │
                                 │
                           (0..N) audit_logs
```

Cardinalidades críticas:
- Municipality : Organization = 1:0..1 (município existe sem assinatura)
- Organization : User = 1:N (múltiplos usuários por prefeitura)
- Municipality : OdsScore = 1:N (histórico temporal)
- Municipality : OdsIndicator = 1:N (múltiplos indicadores por fonte)

---

## 9. DECISÕES ADIADAS (fora do escopo v2.0)

1. **Particionamento de tabelas**: Necessário apenas após escala para Brasil completo. Implementar quando `ods_indicators` ultrapassar 5M linhas.

2. **Read replicas**: Para queries de dashboard/ranking sem afetar writes de coleta. Relevante na fase de produção com >50 municípios ativos.

3. **Materialized views para ranking**: `mv_ods_rankings` com refresh a cada 6h. Elimina o JOIN pesado de ranking nacional. Implementar quando ranking for feature pública.

4. **Tabela de metadados de coleta (CollectionJob)**: Rastreamento de jobs de coleta Bull — quando?/sucesso?/erro?. Atualmente o Bull Queue não persiste no PostgreSQL. Implementar junto ao job scheduler.

5. **CNPJ e dados sensíveis da organização**: Armazenamento de CNPJ requer LGPD compliance. Campo presente no design mas encriptação em repouso deve ser avaliada.
```

---
*Documento gerado por database-architect — NÃO executar migrations sem aprovação.*
*Próximo passo: implementação pelo agente api-developer via `prisma migrate dev`.*
