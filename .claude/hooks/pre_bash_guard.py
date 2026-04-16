#!/usr/bin/env python3
"""PreToolUse(Bash): bloqueia comandos perigosos. exit 2 = bloquear.

Emite em logs/claude-violations.jsonl quando bloqueia,
e em logs/claude-runtime.jsonl quando libera (audit completo).
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _ledger import emit, read_input, session_id  # noqa: E402


BLOCK = [
    "rm -rf /",
    "rm -rf ~",
    "rm -rf .",
    "rm -rf $HOME",
    "DROP TABLE",
    "DROP DATABASE",
    "TRUNCATE",
    "git push --force",
    "git push -f ",
    "git reset --hard HEAD~",
    "chmod -R 777",
    "curl | bash",
    "wget | bash",
    ":(){ :|:& };:",
    "dd if=/dev/zero",
    "mkfs",
    "DELETE FROM municipalities",
]


def main() -> int:
    data = read_input()
    cmd = (data.get("tool_input") or {}).get("command", "") or ""
    sid = session_id(data)

    cmd_low = cmd.lower()
    for p in BLOCK:
        if p.lower() in cmd_low:
            reason = f"Bloqueado: '{p}'"
            # Audit — violação (bloqueia)
            emit(
                "violations",
                event="pretool_block",
                session_id_=sid,
                tool="Bash",
                target=cmd[:200],
                rule=p,
                reason=reason,
                decision="block",
                actor_mode="blocking",
            )
            # Feedback visível ao Claude (stderr + exit 2)
            print(
                json.dumps({"decision": "block", "reason": f"{reason} | cmd: {cmd[:80]}"}),
                file=sys.stderr,
            )
            return 2

    # Liberado — audit leve (só comandos bash, para rastreabilidade)
    emit(
        "runtime",
        event="pretool_allow",
        session_id_=sid,
        tool="Bash",
        target=cmd[:200],
        decision="allow",
        actor_mode="blocking",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
