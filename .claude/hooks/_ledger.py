#!/usr/bin/env python3
"""Biblioteca compartilhada de audit trail JSONL.

Uso nos hooks:

    from _ledger import emit, read_input, git_context

    data = read_input()
    emit("runtime", event="prompt_submitted", **extra_fields)

Arquivos de destino (append-only, JSONL):
  logs/claude-sessions.jsonl   — session_start, instructions_loaded, session_stop
  logs/claude-runtime.jsonl    — prompt_submitted, pretool_allow, tool_failure, write_mutation, compact_backup
  logs/claude-violations.jsonl — pretool_block (tudo que bloqueia)

Campos canônicos (mínimo): ts, session_id, event
Campos comuns: tool, target, decision, reason, git_branch, git_sha, actor_mode

Rotação: simples — trunca quando arquivo passa de 50 MB (mantém últimas ~5000 linhas).
"""
from __future__ import annotations
import json
import os
import sys
import subprocess
import hashlib
from datetime import datetime, timezone
from pathlib import Path

PROJECT_DIR = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
LOG_DIR = PROJECT_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

MAX_BYTES = 50 * 1024 * 1024  # 50 MB
TAIL_LINES = 5000


def _run(cmd: list[str]) -> str:
    try:
        return subprocess.run(
            cmd, capture_output=True, text=True, timeout=5, cwd=str(PROJECT_DIR)
        ).stdout.strip()
    except Exception:
        return ""


def git_context() -> dict:
    return {
        "git_branch": _run(["git", "branch", "--show-current"]) or "",
        "git_sha": _run(["git", "rev-parse", "--short", "HEAD"]) or "",
    }


def read_input() -> dict:
    """Lê o JSON que o Claude Code envia via stdin. Retorna {} se não vier nada."""
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw else {}
    except Exception:
        return {}


def session_id(data: dict | None = None) -> str:
    """Deriva session_id estável.

    Prioridade:
      1. `session_id` explícito no payload do Claude Code
      2. variável de ambiente CLAUDE_SESSION_ID
      3. hash determinístico de pid pai + data do dia (fallback)
    """
    if data:
        sid = data.get("session_id") or data.get("sessionId")
        if sid:
            return str(sid)
    env_sid = os.environ.get("CLAUDE_SESSION_ID")
    if env_sid:
        return env_sid
    seed = f"{os.getppid()}-{datetime.now().strftime('%Y%m%d')}"
    return hashlib.sha1(seed.encode()).hexdigest()[:12]


def _target_file(kind: str) -> Path:
    names = {
        "sessions": "claude-sessions.jsonl",
        "runtime": "claude-runtime.jsonl",
        "violations": "claude-violations.jsonl",
    }
    return LOG_DIR / names.get(kind, f"claude-{kind}.jsonl")


def _rotate(path: Path) -> None:
    try:
        if not path.exists() or path.stat().st_size < MAX_BYTES:
            return
        with path.open("r", encoding="utf-8") as f:
            lines = f.readlines()
        tail = lines[-TAIL_LINES:]
        rotated = path.with_suffix(".jsonl.1")
        path.replace(rotated)
        with path.open("w", encoding="utf-8") as f:
            f.writelines(tail)
    except Exception:
        pass


def emit(
    kind: str,
    *,
    event: str,
    session_id_: str | None = None,
    data: dict | None = None,
    **fields,
) -> None:
    """Grava uma linha JSONL em logs/claude-<kind>.jsonl.

    Fields overrides tudo. Silencioso em erro (hook nunca pode quebrar sessão).
    """
    try:
        record: dict = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "session_id": session_id_ or session_id(data),
            "event": event,
        }
        record.update(git_context())
        record.update({k: v for k, v in fields.items() if v is not None})
        path = _target_file(kind)
        _rotate(path)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
    except Exception:
        # Audit trail nunca deve quebrar runtime
        pass


def sha_of_file(path: Path, length: int = 10) -> str:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()[:length]
    except Exception:
        return ""


if __name__ == "__main__":
    # Self-test rápido
    emit("runtime", event="self_test", note="ledger ok")
    print("ledger ok -", LOG_DIR)
