# Hardening Operacional Go-Live — B1-B3 + P1-P3

**Status:** ✅ **Entregue** (2026-04-16) — todos os itens implementados e em `main`.
**Origem:** Auditoria de maturidade operacional `docs/evidence/2026-04-14-auditoria-adhoc/REPORT.md` (2026-04-14).
**Escopo original:** 3 blockers (B1-B3) + 3 pendências altas (P1-P3) que impediam deploy controlado seguro.

---

## Resumo executivo

Este plano fecha o loop **auditoria → plano → entrega → verificação** iniciado em 2026-04-14. Cada item abaixo tem:

- referência ao achado original no `REPORT.md`
- descrição do problema
- solução aplicada
- commit que entregou a solução

Mantido em `docs/plans/` como registro histórico de prontidão para produção. **Não é backlog ativo** — todos os itens estão concluídos.

---

## B1 — Grafana: fallback de senha `admin` removido ✅

**Problema:** `docker-compose.prod.yml` permitia `GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}`. Deploy sem configurar a variável entraria em produção com credencial trivial.

**Solução:** Helper `scripts/prod-up-local.sh` gera `GRAFANA_PASSWORD` via `openssl rand -hex 16` automaticamente + `!override` evita conflitos de porta no stack local.

**Commit:** `04a6ca9 fix(infra): prod-up-local gera GRAFANA_PASSWORD e !override evita conflito de porta`

---

## B2 — Alertmanager funcional no compose prod ✅

**Problema:** `prometheus.yml` apontava para `alertmanager:9093` mas o service não existia no `docker-compose.prod.yml`. Alertas eram silenciosamente perdidos.

**Solução:**

- `monitoring/alertmanager.yml` com config real (não stub)
- service `alertmanager` adicionado ao `docker-compose.prod.yml`
- webhook roteado para Slack via `monitoring/slack_url` (gitignored)

**Commits:**

- `b31d9da fix(infra): hardening compose prod — Grafana obrigatório, alertmanager, consolidar alert rules`
- `4d88664 feat(infra): alert routing real via Slack para severity=critical`

---

## B3 — Validação de env de produção ✅

**Problema:** Variáveis obrigatórias não validadas antes do deploy. Placeholders (`JWT_SECRET=troque-em-producao`, `REGISTRY=seu-org`) podiam chegar em `main`.

**Solução:** `scripts/validate-prod-env.sh` com:

- checa vars obrigatórias: `DATABASE_PASSWORD`, `JWT_SECRET`, `REDIS_PASSWORD`, `GRAFANA_PASSWORD`, `ALLOWED_ORIGINS`, `REGISTRY`
- rejeita `REGISTRY` contendo `seu-org`
- rejeita `JWT_SECRET` contendo `troque` ou `test`
- flag `--ci` para modo CI
- integrado em `.github/workflows/deploy.yml` antes do SSH deploy

**Commit:** `c1580ef feat(infra): validate-prod-env.sh bloqueia placeholders + integração no deploy`

---

## P1 — Runbook de produção ✅

**Problema:** Primeiro deploy de SC sem procedimento documentado. Cada operação manual vira tribal knowledge.

**Solução:** `docs/RUNBOOK_PRODUCAO.md` cobrindo:

1. Pré-requisitos (servidor, Docker 24+, DNS, portas)
2. Segredos obrigatórios com comando de geração
3. Primeiro deploy (clone → .env → validate → build/pull → up → seed → smoke)
4. Deploy subsequente (CI ou `workflow_dispatch`)
5. Rollback via `IMAGE_TAG` de commit anterior
6. SSL (`setup-ssl.sh` + renovação automática via crontab)
7. Troubleshooting (logs, health, restart, disco)

**Commit principal:** `19cf01f docs(infra): runbook de producao para primeiro deploy SC`
**Complementos:**

- `a3781d0 feat(infra): backup agendado PostgreSQL com rotacao e crontab idempotente`
- `4d88664 feat(infra): alert routing real via Slack para severity=critical`

---

## P2 — SSL: crontab de renovação automatizada ✅

**Problema:** `scripts/setup-ssl.sh` apenas imprimia (`echo`) o comando de renovação — o operador precisava instalar a entrada manualmente no crontab. Esquecer = certificado expira silenciosamente.

**Solução:** Instalação idempotente da entrada no crontab do operador (remove entrada anterior antes de adicionar). Flag `--skip-crontab` para opt-out.

**Commit:** `0805597 fix(infra): setup-ssl.sh instala crontab de renovação automaticamente`

---

## P3 — Consolidação de regras de alerting ✅

**Problema:** `HighErrorRate` e `HighLatency/SlowP95` definidas em dois arquivos (`prometheus-rules.yml` e `alert_rules.yml`) com métricas, thresholds e severities divergentes. Alertas podiam disparar em duplicidade ou silenciar uns aos outros.

**Solução:** Deletado `monitoring/prometheus-rules.yml`. Mantido apenas `monitoring/alert_rules.yml` (5 regras coerentes). `monitoring/prometheus.yml` referencia só a versão consolidada.

**Commit:** `b31d9da fix(infra): hardening compose prod — Grafana obrigatório, alertmanager, consolidar alert rules`

---

## Verificação final

Checklist reexecutado em 2026-04-16:

```bash
# 1. Compose válido
docker compose -f docker-compose.prod.yml config --quiet              # ✅

# 2. Alertmanager existe como service
grep -c "^  alertmanager:" docker-compose.prod.yml                     # ✅ 1

# 3. validate-prod-env.sh presente
ls scripts/validate-prod-env.sh                                        # ✅

# 4. Runbook presente
ls docs/RUNBOOK_PRODUCAO.md                                            # ✅

# 5. setup-ssl.sh tem crontab automático
grep -c "crontab" scripts/setup-ssl.sh                                 # ✅ 6

# 6. Sem prometheus-rules.yml duplicado
ls monitoring/prometheus-rules.yml 2>/dev/null                          # ✅ vazio

# 7. prometheus.yml referencia apenas alert_rules.yml
grep "prometheus-rules\|alert_rules" monitoring/prometheus.yml          # ✅ alert_rules.yml apenas
```

Todos os 7 critérios satisfeitos.

---

## Rastreabilidade

- **Achados originais:** `docs/evidence/2026-04-14-auditoria-adhoc/REPORT.md`
- **Plano anterior (ephemeral):** `.claude/plans/silly-twirling-moth.md` (removido neste commit — promovido para cá)
- **Commits de entrega:** listados por item acima
