# IOC ESG Municipal

Plataforma SaaS B2G que ajuda prefeitos brasileiros a investir FPM com impacto mensurável nos 17 Objetivos de Desenvolvimento Sustentável (ODS) da ONU, eliminando o desperdício estimado de R$20–40 bilhões anuais.

![Tests](https://img.shields.io/badge/tests-601%20passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Pre-requisitos

- Node.js >= 18.0.0
- pnpm >= 8.15.0
- Docker + Docker Compose

---

## Quick Start

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

- Backend: http://localhost:3000
- Frontend: http://localhost:5173
- API Docs (Swagger): http://localhost:3000/api/docs
- Adminer (banco): http://localhost:8080

---

## Scripts

| Comando | Descricao |
|---------|-----------|
| `pnpm dev` | Backend (3000) + frontend (5173) em modo watch |
| `pnpm build` | Build de producao (backend + frontend) |
| `pnpm start` | Inicia o build de producao |
| `pnpm test` | Unit + integration tests |
| `pnpm test:e2e` | Testes E2E com Playwright |
| `pnpm lint` | ESLint em todos os arquivos .ts/.tsx |
| `pnpm format` | Prettier em todo o projeto |
| `pnpm db:migrate` | Executa migrations Prisma |
| `pnpm db:seed` | Seed dos 295 municipios de SC |
| `pnpm db:studio` | Abre o Prisma Studio |
| `pnpm docker:up` | Sobe PostgreSQL + Redis + Adminer |
| `pnpm docker:down` | Para todos os containers |

---

## Estrutura do Projeto

```
ioc-esg-municipal/
├── backend/
│   ├── agents/              # Coletores de APIs governamentais
│   │   ├── ibge/
│   │   ├── siconfi/
│   │   ├── datasus/
│   │   ├── inep/
│   │   ├── snis/
│   │   ├── inpe/
│   │   ├── pncp/
│   │   ├── tse/
│   │   ├── aneel/
│   │   ├── snis_rs/
│   │   ├── ana/
│   │   ├── convenios/
│   │   ├── anatel/
│   │   └── sisvan/
│   ├── docs/                # swagger.ts (OpenAPI spec)
│   ├── lib/                 # prisma.ts singleton
│   ├── middleware/          # auth, rate-limit, error-handler
│   ├── routes/              # Express routers
│   ├── services/
│   │   ├── ods/             # ODS Score Service
│   │   ├── simulator/       # Simulador FPM
│   │   ├── reports/         # Gerador de relatorios ESG
│   │   ├── benchmarks/      # Comparativo entre municipios
│   │   └── ods_history/     # Historico de scores ODS
│   └── utils/               # logger, env-validator
├── frontend/
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── SimulatorPage.tsx
│   │   ├── ReportsPage.tsx
│   │   └── MonitoringPage.tsx
│   └── components/
│       ├── ods/             # Cards e gauges dos 17 ODS
│       └── charts/          # Recharts wrappers
├── shared/
│   ├── types/               # Interfaces TypeScript compartilhadas
│   └── constants/           # ODS 1-17, municipios SC
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── tests/
│   ├── unit/                # 562 testes em 28 arquivos
│   ├── integration/         # 39 testes em 3 arquivos
│   └── e2e/                 # 4 specs Playwright
├── docs/
│   ├── especificacao/
│   ├── plans/
│   ├── decisions/
│   └── PROJECT_STATE.md
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Rotas da API

| Rota | Metodo | Descricao | Auth |
|------|--------|-----------|------|
| `/api/auth/register` | POST | Registro de novo usuario | Nao |
| `/api/auth/login` | POST | Login, retorna JWT | Nao |
| `/api/auth/me` | GET | Dados do usuario autenticado | Sim |
| `/api/ods/:ibgeCode` | GET | Scores ODS (0-100) do municipio | Sim |
| `/api/ods/compare` | POST | Compara ODS entre municipios | Sim |
| `/api/simulator/simulate` | POST | Simulacao de investimento FPM | Sim |
| `/api/simulator/compare` | POST | Compara cenarios de simulacao | Sim |
| `/api/reports/:ibgeCode` | GET | Relatorio ESG executivo completo | Sim |
| `/api/benchmarks` | POST | Benchmark entre municipios | Sim |
| `/api/benchmarks/compare` | POST | Compara municipio vs grupo | Sim |
| `/api/municipalities` | GET | Lista municipios (paginado) | Sim |
| `/api/municipalities/:ibgeCode` | GET | Detalhe de um municipio | Sim |

Documentacao interativa disponivel em `/api/docs` (Swagger UI) com todos os schemas de request/response.

---

## Coletores de Dados

14 coletores de APIs publicas governamentais, todos com cache Redis, retry com backoff exponencial e timeout configuravel.

| Coletor | Fonte | ODS cobertos | Principais indicadores |
|---------|-------|--------------|----------------------|
| IBGE | servicodados.ibge.gov.br/api/v1 | 1, 2, 8, 9, 10, 11 | pct_baixa_renda, taxa_ocupacao, coeficiente_gini, pib_per_capita |
| SICONFI | api.siconfi.tesouro.gov.br/v1 | 3, 4, 11, 16, 17 | despesa_saude, despesa_educacao, equilibrio_fiscal, dependencia_FPM |
| DATASUS | datasus.saude.gov.br | 3 | previne_prenatal, previne_diabetes, previne_hipertensao |
| INEP | inep.gov.br (download) | 4 | ideb_anos_iniciais, ideb_anos_finais |
| SNIS | snis.gov.br (download) | 6 | atendimento_agua, atendimento_esgoto, esgoto_tratado |
| INPE | terrabrasilis.dpi.inpe.br/api/v1 | 13, 15 | desmatamento_anual, desmatamento_acumulado |
| PNCP | pncp.gov.br/api/pncp/v1 | 16 | total_contratacoes, percentual_dispensas, taxa_homologacao |
| TSE | dados.tse.jus.br | 5 | pct_mulheres_eleitas, pct_candidatas_mulheres |
| ANEEL | dadosabertos.aneel.gov.br | 7 | potencia_instalada_gd, pct_energia_renovavel |
| SNIS-RS | snis.gov.br (residuos) | 12 | coleta_seletiva, reciclagem, compostagem |
| ANA | dadosabertos.ana.gov.br | 14 | iqa_medio, pct_corpos_bom |
| Convenios | transferegov.es.gov.br | 17 | convenios_federais, consorcios_intermunicipais |
| ANATEL | informacoes.anatel.gov.br | 9 | banda_larga_fixa, cobertura_4g, pct_fibra_optica |
| SISVAN | sisvan.saude.gov.br | 2 | cobertura_alimentar, deficit_peso, sobrepeso |

**Gotchas importantes:**
- Codigo IBGE: 7 digitos (ex: `4204202`). SICONFI usa 6 digitos sem verificador (`420420`)
- FPM: pago em 3 decendios/mes (dias 10, 20, 30) — some para o valor mensal
- DATASUS pode ficar instavel: timeout 10s + retry 3x + backoff exponencial
- SNIS: dados chegam com ~18 meses de atraso — ano de referencia sempre exibido
- INEP: bienal (anos pares) — anos intermediarios sao interpolados

---

## Variaveis de Ambiente

Copie `.env.example` para `.env` e ajuste conforme seu ambiente.

| Variavel | Descricao | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://postgres:postgres@localhost:5432/ioc_esg_municipal` |
| `DATABASE_USER` | Usuario do banco | `postgres` |
| `DATABASE_PASSWORD` | Senha do banco | `postgres` |
| `DATABASE_NAME` | Nome do banco | `ioc_esg_municipal` |
| `NODE_ENV` | Ambiente (`development`/`production`) | `development` |
| `PORT` | Porta do backend | `3000` |
| `ALLOWED_ORIGINS` | Origens CORS (separar por virgula) | `http://localhost:5173` |
| `VITE_API_URL` | URL base da API (frontend) | `http://localhost:3000/api` |
| `JWT_SECRET` | Segredo JWT (min 32 chars em producao) | `troque-por-chave-segura` |
| `JWT_EXPIRATION` | Expiracao do token | `7d` |
| `REDIS_URL` | URL do Redis | `redis://localhost:6379` |
| `REDIS_PASSWORD` | Senha Redis (obrigatorio em producao) | vazio em dev |
| `IBGE_API_URL` | URL da API IBGE | `https://servicodados.ibge.gov.br/api/v1` |
| `SICONFI_API_URL` | URL da API SICONFI | `https://api.siconfi.tesouro.gov.br/v1` |
| `DATASUS_API_URL` | URL base do DATASUS | `https://datasus.saude.gov.br` |
| `INPE_API_URL` | URL da API TerraBrasilis/INPE | `https://terrabrasilis.dpi.inpe.br/api/v1` |
| `PNCP_API_URL` | URL da API PNCP | `https://pncp.gov.br/api/pncp/v1` |
| `AGENT_TIMEOUT` | Timeout dos coletores (ms) | `30000` |
| `AGENT_RETRY_COUNT` | Numero de tentativas de retry | `3` |
| `AGENT_RETRY_DELAY` | Delay inicial de retry (ms) | `1000` |
| `LOG_LEVEL` | Nivel de log Winston | `info` |

Em producao: `JWT_SECRET` nao pode ser placeholder, `REDIS_PASSWORD` e obrigatorio, `ALLOWED_ORIGINS` nao pode conter `localhost`.

---

## Testes

```bash
# Unit + integration (601 testes)
pnpm test

# Apenas unit tests (562 testes)
pnpm test:unit

# Apenas integration tests (39 testes)
pnpm test:integration

# Watch mode
pnpm test:watch

# E2E com Playwright (requer backend + frontend rodando)
pnpm test:e2e

# UI do Vitest
pnpm vitest --ui
```

Os testes de integracao requerem PostgreSQL e Redis rodando (`pnpm docker:up`).

---

## Docker

Para rodar toda a stack em containers:

```bash
# Sobe PostgreSQL (5432), Redis (6379) e Adminer (8080)
pnpm docker:up

# Ver logs
pnpm docker:logs

# Para tudo
pnpm docker:down
```

O `docker-compose.yml` define os servicos `postgres`, `redis` e `adminer`. O backend e o frontend rodam localmente com `pnpm dev`.

Para build de producao com Docker completo, use o `Dockerfile` na raiz do projeto.

---

## Score ESG

Cada municipio recebe scores de 0 a 100 por ODS, calculados a partir de indicadores de fontes publicas:

- **Verde**: >= 70
- **Amarelo**: 40–69
- **Vermelho**: < 40

O score global e a media ponderada dos 17 ODS. O historico de scores e armazenado automaticamente a cada consulta.

---

## Licenca

MIT
