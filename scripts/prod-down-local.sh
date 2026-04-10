#!/usr/bin/env bash
# =============================================================================
# scripts/prod-down-local.sh
#
# Derruba a stack prod-local iniciada por scripts/prod-up-local.sh.
# Preserva os volumes por padrão. Passe --purge para remover também os dados.
# =============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.prod.local"
ARGS=(-f docker-compose.prod.yml -f docker-compose.prod.local.yml)

if [ -f "$ENV_FILE" ]; then
  ARGS+=(--env-file "$ENV_FILE")
fi

if [ "${1:-}" = "--purge" ]; then
  echo "[prod-local] Derrubando stack + REMOVENDO VOLUMES..."
  docker compose "${ARGS[@]}" down -v
else
  echo "[prod-local] Derrubando stack (volumes preservados)..."
  docker compose "${ARGS[@]}" down
fi
