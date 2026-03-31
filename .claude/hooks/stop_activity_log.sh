#!/bin/bash
# Stop: log assíncrono de atividade ao fim de cada turno
INPUT=$(cat)
IS_ACTIVE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('stop_hook_active',False)).lower())" 2>/dev/null)
[ "$IS_ACTIVE" = "true" ] && exit 0

TS=$(date '+%Y-%m-%d %H:%M:%S')
BRANCH=$(git branch --show-current 2>/dev/null || echo "?")
DIRTY=$(git status --short 2>/dev/null | wc -l | tr -d ' ')

mkdir -p .claude/logs
echo "[$TS] branch=$BRANCH não-commitados=$DIRTY" >> .claude/logs/activity.log
exit 0
