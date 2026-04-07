# Database Review — IOC ESG Municipal

Revisor: database-architect
Data: 2026-04-06
Schema version: migration 20260406000000_add_refresh_token (4 migrations aplicadas)
Estado lido: schema.prisma + 4 migrations SQL + seed.ts + 8 arquivos de serviço/rota

---

## Sumario executivo

O schema atual tem **6 tabelas funcionais** e cobre os casos de uso atuais (295 municípios SC).
Esta revisao identifica **15 problemas** com 4 severidades distintas.

O schema anterior (database-architecture-review.md de 2026-04-02) documentou 10 issues.
Esta revisao confirma que **7 deles foram resolvidos** e adiciona **5 novos** descobertos
com a leitura do codigo real. O schema ainda nao implementou o design v2.0 aprovado
(Organization, AuditLog, ApiCache, Report) — isso e uma lacuna de features, nao de bugs.

---

## Estado atual vs design aprovado

| Entidade     | Design v2.0 (database-schema.md)                | Schema atual                             | Status              |
| ------------ | ----------------------------------------------- | ---------------------------------------- | ------------------- |
| Municipality | Implementada                                    | Implementada                             | OK                  |
| OdsIndicator | Implementada                                    | Implementada                             | OK                  |
| OdsScore     | Implementada                                    | Implementada                             | OK                  |
| Simulation   | Implementada (com userId, updatedAt, deletedAt) | Sem userId, sem updatedAt, sem deletedAt | LACUNA              |
| User         | Com deletedAt, organizationId, lastLoginAt      | Sem deletedAt, sem organizationId        | LACUNA              |
| RefreshToken | Nao prevista no v2.0                            | Implementada                             | OK (adicao correta) |
| Organization | Prevista no v2.0                                | Ausente                                  | PENDENTE            |
| Report       | Prevista no v2.0                                | Ausente                                  | PENDENTE            |
| ApiCache     | Prevista no v2.0                                | Ausente                                  | PENDENTE            |
| AuditLog     | Prevista no v2.0                                | Ausente                                  | PENDENTE            |

As entidades ausentes (Organization, Report, ApiCache, AuditLog) sao features de produto
ainda nao implementadas — nao afetam o funcionamento atual. O risco e de debito tecnico
que cresce conforme o produto avanca sem elas.

---

## Problemas por area

---

### AREA 1: Modelagem e Normalizacao

#### [CRITICO-1] Simulation sem userId — impossivel rastrear quem criou o cenario

**Localizacao:** `prisma/schema.prisma` linha 72-87, `backend/services/simulator/simulator_service.ts` linha 342

O modelo `Simulation` nao tem `userId`. O codigo de persistencia (`persistSimulation`) cria
o registro sem vincular ao usuario autenticado:

```typescript
await prisma.simulation.create({
  data: {
    municipalityId: municipality.id,
    scenarioName: `Simulacao ${result.ibgeCode} — ${new Date()...}`,
    investmentAmount: result.totalAmount,
    investmentType: primaryArea.area,
    // userId: AUSENTE — nao ha como saber quem simulou
  }
})
```

Consequencias:

- Impossivel auditar quem rodou qual cenario
- A rota `GET /simulator/history/:ibgeCode` faz protecao IDOR com `req.user!.municipalityId`
  mas nao tem como mostrar "suas simulacoes" vs "simulacoes de outros usuarios do municipio"
- Quando Organization/multi-tenancy for implementado, sera necessaria migracao de dados

**Schema change necessario:**

```prisma
model Simulation {
  userId    String?   // nullable para nao quebrar dados existentes
  user      User?     @relation(fields: [userId], references: [id])
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  @@index([userId])
  @@index([municipalityId, status])
  @@index([deletedAt])
}
```

**Migration:**

```
Migration: [timestamp]_add_simulation_userid
Up:
  ADD COLUMN "userId" TEXT
  ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
  ADD COLUMN "deletedAt" TIMESTAMP
  ADD COLUMN "errorMessage" TEXT
  CREATE INDEX simulations_userId_idx ON "Simulation"("userId")
  CREATE INDEX simulations_municipalityId_status_idx ON "Simulation"("municipalityId", "status")
  CREATE INDEX simulations_deletedAt_idx ON "Simulation"("deletedAt")
Down:
  DROP COLUMN userId, updatedAt, deletedAt, errorMessage
Notas: userId nullable para compatibilidade com registros existentes.
```

