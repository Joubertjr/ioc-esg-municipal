#!/usr/bin/env bash
# =============================================================================
# scripts/backup-postgres.sh
#
# Backup automatico do PostgreSQL de producao via pg_dump em formato custom.
# Rotaciona mantendo os ultimos N dias de backups (default: 7).
#
# Uso (manual):
#   bash scripts/backup-postgres.sh
#
# Uso (cron — ver scripts/install-backup-cron.sh):
#   0 2 * * * cd /opt/ioc-esg-municipal && bash scripts/backup-postgres.sh >> /var/log/ioc-backup.log 2>&1
#
# Variaveis opcionais:
#   BACKUP_DIR     (default: ./backups)
#   RETENTION_DAYS (default: 7)
#   COMPOSE_FILE   (default: docker-compose.prod.yml)
#   CONTAINER      (default: ioc_postgres_prod)
#
# Exit codes:
#   0 = sucesso
#   1 = erro no pg_dump
#   2 = container nao encontrado
# =============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
CONTAINER="${CONTAINER:-ioc_postgres_prod}"
TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")

# Carregar .env para obter DATABASE_USER/NAME
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${DATABASE_USER:?DATABASE_USER nao definido — configurar .env}"
: "${DATABASE_NAME:?DATABASE_NAME nao definido — configurar .env}"

mkdir -p "$BACKUP_DIR"

# Verifica container rodando
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[backup-postgres] ERRO: container ${CONTAINER} nao esta rodando." >&2
  exit 2
fi

BACKUP_FILE="${BACKUP_DIR}/ioc-esg-${TIMESTAMP}.dump"

echo "[backup-postgres] Iniciando backup: ${BACKUP_FILE}"
echo "[backup-postgres] Container: ${CONTAINER} | DB: ${DATABASE_NAME} | User: ${DATABASE_USER}"

# pg_dump em formato custom (-Fc) — permite restore seletivo com pg_restore
if ! docker exec "$CONTAINER" pg_dump \
  -U "$DATABASE_USER" \
  -d "$DATABASE_NAME" \
  --format=custom \
  --no-owner \
  --no-privileges \
  > "$BACKUP_FILE"; then
  echo "[backup-postgres] ERRO: pg_dump falhou." >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[backup-postgres] Backup OK: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Rotacao: remove backups com mais de RETENTION_DAYS dias
echo "[backup-postgres] Rotacao: mantendo ultimos ${RETENTION_DAYS} dias..."
DELETED=$(find "$BACKUP_DIR" -name 'ioc-esg-*.dump' -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')
echo "[backup-postgres] Removidos: ${DELETED} backup(s) antigo(s)"

# Lista backups atuais
REMAINING=$(find "$BACKUP_DIR" -name 'ioc-esg-*.dump' -type f | wc -l | tr -d ' ')
echo "[backup-postgres] Backups mantidos: ${REMAINING}"

echo "[backup-postgres] Concluido em $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
