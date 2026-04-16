#!/usr/bin/env python3
"""PostToolUse — registra sucesso/falha de tools relevantes e mutações.

Não bloqueia. Observacional. Regras:

  - tool_response.success == False  → event=tool_failure em violations.jsonl
  - tool in (Write, Edit, MultiEdit, NotebookEdit) → event=write_mutation em runtime.jsonl
  - tool in (Bash) e exit code != 0 → event=tool_failure em violations.jsonl

Campos extras capturados:
  tool, target (file_path ou command truncado), exit_code, error_preview
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _ledger import emit, read_input, session_id  # noqa: E402


WRITE_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}


def main() -> int:
    data = read_input()
    tool = data.get("tool_name") or data.get("tool") or ""
    tool_input = data.get("tool_input") or {}
    tool_response = data.get("tool_response") or {}

    success = tool_response.get("success", True)
    error = tool_response.get("error") or tool_response.get("stderr") or ""
    exit_code = tool_response.get("exit_code")

    target = ""
    if tool in WRITE_TOOLS:
        target = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
    elif tool == "Bash":
        cmd = tool_input.get("command") or ""
        target = cmd[:200]

    sid = session_id(data)

    # Falha — sempre auditar em violations
    if success is False or (tool == "Bash" and isinstance(exit_code, int) and exit_code != 0):
        emit(
            "violations",
            event="tool_failure",
            session_id_=sid,
            tool=tool,
            target=target,
            exit_code=exit_code,
            error_preview=str(error)[:300],
            decision="failure",
            actor_mode="audit",
        )

    # Mutação — sempre auditar em runtime
    if tool in WRITE_TOOLS and success is not False:
        emit(
            "runtime",
            event="write_mutation",
            session_id_=sid,
            tool=tool,
            target=target,
            decision="allow",
            actor_mode="audit",
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
