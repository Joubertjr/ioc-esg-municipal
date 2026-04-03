# Database Architecture Review — IOC ESG Municipal
Revisão: 2026-04-02
Revisor: database-architect agent
Estado do projeto: 601 testes, 14 coletores, 17 ODS, schema v3 (3 migrations)

---

## Sumário executivo

O schema está funcionalmente correto para o estado atual (295 municípios SC). Há
**8 problemas** que precisam ser endereçados antes da expansão para 5.570 municípios:
3 críticos, 3 importantes, 2 melhorias. Nenhum exige reescrita total — todos são
cirúrgicos e implementáveis com migrations seguras.

---

## 1. Análise do Schema (prisma/schema.prisma)

### 1.1 Problemas encontrados

#### CRITICO-1: Múltiplas instâncias de PrismaClient

Três módulos distintos instanciam `new PrismaClient()` independentemente:

```
backend/routes/municipalities.ts  → new PrismaClient()
backend/routes/auth.ts            → new PrismaClient()
backend/services/ods/ods_history_service.ts → new PrismaClient()
```

O Prisma mantém um connection pool por instância. Três instâncias = três pools
concorrentes no mesmo processo Node.js. Em produção isso pode causar:
- Esgotamento do pool de conexões do PostgreSQL (default: 5 conexões por instância)
- Warnings de "too many connections" com uso real
- Memory leaks se as instâncias não forem corretamente finalizadas

**Solução:** Singleton compartilhado em `backend/lib/prisma.ts`.

#### CRITICO-2: OdsIndicator sem unique constraint — crescimento ilimitado

A tabela `OdsIndicator` não tem compound unique key. Cada chamada ao serviço
de scores pode inserir registros duplicados para o mesmo
`(municipalityId, odsNumber, indicatorName, referenceYear)`. O serviço atual
não usa `OdsIndicator` diretamente (os dados ficam apenas em `OdsScore`), mas
se alguém implementar persistência de indicadores individuais, a tabela vai
crescer sem controle.

Projeção com 5.570 municípios sem constraint: potencialmente milhões de
duplicatas silenciosas.

**Solução:** Adicionar `@@unique([municipalityId, indicatorName, referenceYear])`.

#### CRITICO-3: Migration 20260403002310_init com nome errado

A terceira migration chama-se `_init` mas é um `ALTER TABLE` incremental
(adiciona coluna `name` ao `User`). O nome é enganoso para qualquer desenvolvedor
que precisar de rollback ou auditoria. Não causa falha em produção mas viola a
convenção estabelecida e pode confundir o histórico.

---

#### IMPORTANTE-1: `findMany` sem paginação em GET /api/municipalities

```typescript
// backend/routes/municipalities.ts
const municipalities = await prisma.municipality.findMany({
  where: { deletedAt: null },
  orderBy: { name: "asc" },
  select: { ... },
});
```

Com 295 municípios SC, o payload JSON é ~20KB — aceitável. Com 5.570 municípios
nacionais, o payload sobe para ~400KB por requisição, sem cache e sem paginação.
A rota `/api/municipalities` é chamada pelo frontend para popular dropdowns,
o que vai degradar a UX conforme o produto escala.

**Solução:** Adicionar `take`/`skip` com parâmetros `page` e `pageSize`, e um
índice em `name` para suportar o `orderBy`.

#### IMPORTANTE-2: `getScoreHistory` sem limit — retorno ilimitado

```typescript
// backend/services/ods/ods_history_service.ts
return prisma.odsScore.findMany({
  where: {
    municipalityId: municipality.id,
    ...(odsNumber !== undefined ? { odsNumber } : {}),
  },
  orderBy: [{ referenceYear: "desc" }, { odsNumber: "asc" }],
});
```

Sem `take`, retorna todos os anos históricos. Com 5 anos x 18 ODS x 5.570
municípios, a tabela `OdsScore` terá ~500k linhas. Uma query sem limit na
rota `/api/ods/:ibgeCode/history` sem filtro de `odsNumber` pode retornar
18 × N_anos linhas sem controle. Baixo risco hoje, alto risco em 2 anos.

