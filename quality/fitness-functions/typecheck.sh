#!/usr/bin/env bash
set -euo pipefail

echo "=== FITNESS: TypeScript typecheck ==="
start=$(date +%s)

if npx tsc --noEmit 2>&1; then
  end=$(date +%s)
  echo "PASS — tsc --noEmit sem erros ($(( end - start ))s)"
  exit 0
else
  end=$(date +%s)
  echo "FAIL — tsc --noEmit encontrou erros ($(( end - start ))s)"
  exit 1
fi
