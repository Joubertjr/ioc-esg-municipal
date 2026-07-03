# Verificação de Produção — Regras Inegociáveis

> Aplicar SEMPRE antes de declarar qualquer feature como concluída.

## Regra #1: Testar login end-to-end em Docker

Nenhuma feature é "pronta" até que o login funcione na stack de produção Docker.

- Rodar `bash scripts/deploy-and-verify.sh` ou, no mínimo, `npx tsx scripts/smoke-test-login.ts`
- O smoke test verifica: página carrega, senha errada mostra erro correto, login correto redireciona

## Regra #2: "Funciona em dev" ≠ "Funciona em produção"

A stack dev (`pnpm dev`) e a stack de produção (`docker-compose.prod.yml`) diferem em:

| Aspecto   | Dev                            | Produção                         |
| --------- | ------------------------------ | -------------------------------- |
| Backend   | Node direto com HMR            | Imagem Docker multi-stage        |
| Frontend  | Vite dev server :5173          | Build estático via nginx :80     |
| CORS      | ALLOWED_ORIGINS=localhost:5173 | Precisa incluir localhost:80     |
| ENV       | .env carregado por dotenv      | Variáveis do compose environment |
| Prisma    | pnpm prisma funciona           | Precisa npm/npx (sem corepack)   |
| Validação | baseSchema (leniente)          | productionRefinements (strict)   |

## Regra #3: Variáveis de ambiente no compose

Toda variável usada pelo backend DEVE estar listada no `environment:` do serviço `api` em `docker-compose.prod.yml`.

Armadilha: `.env` do host NÃO é passado automaticamente para dentro do container. A variável deve aparecer explicitamente como `VAR: ${VAR:-default}`.

## Regra #4: Defaults seguros

Toda variável em `docker-compose.prod.yml` DEVE ter um default funcional (`${VAR:-default}`).

NUNCA usar `${VAR:?error}` (required) para variáveis não-críticas — isso bloqueia `docker compose` inteiro se uma variável faltar.

## Regra #5: ALLOWED_ORIGINS deve incluir porta do nginx

Se o frontend é servido via nginx na porta 80, ALLOWED_ORIGINS deve incluir `http://localhost` e `http://localhost:80`. Se for porta 5173 (dev), deve incluir `http://localhost:5173`.

## Regra #6: Auth endpoints não interceptam refresh

O `fetchWithRefresh` do frontend NÃO deve tentar refresh token em endpoints de auth (`/api/auth/login`, `/api/auth/register`). Um 401 nesses endpoints significa "credenciais inválidas", não "sessão expirada".

Se alguém modificar `frontend/src/lib/api.ts`, verificar que `AUTH_PATHS` ainda exclui esses endpoints.

## Pipeline de verificação

```bash
# Opção A: pipeline completo (build + deploy + test)
bash scripts/deploy-and-verify.sh

# Opção B: só smoke test (se a stack já está de pé)
bash scripts/deploy-and-verify.sh --test-only

# Opção C: skill do Claude Code
/pre-deploy
```

## Lições aprendidas (anti-patterns)

1. **Nunca silenciar env-validator** — se ele bloqueia startup, corrija a variável, não delete a validação
2. **Nunca usar `tsc` direto no Dockerfile** — use `pnpm exec tsc` (resolve o binário corretamente)
3. **Nunca assumir que pnpm existe no production stage** — use npm/npx (Node built-in)
4. **Nunca declarar feature pronta com "testes passam"** — testes unitários não testam a stack real
5. **Nunca esquecer CORS** — se nginx serve na porta X, ALLOWED_ORIGINS precisa incluir porta X