**Solução:** `take: 20` como padrão, parâmetros `limit` e `page` na rota.

#### IMPORTANTE-3: `findFirst` em vez de `findUnique` para ibgeCode

```typescript
// backend/routes/municipalities.ts
const municipality = await prisma.municipality.findFirst({
  where: { ibgeCode, deletedAt: null },
  ...
});
```

`ibgeCode` é `@unique` no schema. `findFirst` é semanticamente errado aqui:
implica "talvez existam vários, pego o primeiro", e força o Prisma a usar
um plano de query ligeiramente diferente de `findUnique`. A correção correta é
usar `findUnique` com `where: { ibgeCode }` e depois filtrar `deletedAt` na
lógica da aplicação, ou usar `findFirst` apenas quando a condição composta
não é coberta por um unique constraint.

**Recomendação:** Substituir por `findUnique` + checar `deletedAt` em código.
Alternativamente, adicionar um índice parcial no PostgreSQL para
`WHERE deletedAt IS NULL`, que vai ser mais eficiente em todo caso.

---

#### MELHORIA-1: Tipo `String` para `status` — sem validação no banco

Os campos `status` em `OdsScore` e `OdsIndicator` aceitam qualquer string.
Os valores válidos são `verde|amarelo|vermelho`. Sem constraint no banco,
dados inválidos podem entrar via seed bugado, script de manutenção ou bug
no serviço de cálculo.

**Opções:**
- Enum Prisma: `enum OdsStatus { verde amarelo vermelho }` — mais seguro, gera CHECK constraint
- CHECK constraint direto no SQL via migration raw
- Validação Zod antes do upsert (já existe na camada de serviço, mas não protege acesso direto ao banco)

Para um campo com apenas 3 valores que não vai mudar, enum Prisma é a melhor opção.

#### MELHORIA-2: `investmentType` sem validação no banco

Similar ao anterior: `Simulation.investmentType` aceita qualquer string mas o
domínio define apenas `education|health|sanitation|security|environment`.
Um enum `InvestmentType` protegeria a integridade sem custo.

---

### 1.2 O que está correto

- Soft delete com `deletedAt` em `Municipality` — correto para entidade principal
- Índice `@@index([deletedAt])` — suporta queries `WHERE deletedAt IS NULL`
- `ibgeCode` e `siconfiCode` como `@unique` — correto e alinhado com o domínio
- `Decimal(15,2)` para `fpmAnnual` — correto para valores financeiros
- `Decimal(12,4)` para indicadores — precisão adequada
- `sources String[]` em `OdsScore` — array nativo PostgreSQL, eficiente
- Compound unique `@@unique([municipalityId, odsNumber, referenceYear])` em `OdsScore` — correto
- Índice `@@index([municipalityId, referenceYear])` em `OdsScore` — cobre a query de histórico
- `User.municipalityId` nullable — correto (admin não tem município)
- `Simulation.targetOds Int[]` — array nativo PostgreSQL adequado para este caso

---

## 2. Análise das Migrations

### Sequência e segurança

| Migration | Operação | Segura? | Reversível? |
|-----------|----------|---------|-------------|
| 20260331173016_init | CREATE TABLE x4 + indexes + FKs | Sim | Sim (DROP TABLE) |
| 20260402120000_add_ods_score | CREATE TABLE OdsScore + indexes + FK | Sim | Sim (DROP TABLE) |
| 20260403002310_init | ALTER TABLE User ADD COLUMN name TEXT NOT NULL | **Parcialmente** | Sim |

#### Problema na migration 20260403002310

```sql
ALTER TABLE "User" ADD COLUMN "name" TEXT NOT NULL;
```

Adicionar uma coluna `NOT NULL` sem `DEFAULT` em uma tabela com dados existentes
é **bloqueante e potencialmente destrutiva** em PostgreSQL com versão < 11.
Em PostgreSQL 11+, se a tabela estiver vazia é segura. Em PostgreSQL 12+,
`ADD COLUMN NOT NULL` com `DEFAULT` constante é instantâneo (sem rewrite).

