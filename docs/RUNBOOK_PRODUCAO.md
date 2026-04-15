# Runbook de Producao — IOC ESG Municipal

> Guia operacional para deploy, manutencao e troubleshooting em producao.
> Foco exclusivo: 295 municipios de Santa Catarina.

---

## 1. Pre-requisitos

| Item     | Requisito minimo                              |
| -------- | --------------------------------------------- |
| Servidor | 2 vCPU, 4 GB RAM, 40 GB disco                 |
| Docker   | 24.0+ com compose v2                          |
| SO       | Ubuntu 22.04 LTS ou Debian 12                 |
| DNS      | Dominio apontando para IP do servidor         |
| Portas   | 80 (HTTP), 443 (HTTPS), 22 (SSH)              |
| Git      | Acesso ao repositorio (clone ou imagem)       |
| Registry | Acesso ao GitHub Container Registry (ghcr.io) |

---

## 2. Segredos obrigatorios

Gere **antes** de qualquer deploy. Nunca reutilize valores entre ambientes.

```bash
# No servidor de producao:
export JWT_SECRET=$(openssl rand -hex 32)
export REDIS_PASSWORD=$(openssl rand -hex 16)
export GRAFANA_PASSWORD=$(openssl rand -hex 16)
export DATABASE_PASSWORD=$(openssl rand -hex 16)
```

Variavel completa que deve existir no `.env`:

| Variavel            | Como gerar                    | Validacao                         |
| ------------------- | ----------------------------- | --------------------------------- |
| `DATABASE_USER`     | Escolher (ex: `ioc_prod`)     | Nao vazio                         |
| `DATABASE_PASSWORD` | `openssl rand -hex 16`        | Min 16 chars                      |
| `DATABASE_NAME`     | Escolher (ex: `ioc_esg_prod`) | Nao vazio                         |
| `DATABASE_URL`      | Montar com valores acima      | Formato postgresql://...          |
| `JWT_SECRET`        | `openssl rand -hex 32`        | Min 32 chars, sem placeholders    |
| `REDIS_PASSWORD`    | `openssl rand -hex 16`        | Min 16 chars                      |
| `REDIS_URL`         | Montar com REDIS_PASSWORD     | Formato redis://:senha@redis:6379 |
| `GRAFANA_PASSWORD`  | `openssl rand -hex 16`        | Nao pode ser "admin"              |
| `ALLOWED_ORIGINS`   | URL do frontend               | Nao pode ser "\*"                 |
| `REGISTRY`          | `ghcr.io/<sua-org>`           | Nao pode conter "seu-org"         |
| `IMAGE_TAG`         | SHA do commit ou `latest`     | Formato: 7 hex chars ou latest    |

**Validar automaticamente:**

```bash
bash scripts/validate-prod-env.sh
```

---

## 3. Primeiro deploy

```bash
# 1. Clonar repositorio
git clone <repo-url> /opt/ioc-esg-municipal
cd /opt/ioc-esg-municipal

# 2. Criar .env a partir do exemplo
cp .env.production.example .env
# Editar .env com os valores gerados acima
nano .env

# 3. Validar variaveis
bash scripts/validate-prod-env.sh

# 4. Autenticar no registry
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <usuario> --password-stdin

# 5. Subir stack (pull da imagem + todos os servicos)
IMAGE_TAG=latest docker compose -f docker-compose.prod.yml up -d

# 6. Executar migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# 7. Seed dos 295 municipios SC
docker compose -f docker-compose.prod.yml exec api npx prisma db seed

# 8. Verificar saude
curl http://localhost:3000/health
# Esperado: {"status":"ok","database":"connected","redis":"connected"}

# 9. Verificar todos os containers
docker compose -f docker-compose.prod.yml ps
# Todos devem estar "healthy" ou "running"
```

---

## 4. Deploy subsequente (automatico)

O pipeline CI/CD executa automaticamente apos merge em `main`:

```
ci (tsc + lint + unit + integration + build)
  -> e2e (Playwright)
    -> smoke-final (295 municipios SC)
      -> docker-build (trivy scan + push ghcr.io)
        -> deploy (SSH + pull + up + healthcheck)
```

**Deploy manual** (via GitHub Actions):

1. Ir em Actions > "Deploy — Producao" > Run workflow
2. Informar `IMAGE_TAG` (SHA de 7 chars do commit desejado ou `latest`)
3. O workflow valida o formato, verifica a imagem no registry e deploya via SSH

---

## 5. Rollback

```bash
# No servidor:
cd /opt/ioc-esg-municipal

# 1. Identificar SHA da versao anterior
docker compose -f docker-compose.prod.yml logs api --tail=5
# ou consultar git log no repositorio

# 2. Subir versao anterior
IMAGE_TAG=<sha-anterior> docker compose -f docker-compose.prod.yml up -d api

# 3. Verificar saude
curl http://localhost:3000/health

# 4. Se envolveu migration destrutiva, verificar historico
docker exec ioc_postgres_prod psql -U $DATABASE_USER -d $DATABASE_NAME \
  -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
```

