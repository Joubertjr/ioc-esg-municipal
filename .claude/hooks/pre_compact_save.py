#!/usr/bin/env python3
"""PreCompact: salva snapshot + emite evento compact_backup no ledger.

Preserva comportamento antigo (escreve backup em .claude/backups/), mas agora
também grava evento auditável em logs/claude-runtime.jsonl para rastreabilidade.
"""
from __future__ import annotations
import glob
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _ledger import emit, read_input, session_id, PROJECT_DIR  # noqa: E402


def _run(cmd: str) -> str:
    try:
        return subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=10, cwd=str(PROJECT_DIR)
        ).stdout.strip()
    except Exception:
        return ""


def main() -> int:
    data = read_input()
    sid = session_id(data)

    bdir = PROJECT_DIR / ".claude" / "backups"
    bdir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    fname = f"compact-{ts}.md"
    path = bdir / fname

    parts = [f"# Backup Pre-Compact — {ts}\n"]
    parts.append(f"Branch: {_run('git branch --show-current')}\n")
    log = _run("git log --oneline -10")
    if log:
        parts.append(f"## Commits\n```\n{log}\n```\n")
    diff = _run("git diff --stat")
    if diff:
        parts.append(f"## Diff\n```\n{diff[:800]}\n```\n")

    state_file = PROJECT_DIR / "docs" / "ESTADO_ATUAL_SC.md"
    if state_file.exists():
        try:
            parts.append(f"## Estado\n{state_file.read_text(encoding='utf-8')[:3000]}\n")
        except Exception:
            pass

    try:
        path.write_text("\n".join(parts), encoding="utf-8")
    except Exception as exc:
        emit(
            "runtime",
            event="compact_backup_failed",
            session_id_=sid,
            error_preview=str(exc)[:200],
            decision="failure",
            actor_mode="observe",
        )
        return 0

    # Mantém últimos 15
    try:
        olds = sorted(glob.glob(str(bdir / "compact-*.md")))[:-15]
        for old in olds:
            os.remove(old)
    except Exception:
        pass

    emit(
        "runtime",
        event="compact_backup",
        session_id_=sid,
        target=str(path.relative_to(PROJECT_DIR)),
        size_bytes=path.stat().st_size if path.exists() else 0,
        decision="allow",
        actor_mode="observe",
    )

    print(f"Backup salvo: {fname}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