**Risco real:** Se a tabela `User` tiver linhas antes desta migration ser aplicada
(ex: ambiente de staging ou produção onde houve bootstrap do primeiro admin),
o PostgreSQL vai rejeitar a operação porque `name` não tem `DEFAULT` e as
linhas existentes não podem satisfazer `NOT NULL`.

**Mitigação necessária:** A migration deveria ter sido:
```sql
ALTER TABLE "User" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
-- depois, em uma segunda migration se necessário:
ALTER TABLE "User" ALTER COLUMN "name" DROP DEFAULT;
```

#### FK com ON DELETE RESTRICT

Todas as FKs usam `ON DELETE RESTRICT`. Isso é a escolha correta para o domínio
(não se deletam municípios com dados associados), mas significa que:
- Deletar um `Municipality` que tem `OdsScore` vai falhar
- O soft delete em `Municipality` contorna isso adequadamente
- Não há risco atual

---

## 3. Análise do Seed (prisma/seed.ts)

### 3.1 Idempotência

Correto: o seed usa `upsert` em todos os registros. Execuções repetidas são seguras.
O campo `where` usa a unique key (`ibgeCode` para Municipality,
compound key para OdsScore).

### 3.2 Performance

O seed de municípios executa **295 upserts sequenciais** com `await` dentro de
um `for` loop. Cada upsert é uma transação individual no PostgreSQL.

```typescript
for (const mun of MUNICIPALITIES) {
  await prisma.municipality.upsert({ ... }); // bloqueante, sequencial
}
```

Para 295 municípios isso é aceitável (~1-2 segundos). Para 5.570 municípios
seria ~20-30 segundos de seed com uma única conexão bloqueada.

**Recomendação:** Usar `prisma.$transaction([...])` com batches de 100
ou `createMany` com `skipDuplicates: true` para o seed nacional.

O mesmo problema ocorre no `seedOdsScores`: 20 municípios × 18 scores = 360
upserts sequenciais. Ainda aceitável, mas estruturalmente ineficiente.

### 3.3 Problema de dados — ibgeCode vs nome do município

**BUG CONFIRMADO:** Há 5 discrepâncias entre os ibgeCodes declarados em `TOP_20`
e os nomes na lista `ALL_SC_MUNICIPALITIES`:

| ibgeCode | Nome em TOP_20 | Nome em ALL_SC | Correto? |
|----------|----------------|----------------|----------|
| 4211801 | Mafra | Ouro | Diverge |
| 4211900 | Maravilha | Palhoça | Diverge |
| 4214805 | Palhoça | Rio do Sul | Diverge |
| 4215802 | São José | São Bento do Sul | Diverge |
| 4213609 | Navegantes | Porto União | Diverge |

O `upsert` usa `ibgeCode` como chave. O resultado depende de qual lista está
correta. Como o seed faz `upsert` por `ibgeCode`, o município que existir no
banco vai ter o nome de `ALL_SC_MUNICIPALITIES` (pois ela executa primeiro e o
upsert de `TOP_20` apenas atualiza população/FPM, não o nome).

**Consequência:** Os perfis de score (large/medium/small) de `TOP_20_PROFILES`
estão associados a ibgeCodes que podem corresponder a municípios errados no banco.
Os scores de `Mafra` podem estar sendo atribuídos a `Ouro` no banco.

**Ação requerida:** Verificar os ibgeCodes corretos via IBGE e corrigir `TOP_20`.

### 3.4 Fontes ODS no seed divergem do estado atual do projeto

O `ODS_SOURCES` no seed lista fontes que eram válidas numa versão anterior:

```typescript
5:  ["ibge"],        // ODS 5 — mas o coletor é TSE
7:  ["siconfi"],     // ODS 7 — mas o coletor é ANEEL
9:  ["siconfi", "pncp"], // ODS 9 — mas o coletor adicionou ANATEL
```

O `PROJECT_STATE.md` lista as fontes reais: ODS 5 = TSE, ODS 7 = ANEEL,
ODS 9 = IBGE + ANATEL. O seed não foi atualizado após a adição dos novos
coletores. Isso gera inconsistência entre dados de seed e dados coletados
ao vivo, o que pode confundir análises de dados.

