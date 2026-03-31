---
name: pre-deploy
description: Checklist completo antes de qualquer deploy. Use antes de subir para staging ou produção.
allowed-tools: Read, Bash(pnpm *), Bash(git *), Bash(docker *)
model: claude-sonnet-4-6
---
# Pre-Deploy Checklist

## Execute cada item e reporte resultado

```bash
# 1. TypeScript sem erros
pnpm tsc --noEmit

# 2. Lint limpo
pnpm lint

# 3. Testes passando
pnpm test

# 4. Build com sucesso
pnpm build

# 5. Sem segredos expostos
grep -r "password\|api_key\|secret\|token" --include="*.ts" backend/ shared/ \
  | grep -v "test\|mock\|example\|env\|\.env"

# 6. .env não commitado
git log --all --full-history -- "**/.env*" | head -5

# 7. Migrations aplicadas
pnpm prisma migrate status

# 8. Docker build
pnpm docker:build 2>&1 | tail -5
```

## Checklist manual
- [ ] `.env.example` atualizado com novas variáveis
- [ ] `docs/PROJECT_STATE.md` atualizado
- [ ] CHANGELOG ou PR summary criado
- [ ] Rollback testado (sei como reverter se der problema)

## Resultado esperado
Todos os itens acima: ✅ PASSA ou justificativa clara de por que não se aplica.
Se qualquer item falhar: não faça deploy até corrigir.
