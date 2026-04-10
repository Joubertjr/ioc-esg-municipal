---
scope: global
applies_to: backend
---

# Database — Regras de Schema e Migrations

> Aplicar em toda interação com o banco de dados: schema Prisma, queries e migrations.

## Regras

### Migrations

- Usar **exclusivamente** `prisma migrate dev` para alterar o schema — nunca editar SQL manualmente
- Nunca executar `prisma db push` em produção — apenas em desenvolvimento local para prototipagem rápida
- Toda migration recebe nome descritivo: `prisma migrate dev --name add_ods_score_index`
- Antes de rodar migration em produção, revisar o SQL gerado em `prisma/migrations/`

### Soft delete

- Entidades principais (`Municipality`, `OdsScore`, `Simulation`, `Report`) usam soft delete
- Campo padrão: `deletedAt DateTime?` — registros com `deletedAt != null` são considerados deletados
- Todas as queries de leitura incluem filtro `WHERE deletedAt IS NULL` (via Prisma middleware global)

### Índices obrigatórios

- Todo modelo que referencia município deve ter índice em `municipalityId`
- Modelos com dados históricos indexam `referenceDate` (tipo `DateTime`)
- Modelo `OdsScore`: índice composto em `(municipalityId, odsNumber, referenceDate)`
- Validar índices com `EXPLAIN ANALYZE` antes de produção para queries frequentes

### Tratamento de erros Prisma

- Sempre capturar e tratar `PrismaClientKnownRequestError` explicitamente
- Códigos mais relevantes:
  - `P2002`: unique constraint violation → retornar 409 Conflict
  - `P2025`: registro não encontrado → retornar 404 Not Found
  - `P2003`: foreign key constraint → retornar 400 Bad Request com detalhe
- Nunca expor `meta` do erro Prisma na resposta HTTP (vaza estrutura do schema)

### Convenções de schema

- Nomes de modelos em PascalCase singular: `Municipality`, não `municipalities`
- Campos em camelCase, colunas mapeadas com `@map("snake_case")` quando necessário
- IDs usam CUID2 (`@default(cuid())`) — nunca auto-increment sequencial em produção
- Campos monetários como `Decimal` no schema (`@db.Decimal(15, 2)`)