---

#### [CRITICO-2] OdsIndicator sem unique constraint — duplicatas silenciosas

**Localizacao:** `prisma/schema.prisma` linha 31-51

O modelo tem `@@unique([municipalityId, indicatorName, referenceYear])` no SCHEMA ATUAL.
Verificando o SQL da migration `20260331173016_init` — a constraint NAO foi criada na migration:

```sql
-- migration 20260331173016_init — NAO ha UNIQUE em OdsIndicator
CREATE TABLE "OdsIndicator" ( ... )
-- Apenas: OdsIndicator_municipalityId_odsNumber_idx
-- Apenas: OdsIndicator_referenceDate_idx
```

O `@@unique` aparece no schema.prisma atual mas NAO EXISTE no banco de dados.
A migration que deveria ter criado essa constraint nunca foi gerada. O Prisma nao
vai forcar a criacao retroativamente — o banco esta sem a constraint.

Isso significa que cada chamada ao OdsScoreService que persistir indicadores pode
inserir duplicatas para o mesmo `(municipalityId, indicatorName, referenceYear)`.

**Schema change:** O `@@unique` ja esta no schema.prisma — e necessaria uma migration
que crie a constraint no banco, com limpeza previa de duplicatas:

```
Migration: [timestamp]_enforce_odsindicator_unique
Up:
  -- Limpar duplicatas (manter a linha mais recente por createdAt)
  DELETE FROM "OdsIndicator"
  WHERE id NOT IN (
    SELECT DISTINCT ON ("municipalityId", "indicatorName", "referenceYear") id
    FROM "OdsIndicator"
    ORDER BY "municipalityId", "indicatorName", "referenceYear", "createdAt" DESC
  );
  -- Criar a constraint
  CREATE UNIQUE INDEX "OdsIndicator_municipalityId_indicatorName_referenceYear_key"
    ON "OdsIndicator"("municipalityId", "indicatorName", "referenceYear");
Down:
  DROP INDEX "OdsIndicator_municipalityId_indicatorName_referenceYear_key"
Notas: Verificar COUNT(*) de duplicatas antes de aplicar em producao.
```

---

#### [IMPORTANTE-1] User sem soft delete e sem lastLoginAt

**Localizacao:** `prisma/schema.prisma` linha 89-102

O modelo `User` nao tem `deletedAt` nem `lastLoginAt`. No contexto B2G SaaS:

- Secretarios saem do cargo — a conta precisa ser desativada sem perder o historico
  de simulacoes e relatorios gerados por ela
- Hard delete de User quebra a FK de `Simulation.userId` quando for implementada
- `lastLoginAt` e necessario para detectar contas inativas (compliance B2G)

O design v2.0 aprovado previa `deletedAt` e `lastLoginAt` no User.

**Schema change:**

```prisma
model User {
  lastLoginAt DateTime?
  deletedAt   DateTime?
  @@index([deletedAt])
}
```

**Migration:**

```
Migration: [timestamp]_add_user_soft_delete
Up:
  ADD COLUMN "lastLoginAt" TIMESTAMP
  ADD COLUMN "deletedAt" TIMESTAMP
  CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt")
Down:
  DROP COLUMN lastLoginAt, deletedAt
Notas: Totalmente seguro — colunas novas, nullable.
```

---

#### [IMPORTANTE-2] Municipality.state hardcoded como "SC" — sem validacao de UF

**Localizacao:** `prisma/schema.prisma` linha 16, `prisma/migrations/20260331173016_init/migration.sql` linha 7

```sql
"state" TEXT NOT NULL DEFAULT 'SC'
```

O campo `state` aceita qualquer string. Para a fase nacional (5.570 municipios),
dados incorretos de UF (ex: "sc", "Santa Catarina", "SC ") vao quebrar queries de
benchmark e comparacao entre estados. Nao ha CHECK constraint no banco.

