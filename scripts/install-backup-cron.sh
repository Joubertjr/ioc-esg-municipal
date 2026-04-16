#!/usr/bin/env bash
# =============================================================================
# scripts/install-backup-cron.sh
#
# Instala crontab idempotente para backup diario do PostgreSQL as 02:00 UTC.
#
# Uso:
#   bash scripts/install-backup-cron.sh              # instala crontab
#   bash scripts/install-backup-cron.sh --uninstall  # remove crontab
#
# O que faz:
#   1. Cria /var/log/ioc-backup.log com permissao adequada (se possivel)
#   2. Remove entrada anterior (idempotente) via marker "# ioc-pg-backup"
#   3. Adiciona nova entrada: 0 2 * * * cd <pwd> && bash scripts/backup-postgres.sh >> /var/log/ioc-backup.log 2>&1
# =============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

CRON_MARKER="# ioc-pg-backup"
LOG_FILE="/var/log/ioc-backup.log"
PROJECT_DIR="$(pwd)"
BACKUP_CMD="cd ${PROJECT_DIR} && bash scripts/backup-postgres.sh >> ${LOG_FILE} 2>&1"
CRON_ENTRY="0 2 * * * ${BACKUP_CMD} ${CRON_MARKER}"

# Uninstall
if [[ "${1:-}" == "--uninstall" ]]; then
  echo "[install-backup-cron] Removendo crontab de backup..."
  (crontab -l 2>/dev/null | grep -v "$CRON_MARKER" || true) | crontab -
  echo "[install-backup-cron] Crontab removido. Verificar com: crontab -l"
  exit 0
fi

# Prepara log file (best effort — pode falhar se nao for root)
if [[ ! -f "$LOG_FILE" ]]; then
  if touch "$LOG_FILE" 2>/dev/null; then
    chmod 644 "$LOG_FILE" 2>/dev/null || true
    echo "[install-backup-cron] Log file criado: $LOG_FILE"
  else
    LOG_FILE="${PROJECT_DIR}/backups/backup.log"
    mkdir -p "${PROJECT_DIR}/backups"
    touch "$LOG_FILE"
    CRON_ENTRY="0 2 * * * cd ${PROJECT_DIR} && bash scripts/backup-postgres.sh >> ${LOG_FILE} 2>&1 ${CRON_MARKER}"
    echo "[install-backup-cron] AVISO: sem permissao em /var/log — usando ${LOG_FILE}"
  fi
fi

echo "[install-backup-cron] Instalando crontab (02:00 UTC diario)..."
# Remove marker antigo e adiciona nova entrada
(crontab -l 2>/dev/null | grep -v "$CRON_MARKER" || true; echo "$CRON_ENTRY") | crontab -

echo "[install-backup-cron] Crontab instalado:"
crontab -l | grep "$CRON_MARKER"

echo ""
echo "[install-backup-cron] Concluido."
echo "[install-backup-cron] Testar manualmente: bash scripts/backup-postgres.sh"
echo "[install-backup-cron] Verificar log: tail -f ${LOG_FILE}"
