#!/usr/bin/env python3
"""PreToolUse(Write|Edit): protege arquivos sensíveis. exit 2 = bloquear.

Emite em logs/claude-violations.jsonl quando bloqueia.
Não emite em liberação (Post-tool já audita write_mutation).
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _ledger import emit, read_input, session_id  # noqa: E402


EXACT = {".env", ".env.production", ".env.staging", ".env.local"}
PATTERNS = [
    r".*\.pem$",
    r".*_rsa$",
    r".*\.key$",
    r".*credentials.*",
    r".*/migrations/\d+.*\.sql$",
]


def main() -> int:
    data = read_input()
    tool_input = data.get("tool_input") or {}
    fp = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
    tool = data.get("tool_name") or data.get("tool") or "Write"
    sid = session_id(data)

    if not fp:
        return 0

    fname = fp.split("/")[-1]

    reason: str | None = None
    rule_hit: str | None = None

    if fname in EXACT:
        reason = f"Arquivo protegido: {fp}"
        rule_hit = f"EXACT:{fname}"
    else:
        for p in PATTERNS:
            if re.match(p, fp):
                reason = f"Padrão sensível: {fp}"
                rule_hit = f"PATTERN:{p}"
                break

    if reason:
        emit(
            "violations",
            event="pretool_block",
            session_id_=sid,
            tool=tool,
            target=fp,
            rule=rule_hit,
            reason=reason,
            decision="block",
            actor_mode="blocking",
        )
        print(json.dumps({"decision": "block", "reason": reason}), file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
