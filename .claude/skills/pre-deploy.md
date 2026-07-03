---
name: pre-deploy
description: Pipeline completo de verificação antes de declarar feature concluída. Build Docker + deploy + smoke test de login + evidências.
allowed-tools: Read, Bash(pnpm *), Bash(git *), Bash(docker *), Bash(npx *), Bash(curl *), Bash(bash *)
model: claude-sonnet-4-6
---

# Pre-Deploy — Verificação Completa

## Contexto

Este skill existe porque múltiplas sessões falharam ao declarar features como "prontas" sem verificar que o login e a stack de produção realmente funcionavam. As falhas mais comuns:

1. Frontend intercepta 401 de auth e mostra "Sessão expirada" em vez de erro real
2. Docker build falha com dependências faltando (tsc, prisma)
3. env-validator bloqueia startup por variáveis ausentes ou regras rígidas demais
4. CORS bloqueia requests porque ALLOWED_ORIGINS não confere com a porta do nginx
5. Variáveis de ambiente definidas no .env não chegam ao container

## Pipeline — execute na ordem

### Phase 1: TypeScript e Lint

```bash
pnpm tsc --noEmit
pnpm lint
```

Se falhar: corrija antes de continuar. Não pule.

### Phase 2: Testes

```bash
pnpm test
```

Se falhar: corrija antes de continuar.

### Phase 3: Docker Build

```bash
docker build -t ioc-esg-municipal:$(git rev-parse --short HEAD) -t ioc-esg-municipal:latest .
```

Se falhar: NÃO tente contornar. As causas mais comuns:

- `tsc: not found` → use `pnpm exec tsc` no Dockerfile, não `tsc` direto
- `prisma: not found` → verifique se o estágio de produção instala prisma CLI
- `pnpm install failed` → tente `docker build --no-cache`

### Phase 4: Deploy + Smoke Test

```bash
bash scripts/deploy-and-verify.sh --skip-build
```

Este script faz: deploy da stack → espera healthy → smoke test de login (Playwright) → API tests → CORS check.

Se `--skip-build` falhar por imagem não encontrada, rode sem a flag.

### Phase 5: Verificação manual

Abra http://localhost no browser e confirme:

1. Página de login carrega
2. Senha errada mostra "Credenciais inválidas" (NÃO "Sessão expirada")
3. Login com admin@ioc.local / Admin123! redireciona para /dashboard
4. Dashboard mostra dados do município

### Phase 6: Limpeza

```bash
docker compose -f docker-compose.prod.yml down
```

## Resultado esperado

Reporte exatamente:

```
tsc: OK | lint: OK | tests: OK | docker build: OK | smoke test: OK | login browser: OK
```

Se qualquer item falhar, NÃO declare como concluído. Corrija o problema e recomece do ponto de falha.

## Regra absoluta

**"Funciona no pnpm dev" NÃO é evidência.** A stack de produção usa Docker multi-stage com nginx, env-validator em modo produção, e caminhos de arquivo diferentes. Só o pipeline completo acima é evidência de que funciona.
