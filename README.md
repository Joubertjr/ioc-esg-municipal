# IOC ESG Municipal

Plataforma SaaS B2G que ajuda prefeitos brasileiros a investir FPM com impacto mensurável nos 17 Objetivos de Desenvolvimento Sustentável (ODS) da ONU, eliminando o desperdício estimado de R$20–40 bilhões anuais.

![Tests](https://img.shields.io/badge/tests-641%20passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Funcionalidades

- **17 ODS cobertos** — scores 0-100 calculados a partir de indicadores públicos reais
- **14 coletores** — IBGE, SICONFI, DATASUS, INEP, SNIS, INPE, PNCP, TSE, ANEEL, SNIS-RS, ANA, Convenios, ANATEL, SISVAN
- **Simulador FPM** — projeta impacto de alocação de investimento nos ODS
- **Relatórios ESG** — relatório executivo com recomendações priorizadas
- **Benchmarks** — comparativo entre municípios de SC, ranking e médias
- **Histórico de scores** — persistência automática a cada consulta
- **RBAC completo** — roles `admin`, `prefeito`, `secretario`
- **API documentada** — Swagger UI em `/api/docs`

---

## Pré-requisitos

- Node.js >= 18.0.0
- pnpm >= 8.15.0
- Docker + Docker Compose

---

## Quick Start (desenvolvimento)

```bash
git clone <repo>
cd ioc-esg-municipal
cp .env.example .env
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

| Serviço | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| Frontend | http://localhost:5173 |
| Swagger UI | http://localhost:3000/api/docs |
| Adminer (banco) | http://localhost:8080 |

---

## Deploy em Produção

### 1. Build da imagem

```bash
docker build -t ioc-esg-municipal:latest .
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.production.example .env
# Edite .env com valores reais — veja seção Variáveis de Ambiente abaixo
```

### 3. Subir a stack

```bash
IMAGE_TAG=latest docker compose -f docker-compose.prod.yml up -d
```

### 4. Migrations e seed

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec api npx tsx prisma/seed.ts
```

**Diferenças em relação ao ambiente de desenvolvimento:**
- Sem Adminer (exposto apenas em localhost em dev)
- Redis com senha obrigatória e persistência AOF (`appendonly yes`)
- API usa imagem pré-construída (sem bind mount de código-fonte)
- Resource limits em todos os serviços (CPU e memória)
- Logging `json-file` com rotação automática
- `restart: unless-stopped` em todos os serviços

---

## Scripts

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Backend (3000) + frontend (5173) em modo watch |
| `pnpm build` | Build de produção (backend + frontend) |
| `pnpm start` | Inicia o build de produção |
| `pnpm test` | Unit + integration tests (em sequência) |
| `pnpm test:unit` | Apenas testes unitários |
| `pnpm test:integration` | Apenas testes de integração |
| `pnpm test:e2e` | Testes E2E com Playwright |
| `pnpm test:watch` | Watch mode |
| `pnpm lint` | ESLint em todos os arquivos .ts/.tsx |
| `pnpm format` | Prettier em todo o projeto |
| `pnpm db:migrate` | Executa migrations Prisma |
| `pnpm db:seed` | Seed dos 295 municípios de SC |
| `pnpm db:studio` | Abre o Prisma Studio |
| `pnpm docker:up` | Sobe PostgreSQL + Redis + Adminer |
| `pnpm docker:down` | Para todos os containers |
| `pnpm docker:logs` | Acompanha logs dos containers |

---

## Testes

```bash
# Unit + integration (641 testes) — rodados em sequência para evitar problema de memória
pnpm test

# Apenas unit tests (562+ testes em 32 arquivos)
pnpm test:unit

# Apenas integration tests (79 testes em 7 arquivos)
# Requer PostgreSQL e Redis rodando: pnpm docker:up
pnpm test:integration

# Watch mode
pnpm test:watch

# Cobertura de código
pnpm test:coverage

# E2E com Playwright (requer backend + frontend rodando)
pnpm test:e2e
```

**Nota:** O Vitest pode travar com SIGSEGV ao rodar todos os 35+ arquivos em um único processo (problema de memória do Node.js). Use `pnpm test` que roda unit e integration em processos separados — todos os testes passam.

---

## Variáveis de Ambiente

Para desenvolvimento, copie `.env.example` para `.env`.
Para produção, copie `.env.production.example` para `.env` no servidor.

| Variável | Descrição | Padrão dev |
|----------|-----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://postgres:postgres@localhost:5432/ioc_esg_municipal` |
| `DATABASE_USER` | Usuário do banco | `postgres` |
| `DATABASE_PASSWORD` | Senha do banco | `postgres` |
| `DATABASE_NAME` | Nome do banco | `ioc_esg_municipal` |
| `NODE_ENV` | Ambiente (`development`/`production`) | `development` |
| `PORT` | Porta do backend | `3000` |
| `ALLOWED_ORIGINS` | Origens CORS (separar por vírgula) | `http://localhost:5173` |
| `VITE_API_URL` | URL base da API (frontend) | `http://localhost:3000/api` |
| `JWT_SECRET` | Segredo JWT (mín. 32 chars em produção) | `troque-por-chave-segura` |
| `JWT_EXPIRATION` | Expiração do token | `1d` |
| `REDIS_URL` | URL do Redis | `redis://localhost:6379` |
| `REDIS_PASSWORD` | Senha Redis (obrigatório em produção) | vazio em dev |
| `IBGE_API_URL` | URL da API IBGE | `https://servicodados.ibge.gov.br/api/v1` |
| `SICONFI_API_URL` | URL da API SICONFI | `https://api.siconfi.tesouro.gov.br/v1` |
| `DATASUS_API_URL` | URL base do DATASUS | `https://datasus.saude.gov.br` |
| `INPE_API_URL` | URL da API TerraBrasilis/INPE | `https://terrabrasilis.dpi.inpe.br/api/v1` |
| `PNCP_API_URL` | URL da API PNCP | `https://pncp.gov.br/api/pncp/v1` |
| `AGENT_TIMEOUT` | Timeout dos coletores (ms) | `30000` |
| `AGENT_RETRY_COUNT` | Número de tentativas de retry | `3` |
| `AGENT_RETRY_DELAY` | Delay inicial de retry (ms) | `1000` |
| `LOG_LEVEL` | Nível de log Winston | `info` |

**Requisitos em produção:** `JWT_SECRET` mínimo 32 caracteres (não pode ser placeholder), `REDIS_PASSWORD` obrigatório, `ALLOWED_ORIGINS` não pode conter `localhost`. O env-validator valida esses critérios no startup e aborta se não atendidos.

Gere segredos com: `openssl rand -hex 32`

---

## Rotas da API

Documentação interativa completa disponível em `/api/docs` (Swagger UI) com todos os schemas de request/response e exemplos.

| Rota | Método | Descrição | Auth | Role |
|------|--------|-----------|------|------|
| `/api/auth/register` | POST | Registro (1º usuário = bootstrap sem auth) | Não* | — |
| `/api/auth/login` | POST | Login, retorna JWT | Não | — |
| `/api/auth/me` | GET | Dados do usuário autenticado | Sim | qualquer |
| `/api/ods/:ibgeCode` | GET | Scores ODS (0-100) do município (cache 1h) | Sim | qualquer |
| `/api/ods/compare` | POST | Compara ODS entre municípios | Sim | qualquer |
| `/api/ods/:ibgeCode/history` | GET | Histórico de scores ODS | Sim | qualquer |
| `/api/simulator/simulate` | POST | Simulação de investimento FPM | Sim | qualquer |
| `/api/simulator/compare` | POST | Compara cenários de simulação | Sim | qualquer |
| `/api/reports/:ibgeCode` | GET | Relatório ESG executivo completo | Sim | qualquer |
| `/api/benchmarks` | POST | Benchmark entre municípios | Sim | qualquer |
| `/api/benchmarks/compare` | POST | Compara município vs grupo | Sim | qualquer |
| `/api/municipalities` | GET | Lista municípios (paginado) | Sim | qualquer |
| `/api/municipalities/:ibgeCode` | GET | Detalhe de um município | Sim | qualquer |
| `/api/agents/:source/:ibgeCode` | GET | Dados brutos de um coletor | Sim | qualquer |
| `/api/agents/batch/:ibgeCode` | POST | Coleta batch de município | Sim | admin |
| `/api/docs` | GET | Swagger UI + OpenAPI spec | Não | — |
| `/health` | GET | Health check | Não | — |

---

## Coletores de Dados

14 coletores de APIs públicas governamentais. Todos implementam cache Redis, retry com backoff exponencial (1s, 2s, 4s) e timeout configurável via `AGENT_TIMEOUT`.

| Coletor | Fonte | ODS | Principais indicadores |
|---------|-------|-----|----------------------|
| IBGE | servicodados.ibge.gov.br/api/v1 | 1, 2, 8, 9, 10, 11 | pct_baixa_renda, taxa_ocupacao, coeficiente_gini, pib_per_capita |
| SICONFI | api.siconfi.tesouro.gov.br/v1 | 3, 4, 11, 16, 17 | despesa_saude, despesa_educacao, equilibrio_fiscal, dependencia_FPM |
| DATASUS | datasus.saude.gov.br | 3 | previne_prenatal, previne_diabetes, previne_hipertensao |
| INEP | inep.gov.br (download) | 4 | ideb_anos_iniciais, ideb_anos_finais |
| SNIS | snis.gov.br (download) | 6 | atendimento_agua, atendimento_esgoto, esgoto_tratado |
| INPE | terrabrasilis.dpi.inpe.br/api/v1 | 13, 15 | desmatamento_anual, desmatamento_acumulado |
| PNCP | pncp.gov.br/api/pncp/v1 | 16 | total_contratacoes, percentual_dispensas, taxa_homologacao |
| TSE | dados.tse.jus.br | 5 | pct_mulheres_eleitas, pct_candidatas_mulheres |
| ANEEL | dadosabertos.aneel.gov.br | 7 | potencia_instalada_gd, pct_energia_renovavel |
| SNIS-RS | snis.gov.br (resíduos) | 12 | coleta_seletiva, reciclagem, compostagem |
| ANA | dadosabertos.ana.gov.br | 14 | iqa_medio, pct_corpos_bom |
| Convenios | transferegov.es.gov.br | 17 | convenios_federais, consorcios_intermunicipais |
| ANATEL | informacoes.anatel.gov.br | 9 | banda_larga_fixa, cobertura_4g, pct_fibra_optica |
| SISVAN | sisvan.saude.gov.br | 2 | cobertura_alimentar, deficit_peso, sobrepeso |

**Gotchas importantes:**
- Código IBGE: 7 dígitos (ex: `4204202`). SICONFI usa 6 dígitos sem verificador (`420420`)
- FPM: pago em 3 decêndios/mês (dias 10, 20, 30) — some para o valor mensal
- DATASUS pode ficar instável: timeout 10s + retry 3x + backoff exponencial
- SNIS: dados chegam com ~18 meses de atraso — ano de referência sempre exibido
- INEP: bienal (anos pares) — anos intermediários são interpolados

---

## Score ESG

Cada município recebe scores de 0 a 100 por ODS, calculados a partir de indicadores públicos:

- **Verde**: >= 70
- **Amarelo**: 40–69
- **Vermelho**: < 40

O score global é a média ponderada dos 17 ODS. O histórico é armazenado automaticamente a cada consulta ao endpoint `/api/ods/:ibgeCode`.

---

## Segurança

- **JWT** com expiração curta (1d padrão) — frontend valida `exp` e redireciona para login em 401
- **RBAC** — `authenticateToken` + `requireRole` em todas as rotas protegidas
- **Rate limiting** — `authLimiter` (10 tentativas/15min) em login/register; `batchLimiter` em rotas batch
- **Helmet** — headers de segurança HTTP configurados
- **CORS** — origens restritas; `localhost` bloqueado em produção pelo env-validator
- **Validação Zod** — todas as rotas validam input antes de processar
- **Env Validator** — startup aborta se `JWT_SECRET`, `REDIS_PASSWORD` ou `ALLOWED_ORIGINS` não atenderem critérios de produção
- **Graceful shutdown** — `SIGTERM`/`SIGINT` handlers encerram conexões limpamente antes de sair

---

## Arquitetura

```
ioc-esg-municipal/
├── backend/
│   ├── agents/              # 14 coletores de APIs governamentais
│   ├── docs/                # swagger.ts (OpenAPI spec)
│   ├── lib/                 # prisma.ts singleton
│   ├── middleware/          # auth JWT, RBAC, rate-limit, error-handler
│   ├── routes/              # Express routers
│   ├── services/
│   │   ├── ods/             # ODS Score Service (orquestra 14 coletores)
│   │   ├── ods_history/     # Histórico de scores
│   │   ├── simulator/       # Simulador de investimento FPM
│   │   ├── reports/         # Gerador de relatórios ESG
│   │   └── benchmarks/      # Comparativo entre municípios
│   └── utils/               # logger Winston, env-validator
├── frontend/
│   ├── pages/               # Login, Dashboard, Simulator, Reports, Monitoring
│   └── components/
│       ├── ods/             # Cards e gauges dos 17 ODS
│       └── charts/          # Recharts wrappers
├── shared/
│   ├── types/               # Interfaces TypeScript compartilhadas
│   └── constants/           # ODS 1-17, 295 municípios SC
├── prisma/
│   ├── schema.prisma
│   └── seed.ts              # Seed com 295 municípios SC e scores realistas
├── tests/
│   ├── unit/                # 562+ testes em 32 arquivos
│   ├── integration/         # 79 testes em 7 arquivos
│   └── e2e/                 # 4 specs Playwright
├── docs/
│   ├── especificacao/       # Documentação completa do produto
│   ├── plans/               # Planos de feature aprovados
│   ├── decisions/           # ADRs (Architecture Decision Records)
│   └── PROJECT_STATE.md     # Estado atual do projeto
├── docker-compose.yml       # Dev: PostgreSQL + Redis + Adminer
├── docker-compose.prod.yml  # Produção: stack completa com API
├── .env.example             # Template para desenvolvimento
└── .env.production.example  # Template para produção
```

**Decisões de arquitetura relevantes:**
- PrismaClient singleton em `backend/lib/prisma.ts` — pool único compartilhado por todos os módulos
- ODS Score Service orquestra os 14 coletores em paralelo com `withTimeout` por fonte
- Cache Redis obrigatório em toda chamada de API externa — TTL por fonte (1h a 7 dias)
- Soft delete em entidades principais; `deletedAt` nunca exposto nas respostas

---

## Contribuindo

### Convenções de commit

```
<tipo>(<escopo>): <descrição imperativa>
- detalhe do que foi feito
- motivo da decisão
```

Tipos: `feat` `fix` `refactor` `test` `docs` `chore` `perf` `ci`

Escopos: `ibge` `siconfi` `datasus` `inep` `snis` `inpe` `pncp` `ods` `simulator` `dashboard` `auth` `db` `infra`

Nunca: `fix bug` `update` `changes` `wip`

### Padrões de código

- TypeScript `strict: true` — zero `any`, use `unknown` + type guards
- Zod para validar toda resposta de APIs externas antes de usar
- Decimal.js para valores financeiros (FPM, investimentos)
- Controllers finos — lógica de negócio nos Services
- Toda chamada a API externa requer cache Redis + retry com backoff

### Checklist antes de abrir PR

- [ ] `pnpm build` sem erros TypeScript
- [ ] `pnpm test` passando
- [ ] Novos testes escritos para nova funcionalidade
- [ ] Sem credenciais hardcoded
- [ ] Erros tratados explicitamente (nunca silencioso)
- [ ] Cache Redis implementado se chamar API externa

---

## Licença

MIT