Opcoes em ordem de preferencia:

1. CHECK constraint via SQL raw na proxima migration: `CHECK (state ~ '^[A-Z]{2}$')`
2. Validacao Zod no seed/servico (ja parcialmente presente, mas nao cobre insercoes diretas)

**Schema change sugerido (migration raw):**

```
Migration: [timestamp]_add_state_check_constraint
Up:
  ALTER TABLE "Municipality" ADD CONSTRAINT "Municipality_state_check"
    CHECK (state ~ '^[A-Z]{2}$');
Down:
  ALTER TABLE "Municipality" DROP CONSTRAINT "Municipality_state_check";
Notas: Verificar que todos os registros existentes satisfazem o pattern antes de aplicar.
```

---

#### [IMPORTANTE-3] OdsScore.calculatedAt semanticamente diferente de createdAt

**Localizacao:** `prisma/schema.prisma` linha 61, 65

```prisma
calculatedAt DateTime @default(now())
// NAO tem updatedAt
```

`calculatedAt` e usado como `@default(now())` e serve tanto de "quando foi criado"
quanto de "quando foi calculado". No upsert do `ods_history_service.ts`, o update
atualiza `calculatedAt: new Date()` — o que esta correto.

O problema e a ausencia de `createdAt` separado: nao ha como saber quando um score
foi registrado pela primeira vez vs quando foi recalculado. Para compliance e auditoria
de dados publicos, essa distincao importa.

**Schema change:**

```prisma
model OdsScore {
  createdAt    DateTime @default(now())
  calculatedAt DateTime @default(now())  // manter — e o "ultimo calculo"
}
```

**Migration:**

```
Migration: [timestamp]_add_odsscore_createdat
Up:
  ADD COLUMN "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
Down:
  DROP COLUMN "createdAt"
Notas: DEFAULT NOW() preenche retroativamente — aceitavel para dados historicos.
```

---

### AREA 2: Indexes

#### [IMPORTANTE-4] Ausencia de indice composto (state, deletedAt) em Municipality

**Localizacao:** `prisma/schema.prisma` linha 27-28

```prisma
@@index([state])
@@index([deletedAt])
```

A query de listagem de municipios sempre filtra `WHERE state = 'SC' AND deletedAt IS NULL`.
Os dois indices separados forcam o PostgreSQL a escolher um deles ou fazer bitmap scan.
O indice composto `(state, deletedAt)` eliminaria a escolha e seria optimal.

O design v2.0 previa `@@index([state, deletedAt])` explicitamente.

**Schema change:**

```prisma
@@index([state, deletedAt])
// Pode manter os individuais ou remover o de state (deletedAt individual e util para
// queries de soft delete sem filtro de estado)
```

**Migration:**

```
Migration: [timestamp]_add_municipality_state_deletedat_idx
Up:
  CREATE INDEX CONCURRENTLY "Municipality_state_deletedAt_idx"
    ON "Municipality"("state", "deletedAt");
Down:
  DROP INDEX "Municipality_state_deletedAt_idx";
Notas: CONCURRENTLY — sem lock em producao.
```

---

#### [IMPORTANTE-5] Ausencia de indice composto (municipalityId, referenceYear) em OdsIndicator

**Localizacao:** `prisma/schema.prisma` linha 49

O schema tem `@@index([municipalityId, odsNumber])` e `@@index([municipalityId, referenceYear])`.
Verificando a migration `20260331173016_init`:

```sql
CREATE INDEX "OdsIndicator_municipalityId_odsNumber_idx" ON "OdsIndicator"("municipalityId", "odsNumber");
CREATE INDEX "OdsIndicator_referenceDate_idx" ON "OdsIndicator"("referenceDate");
-- NAO existe: OdsIndicator_municipalityId_referenceYear_idx
```

O indice `@@index([municipalityId, referenceYear])` aparece no schema.prisma mas
NAO foi criado pela migration. Mesmo problema da constraint unique de OdsIndicator.

**Migration:**