---

## 4. Análise do ODS History Service

### 4.1 Estratégia de upsert

```typescript
const upserts = report.ods.map((ods) =>
  prisma.odsScore.upsert({ ... })
);
await prisma.$transaction(upserts);
```

A estratégia está correta: constrói o array de operações e executa em uma única
transação. Se qualquer upsert falhar, todos fazem rollback. O compound unique
`[municipalityId, odsNumber, referenceYear]` garante que não há duplicatas.

### 4.2 Problema: dois findUnique antes de cada persist

```typescript
const municipality = await prisma.municipality.findUnique({
  where: { ibgeCode },
});
```

Esta query ocorre:
1. Em `calculateAndPersistScores` — busca o município para obter o `id`
2. Em `getScoreHistory` — busca o município para obter o `id`

O `id` do município poderia ser evitado se as queries de `OdsScore` usassem
`ibgeCode` via relação. Mas a estrutura atual (FK para `id` CUID, não para
`ibgeCode`) é padrão e correta — a query de lookup é barata (unique index).

O padrão é aceitável desde que o resultado seja cacheado. O serviço não usa
Redis para este lookup, mas o impacto é baixo (uma query por request via
unique index).

### 4.3 Fire-and-forget em /api/ods/:ibgeCode

```typescript
// ods.ts route
calculateAndPersistScores(ibgeCode).catch((err: unknown) =>
  logger.error("[ods-history] falha ao persistir scores", { ... }),
);
```

O persist ocorre depois de `res.json(report)` — correto para não bloquear
a resposta ao cliente. Porém, se o servidor reiniciar entre a resposta e o
persist, o snapshot se perde. Para o caso de uso atual (histórico best-effort)
é aceitável. Para auditoria regulatória futura pode ser necessário garantir
durabilidade.

---

## 5. Query Patterns — Problemas e Riscos

### 5.1 Mapa completo de queries

| Localização | Query | Problemas |
|-------------|-------|-----------|
| `municipalities.ts:38` | `findMany` sem limit | Unbounded em escala nacional |
| `municipalities.ts:82` | `findFirst` com ibgeCode único | Deveria ser `findUnique` |
| `ods_history_service.ts:102` | `findMany` sem limit | Unbounded em múltiplos anos |
| `ods_history_service.ts:15` | `findUnique` Municipality | Correto |
| `auth_service.ts:85` | `findUnique` por email | Correto |
| `auth_service.ts:95` | `create` User | Correto |
| `auth_service.ts:159` | `count()` Users | Correto, mas executado em cada register |
| `seed.ts` | `upsert` sequencial x295 | Lento para escala nacional |
| `seed.ts` | `upsert` sequencial x360 | Lento para escala nacional |

### 5.2 N+1 identificado no seed

```typescript
for (const ibgeCode of top20IbgeCodes) {
  const municipality = await prisma.municipality.findUnique({ ... }); // N queries
  for (const scoreInput of scores) {
    await prisma.odsScore.upsert({ ... }); // N*18 queries
  }
}
```

No seed isso é tolerável (20 municípios). Se o mesmo padrão for replicado em
um job de atualização em batch (ex: recalcular todos os 295 municípios SC),
o N+1 vai ser problemático.

### 5.3 authService.countUsers() em cada registro

```typescript
const userCount = await authService.countUsers(); // COUNT(*) em cada POST /register
```

A lógica de "primeiro usuário é bootstrap" executa `COUNT(*)` na tabela User
em cada chamada de `/register`. Com índice implícito no PK, é rápido. O risco
real é de race condition: dois requests simultâneos de register podem ambos
ver `count === 0` e criar dois admins. Para o volume esperado (poucos usuários
por município) é aceitável, mas deve ser documentado como limitação conhecida.

---

## 6. Recomendações para Escala a 5.570 Municípios

### 6.1 Índices adicionais necessários

