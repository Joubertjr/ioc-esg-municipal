# Auditoria de Maturidade Operacional — IOC ESG Municipal

**Data:** 2026-04-14
**Escopo:** Dependências de ação ad hoc no caminho de produção
**Auditor:** Agente de Auditoria Operacional

---

## DIAGNÓSTICO EXECUTIVO

### Resumo

O projeto IOC ESG Municipal apresenta uma arquitetura sólida para a fase atual (go-live em SC). O pipeline automatizado (CI/CD, ingestão, docker build, smoke tests) é real e funcional. Contudo, a auditoria identificou **15 achados de dependência ad hoc**, dos quais **5 são de severidade blocker ou alta** e afetam diretamente a repetibilidade do caminho de produção.

### Veredito de Repetibilidade

**PARCIALMENTE REPETÍVEL** — 70% do caminho de produção é automatizado. Os 30% restantes dependem de ações manuais sem rotina formal.

### Pontuação por Dimensão

| Dimensão        | Repetibilidade | Principais Riscos                                       |
| --------------- | -------------- | ------------------------------------------------------- |
| Build & Deploy  | Alta (80%)     | REGISTRY placeholder, SMOKE_EMAIL hardcoded no CI       |
| Dados estáticos | Baixa (20%)    | CSV manual, sem scheduler, sem verificação de frescor   |
| Segurança       | Média (60%)    | Senha hardcoded no seed, Grafana com `admin` por padrão |
| Infraestrutura  | Alta (75%)     | SSL sem crontab automático, servidor sem runbook        |
| Monitoramento   | Média (55%)    | Alertas Prometheus sem destino (sem Alertmanager)       |
| Testes          | Alta (85%)     | Integração de agentes requer opt-in manual (env var)    |

---

## DIAGNÓSTICO TÉCNICO

### AH-001 — Senha admin hardcoded no seed de produção

**Severidade:** BLOCKER | **Categoria:** Segurança

**Evidência:**

- `prisma/seed.ts:761` — `bcrypt.hash("Admin@2026", 12)`
- `prisma/seed.ts:754` — `email = "admin@ioc.local"`
- `scripts/create-demo-user.ts:16-17` — mesmas credenciais
- `scripts/smoke-test-stack.sh:52-53` — fallbacks para `admin@ioc.local` / `Admin@2026`
- `scripts/smoke-test-sc.ts:19-20` — fallbacks idênticos
- `.github/workflows/main.yml:160` — `SMOKE_PASSWORD: Admin@2026` hardcoded no CI

**Tipo:** Ad hoc perigoso. Credencial de domínio formal commitada no repositório. Qualquer pessoa com acesso ao repositório conhece a senha do administrador da plataforma.

**Causa-raiz:** O seed foi desenhado para dev/CI mas tem caminho direto para produção via `RUN_SEED=true`. Não há separação entre "seed de estrutura" (municípios) e "seed de usuário demo".

**Ação corretiva:** (1) Separar `seedAdminUser` do seed principal. (2) Criar `scripts/create-prod-admin.ts` que leia email e senha de vars de ambiente obrigatórias. (3) Remover `Admin@2026` de todos os scripts.

**Critério de fechamento:** `grep -r "Admin@2026" . --include="*.ts"` retorna zero resultados.

---

### AH-002 — Atualização de dados estáticos: processo inteiramente manual

**Severidade:** Alta | **Categoria:** Dados / Operações

**Evidência:**

- `scripts/update-snis-data.ts:37-44` — "Acesse portal > selecione > exporte CSV > salve em scripts/data/ > execute script"
- `scripts/update-inep-data.ts:16-18` — mesma instrução manual
- `scripts/update-sisvan-data.ts`, `update-anatel-data.ts`, `update-aneel-data.ts`, `update-convenios-data.ts`, `update-ieps-data.ts` — padrão idêntico em todos os 7 scripts
- `scripts/data/` — diretório não existe (sem CSV de entrada)
- Ausência de schedule no CI para `data:update:all`

**Tipo:** Ad hoc inaceitável. Dados governamentais são publicados anualmente mas não há trigger automático, lembrete formal, nem verificação de frescor.

**Risco:** Plataforma pode exibir dados de 2021/2022 em 2026/2027 sem nenhum alerta ao prefeito.

**Ação corretiva:** (1) Criar `scripts/check-data-freshness.ts` que leia `__meta.lastUpdated` de todos os JSONs e gere alerta se qualquer fonte exceder threshold. (2) Adicionar job semanal no CI que execute este check e abra issue automática.

**Critério de fechamento:** CI roda check de frescor semanal e abre issue quando dado vence.

