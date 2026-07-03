#!/bin/sh
# =============================================================================
# IOC ESG Municipal — Docker entrypoint
# Roda migrations antes de iniciar o servidor Node.
#
# O seed NÃO é executado automaticamente a cada restart — isso causaria
# 295 upserts desnecessários em produção e restarts de desenvolvimento lentos.
#
# Para executar o seed (primeira vez ou ambiente fresh):
#   RUN_SEED=true docker compose up
# ou diretamente:
#   docker compose run --rm api sh -c "node dist/prisma/seed.js"
# ou via pnpm fora do container:
#   pnpm db:seed
# =============================================================================
set -e

PRISMA_BIN="./node_modules/.bin/prisma"

echo "==> Rodando Prisma migrations..."
$PRISMA_BIN migrate deploy

if [ "${RUN_SEED}" = "true" ]; then
  echo "==> Rodando seed (295 municípios SC)..."
  node dist/prisma/seed.js
  echo "==> Seed concluído."
else
  echo "==> Seed ignorado (RUN_SEED != true). Use RUN_SEED=true para executar."
fi

echo "==> Iniciando servidor Node..."
exec "$@"
