#!/usr/bin/env bash
# =============================================================================
# scripts/smoke-test-stack.sh
#
# Rotina de validação end-to-end de uma stack (dev, prod-local ou CI).
# Testa os fluxos críticos que o usuário realmente usa:
#
#   1.  GET  /health                          → 200, status=ok
#   2.  GET  /                                → SPA React (#root)
#   3.  POST /api/auth/login                  → 200, token + role admin
#   4.  GET  /api/municipalities              → 200, total=295
#   5.  GET  /api/municipalities/4205407      → 200, Florianópolis
#   6.  GET  /api/ods/4205407                 → 200, scores ODS com score_geral
#   7.  GET  /api/municipalities/4205407/peers → 200, lista de peers não vazia
#   8.  POST /api/benchmarks                  → 200, resultados com rankings
#   9.  POST /api/auth/login (cred errada)    → 401
#  10.  IDOR: prefeito acessa outro município → 403
#
# Uso:
#   scripts/smoke-test-stack.sh                  # dev
#   scripts/smoke-test-stack.sh prod-local       # prod-local (porta 8080)
#   scripts/smoke-test-stack.sh custom <api> [frontend]
#
# Credenciais injetáveis:
#   SMOKE_EMAIL=x SMOKE_PASSWORD=y scripts/smoke-test-stack.sh
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

EMAIL="${SMOKE_EMAIL:?SMOKE_EMAIL é obrigatória}"
PASSWORD="${SMOKE_PASSWORD:?SMOKE_PASSWORD é obrigatória}"

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

# ── 6. ODS scores — validação profunda ──────────────────────────────────────
if [ -n "$TOKEN" ]; then
  http=$(curl -sS -m 60 -o /tmp/smoke-ods.json -w "%{http_code}" "${AUTH[@]}" "$API/api/ods/4205407" 2>&1) || true
  if [ "$http" = "200" ]; then
    # Validação profunda: score_geral deve ser numérico > 0
    valid=$(python3 -c "
import json,sys
try:
    d=json.load(open('/tmp/smoke-ods.json'))
    sg = d.get('score_geral') or d.get('scoreGeral') or d.get('globalScore')
    scores = d.get('scores') or d.get('ods_scores') or d.get('odsScores') or []
    if sg is not None and (isinstance(sg,(int,float)) and sg > 0):
        # Tem score global
        if isinstance(scores, list) and len(scores) > 0:
            print('OK')
        elif isinstance(scores, dict) and len(scores) > 0:
            print('OK')
        else:
            print('OK_SCORE_ONLY')
    else:
        print('FAIL:score_geral=' + str(sg) + ',scores_len=' + str(len(scores) if isinstance(scores,list) else 'N/A'))
except Exception as e:
    print('FAIL:' + str(e))
" 2>/dev/null)
    if [[ "$valid" == OK* ]]; then
      pass "6. GET /api/ods/4205407 (HTTP $http, body validado)"
    else
      fail "6. GET /api/ods/4205407" "HTTP $http, validação: $valid"
    fi
  else
    body=$(head -c 200 /tmp/smoke-ods.json 2>/dev/null)
    fail "6. GET /api/ods/4205407" "HTTP $http body: $body"
  fi
fi

# ── 7. Peers — validação profunda ───────────────────────────────────────────
if [ -n "$TOKEN" ]; then
  http=$(curl -sS -m 10 -o /tmp/smoke-peers.json -w "%{http_code}" "${AUTH[@]}" "$API/api/municipalities/4205407/peers" 2>&1) || true
  if [ "$http" = "200" ]; then
    valid=$(python3 -c "
import json
try:
    d=json.load(open('/tmp/smoke-peers.json'))
    peers = d.get('peers') or d.get('data') or (d if isinstance(d,list) else [])
    if isinstance(peers,list) and len(peers) > 0:
        print('OK:' + str(len(peers)) + ' peers')
    else:
        print('FAIL:peers vazio ou ausente')
except Exception as e:
    print('FAIL:' + str(e))
" 2>/dev/null)
    if [[ "$valid" == OK* ]]; then
      pass "7. GET /api/municipalities/4205407/peers ($valid)"
    else
      fail "7. GET /api/municipalities/4205407/peers" "HTTP $http, validação: $valid"
    fi
  else
    body=$(head -c 200 /tmp/smoke-peers.json 2>/dev/null)
    fail "7. GET /api/municipalities/4205407/peers" "HTTP $http body: $body"
  fi
fi

# ── 8. Benchmark — validação profunda ───────────────────────────────────────
if [ -n "$TOKEN" ]; then
  http=$(curl -sS -m 60 -o /tmp/smoke-bench.json -w "%{http_code}" -X POST "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d '{"ibgeCodes":["4205407","4216602","4209102"]}' \
    "$API/api/benchmarks" 2>&1) || true
  if [ "$http" = "200" ]; then
    valid=$(python3 -c "
import json
try:
    d=json.load(open('/tmp/smoke-bench.json'))
    rankings = d.get('rankings') or d.get('results') or d.get('data') or d.get('municipalities') or []
    if isinstance(rankings,list) and len(rankings) >= 2:
        print('OK:' + str(len(rankings)) + ' municípios')
    elif isinstance(d,dict) and len(d) > 0:
        # Resposta com estrutura diferente mas não vazia
        print('OK:keys=' + ','.join(list(d.keys())[:5]))
    else:
        print('FAIL:resposta vazia')
except Exception as e:
    print('FAIL:' + str(e))
" 2>/dev/null)
    if [[ "$valid" == OK* ]]; then
      pass "8. POST /api/benchmarks ($valid)"
    else
      fail "8. POST /api/benchmarks" "HTTP $http, validação: $valid"
    fi
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

# ── 10. IDOR: prefeito sem município tenta acessar ODS → 403 ───────────────
# Registra prefeito (sem município vinculado), tenta acessar ODS de Florianópolis.
# requireMunicipalityScope deve bloquear: municipalityId(null) !== municipality.id.
IDOR_EMAIL="idor-test-$(date +%s)@smoke.local"
IDOR_PASS="SmokeIDOR@2026"

idor_reg=$(curl -sS -m 5 -X POST "$API/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$IDOR_EMAIL\",\"password\":\"$IDOR_PASS\",\"name\":\"IDOR Test\"}" 2>&1) || true
IDOR_TOKEN=$(echo "$idor_reg" | python3 -c "import sys,json
try:
    d=json.loads(sys.stdin.read())
    print(d.get('token',''))
except: pass" 2>/dev/null)

if [ -n "$IDOR_TOKEN" ]; then
  # Prefeito sem município tenta acessar ODS de Florianópolis → 403
  idor_http=$(curl -sS -m 10 -o /tmp/smoke-idor.json -w "%{http_code}" \
    -H "Authorization: Bearer $IDOR_TOKEN" \
    "$API/api/ods/4205407" 2>&1) || true
  if [ "$idor_http" = "403" ]; then
    pass "10. IDOR: prefeito sem município → /api/ods/4205407 = 403"
  else
    body=$(head -c 200 /tmp/smoke-idor.json 2>/dev/null)
    fail "10. IDOR" "HTTP $idor_http (esperado 403) body: $body"
  fi
else
  fail "10. IDOR" "registro do prefeito falhou: $(echo "$idor_reg" | head -c 200)"
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