```
Municipality:
  @@index([name])                          — suporta ORDER BY name na listagem
  @@index([state, name])                   — suporta listagem filtrada por estado
  @@index([population])                    — se implementar filtro por porte

OdsIndicator:
  @@unique([municipalityId, indicatorName, referenceYear])  — evita duplicatas
  @@index([municipalityId, referenceYear])  — falta este índice composto

OdsScore:
  — índices atuais são suficientes para escala nacional
```

### 6.2 Particionamento futuro (>2M linhas)

Com 5.570 municípios × 5 anos × 50 indicadores, `OdsIndicator` pode atingir
~1.4M linhas. `OdsScore` fica em ~500k linhas. Estas tabelas não precisam de
particionamento agora, mas se o projeto expandir para séries históricas anuais
longas (>10 anos), considerar `PARTITION BY LIST (referenceYear)` no PostgreSQL.

### 6.3 Seed nacional — usar createMany

Para o seed de 5.570 municípios, substituir o loop sequencial por:

```typescript
// Batch de 500 por vez — evita timeout
const BATCH_SIZE = 500;
for (let i = 0; i < municipalities.length; i += BATCH_SIZE) {
  await prisma.municipality.createMany({
    data: municipalities.slice(i, i + BATCH_SIZE),
    skipDuplicates: true,
  });
}
```

Isso reduz o tempo de seed de ~30s para ~2-3s para 5.570 municípios.

### 6.4 Singleton de PrismaClient

Criar `backend/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env["NODE_ENV"] === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
```

Substituir os 3 `new PrismaClient()` por `import { prisma } from "../lib/prisma.js"`.

### 6.5 Paginação em /api/municipalities

```typescript
router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query["page"] ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query["pageSize"] ?? 50)));

  const [municipalities, total] = await prisma.$transaction([
    prisma.municipality.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { ibgeCode: true, name: true, state: true, population: true },
    }),
    prisma.municipality.count({ where: { deletedAt: null } }),
  ]);

  res.json({ data: municipalities, total, page, pageSize });
});
```

---

## 7. Plano de Migrations Necessárias

### Migration 1: prisma-client-singleton (sem SQL — mudança de código)
Sem migration. Apenas refatoração de código.

### Migration 2: add-municipality-name-index
```
Migration: [timestamp]_add_municipality_name_index
Up:
  - CREATE INDEX "Municipality_name_idx" ON "Municipality"("name")
  - CREATE INDEX "Municipality_state_name_idx" ON "Municipality"("state", "name")
Down (rollback):
  - DROP INDEX "Municipality_name_idx"
  - DROP INDEX "Municipality_state_name_idx"
Notas de segurança:
  - CREATE INDEX CONCURRENTLY em produção para não bloquear writes
  - Reversível sem perda de dados
```

### Migration 3: add-odsindicator-unique-constraint
```
Migration: [timestamp]_add_odsindicator_unique
Up:
  - DELETE FROM "OdsIndicator" WHERE id NOT IN (
      SELECT MIN(id) FROM "OdsIndicator"
      GROUP BY "municipalityId", "indicatorName", "referenceYear"
    )  -- limpa duplicatas antes de criar a constraint
  - CREATE UNIQUE INDEX "OdsIndicator_mun_name_year_key"
      ON "OdsIndicator"("municipalityId", "indicatorName", "referenceYear")
Down (rollback):
  - DROP INDEX "OdsIndicator_mun_name_year_key"
Notas de segurança:
  - A etapa de DELETE é necessária se houver dados existentes
  - Verificar COUNT de duplicatas antes de aplicar em produção
  - Reversível
```

### Migration 4: add-ods-status-enum (opcional, baixa prioridade)
```
Migration: [timestamp]_add_ods_status_enum
Up:
  - CREATE TYPE "OdsStatus" AS ENUM ('verde', 'amarelo', 'vermelho')
  - ALTER TABLE "OdsScore" ALTER COLUMN "status" TYPE "OdsStatus"
      USING "status"::"OdsStatus"
  - ALTER TABLE "OdsIndicator" ALTER COLUMN "status" TYPE "OdsStatus"
      USING "status"::"OdsStatus"
Down (rollback):
  - ALTER TABLE "OdsScore" ALTER COLUMN "status" TYPE TEXT
      USING "status"::TEXT
  - ALTER TABLE "OdsIndicator" ALTER COLUMN "status" TYPE TEXT
      USING "status"::TEXT
  - DROP TYPE "OdsStatus"
Notas de segurança:
  - Verificar que não existem valores fora do enum antes de aplicar
  - Bloqueante (LOCK TABLE) — aplicar em janela de manutenção
  - Reversível
```

