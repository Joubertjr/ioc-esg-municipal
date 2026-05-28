# Migração de banco — camada MDO

Aplique após pull com as fases 2 e 3:

```bash
# Com DATABASE_URL configurado em .env
pnpm prisma migrate deploy
pnpm prisma generate
```

## Migrations incluídas

| Migration                         | Conteúdo                       |
| --------------------------------- | ------------------------------ |
| `20260528120000_hitl_audit`       | `HitlRequest`, `AgentAuditLog` |
| `20260528140000_published_report` | `PublishedExecutiveReport`     |

## Verificação rápida

```bash
pnpm exec prisma migrate status
```

## Rollback

Não há rollback automático. Em dev:

```bash
pnpm prisma migrate reset   # apaga dados — só desenvolvimento
```
