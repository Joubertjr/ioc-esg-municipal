#!/usr/bin/env bash
# =============================================================================
# scripts/configure-slack-alerts.sh
#
# Configura o webhook real do Slack para alertas criticos do Alertmanager.
#
# Uso:
#   bash scripts/configure-slack-alerts.sh https://hooks.slack.com/services/T00/B00/XXXX
#
# O que faz:
#   1. Valida formato do URL (precisa comecar com https://hooks.slack.com/)
#   2. Escreve em monitoring/slack_url (ignorado pelo git)
#   3. Ajusta permissoes para 0600
#   4. Se o container alertmanager estiver rodando, recarrega config via SIGHUP
#
# Seguranca:
#   - Arquivo monitoring/slack_url esta no .gitignore
#   - Permissao 0600 impede leitura por outros usuarios do servidor
#   - Alertmanager le via api_url_file (nao aparece em logs)
# =============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

WEBHOOK_URL="${1:-}"
TARGET_FILE="monitoring/slack_url"

if [[ -z "$WEBHOOK_URL" ]]; then
  echo "ERRO: URL do webhook obrigatorio." >&2
  echo "Uso: bash scripts/configure-slack-alerts.sh https://hooks.slack.com/services/..." >&2
  exit 1
fi

if ! echo "$WEBHOOK_URL" | grep -qE '^https://hooks\.slack\.com/services/[A-Z0-9]+/[A-Z0-9]+/[A-Za-z0-9]+$'; then
  echo "ERRO: Formato de URL invalido." >&2
  echo "Esperado: https://hooks.slack.com/services/<team>/<channel>/<token>" >&2
  echo "Recebido: $WEBHOOK_URL" >&2
  exit 1
fi

echo "[configure-slack-alerts] Escrevendo webhook em $TARGET_FILE..."
echo "$WEBHOOK_URL" > "$TARGET_FILE"
chmod 600 "$TARGET_FILE"
echo "[configure-slack-alerts] Permissao 0600 aplicada."

# Tenta recarregar alertmanager se estiver rodando (ignora erros)
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^ioc_alertmanager$'; then
  echo "[configure-slack-alerts] Container ioc_alertmanager detectado — enviando SIGHUP para recarga..."
  if docker kill -s HUP ioc_alertmanager >/dev/null 2>&1; then
    echo "[configure-slack-alerts] Alertmanager recarregou a config com sucesso."
  else
    echo "[configure-slack-alerts] AVISO: SIGHUP falhou. Reinicie manualmente:"
    echo "  docker compose -f docker-compose.prod.yml restart alertmanager"
  fi
else
  echo "[configure-slack-alerts] Alertmanager nao esta rodando. Na proxima subida do stack o webhook sera usado."
fi

echo ""
echo "[configure-slack-alerts] Concluido. Testar com:"
echo "  docker compose -f docker-compose.prod.yml exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml"