### Migration 5: add-odsindicator-referenceYear-index
```
Migration: [timestamp]_add_odsindicator_year_index
Up:
  - CREATE INDEX "OdsIndicator_municipalityId_referenceYear_idx"
      ON "OdsIndicator"("municipalityId", "referenceYear")
Down (rollback):
  - DROP INDEX "OdsIndicator_municipalityId_referenceYear_idx"
Notas de segurança:
  - CREATE INDEX CONCURRENTLY em produção
  - Reversível sem perda de dados
```

---

## 8. Priorização

| # | Issue | Severidade | Esforço | Tipo |
|---|-------|-----------|---------|------|
| 1 | Múltiplas instâncias PrismaClient | Critico | 1h | Refatoração de código |
| 2 | findMany sem paginação em /municipalities | Critico | 2h | Código + migration de índice |
| 3 | ibgeCode/nome divergentes em 5 municípios | Critico | 1h | Correção de dados |
| 4 | findMany sem limit em getScoreHistory | Importante | 1h | Código |
| 5 | findFirst vs findUnique em /municipalities | Importante | 30min | Código |
| 6 | OdsIndicator sem unique constraint | Importante | 2h | Migration |
| 7 | ODS_SOURCES no seed desatualizado | Importante | 30min | Dados |
| 8 | Migration 20260403 com nome errado | Melhoria | — | Documentação |
| 9 | status como String sem validação | Melhoria | 3h | Migration (opcional) |
| 10 | investmentType sem enum | Melhoria | 2h | Migration (opcional) |

**Ação imediata (antes do próximo feature):** Issues 1, 2, 3.
**Sprint seguinte:** Issues 4, 5, 6, 7.
**Backlog:** Issues 8, 9, 10.

---

## 9. Queries de exemplo para os casos de uso principais

### Dashboard do prefeito — carregar scores mais recentes
```sql
SELECT os.*, m.name, m.ibgeCode
FROM "OdsScore" os
JOIN "Municipality" m ON m.id = os."municipalityId"
WHERE m."ibgeCode" = '4204202'
  AND os."referenceYear" = (
    SELECT MAX("referenceYear") FROM "OdsScore" WHERE "municipalityId" = m.id
  )
ORDER BY os."odsNumber" ASC;
-- Usa: index (municipalityId, referenceYear) em OdsScore
```

### Comparativo SC — ranking por ODS 6 (saneamento)
```sql
SELECT m.name, os.score, os.status
FROM "OdsScore" os
JOIN "Municipality" m ON m.id = os."municipalityId"
WHERE m.state = 'SC'
  AND os."odsNumber" = 6
  AND os."referenceYear" = 2023
ORDER BY os.score DESC;
-- Usa: index (odsNumber) em OdsScore + index (state) em Municipality
-- ATENÇÃO: sem limit, retorna 295 linhas — adicionar LIMIT 50 OFFSET ?
```

### Histórico temporal de um ODS
```sql
SELECT "referenceYear", score, status, "calculatedAt"
FROM "OdsScore"
WHERE "municipalityId" = (
  SELECT id FROM "Municipality" WHERE "ibgeCode" = '4204202'
)
  AND "odsNumber" = 3
ORDER BY "referenceYear" DESC
LIMIT 10;
-- Usa: compound unique index como covering index
```

### Listagem paginada de municípios
```sql
SELECT "ibgeCode", name, state, population
FROM "Municipality"
WHERE "deletedAt" IS NULL
ORDER BY name ASC
LIMIT 50 OFFSET 0;
-- FALTA: índice em (name) — adicionar na Migration 2
```

---