---

### AH-003 — Registry de produção hardcoded como placeholder

**Severidade:** Alta | **Categoria:** Deploy / CI-CD

**Evidência:**

- `docker-compose.prod.yml:94` — `image: ${REGISTRY:-ghcr.io/seu-org}/ioc-esg-municipal:${IMAGE_TAG:-latest}`
- `.env.production.example:19` — `REGISTRY=ghcr.io/seu-org`

**Tipo:** Ad hoc perigoso. Fallback `ghcr.io/seu-org` aponta para registry inexistente. Deploy sem `.env` preenchido falha ou usa imagem desatualizada silenciosamente.

**Ação corretiva:** Criar `scripts/validate-prod-env.sh` que falhe se `REGISTRY` contiver "seu-org" ou `IMAGE_TAG` for "latest". Adicionar como primeiro passo do `deploy.yml`.

**Critério de fechamento:** Deploy falha automaticamente se REGISTRY ou IMAGE_TAG estiverem com valores placeholder.

---

### AH-004 — Renovação de SSL sem crontab automático

**Severidade:** Alta | **Categoria:** Infraestrutura / SSL

**Evidência:**

- `scripts/setup-ssl.sh:69-72` — Etapa 6: imprime o comando de crontab mas NÃO o instala
- `scripts/setup-ssl.sh:70` — `echo "[setup-ssl] Para renovacao automatica, adicione ao crontab:"`

**Tipo:** Ad hoc perigoso. Certificado Let's Encrypt vence em 90 dias. Se crontab não for configurado manualmente pelo operador, o site fica inacessível.

**Ação corretiva:** Modificar `setup-ssl.sh` para executar `(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -` automaticamente, com flag `--skip-crontab` para opt-out.

**Critério de fechamento:** `setup-ssl.sh` instala crontab automaticamente no fluxo normal.

---

### AH-005 — Alertas Prometheus sem destino: detecção sem resposta

**Severidade:** Alta | **Categoria:** Monitoramento

**Evidência:**

- `monitoring/prometheus-rules.yml` — 4 regras: HighErrorRate, SlowP95, ExternalApiDown, CacheErrorRising
- `monitoring/prometheus.yml` — sem bloco `alerting` configurado
- `docker-compose.prod.yml` — sem service `alertmanager`
- Ausência de `alertmanager.yml` no repositório

**Tipo:** Ad hoc inaceitável. Regras de alerta existem mas disparam para o vazio. Único caminho de resposta é o operador olhar o Grafana proativamente.

**Ação corretiva:** (1) Adicionar `alertmanager` service ao `docker-compose.prod.yml`. (2) Criar `monitoring/alertmanager.yml` com receiver de email via env vars. (3) Conectar Prometheus ao Alertmanager.

**Critério de fechamento:** `curl localhost:9093/api/v2/status` retorna 200 e regra teste dispara para receiver configurado.

---

### AH-006 — Smoke test final não integrado ao pipeline de deploy

**Severidade:** Média | **Categoria:** Deploy / Qualidade

**Evidência:**

- `scripts/smoke-final.sh` — script robusto, 3 camadas, 295 municípios (existe mas não é chamado no deploy)
- `.github/workflows/deploy.yml` — healthcheck apenas `/health`, sem smoke-final.sh
- `docs/ESTADO_ATUAL_SC.md:105` — "Smoke Test Final: **Pendente** — executar antes do deploy"

**Tipo:** Ad hoc inaceitável. O smoke test mais completo existe mas não é executado automaticamente após deploy.

**Ação corretiva:** Adicionar ao `deploy.yml` step "Post-deploy smoke test" com `SMOKE_EMAIL` e `SMOKE_PASSWORD` como secrets do GitHub.

**Critério de fechamento:** `deploy.yml` inclui step de smoke test e deploy falha se smoke retornar NO-GO.

---

### AH-007 — Processo de first-boot sem runbook executável

**Severidade:** Média | **Categoria:** Deploy / Operações

**Evidência:**

- `entrypoint.sh:24-29` — `RUN_SEED=true` como opt-in não documentado formalmente
- Sequência correta de primeiro deploy distribuída entre `CLAUDE.md`, `ESTADO_ATUAL_SC.md` e comentários de código
- Ausência de `RUNBOOK_PRODUCAO.md`

**Tipo:** Ad hoc inaceitável. Sequência de primeiro deploy não tem checklist executável. Operador pode subir sem seed e demorar horas para entender.

**Ação corretiva:** Criar `docs/RUNBOOK_PRODUCAO.md` com checklist: pré-requisitos, clonar, `.env`, build, up, seed, smoke, SSL, crontab.

