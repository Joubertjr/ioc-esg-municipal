#!/usr/bin/env bash
# =============================================================================
# scripts/setup-ssl.sh
#
# Provisiona certificados Let's Encrypt para deploy direto (sem LB externo).
#
# Uso:
#   DOMAIN=app.ioc.com.br EMAIL=admin@ioc.com.br ./scripts/setup-ssl.sh
#
# Pre-requisitos:
#   - DNS do DOMAIN apontando para o IP deste servidor
#   - Portas 80 e 443 abertas no firewall
#   - Docker e docker compose instalados
#   - Stack base rodando: docker compose -f docker-compose.prod.yml up -d
# =============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

DOMAIN="${DOMAIN:?Defina DOMAIN=app.ioc.com.br}"
EMAIL="${EMAIL:?Defina EMAIL=admin@ioc.com.br}"
COMPOSE_BASE="docker-compose.prod.yml"
COMPOSE_SSL="docker-compose.prod.ssl.yml"
SSL_DIR="./nginx/ssl"

echo "[setup-ssl] Dominio: $DOMAIN"
echo "[setup-ssl] Email: $EMAIL"

# 1. Garante que nginx HTTP-only esta rodando (para ACME challenge)
echo "[setup-ssl] Iniciando nginx em modo HTTP..."
docker compose -f "$COMPOSE_BASE" up -d nginx

# 2. Solicita certificado via Certbot (webroot mode)
echo "[setup-ssl] Solicitando certificado Let's Encrypt..."
docker run --rm \
  -v "${SSL_DIR}:/etc/letsencrypt" \
  -v "$(docker volume inspect ioc-esg-municipal_certbot_www -f '{{.Mountpoint}}' 2>/dev/null || echo '/tmp/certbot_www'):/var/www/certbot" \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

# 3. Cria symlinks com nomes esperados pelo nginx.conf
LIVE_DIR="${SSL_DIR}/live/${DOMAIN}"
if [ -d "$LIVE_DIR" ]; then
  echo "[setup-ssl] Criando symlinks para cert.pem e key.pem..."
  ln -sf "live/${DOMAIN}/fullchain.pem" "${SSL_DIR}/cert.pem"
  ln -sf "live/${DOMAIN}/privkey.pem" "${SSL_DIR}/key.pem"
fi

# 4. Reinicia com config SSL
echo "[setup-ssl] Reiniciando nginx com SSL..."
docker compose -f "$COMPOSE_BASE" -f "$COMPOSE_SSL" up -d nginx

# 5. Verifica
echo "[setup-ssl] Verificando HTTPS..."
sleep 3
if curl -fsS "https://${DOMAIN}/health" >/dev/null 2>&1; then
  echo "[setup-ssl] HTTPS OK: https://${DOMAIN}/health"
else
  echo "[setup-ssl] AVISO: HTTPS nao respondeu. Verifique os logs:"
  echo "  docker compose -f $COMPOSE_BASE -f $COMPOSE_SSL logs nginx"
fi

# 6. Configura renovacao automatica via crontab (idempotente)
CRON_MARKER="# ioc-ssl-renew"
CRON_CMD="0 3 * * * cd $(pwd) && docker compose -f $COMPOSE_BASE -f $COMPOSE_SSL --profile ssl run --rm certbot renew --quiet && docker compose -f $COMPOSE_BASE -f $COMPOSE_SSL exec nginx nginx -s reload $CRON_MARKER"

if [[ "${1:-}" == "--skip-crontab" ]]; then
  echo "[setup-ssl] --skip-crontab: crontab nao instalado."
  echo "[setup-ssl] Para instalar manualmente:"
  echo "  $CRON_CMD"
else
  echo "[setup-ssl] Instalando crontab de renovacao automatica (3h diario)..."
  # Remove entrada anterior (idempotente) e adiciona nova
  (crontab -l 2>/dev/null | grep -v "$CRON_MARKER" || true; echo "$CRON_CMD") | crontab -
  echo "[setup-ssl] Crontab instalado. Verificar com: crontab -l"
fi

echo ""
echo "[setup-ssl] Concluido."
