#!/usr/bin/env python3
"""PreToolUse: bloqueia comandos perigosos. exit 2 = bloquear."""
import json, sys, re

try:
    data = json.loads(sys.stdin.read())
    cmd = data.get("tool_input", {}).get("command", "")
except:
    sys.exit(0)

BLOCK = [
    "rm -rf /", "rm -rf ~", "rm -rf .", "rm -rf $HOME",
    "DROP TABLE", "DROP DATABASE", "TRUNCATE",
    "git push --force", "git push -f ",
    "git reset --hard HEAD~",
    "chmod -R 777", "curl | bash", "wget | bash",
    ":(){ :|:& };:", "dd if=/dev/zero", "mkfs",
    "DELETE FROM municipalities",
]

for p in BLOCK:
    if p.lower() in cmd.lower():
        print(json.dumps({"decision": "block", "reason": f"Bloqueado: '{p}' | cmd: {cmd[:80]}"}), file=sys.stderr)
        sys.exit(2)

sys.exit(0)