```
Migration: [timestamp]_add_odsindicator_year_idx
Up:
  CREATE INDEX CONCURRENTLY "OdsIndicator_municipalityId_referenceYear_idx"
    ON "OdsIndicator"("municipalityId", "referenceYear");
Down:
  DROP INDEX "OdsIndicator_municipalityId_referenceYear_idx";
```

---

#### [MELHORIA-1] RefreshToken tem indice redundante em token

**Localizacao:** `prisma/migrations/20260406000000_add_refresh_token/migration.sql` linha 15-17

```sql
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");  -- do @unique
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");          -- adicional
```

O `@unique` ja cria um unique index, que serve como lookup de token. O `@@index([token])`
adicional e redundante — PostgreSQL nao vai usa-lo quando ja existe um unique index
no mesmo campo. Custo: espaco extra em disco e overhead de write para manter dois indices.

**Schema change:**

```prisma
model RefreshToken {
  // Remover @@index([token]) — o @unique ja cobre o lookup
  @@index([userId])  // manter — necessario para revogar todos tokens de um usuario
}
```

**Migration:**

```
Migration: [timestamp]_remove_refreshtoken_redundant_idx
Up:
  DROP INDEX IF EXISTS "RefreshToken_token_idx";
Down:
  CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");
```

---

#### [MELHORIA-2] OdsScore sem indice para ranking nacional

**Localizacao:** `prisma/schema.prisma` linha 68-69

```prisma
@@index([municipalityId, referenceYear])
@@index([municipalityId, calculatedAt])
@@index([odsNumber])
```

A query de ranking nacional (todos os municipios SC ordenados por score de um ODS)
e o benchmark entre grupos: `WHERE odsNumber = ? AND referenceYear = ? ORDER BY score DESC`.

O indice atual `@@index([odsNumber])` cobre o filtro de ODS mas nao o sort por score
nem o filtro de ano. O PostgreSQL vai precisar de sort adicional apos o index scan.

O design v2.0 previa: `@@index([odsNumber, referenceDate, score])` para cobrir essa query.

**Schema change:**

```prisma
@@index([odsNumber, referenceYear, score])
```

**Migration:**

```
Migration: [timestamp]_add_odsscore_ranking_idx
Up:
  CREATE INDEX CONCURRENTLY "OdsScore_odsNumber_referenceYear_score_idx"
    ON "OdsScore"("odsNumber", "referenceYear", score DESC);
Down:
  DROP INDEX "OdsScore_odsNumber_referenceYear_score_idx";
Notas: score DESC alinhado com ORDER BY score DESC da query de ranking.
```

---

### AREA 3: Constraints

#### [CRITICO-3] Schema.prisma diverge das migrations SQL aplicadas

**Localizacao:** Comparando `schema.prisma` com migrations SQL

Foram identificadas **3 divergencias** entre o schema.prisma e o que realmente existe no banco:

| Campo/Index                                                             | schema.prisma       | Migration SQL        | Estado real         |
| ----------------------------------------------------------------------- | ------------------- | -------------------- | ------------------- |
| `OdsIndicator.@@unique([municipalityId, indicatorName, referenceYear])` | Presente            | Ausente em migration | Nao existe no banco |
| `OdsIndicator.@@index([municipalityId, referenceYear])`                 | Presente            | Ausente em migration | Nao existe no banco |
| `Municipality.@@index([name])`                                          | Presente (linha 28) | Ausente em migration | Nao existe no banco |

Estas divergencias surgem quando o schema.prisma e editado manualmente sem gerar
migration com `prisma migrate dev`. O banco de dados nao reflete o schema.prisma.

**Consequencia critica:** `prisma generate` vai passar (gera o client a partir do schema),
`pnpm build` vai passar, mas o banco real nao tem as constraints/indices. Qualquer
desenvolvedor novo que rodar `prisma db pull` vai ver um schema diferente do que esta
no arquivo.

**Acao necessaria:** Gerar migrations para sincronizar banco com schema.prisma.
Executar `prisma migrate diff` para confirmar o diff exato antes de gerar.

---

#### [IMPORTANTE-6] investmentType sem constraint — valores invalidos silenciosos