**Critério de fechamento:** `RUNBOOK_PRODUCAO.md` existe e foi seguido pelo menos uma vez sem consultar outros documentos.

---

### AH-008 — `fix-env-dev.py`: script de correção de divergência estrutural

**Severidade:** Média | **Categoria:** Configuração / DX

**Evidência:**

- `scripts/fix-env-dev.py:9-14` — "Motivo: O .env.example usa postgres:postgres@localhost mas o docker-compose.yml sobe com ioc:ioc_dev_2026/ioc_esg. Essa divergência causa HTTP 500 no login."
- Script existe como solução permanente para um problema estrutural

**Tipo:** Ad hoc inaceitável. Script de correção existe porque `.env.example` e `docker-compose.yml` estão fora de sincronismo.

**Ação corretiva:** (1) Atualizar `.env.example` com credenciais corretas de dev. (2) Adicionar `pnpm dev:setup` que copie `.env.example` para `.env` se não existir. (3) Deletar `fix-env-dev.py`.

**Critério de fechamento:** Novo clone + `pnpm dev:setup` + `pnpm dev` funciona sem intervenção.

---

### AH-009 — `fetch-real-data.ts`: script com código comentado (BigQuery)

**Severidade:** Média | **Categoria:** Dados / Técnico

**Evidência:**

- `scripts/fetch-real-data.ts:96` — "Código BigQuery (descomentar quando credenciais estiverem disponíveis)"
- Dependência `@google-cloud/bigquery` não listada no `package.json`

**Tipo:** Ad hoc inaceitável. Script inoperante comprometido no repositório como placeholder.

**Ação corretiva:** Mover para `docs/scripts-pendentes/` (sem extensão `.ts`) com comentário de implementação futura, ou implementar completamente.

**Critério de fechamento:** `scripts/fetch-real-data.ts` é funcional e testado, ou não existe na pasta `scripts/`.

---

### AH-010 — Grafana com senha padrão `admin` no fallback

**Severidade:** Média | **Categoria:** Segurança

**Evidência:**

- `docker-compose.prod.yml:216` — `GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}`

**Tipo:** Ad hoc perigoso. Se operador não incluir `GRAFANA_PASSWORD` no `.env`, Grafana sobe com senha `admin` na porta 3001.

**Ação corretiva:** Remover fallback `:-admin` do compose de produção, tornando `GRAFANA_PASSWORD` obrigatório.

**Critério de fechamento:** `docker compose -f docker-compose.prod.yml up -d` sem `GRAFANA_PASSWORD` causa erro explícito.

---

### AH-011 — `referenceYear` dos JSONs estáticos: parâmetro manual sem validação

**Severidade:** Média | **Categoria:** Dados / Qualidade

**Evidência:**

- `scripts/update-snis-data.ts:58-62` — `--year` é argumento CLI opcional com `DEFAULT_FALLBACK_YEAR = 2022`
- `scripts/update-inep-data.ts:43-45` — idem, `DEFAULT_FALLBACK_YEAR = 2023`

**Tipo:** Ad hoc inaceitável. Operador pode esquecer `--year 2025` e `__meta.referenceYear` ficará como 2022 mesmo com dados de 2025.

**Ação corretiva:** Scripts devem tentar extrair o ano da coluna de ano do CSV. `--year` como override obrigatório se não encontrado no CSV.

**Critério de fechamento:** Scripts extraem `referenceYear` do conteúdo do CSV.

---

### AH-012 — Testes de integração de agentes opt-in manual

**Severidade:** Baixa | **Categoria:** Testes

**Evidência:**

- `tests/integration/agents/siconfi_integration.test.ts:15` — `describe.skipIf(!process.env["SICONFI_INTEGRATION"])`
- `SICONFI_INTEGRATION` ausente do CI (`main.yml`)

**Tipo:** Ad hoc aceitável (borderline). Isolamento do CI é razoável, mas falta schedule periódico.

**Ação corretiva:** Adicionar job semanal no CI (`0 6 * * 0`) para executar testes de integração de agentes.

---

### AH-013 — `SC_BENCHMARK_CODES`: lista hardcoded sem teste nome×código no CI

**Severidade:** Baixa | **Categoria:** Dados / Qualidade

**Evidência:**

- `shared/constants/sc-benchmark-codes.ts` — 10 códigos hardcoded com comentários de nomes
- `scripts/smoke-test-sc.ts:24-35` — valida nome×código, mas apenas no smoke test manual
- Ausência de teste unitário no CI

