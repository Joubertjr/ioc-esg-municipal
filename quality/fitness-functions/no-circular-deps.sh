#!/usr/bin/env bash
set -euo pipefail

echo "=== FITNESS: No circular dependencies ==="
start=$(date +%s)

output=$(pnpm madge:circular 2>&1) || true

if echo "$output" | grep -q "No circular dependency found"; then
  end=$(date +%s)
  echo "PASS — nenhuma dependência circular ($(( end - start ))s)"
  exit 0
elif echo "$output" | grep -q "Found 0 circular"; then
  end=$(date +%s)
  echo "PASS — nenhuma dependência circular ($(( end - start ))s)"
  exit 0
else
  end=$(date +%s)
  echo "FAIL — dependências circulares encontradas:"
  echo "$output"
  echo "($(( end - start ))s)"
  exit 1
fi