**Localizacao:** `prisma/schema.prisma` linha 79, `backend/routes/simulator.ts`

O campo `investmentType` aceita qualquer string no banco. O schema anota:

```prisma
investmentType String /// education|health|sanitation|security|environment
```

Mas o `InvestmentAllocationSchema` no router define 8 areas:
`education, health, sanitation, environment, security, energy, urbanization, governance`

O campo `investmentType` recebe apenas a area de maior investimento (primaryArea.area).
Com 8 areas possiveis mas 5 documentadas no schema, ha inconsistencia entre a validacao
do request e os valores validos do campo no banco.

**Schema change:**

```prisma
// Opcao 1: enum Prisma (recomendado)
enum InvestmentArea {
  education
  health
  sanitation
  environment
  security
  energy
  urbanization
  governance
}

model Simulation {
  investmentType InvestmentArea
}

// Opcao 2: CHECK constraint via migration raw
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_investmentType_check"
  CHECK ("investmentType" IN ('education','health','sanitation','environment',
                              'security','energy','urbanization','governance'));
```

---

#### [MELHORIA-3] odsNumber sem CHECK constraint — valores fora de 0-17 possiveis

**Localizacao:** `OdsIndicator.odsNumber`, `OdsScore.odsNumber`

Ambas as tabelas aceitam qualquer inteiro. Um bug no servico de calculo poderia
inserir `odsNumber = 99` e a linha ficaria permanentemente invalida sem deteccao.

**Schema change (migration raw):**

```sql
ALTER TABLE "OdsIndicator" ADD CONSTRAINT "OdsIndicator_odsNumber_check"
  CHECK ("odsNumber" >= 1 AND "odsNumber" <= 17);

ALTER TABLE "OdsScore" ADD CONSTRAINT "OdsScore_odsNumber_check"
  CHECK ("odsNumber" >= 0 AND "odsNumber" <= 17);
  -- OdsScore usa 0 para score global
```

---

### AREA 4: Soft Delete e Timestamps

#### [IMPORTANTE-7] Simulation sem soft delete e sem updatedAt

Ja coberto no CRITICO-1. Resumo:

- `deletedAt` ausente: hard delete quebra historico
- `updatedAt` ausente: impossivel saber quando um cenario foi modificado
- O modelo `Report` equivalente no design v2.0 tem ambos

---

#### [MELHORIA-4] RefreshToken.revokedAt poderia ser renomeado para deletedAt

**Localizacao:** `prisma/schema.prisma` linha 111

`revokedAt` e semanticamente correto para tokens de autenticacao. Nao e um soft delete
padrao — e um campo de dominio. Manter como esta. Registrado apenas para documentar
a decisao explicita de nao usar o padrao `deletedAt` aqui.

---

### AREA 5: Migrations

#### [CRITICO-4] Migration 20260403002310 com nome errado e risco de falha

**Localizacao:** `prisma/migrations/20260403002310_init/migration.sql`

Dois problemas na mesma migration:

**Problema 1 — Nome enganoso:**

```
20260403002310_init
```

Nome `_init` e reservado por convencao para a migration de criacao do schema.
Esta e uma migration de `ALTER TABLE` incremental. O nome confunde auditoria e rollback.
Nao causa falha tecnica mas viola a convencao do projeto.

**Problema 2 — Risco de falha com dados existentes:**

```sql
ALTER TABLE "User" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
```

A migration SQL real usa `DEFAULT ''` — isso e seguro em PostgreSQL 12+.
Porem o erro reportado pela migration indica que o Prisma gerou:

```
"name" TEXT NOT NULL  -- sem DEFAULT na versao original da migration
```

Mas o SQL salvo tem `DEFAULT ''`. Isso sugere que a migration foi editada manualmente
apos geracao — o que e uma pratica perigosa pois quebra a garantia de idempotencia
do `prisma migrate`.

**Acao:** Verificar se o historico do git mostra edicao manual. Se sim, documentar
como ADR o motivo. A migration ja foi aplicada — nao e mais alteravel.

---

#### [MELHORIA-5] Nenhuma migration usa CREATE INDEX CONCURRENTLY

