# IOC ESG Municipal — CLAUDE.md

> Leia inteiro antes de agir. Cada regra é operacional, não sugestão.

---

## CONTEXTO DO PROJETO

**IOC ESG Municipal** = Plataforma SaaS B2G que ajuda prefeitos brasileiros a investir
FPM com impacto nos 17 ODS da ONU, eliminando o R$20-40B desperdiçado anualmente.

**Mercado inicial:** 295 municípios de Santa Catarina → 5.570 no Brasil
**Modelo:** Assinatura R$12k–200k/ano por município, 80%+ de margem
**Diferencial:** Dados públicos + simulação multi-agente + recomendação por IA

**Stack aprovada:**

- Backend: Node.js 18 + TypeScript strict + Express + Prisma ORM + PostgreSQL + Redis + Bull
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + Shadcn/ui + Recharts
- Testes: Vitest (unit/integration) + Playwright (e2e)
- Infra: Docker Compose + GitHub Actions

**Estado atual:** !`cat docs/PROJECT_STATE.md 2>/dev/null | head -10 || echo "Setup inicial — documentação completa disponível em docs/especificacao/"`

---

## INÍCIO DE SESSÃO — execute sempre

```bash
git log --oneline -5 2>/dev/null || echo "repo novo"
git status --short 2>/dev/null | head -5
cat docs/PROJECT_STATE.md 2>/dev/null | head -30
```

Memoria de longo prazo: ler `~/obsidian-vault/ioc-esg-municipal/long-term/gotchas.md` e `short-term/current-task.md`.
Ou invoque o agente `memory-manager` para sincronizar automaticamente.

Reporte: **feito / em progresso / próximo passo exato**

---

## IDENTIDADE

Você é o **arquiteto-executor** deste projeto. Não espera instrução óbvia.

- Toma decisões técnicas e documenta como ADR em `docs/decisions/`
- Propõe arquitetura ANTES de implementar qualquer coisa
- Questiona requisitos ambíguos antes de codificar
- Dúvida entre velocidade e qualidade: **escolha qualidade**

---

## PROTOCOLO OBRIGATÓRIO: PLAN BEFORE CODE

Para qualquer task > 15 minutos:

1. Ative Plan Mode (Shift+Tab 2×) ou pense explicitamente
2. Leia os arquivos relevantes — **nunca assuma estrutura**
3. Produza: o quê, como, por quê, arquivos afetados, riscos
4. Aguarde aprovação antes de executar
5. Checkpoint: `git add -A && git commit -m "checkpoint: antes de [feature]"`
6. Salve plano em `docs/plans/<feature>.md`

---

## COMANDOS DO PROJETO

```bash
pnpm dev              # backend (3000) + frontend (5173)
pnpm test             # unit + integration
pnpm test:e2e         # playwright
pnpm lint && pnpm format
pnpm db:migrate       # prisma migrate dev
pnpm db:seed          # seed 295 municípios SC
pnpm db:studio        # Prisma Studio UI
pnpm docker:up        # PostgreSQL + Redis + Adminer
```

---

## ARQUITETURA DO PROJETO

```
ioc-esg-municipal/
├── backend/
│   ├── agents/          # Coletores de APIs governamentais
│   │   ├── ibge/        # Dados demográficos — servicodados.ibge.gov.br/api/v1
│   │   ├── siconfi/     # FPM e finanças — api.siconfi.tesouro.gov.br/v1
│   │   ├── datasus/     # Saúde — datasus.saude.gov.br
│   │   ├── inep/        # IDEB — inep.gov.br (download Excel, sem REST)
│   │   ├── snis/        # Saneamento — snis.gov.br (download anual)
│   │   ├── inpe/        # Florestal — terrabrasilis.dpi.inpe.br/api/v1
│   │   └── pncp/        # Licitações — pncp.gov.br/api/pncp
│   ├── services/
│   │   ├── ods/         # Calculators de score 0-100 por ODS
│   │   ├── simulator/   # Motor de simulação de políticas públicas
│   │   ├── reports/     # Gerador de relatórios ESG
│   │   └── benchmarks/  # Comparativo entre municípios SC
│   ├── models/          # Schemas Prisma
│   ├── routes/          # Express routers
│   └── middleware/      # Auth JWT, rate limit, logging Winston
├── frontend/
│   ├── pages/
│   │   ├── dashboard/   # ODS overview do município (prefeito)
│   │   ├── simulator/   # Simulador de cenários de investimento
│   │   ├── reports/     # Relatórios de impacto ESG
│   │   └── monitoring/  # Acompanhamento de metas
│   └── components/
│       ├── ods/         # Cards e gauges dos 17 ODS
│       └── charts/      # Recharts wrappers
├── shared/
│   ├── types/           # Interfaces TypeScript (Município, ODS, Simulação)
│   └── constants/       # ODS 1-17, APIs, 295 municípios SC
├── docs/
│   ├── especificacao/   # Documentação completa do projeto
│   ├── plans/           # Planos aprovados por feature
│   ├── decisions/       # ADRs (Architecture Decision Records)
│   └── PROJECT_STATE.md # Estado atual — atualizar todo fim de sessão
└── .claude/             # Claude Code config
```

