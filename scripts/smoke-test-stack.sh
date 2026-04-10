#!/usr/bin/env bash
# =============================================================================
# scripts/smoke-test-stack.sh
#
# Rotina de validação end-to-end de uma stack (dev ou prod-local).
# Testa os fluxos críticos que o usuário realmente usa:
#
#   1.  GET  /health                          → 200, service=ioc-esg-municipal
#   2.  GET  /                                → SPA React servida (index.html)
#   3.  POST /api/auth/login                  → 200, token + role admin
#   4.  GET  /api/municipalities              → 200, total=295 (SC)
#   5.  GET  /api/municipalities/4205407      → 200, Florianópolis
#   6.  GET  /api/ods/4205407                 → 200, scores ODS
#   7.  GET  /api/municipalities/4205407/peers → 200, peers
#   8.  POST /api/benchmarks                  → 200, benchmark entre municípios
#   9.  POST /api/auth/login (cred errada)    → 401 (não 500)
#
# Uso:
#   scripts/smoke-test-stack.sh                  # dev
#   scripts/smoke-test-stack.sh prod-local       # prod-local (porta 8080)
#   scripts/smoke-test-stack.sh custom http://host:port
#
# Dev mode:
#   Backend em :3000 (API) e frontend em :5173 (Vite) — testes 2 usam :5173.
# Prod-local mode:
#   Tudo em :8080 (Express serve React bundle).
#
# Exit code: 0 = todos passaram, 1 = pelo menos um falhou.
# =============================================================================

set -uo pipefail

MODE="${1:-dev}"
case "$MODE" in
  dev)
    API="http://localhost:3000"
    FRONTEND="http://localhost:5173"
    ;;
  prod-local)
    API="http://localhost:8080"
    FRONTEND="http://localhost:8080"
    ;;
  custom)
    API="${2:-http://localhost:3000}"
    FRONTEND="${3:-$API}"
    ;;
  *)
    echo "Uso: $0 [dev|prod-local|custom <api> <frontend>]" >&2
    exit 2
    ;;
esac

EMAIL="admin@ioc.local"
PASSWORD="Admin@2026"

PASS=0
FAIL=0
FAILED_TESTS=()

pass() { PASS=$((PASS+1)); printf "  \033[32mOK\033[0m  %s\n" "$1"; }
fail() { FAIL=$((FAIL+1)); FAILED_TESTS+=("$1"); printf "  \033[31mFAIL\033[0m %s — %s\n" "$1" "$2"; }

echo "═══════════════════════════════════════════════════════════════════"
echo "  Smoke test — modo: $MODE"
echo "  API:      $API"
echo "  Frontend: $FRONTEND"
echo "═══════════════════════════════════════════════════════════════════"

# ── 1. Health ───────────────────────────────────────────────────────────────
body=$(curl -sS -m 5 "$API/health" 2>&1) || true
if echo "$body" | grep -q '"status":"ok"'; then
  pass "1. GET /health"
else
  fail "1. GET /health" "resposta: $(echo "$body" | head -c 200)"
fi

# ── 2. Frontend SPA ──────────────────────────────────────────────────────────
body=$(curl -sS -m 5 "$FRONTEND/" 2>&1) || true
if echo "$body" | grep -qi '<div id="root">'; then
  pass "2. GET / (frontend SPA)"
else
  fail "2. GET /" "index.html sem #root (head: $(echo "$body" | head -c 120))"
fi