**Localizacao:** Todas as migrations

Todas as migrations criam indices com `CREATE INDEX` simples (bloqueante).
Em producao, criar indices em tabelas com dados requer `ACCESS SHARE LOCK` —
que bloqueia writes por toda a duracao da criacao do indice.

Para os indices atuais com 295 municipios, o impacto e <1 segundo. Ao escalar
para 5.570 municipios com dados historicos, a criacao de um indice em `OdsScore`
(potencialmente 500k linhas) pode levar 5-30 segundos bloqueando writes.

**Recomendacao para todas as futuras migrations de indice:**

```sql
-- Nao aplicar dentro de uma transaction block
CREATE INDEX CONCURRENTLY "nome_idx" ON "Tabela"("campo");
```

O Prisma nao suporta `CONCURRENTLY` diretamente — requer SQL raw via `db.execute`.

---

### AREA 6: Escalabilidade (5.570 municipios)

#### Projecao de volume

| Tabela         | Hoje (295 mun, 1 ano) | Fase 2 (5.570 mun, 5 anos) | Risco                                      |
| -------------- | --------------------- | -------------------------- | ------------------------------------------ |
| municipalities | 295 linhas            | 5.570 linhas               | Zero                                       |
| ods_scores     | ~5.310 linhas         | ~500k linhas               | Medio — adicionar indice de ranking        |
| ods_indicators | ~14k linhas (seed)    | ~1.4M linhas               | Alto — unique constraint e indice faltando |
| simulations    | ~baixo                | ~50k-200k linhas           | Medio — sem indice de status               |
| refresh_tokens | ~baixo                | Proporcional a usuarios    | Baixo — TTL curto                          |
| users          | <100                  | ~15k                       | Zero                                       |

#### Seed nacional

O seed atual executa upserts sequenciais. Para 5.570 municipios, o padrao atual levaria
~20-30 segundos. O design v2.0 recomendou `createMany` com batches de 500.

Nao e um problema de schema — e de implementacao do seed. Registrado aqui por impacto
operacional na expansao.

---

## Resumo de todos os problemas

| #   | Problema                                                       | Severidade | Tipo                 | Migration necessaria? |
| --- | -------------------------------------------------------------- | ---------- | -------------------- | --------------------- |
| C1  | Simulation sem userId                                          | Critico    | Schema + codigo      | Sim                   |
| C2  | OdsIndicator unique no schema mas nao no banco                 | Critico    | Migration faltando   | Sim                   |
| C3  | schema.prisma diverge das migrations (3 itens)                 | Critico    | Migration faltando   | Sim                   |
| C4  | Migration 20260403 nome errado + risco dados                   | Critico    | Documentar/monitorar | Nao (ja aplicada)     |
| I1  | User sem soft delete e lastLoginAt                             | Importante | Schema               | Sim                   |
| I2  | Municipality.state sem CHECK constraint                        | Importante | Constraint           | Sim                   |
| I3  | OdsScore sem createdAt separado                                | Importante | Schema               | Sim                   |
| I4  | Indice composto (state, deletedAt) ausente                     | Importante | Indice               | Sim                   |
| I5  | Indice (municipalityId, referenceYear) ausente em OdsIndicator | Importante | Indice               | Sim                   |
| I6  | investmentType inconsistente (5 vs 8 valores)                  | Importante | Constraint           | Sim                   |
| I7  | Simulation sem soft delete e updatedAt                         | Importante | Schema (parte de C1) | Sim                   |
| M1  | RefreshToken com indice redundante em token                    | Melhoria   | Indice               | Sim                   |
| M2  | OdsScore sem indice de ranking (odsNumber, year, score)        | Melhoria   | Indice               | Sim                   |
| M3  | odsNumber sem CHECK constraint 0-17                            | Melhoria   | Constraint           | Sim                   |
| M4  | Migrations sem CREATE INDEX CONCURRENTLY                       | Melhoria   | Processo             | Sim (futuras)         |

---

## Schema changes necessarios — ordem de execucao

Sequencia segura para producao:

