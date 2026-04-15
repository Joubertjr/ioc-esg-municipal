#!/usr/bin/env bash
# =============================================================================
# validate-prod-env.sh — Valida variáveis de ambiente para produção
# =============================================================================
# Uso:
#   bash scripts/validate-prod-env.sh          # valida .env de produção completo
#   bash scripts/validate-prod-env.sh --ci     # valida apenas REGISTRY/IMAGE_TAG (CI)
#
# Exit codes:
#   0 = tudo válido
#   1 = uma ou mais variáveis inválidas (lista de problemas no stderr)
# =============================================================================

set -euo pipefail

ERRORS=()

error() {
  ERRORS+=("$1")
}

# ── Modo CI: apenas REGISTRY e IMAGE_TAG ─────────────────────────────────────
if [[ "${1:-}" == "--ci" ]]; then
  if [[ -z "${REGISTRY:-}" ]]; then
    error "REGISTRY não definido"
  elif echo "$REGISTRY" | grep -qi "seu-org"; then
    error "REGISTRY contém placeholder 'seu-org' — defina o registry real"
  fi

  if [[ -z "${IMAGE_TAG:-}" ]]; then
    error "IMAGE_TAG não definido"
  elif ! echo "$IMAGE_TAG" | grep -qE '^([a-f0-9]{7}|latest)$'; then
    error "IMAGE_TAG deve ser SHA de 7 chars ou 'latest'. Recebido: ${IMAGE_TAG}"
  fi

  if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "=== FALHA: validação CI ===" >&2
    for e in "${ERRORS[@]}"; do echo "  - $e" >&2; done
    exit 1
  fi
  echo "validate-prod-env.sh (--ci): OK"
  exit 0
fi

# ── Modo completo: todas as variáveis de produção ────────────────────────────

# Carregar .env se existir (sem sobrescrever variáveis já definidas)
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# Variáveis obrigatórias (não podem estar vazias)
REQUIRED_VARS=(
  DATABASE_PASSWORD
  DATABASE_USER
  DATABASE_NAME
  JWT_SECRET
  REDIS_PASSWORD
  GRAFANA_PASSWORD
  ALLOWED_ORIGINS
  REGISTRY
)

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    error "${var} não definido ou vazio"
  fi
done

# Rejeitar placeholders conhecidos
if echo "${REGISTRY:-}" | grep -qi "seu-org"; then
  error "REGISTRY contém placeholder 'seu-org' — defina o registry real (ex: ghcr.io/minha-org)"
fi

if echo "${JWT_SECRET:-}" | grep -qiE "(troque|test|change.me|replace|example)"; then
  error "JWT_SECRET contém valor de teste/placeholder — gere com: openssl rand -hex 32"
fi

if echo "${REDIS_PASSWORD:-}" | grep -qiE "(troque|test|change.me|replace|example)"; then
  error "REDIS_PASSWORD contém valor de teste/placeholder — gere com: openssl rand -hex 16"
fi

if echo "${GRAFANA_PASSWORD:-}" | grep -qiE "(^admin$|troque|test|change.me|replace|example)"; then
  error "GRAFANA_PASSWORD contém valor inseguro — gere com: openssl rand -hex 16"
fi

# JWT_SECRET deve ter pelo menos 32 caracteres
if [[ -n "${JWT_SECRET:-}" && ${#JWT_SECRET} -lt 32 ]]; then
  error "JWT_SECRET muito curto (${#JWT_SECRET} chars) — mínimo 32 caracteres"
fi

# REDIS_PASSWORD deve ter pelo menos 16 caracteres
if [[ -n "${REDIS_PASSWORD:-}" && ${#REDIS_PASSWORD} -lt 16 ]]; then
  error "REDIS_PASSWORD muito curto (${#REDIS_PASSWORD} chars) — mínimo 16 caracteres"
fi

# ALLOWED_ORIGINS não deve conter wildcard
if [[ "${ALLOWED_ORIGINS:-}" == "*" ]]; then
  error "ALLOWED_ORIGINS não pode ser '*' em produção — use URL(s) específica(s)"
fi

# ── Resultado ────────────────────────────────────────────────────────────────
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo "=== FALHA: ${#ERRORS[@]} problema(s) encontrado(s) ===" >&2
  for e in "${ERRORS[@]}"; do echo "  - $e" >&2; done
  echo "" >&2
  echo "Corrija os valores no .env e execute novamente." >&2
  exit 1
fi

echo "validate-prod-env.sh: OK — todas as variáveis validadas"
exit 0
