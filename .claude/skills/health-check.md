---
name: health-check
description: Monitor de saúde do projeto. Use com /loop 15m durante desenvolvimento ativo. Verifica testes, segurança, Git e APIs governamentais.
allowed-tools: Read, Bash(pnpm *), Bash(git *), Bash(curl -s *)
model: claude-haiku-4-5-20251001
---
# Health Check — IOC ESG Municipal

## Execute e reporte status

```bash
# Testes
pnpm test --passWithNoTests 2>&1 | grep -E "passed|failed|Tests:" | head -3

# Não commitados
DIRTY=$(git status --short | wc -l | tr -d ' ')
echo "Não commitados: $DIRTY arquivo(s)"

# APIs governamentais (curl com timeout 8s)
curl -s --max-time 8 "https://servicodados.ibge.gov.br/api/v1/localidades/municipios/4204202" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('IBGE: OK -', d.get('nome','?'))" 2>/dev/null || echo "IBGE: INDISPONÍVEL"

curl -s --max-time 8 "https://api.siconfi.tesouro.gov.br/v1/municipios/SC" | \
  python3 -c "import sys,json; json.load(sys.stdin); print('SICONFI: OK')" 2>/dev/null || echo "SICONFI: INDISPONÍVEL"

# Secrets expostos (paranoia)
COUNT=$(grep -r "password\s*=\s*['\"][^'\"]\{6\}" --include="*.ts" backend/ shared/ 2>/dev/null \
  | grep -v "test\|mock\|example\|env" | wc -l | tr -d ' ')
echo "Possíveis secrets hardcoded: $COUNT"
```

## Output esperado
```
HEALTH CHECK — HH:MM:SS
✅ Testes: N passando, 0 falhando
✅ Git: N arquivos não commitados
✅ IBGE: OK — Florianópolis
✅ SICONFI: OK
✅ Secrets: 0 detectados
```

Se algo falhar: descreva e sugira ação.
