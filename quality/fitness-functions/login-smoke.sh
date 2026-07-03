#!/usr/bin/env bash
set -euo pipefail

echo "=== FITNESS: Login smoke test ==="
start=$(date +%s)

API_URL="${API_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@ioc.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@SC2026!}"

# 1. Health check
echo "Verificando health..."
if ! curl -sf "$API_URL/health" > /dev/null 2>&1; then
  echo "FAIL — API não responde em $API_URL/health"
  echo "Stack de produção está rodando? (docker compose -f docker-compose.prod.yml up -d)"
  exit 1
fi
echo "Health: OK"

# 2. Login com credenciais erradas deve falhar
echo "Testando login com senha errada..."
wrong_response=$(curl -sf -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ioc.local","password":"wrongpassword"}' \
  -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

if [ "$wrong_response" = "401" ]; then
  echo "Senha errada rejeitada: OK"
elif [ "$wrong_response" = "000" ]; then
  echo "FAIL — API não respondeu ao login"
  exit 1
else
  echo "WARN — senha errada retornou $wrong_response (esperado 401)"
fi

# 3. Login com credenciais corretas deve retornar JWT
echo "Testando login com credenciais corretas..."
login_response=$(curl -sf -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null || echo "FAIL")

if echo "$login_response" | grep -q "token\|accessToken"; then
  echo "Login com JWT: OK"
else
  echo "FAIL — login não retornou token"
  echo "Response: $login_response"
  exit 1
fi

# 4. Extrair token e verificar /auth/me
token=$(echo "$login_response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
if [ -z "$token" ]; then
  token=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
fi

if [ -n "$token" ]; then
  echo "Verificando /auth/me..."
  me_response=$(curl -sf "$API_URL/api/auth/me" \
    -H "Authorization: Bearer $token" 2>/dev/null || echo "FAIL")

  if echo "$me_response" | grep -q "email"; then
    echo "/auth/me: OK"
  else
    echo "WARN — /auth/me não retornou email"
  fi
fi

end=$(date +%s)
echo "PASS — login smoke test completo ($(( end - start ))s)"
exit 0
