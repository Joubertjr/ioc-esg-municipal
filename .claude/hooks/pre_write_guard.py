#!/usr/bin/env python3
"""PreToolUse Write/Edit: protege arquivos sensíveis."""
import json, sys, re

try:
    data = json.loads(sys.stdin.read())
    fp = data.get("tool_input", {}).get("file_path", "")
except:
    sys.exit(0)

if not fp:
    sys.exit(0)

fname = fp.split("/")[-1]
EXACT = [".env", ".env.production", ".env.staging", ".env.local"]
PATTERNS = [r".*\.pem$", r".*_rsa$", r".*\.key$", r".*credentials.*",
            r".*/migrations/\d+.*\.sql$"]

if fname in EXACT:
    print(json.dumps({"decision": "block", "reason": f"Arquivo protegido: {fp}"}), file=sys.stderr)
    sys.exit(2)

for p in PATTERNS:
    if re.match(p, fp):
        print(json.dumps({"decision": "block", "reason": f"Padrão sensível: {fp}"}), file=sys.stderr)
        sys.exit(2)

sys.exit(0)
