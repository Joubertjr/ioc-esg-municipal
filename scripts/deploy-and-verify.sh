#!/usr/bin/env bash
# =============================================================================
# scripts/deploy-and-verify.sh
#
# Pipeline completo: build → deploy → smoke test → evidências → report.
# Substitui o ciclo manual que falhava repetidamente.
#
# Uso:
#   bash scripts/deploy-and-verify.sh          # build + deploy + test
#   bash scripts/deploy-and-verify.sh --skip-build  # só deploy + test (imagem já existe)
#   bash scripts/deploy-and-verify.sh --test-only   # só smoke test (stack já está de pé)
#
# Variáveis de ambiente (todas com defaults seguros):
#   ADMIN_EMAIL     — email para login (default: admin@ioc.local)
#   ADMIN_PASSWORD  — senha para login (default: Admin123!)
#   RUN_SEED        — executar seed no deploy (default: true)
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# ─── Args ───────────────────────────────────────────────────────────────────
SKIP_BUILD=false
TEST_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --test-only)  TEST_ONLY=true ;;
  esac
done

# ─── Helpers ────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
TOTAL=0

report() {
  local label="$1"
  local exit_code="$2"
  TOTAL=$((TOTAL + 1))
  if [ "$exit_code" -eq 0 ]; then
    PASS=$((PASS + 1))
    echo -e "\033[32m[PASS]\033[0m $label"
  else
    FAIL=$((FAIL + 1))
    echo -e "\033[31m[FAIL]\033[0m $label"
  fi
}

cleanup_on_fail() {
  echo ""
  echo "Para ver logs: docker compose -f docker-compose.prod.yml logs --tail=50 api"
  echo "Para derrubar: docker compose -f docker-compose.prod.yml down"
}
trap cleanup_on_fail ERR

echo ""
echo "============================================="
echo "  IOC ESG Municipal — Deploy & Verify"
echo "============================================="
echo ""

# ─── Phase 1: Build ────────────────────────────────────────────────────────
if [ "$TEST_ONLY" = false ] && [ "$SKIP_BUILD" = false ]; then
  echo "--- Phase 1: Docker Build ---"
  echo ""

  IMAGE_TAG=$(git rev-parse --short HEAD)
  echo "Building ioc-esg-municipal:${IMAGE_TAG} ..."

  if docker build -t "ioc-esg-municipal:${IMAGE_TAG}" -t ioc-esg-municipal:latest . 2>&1 | tail -5; then
    report "Docker build" 0
  else
    report "Docker build" 1
    echo "FATAL: Docker build falhou. Corrija antes de continuar."
    exit 1
  fi
  echo ""
else
  echo "--- Phase 1: Build (pulado) ---"
  echo ""
fi

# ─── Phase 2: Deploy ───────────────────────────────────────────────────────
if [ "$TEST_ONLY" = false ]; then
  echo "--- Phase 2: Deploy stack produção ---"
  echo ""

  # Derruba stack anterior se existir
  docker compose -f docker-compose.prod.yml down 2>/dev/null || true

  # Sobe stack com defaults seguros
  ALLOWED_ORIGINS='http://localhost,http://localhost:80' \
  RUN_SEED="${RUN_SEED:-true}" \
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@ioc.local}" \
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}" \
  docker compose -f docker-compose.prod.yml up -d

  echo ""
  echo "Aguardando containers ficarem healthy..."
  for i in $(seq 1 60); do
    if curl -sf http://localhost/health > /dev/null 2>&1; then
      echo "Stack saudável após ${i}s"
      report "Stack healthy" 0
      break
    fi
    if [ "$i" -eq 60 ]; then
      report "Stack healthy" 1
      echo "FATAL: Stack não ficou saudável em 60s"
      docker compose -f docker-compose.prod.yml logs --tail=30 api
      exit 1
    fi
    sleep 1
  done
  echo ""
else
  echo "--- Phase 2: Deploy (pulado) ---"
  echo ""
fi

# ─── Phase 3: Smoke Test Login ─────────────────────────────────────────────
echo "--- Phase 3: Smoke Test Login (Playwright) ---"
echo ""

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@ioc.local}" \
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}" \
npx tsx scripts/smoke-test-login.ts http://localhost
LOGIN_EXIT=$?
report "Smoke test login" $LOGIN_EXIT

# ─── Phase 4: API Smoke Test ───────────────────────────────────────────────
echo ""
echo "--- Phase 4: API endpoints ---"
echo ""

# Health
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost/health)
[ "$HTTP_CODE" = "200" ] && report "GET /health → 200" 0 || report "GET /health → $HTTP_CODE" 1

# Login API returns proper error
RESP=$(curl -sf -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"wrong@email.com","password":"wrong"}' 2>&1 || true)
echo "$RESP" | grep -q "Credenciais inválidas" && \
  report "POST /api/auth/login (wrong creds) → mensagem correta" 0 || \
  report "POST /api/auth/login (wrong creds) → mensagem incorreta" 1

# Login API returns token
TOKEN_RESP=$(curl -sf -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL:-admin@ioc.local}\",\"password\":\"${ADMIN_PASSWORD:-Admin123!}\"}" 2>&1 || true)
echo "$TOKEN_RESP" | grep -q "token" && \
  report "POST /api/auth/login (correct creds) → token recebido" 0 || \
  report "POST /api/auth/login (correct creds) → sem token" 1

# CORS headers present
CORS=$(curl -sf -I http://localhost/api/auth/login \
  -H "Origin: http://localhost" 2>&1 || true)
echo "$CORS" | grep -qi "access-control" && \
  report "CORS headers presentes" 0 || \
  report "CORS headers ausentes" 1

# ─── Final Report ──────────────────────────────────────────────────────────
echo ""
echo "============================================="
if [ $FAIL -eq 0 ]; then
  echo -e "  \033[32mTODOS OS TESTES PASSARAM\033[0m — $PASS/$TOTAL"
  echo "  Stack de produção verificada end-to-end."
else
  echo -e "  \033[31m$FAIL FALHA(S)\033[0m — $PASS/$TOTAL passaram"
  echo "  Corrija os problemas acima antes de declarar concluído."
fi
echo "============================================="
echo ""

exit $FAIL
