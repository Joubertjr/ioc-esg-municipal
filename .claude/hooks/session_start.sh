#!/bin/bash
# SessionStart: injeta contexto git + estado no início de cada sessão

BRANCH=$(git branch --show-current 2>/dev/null || echo "sem branch")
COMMITS=$(git log --oneline -5 2>/dev/null || echo "repo novo")
DIRTY=$(git status --short 2>/dev/null | wc -l | tr -d ' ')
STATE=$(head -25 docs/PROJECT_STATE.md 2>/dev/null || echo "Sem estado salvo")
GOTCHAS=$(head -20 .claude/GOTCHAS.md 2>/dev/null || echo "")

python3 -c "
import json, sys
ctx = '''=== IOC ESG MUNICIPAL - CONTEXTO DA SESSAO ===
Branch: ${BRANCH} | Nao commitados: ${DIRTY} arquivo(s)
Commits recentes:
${COMMITS}

Estado:
${STATE}

Gotchas criticos:
${GOTCHAS}
'''
print(json.dumps({'additionalContext': ctx}))
"
