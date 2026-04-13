#!/bin/bash
# Auditoria funcional end-to-end — IOC ESG Municipal
# Executa testes Playwright contra a stack rodando e gera evidências.
#
# Uso: ./scripts/audit.sh
# Pré-requisito: stack rodando (docker compose up -d ou dev servers)

set -euo pipefail

EVIDENCE_DIR="docs/evidence/$(date +%Y-%m-%d)-audit"

echo "=== Auditoria Funcional E2E ==="
echo "Evidências: $EVIDENCE_DIR"
echo ""

# Verificar backend
if ! curl -sf http://localhost:3000/health > /dev/null 2>&1; then
  echo "❌ Backend não está rodando. Execute primeiro:"
  echo "   docker compose up -d"
  exit 1
fi
echo "✅ Backend: OK"

# Verificar frontend
if ! curl -sf http://localhost:5173 > /dev/null 2>&1; then
  echo "❌ Frontend não está rodando. Execute primeiro:"
  echo "   docker compose up -d"
  exit 1
fi
echo "✅ Frontend: OK"
echo ""

# Criar diretório de evidências
mkdir -p "$EVIDENCE_DIR"

# Executar auditoria
echo "Executando testes de auditoria..."
PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/e2e/audit.spec.ts \
  --reporter=list \
  2>&1 | tee "$EVIDENCE_DIR/audit-output.txt"

EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "=== Resultado ==="
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✅ Auditoria passou — todas as páginas funcionando"
else
  echo "❌ Auditoria encontrou problemas — veja $EVIDENCE_DIR/"
fi

echo "Screenshots: $EVIDENCE_DIR/"
echo "Relatório HTML: playwright-report/index.html"

exit "$EXIT_CODE"
