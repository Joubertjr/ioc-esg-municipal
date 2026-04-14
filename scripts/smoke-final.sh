#!/usr/bin/env bash
# scripts/smoke-final.sh
#
# Orquestrador de smoke test final para go/no-go de produção.
# Roda 3 camadas: gate rápido, varredura 295, refresh/reload.
#
# Uso:
#   bash scripts/smoke-final.sh              # dev (localhost:3000)
#   bash scripts/smoke-final.sh prod-local   # prod (localhost:8080)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

MODE="${1:-dev}"
case "$MODE" in
  prod-local)
    API_URL="http://localhost:8080"
    ;;
  *)
    API_URL="http://localhost:3000"
    ;;
esac

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

echo ""
echo "============================================="
echo "  Smoke Test Final SC — $API_URL"
echo "============================================="
echo ""

# ─── Layer 1: Gate rápido (smoke-test-stack.sh) ─────────────────────────────

echo "--- Layer 1: Gate rápido ---"

# Wait for backend
for i in $(seq 1 15); do
  curl -sf "$API_URL/health" > /dev/null 2>&1 && break
  echo "  Waiting for backend... ($i)"
  sleep 2
done

if curl -sf "$API_URL/health" > /dev/null 2>&1; then
  report "Backend healthy" 0
else
  report "Backend healthy" 1
  echo ""
  echo "FATAL: Backend not responding at $API_URL — aborting."
  exit 1
fi

# Run existing smoke-test-stack.sh
if [ -f "$SCRIPT_DIR/smoke-test-stack.sh" ]; then
  echo ""
  echo "Running smoke-test-stack.sh..."
  bash "$SCRIPT_DIR/smoke-test-stack.sh" "$MODE" > /tmp/smoke-stack-output.txt 2>&1
  STACK_EXIT=$?
  report "smoke-test-stack.sh" $STACK_EXIT
  if [ $STACK_EXIT -ne 0 ]; then
    echo "  Output:"
    tail -5 /tmp/smoke-stack-output.txt | sed 's/^/    /'
  fi
else
  echo "  (smoke-test-stack.sh not found — skipping)"
fi

# ─── Layer 2: Varredura 295 (smoke-test-sc.ts) ──────────────────────────────

echo ""
echo "--- Layer 2: Varredura 295 municípios ---"
echo ""

npx tsx "$SCRIPT_DIR/smoke-test-sc.ts" "$API_URL"
SC_EXIT=$?
report "smoke-test-sc.ts" $SC_EXIT

# ─── Layer 3: Refresh/reload E2E (Playwright) ───────────────────────────────

echo ""
echo "--- Layer 3: Refresh/reload E2E ---"
echo ""

# Check if playwright is available
if command -v npx &> /dev/null && [ -f "$PROJECT_DIR/tests/e2e/refresh.spec.ts" ]; then
  npx playwright test tests/e2e/refresh.spec.ts --reporter=list 2>&1 | tail -20
  REFRESH_EXIT=${PIPESTATUS[0]}
  report "refresh.spec.ts" $REFRESH_EXIT
else
  echo "  (Playwright or refresh.spec.ts not found — skipping)"
fi

# ─── Final Report ────────────────────────────────────────────────────────────

echo ""
echo "============================================="
if [ $FAIL -eq 0 ]; then
  echo -e "  \033[32mGO FOR PRODUCTION\033[0m — $PASS/$TOTAL passed"
else
  echo -e "  \033[31mNO-GO\033[0m — $PASS/$TOTAL passed, $FAIL failed"
fi
echo "============================================="
echo ""

exit $FAIL
