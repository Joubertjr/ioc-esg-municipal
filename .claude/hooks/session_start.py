#!/usr/bin/env python3
"""SessionStart: injeta contexto + emite session_start e instructions_loaded.

Este hook substitui session_start.sh. Duas responsabilidades:

  1. Output canônico `{"additionalContext": "..."}` em stdout — o Claude
     Code anexa essa string ao início da sessão (contexto operacional).
  2. Audit trail em logs/claude-sessions.jsonl:
       - session_start      → branch, sha, dirty, instructions_sha
       - instructions_loaded → SHA de CLAUDE.md + rules/*.md
"""
from __future__ import annotations
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _ledger import emit, read_input, session_id, sha_of_file, PROJECT_DIR  # noqa: E402


def _run(cmd: list[str]) -> str:
    try:
        return subprocess.run(
            cmd, capture_output=True, text=True, timeout=5, cwd=str(PROJECT_DIR)
        ).stdout.strip()
    except Exception:
        return ""


def _head(path: Path, n: int) -> str:
    try:
        with path.open("r", encoding="utf-8") as f:
            return "".join([next(f) for _ in range(n)])
    except Exception:
        return ""


def main() -> int:
    data = read_input()
    sid = session_id(data)

    branch = _run(["git", "branch", "--show-current"]) or "sem branch"
    commits = _run(["git", "log", "--oneline", "-5"]) or "repo novo"
    status = _run(["git", "status", "--short"])
    dirty = len([l for l in status.splitlines() if l.strip()])

    state_file = PROJECT_DIR / "docs" / "ESTADO_ATUAL_SC.md"
    gotchas_file = PROJECT_DIR / ".claude" / "GOTCHAS.md"
    claude_md = PROJECT_DIR / "CLAUDE.md"

    state = _head(state_file, 25) if state_file.exists() else "Sem estado salvo"
    gotchas = _head(gotchas_file, 20) if gotchas_file.exists() else ""

    # SHAs das instruções — prova "qual CLAUDE.md foi carregado"
    claude_sha = sha_of_file(claude_md) if claude_md.exists() else ""
    rules_dir = PROJECT_DIR / ".claude" / "rules"
    rule_shas: dict[str, str] = {}
    if rules_dir.is_dir():
        for p in sorted(rules_dir.glob("*.md")):
            rule_shas[p.name] = sha_of_file(p)

    # Evento 1 — abertura de sessão
    emit(
        "sessions",
        event="session_start",
        session_id_=sid,
        branch=branch,
        dirty_files=dirty,
        claude_md_sha=claude_sha,
        actor_mode="observe",
    )

    # Evento 2 — instruções carregadas (para auditoria de drift)
    emit(
        "sessions",
        event="instructions_loaded",
        session_id_=sid,
        claude_md_sha=claude_sha,
        rules=rule_shas,
        rules_count=len(rule_shas),
        state_file_present=state_file.exists(),
        actor_mode="observe",
    )

    # Output para o Claude — contexto de sessão
    ctx = (
        "=== IOC ESG MUNICIPAL - CONTEXTO DA SESSAO ===\n"
        f"Branch: {branch} | Nao commitados: {dirty} arquivo(s)\n"
        "Commits recentes:\n"
        f"{commits}\n\n"
        "Estado:\n"
        f"{state}\n\n"
        "Gotchas criticos:\n"
        f"{gotchas}\n"
    )
    print(json.dumps({"additionalContext": ctx}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
