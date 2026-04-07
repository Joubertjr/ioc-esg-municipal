# Guia de Melhores Praticas de Desenvolvimento

# IOC ESG Municipal

> Regras operacionais derivadas do stack aprovado e das decisoes tecnicas do projeto.
> Leia o CLAUDE.md antes deste documento — este guia e complementar, nao substituto.

---

## Sumario

1. [Fluxo de trabalho Git](#1-fluxo-de-trabalho-git)
2. [Code Review](#2-code-review)
3. [Testes](#3-testes)
4. [CI/CD](#4-cicd)
5. [Deploy](#5-deploy)
6. [Seguranca](#6-seguranca)
7. [Performance e Monitoramento](#7-performance-e-monitoramento)
8. [Checklist rapido](#8-checklist-rapido)

---

## 1. Fluxo de trabalho Git

### Branches

```
main        — producao, protegido, so aceita PR aprovado + CI verde
develop     — integracao continua, deploy automatico para staging
feature/*   — nova funcionalidade (ex: feature/ods-simulator)
fix/*       — correcao de bug (ex: fix/siconfi-timeout)
chore/*     — infra, deps, config (ex: chore/upgrade-prisma)
```

**Regra:** nunca commitar diretamente em `main`. Todo trabalho vai via PR.

### Commits

Formato obrigatorio (ver CLAUDE.md):

```
<tipo>(<escopo>): <descricao imperativa em minusculo>
- detalhe do que foi feito
- motivo da decisao
```

Exemplos corretos:

```
feat(siconfi): adiciona retry com backoff exponencial no coletor FPM
- 3 tentativas: 1s, 2s, 4s
- DATASUS e SICONFI caem frequentemente em horario comercial

fix(auth): corrige TypeError em URL parse no middleware CSRF
- new URL(referer) lanca em referer invalido
- try/catch retorna 403 com mensagem clara
```

Exemplos **errados** (nunca usar):

```
fix bug
update
changes
wip
temp
```

### Commits atomicos

Um commit = uma alteracao logica. Nao misture refatoracao com nova feature no mesmo commit. Se precisar, use `git add -p` para stagear parcialmente.

---

## 2. Code Review

### Antes de abrir PR

```bash
pnpm tsc --noEmit          # zero erros TypeScript
pnpm lint                  # zero warnings ESLint
pnpm test:unit             # todos passando
pnpm test:integration      # todos passando
pnpm build                 # build sem erro
```

Se qualquer um falhar, o PR nao deve ser aberto.

### Tamanho de PR

- **Ideal:** menos de 400 linhas alteradas
- **Aceitavel:** ate 800 linhas para features completas (backend + frontend + testes)
- **Exige justificativa:** acima de 800 linhas — quebrar em PRs menores se possivel

### O que revisar (checklist do revisor)

**TypeScript**

- [ ] Zero `any` — use `unknown` + type guards ou tipos especificos
- [ ] Interfaces de dominio usadas corretamente (`Municipio`, `ODS`, `Indicador`, `Simulacao`)
- [ ] Respostas de APIs externas validadas com Zod antes de usar

**APIs governamentais**

- [ ] Cache Redis implementado com TTL correto por fonte (ver tabela no CLAUDE.md)
- [ ] Retry com backoff exponencial: 3 tentativas, delays 1s/2s/4s
- [ ] Rate limiting respeitado: maximo 2 req/s para APIs governamentais
- [ ] Codigo IBGE (7 digitos) convertido corretamente para SICONFI (6 digitos sem verificador)

**Seguranca**

- [ ] Nenhuma credencial hardcoded
- [ ] Nenhum dado pessoal em logs (apenas dados agregados por municipio)
- [ ] Validacao Zod em toda rota antes de processar
- [ ] Endpoints novos tem `authenticateToken` + `requireRole` se dados sensiveis

**Testes**

- [ ] Testes escritos para funcionalidade nova
- [ ] Casos de erro cobertos (nao so happy path)
- [ ] Mocks corretos — nao mockar logica de negocio, apenas I/O externo

**Banco de dados**

- [ ] Migrations via `prisma migrate dev` — nunca SQL manual
- [ ] Indices em: `municipality_id`, `ods_number`, `reference_date`
- [ ] Soft delete em entidades principais (`deletedAt`)

### Labels de review

Use as labels do PR para comunicar prioridade:

- **Bloqueador** — impede merge, deve ser corrigido
- **Importante** — deve ser discutido antes do merge
- **Sugestao** — melhoria opcional, nao bloqueia

### Aprovacao e merge

- Minimo 1 aprovacao de outro developer
- CI deve estar verde (tsc + lint + tests + build)
- Squash merge para `main` (historico limpo)
- Merge commit para `develop` (preserva contexto de feature)

---

## 3. Testes

### Estrutura de testes

```
tests/
  unit/
    agents/        # um arquivo por coletor (ex: ibge_collector.test.ts)
    middleware/    # auth, error-handler, rate-limit, request-id, request-logger
    routes/        # um arquivo por router
    services/      # ods-score, simulator, reports, benchmarks, auth
  integration/    # health, auth, ods, municipalities, benchmarks, simulator, reports
  e2e/            # Playwright: auth, navigation, dashboard, simulator
```

### Regras por tipo

**Unit tests (Vitest)**

- Mockar apenas I/O externo: Redis, Prisma, chamadas HTTP (axios/fetch)
- Nao mockar logica de negocio propria
- Um describe por funcao/metodo testado
- Nomes descritivos: `it('retorna score 0 quando indicador esta ausente')`

```typescript
// Correto — mocka apenas o Redis
vi.mock("../../../backend/lib/redis", () => ({
  redis: { get: vi.fn(), setex: vi.fn() },
}));

// Errado — mocka a logica de negocio que deveria ser testada
vi.mock("../../../backend/services/ods/ods_score_service");
```

**Integration tests**

- Usam banco PostgreSQL e Redis reais (provisionados no CI via services)
- Rodam apos `prisma migrate deploy`
- Nao dependem de ordem de execucao — cada teste limpa seus dados

**E2E (Playwright)**

- Rodam contra servidor real (backend + frontend em preview)
- Especificados em `tests/e2e/` com extensao `.spec.ts`
- `PLAYWRIGHT_SKIP_WEBSERVER=1` quando servidores ja estao rodando

### Rodar testes em batches (workaround SIGSEGV)

O Vitest tem um crash de memoria com 41+ arquivos simultaneos. Use:

```bash
# Unit agents (14 arquivos)
pnpm vitest run tests/unit/agents/

# Unit middleware + routes
pnpm vitest run tests/unit/middleware/ tests/unit/routes/

# Unit services
pnpm vitest run tests/unit/services/

# Integration
DATABASE_URL=postgresql://... REDIS_URL=redis://... pnpm vitest run tests/integration/
```

No CI, os jobs ja rodam em steps separados — o problema nao afeta o pipeline.

### Cobertura minima

- Novos coletores de API: minimo 10 testes (happy path + erros + cache hit/miss + retry)
- Novos servicos: minimo 5 testes (calculo correto + edge cases)
- Novas rotas: minimo 3 testes (sucesso + autenticacao + validacao de input)

---

## 4. CI/CD

### Workflows ativos

| Workflow          | Arquivo                       | Trigger                   | O que faz                                     |
| ----------------- | ----------------------------- | ------------------------- | --------------------------------------------- |
| CI/CD principal   | `main.yml`                    | push/PR em main e develop | tsc + lint + unit + integration + e2e + build |
| Docker build      | `docker-build.yml`            | push em main              | build imagem multi-stage, push para GHCR      |
| PR review         | `main.yml` (claude-pr-review) | PR aberto                 | revisao automatica com Claude Code            |
| Briefing diario   | `main.yml` (daily-briefing)   | 9h UTC seg-sex            | relatorio de progresso                        |
| Health check APIs | `main.yml` (api-health)       | 13h UTC diario            | verifica IBGE, SICONFI, PNCP                  |
| Security audit    | `main.yml` (security-audit)   | segunda 10h UTC           | pnpm audit + grep credenciais                 |

### Secrets necessarios no GitHub

```
ANTHROPIC_API_KEY    # para jobs com Claude Code Action
JWT_SECRET           # fallback de CI (nao usar em prod)
```

O `GITHUB_TOKEN` e automatico — nao precisa configurar.

### Ordem de execucao no CI

```
push para main
  └── ci (tsc + lint + unit + integration + build)
      └── e2e (necessita ci)
  └── docker-build (roda em paralelo com ci — PROBLEMA CONHECIDO)
```

**Atencao:** o `docker-build.yml` nao tem `needs: [ci]`. A imagem pode ser publicada mesmo com ci falhando se ambos rodarem em paralelo. Ate essa dependencia ser adicionada, monitore manualmente.

### Adicionar dependencia no docker-build (pendente)

```yaml
# Em .github/workflows/docker-build.yml, adicionar:
jobs:
  build-and-push:
    needs: [ci] # <-- adicionar esta linha
```

### Cache de dependencias no CI

O cache de pnpm e gerenciado pelo `actions/setup-node` com `cache: 'pnpm'`. Nao adicionar passos extras de cache — o setup-node ja otimiza.

### Variaveis de ambiente no CI

- Secrets de producao: nunca no codigo, sempre em `Settings > Secrets and variables`
- Valores de teste: podem ir direto no `env:` do step (ex: `DATABASE_URL: postgresql://test:test@localhost:5432/ioc_esg_test`)
- `JWT_SECRET` no CI usa fallback hardcoded com aviso — aceitavel so em ambiente de teste

---

## 5. Deploy

### Pipeline de deploy

```
1. Abrir PR na branch main
2. CI verde (tsc + lint + unit + integration + e2e + build)
3. Revisao aprovada (1+ aprovacao)
4. Merge com squash
5. docker-build.yml publica imagem com tag = SHA curto do commit
6. Deploy manual no servidor:
   IMAGE_TAG=<sha> docker compose -f docker-compose.prod.yml up -d
```

### Antes de fazer deploy em producao

```bash
# 1. Verificar que a imagem foi publicada com sucesso
# GitHub Actions > docker-build > Image digest summary

# 2. No servidor, puxar a nova imagem
docker pull ghcr.io/seu-org/ioc-esg-municipal:<sha>

# 3. Rodar migracao ANTES de subir o container (pendente automacao)
docker run --rm \
  --env-file .env \
  ghcr.io/seu-org/ioc-esg-municipal:<sha> \
  node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.\$connect().then(() => p.\$disconnect())"

# Alternativa mais segura: rodar migrate deploy explicitamente
docker run --rm \
  --env-file .env \
  --entrypoint "" \
  ghcr.io/seu-org/ioc-esg-municipal:<sha> \
  npx prisma migrate deploy

# 4. Subir nova versao
IMAGE_TAG=<sha> docker compose -f docker-compose.prod.yml up -d

# 5. Verificar health
curl http://localhost:3000/health
```

### Rollback

```bash
# Subir a versao anterior (SHA do commit anterior)
IMAGE_TAG=<sha-anterior> docker compose -f docker-compose.prod.yml up -d

# Verificar health
curl http://localhost:3000/health
```

Se o rollback envolver migracao de banco, consulte o historico do Prisma:

```bash
# Ver historico de migrations aplicadas
docker exec ioc_postgres_prod psql -U $DATABASE_USER -d $DATABASE_NAME \
  -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"
```

### Configuracao de ambiente

Copie `.env.production.example` para `.env` no servidor e preencha:

| Variavel            | Como gerar             | Observacao                                         |
| ------------------- | ---------------------- | -------------------------------------------------- |
| `JWT_SECRET`        | `openssl rand -hex 32` | Minimo 32 chars                                    |
| `REDIS_PASSWORD`    | `openssl rand -hex 16` | Minimo 16 chars                                    |
| `DATABASE_PASSWORD` | Senha forte escolhida  | Mantenha igual em DATABASE_URL e DATABASE_PASSWORD |
| `REGISTRY`          | `ghcr.io/seu-org`      | Seu GitHub Org                                     |
| `ALLOWED_ORIGINS`   | URL do frontend        | Sem barra final                                    |

### Verificar depois do deploy

```bash
# Health check da API
curl http://localhost:3000/health

# Verificar containers rodando
docker compose -f docker-compose.prod.yml ps

# Verificar logs recentes
docker compose -f docker-compose.prod.yml logs api --tail=50

# Verificar conexao com banco
docker compose -f docker-compose.prod.yml exec postgres \
  pg_isready -U $DATABASE_USER -d $DATABASE_NAME
```

---

## 6. Seguranca

### Regras absolutas

- Nunca commitar `.env`, senhas, tokens ou chaves de API
- Nunca logar dados pessoais (CPF, nome de pessoa fisica) — apenas dados agregados por municipio
- Nunca usar `any` em TypeScript — use `unknown` + type guards
- Nunca chamar API externa sem cache Redis + retry

### Validacao de entrada

Toda rota Express deve validar entrada com Zod antes de processar:

```typescript
// Correto
const schema = z.object({
  ibgeCode: z.string().regex(/^\d{7}$/, "Codigo IBGE deve ter 7 digitos"),
  amount: z.number().positive(),
});

const parsed = schema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ error: parsed.error.issues });
}
```

### Autenticacao e autorizacao

- Rotas com dados de municipio especifico: `authenticateToken`
- Operacoes administrativas (batch, seed): `requireRole('admin')`
- Dados de secretario: `requireRole('admin', 'secretario')`
- Rota `/health` e `/api/docs`: publica (sem auth)

### Cache Redis com TTL

```typescript
// TTLs por fonte (obrigatorio)
const TTL = {
  IBGE: 86400, // 24h
  SICONFI: 21600, // 6h
  DATASUS: 43200, // 12h
  INEP: 604800, // 7 dias
  SNIS: 604800, // 7 dias
  INPE: 86400, // 24h
  PNCP: 3600, // 1h
};
```

### Auditoria de seguranca semanal

O job `security-audit` roda toda segunda automaticamente. Monitore issues criadas com label `security`. CVEs com severidade alta/critica devem ser resolvidos na semana.

---

## 7. Performance e Monitoramento

### Redis

- Todos os coletores usam `withCache(key, ttl, fn)` — nunca chamar API gov sem cache
- Em producao: `maxmemory 256mb` + `maxmemory-policy allkeys-lru` (configurado no compose)
- Chaves de cache: `{fonte}:{ibgeCode}:{ano}` (ex: `ibge:4204202:2024`)

### Banco de dados

- Usar `PrismaClient` singleton — nao instanciar multiplas conexoes
- Indices obrigatorios: `municipality_id`, `ods_number`, `reference_date`
- Usar `select` explicito — evitar `findMany` sem campos especificados em queries grandes
- Connection pooling via Prisma (nao configurar pool manualmente)

### APIs governamentais

- Rate limiting: maximo 2 req/s por API governamental
- Timeout: 30s para DATASUS (instavel), 10s para demais
- Retry: 3 tentativas com backoff 1s/2s/4s
- Nunca chamar em paralelo mais de 5 APIs simultaneamente por request

### Health check

O endpoint `GET /health` retorna:

```json
{
  "status": "ok",
  "timestamp": "2026-04-06T10:00:00.000Z",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

Monitore este endpoint com frequencia minima de 1 verificacao por minuto em producao.

### Logs

- Nivel `info` em producao — nunca `debug` (volume excessivo)
- Logs estruturados via Winston (JSON em producao)
- Request ID (UUID) em todos os logs do request — usar `req.id`
- Nunca usar `console.log` fora de scripts de desenvolvimento

---

## 8. Checklist rapido

### Antes de commitar

- [ ] `pnpm tsc --noEmit` — zero erros
- [ ] `pnpm lint` — zero warnings
- [ ] Sem `console.log` no codigo de producao
- [ ] Sem credenciais hardcoded
- [ ] Sem `any` em TypeScript

### Antes de abrir PR

- [ ] `pnpm test:unit` — passando
- [ ] `pnpm test:integration` — passando
- [ ] `pnpm build` — sem erros
- [ ] Testes escritos para funcionalidade nova
- [ ] `.env.production.example` atualizado se novas variaveis foram adicionadas

### Antes de fazer deploy

- [ ] CI verde no GitHub Actions (tsc + lint + tests + build)
- [ ] Imagem Docker publicada com sucesso
- [ ] `prisma migrate deploy` rodado no servidor antes de subir container
- [ ] `.env` no servidor tem todos os valores preenchidos
- [ ] Backup do banco feito (se migracao destrutiva)
- [ ] Rollback planejado (SHA da versao anterior anotado)

### Apos deploy

- [ ] `curl http://localhost:3000/health` retorna `{"status":"ok"}`
- [ ] Logs sem erros criticos nos primeiros 5 minutos
- [ ] Containers todos em status `healthy` no `docker compose ps`

---

_Ultima atualizacao: 2026-04-06_
_Versao do projeto: ver `docs/PROJECT_STATE.md`_