**Tipo:** Ad hoc aceitável. Os 8 códigos errados foram detectados manualmente (commit `3a0111e`). Smoke test valida agora, mas só quando executado.

**Ação corretiva:** Criar `tests/unit/constants/sc-benchmark-codes.test.ts` que valide cada código contra `SC_MUNICIPALITIES`.

---

### AH-014 — `trivy-action@master`: action sem pin de versão

**Severidade:** Baixa | **Categoria:** CI/CD / Supply Chain

**Evidência:**

- `.github/workflows/docker-build.yml:68` — `uses: aquasecurity/trivy-action@master`

**Tipo:** Ad hoc perigoso (baixa probabilidade). Action de segurança sem pin pode mudar comportamento silenciosamente.

**Ação corretiva:** Substituir `@master` por SHA fixo. Adicionar `dependabot.yml` para GitHub Actions.

---

### AH-015 — Testes de integração com mock de Prisma (viola regra do projeto)

**Severidade:** Baixa | **Categoria:** Testes

**Evidência:**

- `.claude/rules/testing.md` — "Nunca usar `jest.mock` ou `vi.mock` para módulos Prisma"
- `tests/integration/api/health.test.ts:38-53` — `vi.mock("@prisma/client", ...)`
- `tests/integration/api/auth.test.ts` — mesmo padrão

**Tipo:** Ad hoc inaceitável. Viola regra explícita do projeto. Testes de integração que mockam o banco não detectam regressões reais de query.

**Ação corretiva:** (1) Criar `vitest.setup.ts` com setup/teardown de banco real usando `DATABASE_URL_TEST`. (2) Remover `vi.mock("@prisma/client")` dos testes de integração.

---

## PLANO ESTRUTURAL

### Bloco A — Criar (ausências críticas)

| #   | Ação                                                                           | Resolve        |
| --- | ------------------------------------------------------------------------------ | -------------- |
| 1   | `docs/RUNBOOK_PRODUCAO.md` — checklist formal de primeiro deploy               | AH-007         |
| 2   | `scripts/create-prod-admin.ts` — cria admin com senha via env var              | AH-001         |
| 3   | `scripts/validate-prod-env.sh` — valida REGISTRY, GRAFANA_PASSWORD, JWT_SECRET | AH-003, AH-010 |
| 4   | `scripts/check-data-freshness.ts` — alerta quando dados estáticos vencem       | AH-002         |
| 5   | `monitoring/alertmanager.yml` + service no compose prod                        | AH-005         |
| 6   | `tests/unit/constants/sc-benchmark-codes.test.ts`                              | AH-013         |

### Bloco B — Endurecer (gates formais ausentes)

| #   | Ação                                                    | Resolve |
| --- | ------------------------------------------------------- | ------- |
| 1   | Smoke-final como step pós-deploy no `deploy.yml`        | AH-006  |
| 2   | Remover fallback `:-admin` do `docker-compose.prod.yml` | AH-010  |
| 3   | Sincronizar `.env.example` com credenciais reais de dev | AH-008  |
| 4   | `setup-ssl.sh` instala crontab automaticamente          | AH-004  |
| 5   | Job semanal de testes de integração de agentes no CI    | AH-012  |
| 6   | Job semanal de check de frescor de dados no CI          | AH-002  |
| 7   | Pinagem de `trivy-action@master` para SHA específico    | AH-014  |

### Bloco C — Bloqueios antes do go-live SC

1. **AH-001** (BLOCKER) — Remover `Admin@2026` do seed; criar `create-prod-admin.ts`
2. **AH-003** (Alta) — Criar `validate-prod-env.sh`; executar antes do deploy
3. **AH-004** (Alta) — `setup-ssl.sh` ou documentar no RUNBOOK que crontab é obrigatório
4. **AH-007** (Média) — Criar `RUNBOOK_PRODUCAO.md` com checklist verificável

### Bloco D — Backlog pós go-live SC

AH-002, AH-005, AH-006, AH-008, AH-009, AH-011, AH-012, AH-013, AH-014, AH-015

---

## O QUE É INEVITAVELMENTE HUMANO

Os seguintes processos envolvem julgamento legítimo e não devem ser automatizados:

1. Validar a qualidade dos dados governamentais antes de rodar o script de atualização
2. Aprovar o resultado go/no-go do smoke test antes de informar ao cliente
3. Selecionar o domínio e configurar DNS
4. Revisar o SQL gerado por Prisma Migrate antes de rodar em produção
5. Definir runbook de resposta a incidentes (processo organizacional)

---

_Auditoria gerada em 2026-04-14. Próxima revisão: após go-live SC._