# ── 3. Login admin ──────────────────────────────────────────────────────────
login=$(curl -sS -m 5 -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>&1) || true
TOKEN=$(echo "$login" | python3 -c "import sys,json
try:
    d=json.loads(sys.stdin.read())
    print(d.get('token',''))
except: pass" 2>/dev/null)
ROLE=$(echo "$login" | python3 -c "import sys,json
try:
    d=json.loads(sys.stdin.read())
    print(d.get('user',{}).get('role',''))
except: pass" 2>/dev/null)

if [ -n "$TOKEN" ] && [ "$ROLE" = "admin" ]; then
  pass "3. POST /api/auth/login (role=$ROLE)"
else
  fail "3. POST /api/auth/login" "resposta: $(echo "$login" | head -c 200)"
  TOKEN=""
fi

AUTH=(-H "Authorization: Bearer $TOKEN")

# ── 4. Lista de municípios (total=295) ──────────────────────────────────────
if [ -n "$TOKEN" ]; then
  resp=$(curl -sS -m 10 "${AUTH[@]}" "$API/api/municipalities?limit=500" 2>&1) || true
  total=$(echo "$resp" | python3 -c "import sys,json
try:
    d=json.loads(sys.stdin.read())
    print(d.get('total','ERR') if isinstance(d,dict) else 'ERR')
except: print('ERR')" 2>/dev/null)
  if [ "$total" = "295" ]; then
    pass "4. GET /api/municipalities (total=295)"
  else
    fail "4. GET /api/municipalities" "total=$total (esperado 295)"
  fi
else
  fail "4. GET /api/municipalities" "sem token"
fi

# ── 5. Florianópolis ────────────────────────────────────────────────────────
if [ -n "$TOKEN" ]; then
  resp=$(curl -sS -m 5 "${AUTH[@]}" "$API/api/municipalities/4205407" 2>&1) || true
  name=$(echo "$resp" | python3 -c "import sys,json
try:
    d=json.loads(sys.stdin.read())
    print((d.get('data') or d).get('name',''))
except: pass" 2>/dev/null)
  if [ "$name" = "Florianópolis" ]; then
    pass "5. GET /api/municipalities/4205407"
  else
    fail "5. GET /api/municipalities/4205407" "name='$name'"
  fi
fi

# ── 6. ODS scores de Florianópolis ──────────────────────────────────────────
if [ -n "$TOKEN" ]; then
  http=$(curl -sS -m 60 -o /tmp/smoke-ods.json -w "%{http_code}" "${AUTH[@]}" "$API/api/ods/4205407" 2>&1) || true
  if [ "$http" = "200" ]; then
    pass "6. GET /api/ods/4205407 (HTTP $http)"
  else
    body=$(head -c 200 /tmp/smoke-ods.json 2>/dev/null)
    fail "6. GET /api/ods/4205407" "HTTP $http body: $body"
  fi
fi

# ── 7. Peers de Florianópolis ───────────────────────────────────────────────
if [ -n "$TOKEN" ]; then
  http=$(curl -sS -m 10 -o /tmp/smoke-peers.json -w "%{http_code}" "${AUTH[@]}" "$API/api/municipalities/4205407/peers" 2>&1) || true
  if [ "$http" = "200" ]; then
    pass "7. GET /api/municipalities/4205407/peers (HTTP $http)"
  else
    body=$(head -c 200 /tmp/smoke-peers.json 2>/dev/null)
    fail "7. GET /api/municipalities/4205407/peers" "HTTP $http body: $body"
  fi
fi

# ── 8. Benchmark entre municípios (POST) ────────────────────────────────────
if [ -n "$TOKEN" ]; then
  http=$(curl -sS -m 60 -o /tmp/smoke-bench.json -w "%{http_code}" -X POST "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d '{"ibgeCodes":["4205407","4216602","4209102"]}' \
    "$API/api/benchmarks" 2>&1) || true
  if [ "$http" = "200" ]; then
    pass "8. POST /api/benchmarks (HTTP $http)"
  else
    body=$(head -c 200 /tmp/smoke-bench.json 2>/dev/null)
    fail "8. POST /api/benchmarks" "HTTP $http body: $body"
  fi
fi

# ── 9. Login inválido → 401, não 500 ───────────────────────────────────────
http=$(curl -sS -m 5 -o /tmp/smoke-bad.json -w "%{http_code}" -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ioc.local","password":"senha-errada"}' 2>&1) || true
if [ "$http" = "401" ]; then
  pass "9. POST /api/auth/login (credencial errada → 401)"
else
  body=$(head -c 200 /tmp/smoke-bad.json 2>/dev/null)
  fail "9. POST /api/auth/login (inválido)" "HTTP $http (esperado 401) body: $body"
fi

# ── Relatório final ─────────────────────────────────────────────────────────
echo "───────────────────────────────────────────────────────────────────"
echo "  Passou: $PASS    Falhou: $FAIL"
if [ $FAIL -gt 0 ]; then
  echo "  Testes que falharam:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  exit 1
fi
echo "  Todos os testes passaram."
exit 0