---

## DOMÍNIO DO NEGÓCIO

### Personas

- **Prefeito:** quer gastar FPM com segurança, evitar TCE, ser reeleito
- **Secretário de Finanças:** precisa de conformidade com Lei 14.133/2021
- **Secretário de Planejamento:** quer alinhar com ODS e Agenda 2030

### Score ESG

- Cada ODS tem score 0-100 calculado a partir de indicadores públicos
- Verde ≥70 | Amarelo 40–69 | Vermelho <40
- Score global = média ponderada dos 17 ODS

### APIs governamentais (todos os dados são públicos e gratuitos)

| API     | URL                              | Dados                   | Cache TTL |
| ------- | -------------------------------- | ----------------------- | --------- |
| IBGE    | servicodados.ibge.gov.br/api/v1  | Pop, renda, desemprego  | 24h       |
| SICONFI | api.siconfi.tesouro.gov.br/v1    | FPM, receitas, despesas | 6h        |
| DATASUS | datasus.saude.gov.br             | Saúde, mortalidade      | 12h       |
| INEP    | inep.gov.br (download)           | IDEB (bienal)           | 7 dias    |
| SNIS    | snis.gov.br (download)           | Água, esgoto (anual)    | 7 dias    |
| INPE    | terrabrasilis.dpi.inpe.br/api/v1 | Florestal, desmatamento | 24h       |
| PNCP    | pncp.gov.br/api/pncp             | Licitações (tempo real) | 1h        |

### Gotchas críticos do domínio

- Código IBGE: 7 dígitos (ex: 4204202). SICONFI usa 6 dígitos sem verificador (420420)
- FPM: pago em 3 decênios/mês (dias 10, 20, 30). Some para obter valor mensal
- IDEB: bienal (anos pares). Interpole para anos intermediários
- DATASUS: cai com frequência. Sempre timeout=30s + retry 3x + backoff exponencial
- SNIS: dados chegam com ~18 meses de atraso. Sempre informe o ano de referência
- Municípios <5k hab: muitos indicadores são amostral ou suprimidos por privacidade

---

## PADRÕES DE CÓDIGO

### TypeScript

- `strict: true` sempre, zero `any`, use `unknown` + type guards
- Zod para validar TODA resposta de APIs externas antes de usar
- Decimal.js para valores financeiros (FPM, investimentos)
- Interfaces para domínio (Municipio, ODS, Indicador, Simulacao)

### Backend

- Controllers finos — lógica de negócio nos Services
- Winston para logs estruturados (nunca console.log em produção)
- Cache Redis obrigatório em toda chamada de API externa
- Retry com backoff exponencial: 1s, 2s, 4s (3 tentativas)
- Rate limiting: máx 2 req/segundo para APIs governamentais

### Frontend

- React Query para server state, Zustand para client state mínimo
- Componentes funcionais, tipagem explícita de props
- Lazy loading para páginas
- Skeleton loaders para dados assíncronos

### Banco de dados

- Migrations via Prisma Migrate — nunca editar SQL manualmente
- Soft delete em entidades principais
- Índices em: municipality_id, ods_number, reference_date

---

## SEGURANÇA

- NUNCA commita `.env`, chaves de API, tokens, senhas
- NUNCA loga PII (dados pessoais), apenas dados agregados por município
- Validação Zod em toda rota antes de processar
- Rate limiting em rotas públicas
- `.env` no `.gitignore`, `.env.example` sempre atualizado

---

## CONVENÇÕES DE COMMIT

```
<tipo>(<escopo>): <descrição imperativa>
- detalhe do que foi feito
- motivo da decisão
```

Tipos: `feat` `fix` `refactor` `test` `docs` `chore` `perf` `ci`
Escopos: `ibge` `siconfi` `datasus` `inep` `snis` `inpe` `pncp` `ods` `simulator` `dashboard` `auth` `db` `infra`

Nunca: `fix bug` `update` `changes` `wip`

---

## MEMÓRIA DE LONGO PRAZO (Obsidian Vault)

Vault: `~/obsidian-vault/ioc-esg-municipal/`
MCP Server: `@modelcontextprotocol/server-filesystem` configurado em `.mcp.json`

Estrutura:

```
~/obsidian-vault/ioc-esg-municipal/
├── long-term/
│   ├── architecture.md      # Stack, principios, escopo
│   ├── decisions-log.md     # ADRs
│   ├── gotchas.md           # Bugs conhecidos, armadilhas de dominio
│   └── lessons-learned.md   # Padroes validados, licoes
├── short-term/
│   └── current-task.md      # Tarefa em andamento
└── daily/
    └── YYYY-MM-DD.md        # Log diario
```

Hierarquia de memória:

- **CLAUDE.md** (~50 linhas ativas) = registradores — sempre em contexto
- **MEMORY.md** (~30 linhas) = cache — índice/ponteiros, sem conteúdo
- **Vault Obsidian** (ilimitado) = RAM/disco — base de conhecimento persistente

Regras:

- Início de sessão: ler `long-term/architecture.md` e `long-term/gotchas.md`
- Fim de sessão: atualizar `daily/YYYY-MM-DD.md` e `short-term/current-task.md`
- Decisões arquiteturais: adicionar em `long-term/decisions-log.md`
- Nunca poluir vault com outputs temporários — esses ficam em `~/.claude/`

---

## GESTÃO DE CONTEXTO

- `/compact` quando contexto atingir **70%** — nunca espere 90%
- `/context-save` antes de qualquer compactação
- `/btw <pergunta>` para dúvidas rápidas sem poluir contexto
- `/clear` entre features não relacionadas
- Antes de limpar: salve em `docs/PROJECT_STATE.md`

---

## QUALIDADE — checklist antes de "concluído"

- [ ] `pnpm build` sem erros TypeScript
- [ ] `pnpm test` passando
- [ ] Novos testes escritos para nova funcionalidade
- [ ] Sem credenciais hardcoded
- [ ] Erros tratados explicitamente (nunca silencioso)
- [ ] Cache Redis implementado se chamar API externa

---

## RECURSOS DO PROJETO

### Skills (invoque com `/nome`)

| Skill                   | Quando usar                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `/setup`                | Setup inicial completo — execute UMA VEZ                      |
| `/new-agent <api>`      | Novo coletor (ibge, siconfi, datasus, inep, snis, inpe, pncp) |
| `/new-ods <1-17>`       | Calculator de score para um ODS                               |
| `/full-stack <feature>` | Feature completa backend+frontend                             |
| `/tdd <feature>`        | Red-Green-Refactor rigoroso                                   |
| `/bug-fix`              | Diagnóstico + correção + teste de regressão                   |
| `/refactor`             | Refatoração segura com cobertura                              |
| `/pre-deploy`           | Checklist antes de qualquer deploy                            |
| `/pr-summary`           | Sumário estruturado de PR                                     |
| `/health-check`         | Monitor de saúde (use com `/loop 15m`)                        |
| `/morning-briefing`     | Standup autônomo diário                                       |
| `/context-save`         | Salva estado antes de `/compact`                              |
| `/research <tópico>`    | Pesquisa técnica para decisão                                 |

### Agentes (invoque com: "Use o agente X para...")

| Tier   | Agente               | Quando                                          |
| ------ | -------------------- | ----------------------------------------------- |
| Opus   | `orchestrator`       | Feature multi-camada — coordena todos           |
| Opus   | `backend-architect`  | Design de API ou serviço                        |
| Opus   | `database-architect` | Schema ou migration                             |
| Opus   | `frontend-architect` | UI complexa                                     |
| Opus   | `security-auditor`   | Antes de deploy, auth, dados sensíveis          |
| Opus   | `code-reviewer`      | Após qualquer feature — contexto limpo          |
| Sonnet | `data-collector`     | Implementar/debugar coletor de API gov          |
| Sonnet | `ods-analyst`        | Scores e indicadores dos 17 ODS                 |
| Sonnet | `api-developer`      | Implementar endpoints a partir de specs         |
| Sonnet | `test-writer`        | Cobertura de testes                             |
| Sonnet | `debugger`           | Bug persistente                                 |
| Sonnet | `docs-writer`        | README, documentação de API                     |
| Haiku  | `devops-engineer`    | Docker, CI/CD, infra                            |
| Opus   | `project-monitor`    | Monitoramento continuo, KPIs, coerencia, riscos |
| Sonnet | `memory-manager`     | Obsidian vault: sync, ADRs, gotchas, daily logs |

### Slash commands

| Comando               | O que faz                             |
| --------------------- | ------------------------------------- |
| `/plan <feature>`     | Protocolo de planejamento documentado |
| `/checkpoint <desc>`  | Commit de segurança                   |
| `/state`              | Atualiza PROJECT_STATE.md             |
| `/decisions <título>` | Registra ADR                          |

---

## O QUE NUNCA FAZER

- Implementar sem plano aprovado para tasks > 15min
- Usar `any` em TypeScript
- Chamar API externa sem cache + retry
- Commitar sem rodar testes
- `git push --force` sem confirmação explícita
- Hardcodar IDs de município, URLs ou valores de configuração
- Misturar refatoração com nova feature no mesmo commit

---

## FIM DE SESSÃO — sempre

1. Commit de tudo funcionando
2. Atualize `docs/PROJECT_STATE.md`
3. Invoque `memory-manager` para persistir decisões, gotchas e lições no vault Obsidian
4. Atualize `~/obsidian-vault/ioc-esg-municipal/daily/YYYY-MM-DD.md`
5. Registre decisões em `docs/decisions/` se houver
6. Reporte: **feito / pendente / próximo passo exato**

---

_IOC ESG Municipal v1.0 — 31/03/2026_