**Atencao:** rollback de migrations destrutivas (DROP COLUMN, DROP TABLE) requer restore de backup.

---

## 6. SSL (HTTPS)

### Setup inicial

```bash
# DNS deve apontar para o servidor antes de executar
DOMAIN=app.seudominio.com.br EMAIL=admin@seudominio.com.br ./scripts/setup-ssl.sh
```

O script:

1. Solicita certificado Let's Encrypt via Certbot (webroot mode)
2. Cria symlinks para nginx
3. Reinicia nginx com config SSL
4. Instala crontab de renovacao automatica (diario as 3h)

### Renovacao

A renovacao e automatica via crontab instalado pelo `setup-ssl.sh`.
Para verificar: `crontab -l | grep ioc-ssl-renew`

### Renovacao manual (emergencia)

```bash
cd /opt/ioc-esg-municipal
docker compose -f docker-compose.prod.yml -f docker-compose.prod.ssl.yml \
  --profile ssl run --rm certbot renew --quiet
docker compose -f docker-compose.prod.yml -f docker-compose.prod.ssl.yml \
  exec nginx nginx -s reload
```

---

## 7. Monitoramento

### Servicos disponiveis

| Servico      | URL local             | Descricao             |
| ------------ | --------------------- | --------------------- |
| API          | http://localhost:3000 | Backend Express       |
| Prometheus   | http://localhost:9090 | Metricas e alertas    |
| Grafana      | http://localhost:3001 | Dashboards            |
| Alertmanager | http://localhost:9093 | Roteamento de alertas |

Todos expostos apenas em `127.0.0.1` — nao acessiveis externamente sem proxy.

### Alertas

O alertmanager esta configurado com webhook stub (loga via Winston).
Para producao real, substituir por receiver Slack/email em `monitoring/alertmanager.yml`:

```yaml
receivers:
  - name: slack
    slack_configs:
      - api_url: ${SLACK_WEBHOOK_URL}
        channel: "#alertas-ioc"
```

---

## 8. Troubleshooting

### API nao responde

```bash
# Verificar status dos containers
docker compose -f docker-compose.prod.yml ps

# Verificar logs recentes
docker compose -f docker-compose.prod.yml logs api --tail=100

# Verificar conexao com banco
docker compose -f docker-compose.prod.yml exec postgres \
  pg_isready -U $DATABASE_USER -d $DATABASE_NAME

# Verificar conexao com Redis
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli -a $REDIS_PASSWORD ping
```

### Container reiniciando em loop

```bash
# Ver eventos de restart
docker compose -f docker-compose.prod.yml events --filter event=restart

# Inspecionar ultimo log antes do crash
docker compose -f docker-compose.prod.yml logs api --tail=50 --no-log-prefix
```

### Disco cheio

```bash
# Verificar uso
df -h /

# Limpar imagens Docker antigas
docker image prune -f --filter "until=72h"

# Limpar logs antigos dos containers
docker system prune --volumes -f
```

### Migrations falharam

```bash
# Ver status das migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate status

# Ver migrations aplicadas
docker exec ioc_postgres_prod psql -U $DATABASE_USER -d $DATABASE_NAME \
  -c "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"

# Retentar migration (idempotente)
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

### Grafana nao abre

```bash
# Verificar se a variavel GRAFANA_PASSWORD esta definida
# (compose falha com mensagem clara se nao estiver)
docker compose -f docker-compose.prod.yml config --quiet 2>&1

# Reset de senha do admin
docker compose -f docker-compose.prod.yml exec grafana \
  grafana-cli admin reset-admin-password <nova-senha>
```

---

## 9. Backup

### Banco de dados

```bash
# Backup completo
docker exec ioc_postgres_prod pg_dump -U $DATABASE_USER -d $DATABASE_NAME \
  --format=custom -f /tmp/backup.dump

# Copiar para fora do container
docker cp ioc_postgres_prod:/tmp/backup.dump ./backups/$(date +%Y%m%d).dump

# Restore (em caso de desastre)
docker exec -i ioc_postgres_prod pg_restore -U $DATABASE_USER -d $DATABASE_NAME \
  --clean --if-exists < ./backups/20260415.dump
```

### Redis

Redis usa `appendonly yes` com fsync a cada segundo. Os dados persistem em restart.
Para backup manual do AOF:

```bash
docker exec ioc_redis_prod redis-cli -a $REDIS_PASSWORD BGSAVE
docker cp ioc_redis_prod:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb
```

---

_Ultima atualizacao: 2026-04-15_