```
Migration A: [timestamp]_fix_schema_drift
  -- Sincroniza banco com schema.prisma (indices faltando)
  CREATE UNIQUE INDEX "OdsIndicator_municipalityId_indicatorName_referenceYear_key"
    (com limpeza de duplicatas antes)
  CREATE INDEX CONCURRENTLY "OdsIndicator_municipalityId_referenceYear_idx"
  CREATE INDEX CONCURRENTLY "Municipality_name_idx"

Migration B: [timestamp]_add_municipality_composite_idx
  CREATE INDEX CONCURRENTLY "Municipality_state_deletedAt_idx"

Migration C: [timestamp]_add_simulation_fields
  ADD COLUMN userId TEXT (nullable)
  ADD COLUMN updatedAt TIMESTAMP DEFAULT NOW()
  ADD COLUMN deletedAt TIMESTAMP
  ADD COLUMN errorMessage TEXT
  CREATE INDEX simulations_userId_idx
  CREATE INDEX simulations_municipalityId_status_idx
  CREATE INDEX simulations_deletedAt_idx

Migration D: [timestamp]_add_user_soft_delete
  ADD COLUMN lastLoginAt TIMESTAMP
  ADD COLUMN deletedAt TIMESTAMP
  CREATE INDEX User_deletedAt_idx

Migration E: [timestamp]_add_odsscore_ranking_idx
  CREATE INDEX CONCURRENTLY "OdsScore_odsNumber_referenceYear_score_idx"
  ADD COLUMN createdAt TIMESTAMP DEFAULT NOW()

Migration F: [timestamp]_add_check_constraints (baixa prioridade)
  CHECK state ~ '^[A-Z]{2}$' em Municipality
  CHECK odsNumber BETWEEN 0 AND 17 em OdsScore
  CHECK odsNumber BETWEEN 1 AND 17 em OdsIndicator
  CHECK investmentType IN (...) em Simulation

Migration G: [timestamp]_remove_refreshtoken_redundant_idx (baixa prioridade)
  DROP INDEX "RefreshToken_token_idx"
```

---

## Prioridade de execucao

### Imediato (antes do proximo deploy)

- C2 + C3 (Migration A): Schema.prisma e banco divergem — e um bug silencioso
- C1 (Migration C): Simulation sem userId vai requerer migracao de dados custosa depois

### Sprint seguinte

- I1 (Migration D): User sem soft delete — necessario antes de implementar RBAC completo
- I4 + I5 (Migrations A e B): Indices faltando — impacto na performance cresce linearmente
- I3 (Migration E): OdsScore sem createdAt — necessario antes de implementar auditoria

### Backlog (antes da expansao nacional)

- I2, I6, M3 (Migration F): Check constraints — seguranca de dados
- M1 (Migration G): Indice redundante — otimizacao de espaco
- M2 (Migration E): Indice de ranking — necessario quando benchmark nacional for feature publica
- M4: Processo — usar CONCURRENTLY em todas as futuras migrations de indice

---

## O que esta correto e nao deve ser alterado

- CUIDs como surrogate key — correto para o dominio
- ibgeCode e siconfiCode como @unique — alinhado com o dominio
- Decimal(15,2) para fpmAnnual — correto para valores financeiros
- Decimal(12,4) para OdsIndicator.value — precisao adequada
- sources String[] em OdsScore — array nativo PostgreSQL, eficiente
- @@unique([municipalityId, odsNumber, referenceYear]) em OdsScore — correto e implementado
- ON DELETE RESTRICT em todas as FKs — correto (soft delete protege a integridade)
- ON DELETE CASCADE em RefreshToken — correto (tokens devem ser deletados com o usuario)
- Soft delete em Municipality — correto para entidade historica
- getScoreHistory com limit: 100 — correto (revisao anterior apontou unbounded, ja corrigido)
- Paginacao em GET /municipalities — correto (revisao anterior apontou ausencia, ja corrigido)
- PrismaClient singleton em backend/lib/prisma.ts — correto (revisao anterior apontou multiplas instancias, ja corrigido)

---

_Documento gerado por database-architect — nenhuma edicao foi feita nos arquivos do projeto._
