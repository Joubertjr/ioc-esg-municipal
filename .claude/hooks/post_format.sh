#!/bin/bash
# PostToolUse Write/Edit: auto-formata o arquivo salvo
FILE="$CLAUDE_TOOL_INPUT_FILE_PATH"
[ -z "$FILE" ] || [ ! -f "$FILE" ] && exit 0

EXT="${FILE##*.}"
case "$EXT" in
  ts|tsx|js|jsx|mjs)
    command -v npx &>/dev/null && npx prettier --write "$FILE" --log-level silent 2>/dev/null
    [ -f "eslint.config.js" ] || [ -f ".eslintrc.json" ] && npx eslint --fix "$FILE" --quiet 2>/dev/null
    ;;
  json|md|css|scss)
    command -v npx &>/dev/null && npx prettier --write "$FILE" --log-level silent 2>/dev/null
    ;;
  py)
    command -v black &>/dev/null && black "$FILE" -q 2>/dev/null || true
    ;;
esac
exit 0
