#!/usr/bin/env bash
# =============================================================================
# scripts/prod-up-local.sh
#
# Sobe a stack de PRODUÇÃO localmente (postgres + redis + api), usando a
# imagem Docker construída via `docker build -t ioc-esg-municipal:latest .`.
#
# Finalidade: validar que a imagem multi-stage funciona de ponta a ponta antes
# de um deploy real. NÃO é deploy em produção — não há TLS nem nginx.
#
# Pré-requisitos:
#   1. Imagem local construída: `docker build -t ioc-esg-municipal:latest .`
#   2. Porta 8080 livre no host (usada para expor a API)
#   3. Dev stack parado: `pnpm docker:down` (para evitar conflito em 5432/6379)
#
# O script gera automaticamente `.env.prod.local` na primeira execução com
# segredos aleatórios fortes. O arquivo está no .gitignore.
# =============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.prod.local"
IMAGE_TAG="${IMAGE_TAG:-latest}"

if [ ! -f "$ENV_FILE" ]; then
  echo "[prod-local] Gerando $ENV_FILE com segredos aleatorios..."
  JWT=$(openssl rand -hex 32)
  REDIS_PWD=$(openssl rand -hex 16)
  GRAFANA_PWD=$(openssl rand -hex 16)
  cat > "$ENV_FILE" <<EOF
# Gerado automaticamente por scripts/prod-up-local.sh — NAO commitar.
# Este arquivo serve apenas para validacao local da imagem de producao.
REGISTRY=
IMAGE_TAG=${IMAGE_TAG}

# Banco (usa mesmo dataset do dev por conveniencia, mas em volume separado)
DATABASE_USER=ioc
DATABASE_PASSWORD=ioc_prod_local_2026
DATABASE_NAME=ioc_esg

# Auth
JWT_SECRET=${JWT}
JWT_EXPIRATION=1d

# Redis
REDIS_PASSWORD=${REDIS_PWD}

# Grafana (admin password)
GRAFANA_PASSWORD=${GRAFANA_PWD}

# CORS — API exposta em http://localhost:8080
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173

# Logging
LOG_LEVEL=info

# APIs governamentais (defaults do .env.production.example)
IBGE_API_URL=https://servicodados.ibge.gov.br/api/v1
SICONFI_API_URL=https://api.siconfi.tesouro.gov.br/v1
DATASUS_API_URL=https://datasus.saude.gov.br
INPE_API_URL=https://terrabrasilis.dpi.inpe.br/api/v1
PNCP_API_URL=https://pncp.gov.br/api/pncp/v1

AGENT_TIMEOUT=30000
AGENT_RETRY_COUNT=3
AGENT_RETRY_DELAY=1000
EOF
  echo "[prod-local] $ENV_FILE criado."
fi

# Valida que a imagem existe
if ! docker image inspect "ioc-esg-municipal:${IMAGE_TAG}" >/dev/null 2>&1; then
  echo "[prod-local] ERRO: imagem 'ioc-esg-municipal:${IMAGE_TAG}' nao existe." >&2
  echo "[prod-local] Construa primeiro: docker build -t ioc-esg-municipal:${IMAGE_TAG} ." >&2
  exit 1
fi

echo "[prod-local] Subindo stack (postgres + redis + api)..."
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.prod.local.yml \
  --env-file "$ENV_FILE" \
  up -d postgres redis api

echo "[prod-local] Aguardando API ficar saudavel..."
for i in $(seq 1 30); do
  if curl -fsS http://localhost:8080/health >/dev/null 2>&1; then
    echo "[prod-local] API saudavel apos ${i}s"
    curl -fsS http://localhost:8080/health
    echo
    echo "[prod-local] OK. Acesse http://localhost:8080/"
    echo "[prod-local] Derrubar: scripts/prod-down-local.sh"
    exit 0
  fi
  sleep 1
done

echo "[prod-local] ERRO: API nao ficou saudavel em 30s" >&2
echo "[prod-local] Logs:" >&2
docker compose -f docker-compose.prod.yml -f docker-compose.prod.local.yml logs --tail=80 api >&2
exit 1
