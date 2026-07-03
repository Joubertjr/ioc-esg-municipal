#!/usr/bin/env bash
set -euo pipefail

echo "=== FITNESS: Docker production build ==="
echo "NOTA: este teste leva ~10-15min"
start=$(date +%s)

tag="ioc-esg-municipal:fitness-$(git rev-parse --short HEAD)"

if docker build -t "$tag" . 2>&1; then
  end=$(date +%s)
  echo "PASS — docker build concluído com sucesso: $tag ($(( end - start ))s)"
  exit 0
else
  end=$(date +%s)
  echo "FAIL — docker build falhou ($(( end - start ))s)"
  exit 1
fi
