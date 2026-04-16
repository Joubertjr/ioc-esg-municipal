#!/usr/bin/env python3
"""Stop: registra fim de turno + mantém log tradicional em .claude/logs/activity.log.

Duas saídas:

  - logs/claude-sessions.jsonl → evento session_stop (auditável)
  - .claude/logs/activity.log  → linha humana (compat com fluxo antigo)
"""
from __future__ import annotations
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _ledger import emit, read_input, session_id, PROJECT_DIR  # noqa: E402


def _run(cmd: list[str]) -> str:
    try:
        return subprocess.run(
            cmd, capture_output=True, text=True, timeout=5, cwd=str(PROJECT_DIR)
        ).stdout.strip()
    except Exception:
        return ""


def main() -> int:
    data = read_input()
    # Evita loop se já é um stop-hook reentrante
    if data.get("stop_hook_active") is True:
        return 0

    sid = session_id(data)
    branch = _run(["git", "branch", "--show-current"]) or "?"
    status = _run(["git", "status", "--short"])
    dirty = len([l for l in status.splitlines() if l.strip()])

    emit(
        "sessions",
        event="session_stop",
        session_id_=sid,
        branch=branch,
        dirty_files=dirty,
        actor_mode="observe",
    )

    # Compat: log humano
    try:
        logs_dir = PROJECT_DIR / ".claude" / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with (logs_dir / "activity.log").open("a", encoding="utf-8") as f:
            f.write(f"[{ts}] branch={branch} não-commitados={dirty}\n")
    except Exception:
        pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
