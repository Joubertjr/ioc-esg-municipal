#!/usr/bin/env bash
set -euo pipefail

echo "=== FITNESS: No secrets in code ==="
start=$(date +%s)

found=0

# Patterns that indicate hardcoded secrets (not variable names or type annotations)
patterns=(
  'password\s*[:=]\s*["\x27][^"\x27]\{8,\}'
  'secret\s*[:=]\s*["\x27][^"\x27]\{8,\}'
  'apikey\s*[:=]\s*["\x27][^"\x27]\{8,\}'
  'api_key\s*[:=]\s*["\x27][^"\x27]\{8,\}'
  'PRIVATE.KEY'
  'sk-[a-zA-Z0-9]\{20,\}'
  'ghp_[a-zA-Z0-9]\{36,\}'
  'aws_secret_access_key'
)

exclude_patterns="node_modules|dist|\.test\.|\.spec\.|\.example|\.env\.example|pnpm-lock|\.md$|fitness-functions"

for pattern in "${patterns[@]}"; do
  matches=$(grep -rni "$pattern" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" . 2>/dev/null \
    | grep -vE "$exclude_patterns" \
    | grep -vE "(process\.env|config\.|getenv|import|require|interface|type |describe\(|it\(|test\(|expect\(|mock|\.d\.ts)" \
    || true)

  if [ -n "$matches" ]; then
    echo "POTENTIAL SECRET FOUND (pattern: $pattern):"
    echo "$matches"
    echo ""
    found=1
  fi
done

# Check for .env files that shouldn't be committed
env_files=$(find . -name ".env" -not -path "*/node_modules/*" -not -name ".env.example" -not -name ".env.test" 2>/dev/null || true)
if [ -n "$env_files" ]; then
  # Check if they're tracked by git
  for f in $env_files; do
    if git ls-files --error-unmatch "$f" 2>/dev/null; then
      echo "TRACKED .env FILE: $f"
      found=1
    fi
  done
fi

end=$(date +%s)

if [ "$found" -eq 0 ]; then
  echo "PASS — nenhum secret encontrado no código ($(( end - start ))s)"
  exit 0
else
  echo "FAIL — possíveis secrets encontrados ($(( end - start ))s)"
  exit 1
fi
