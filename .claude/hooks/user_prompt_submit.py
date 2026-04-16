#!/usr/bin/env python3
"""UserPromptSubmit: classifica o prompt e emite evento auditável.

Não bloqueia — puramente observacional. Classificação heurística:

  categoria: code | audit | deploy | docs | ops | question | unknown
  risco:     baixo | medio | alto

Sinais (heurísticas simples e explícitas, sem LLM):
  - deploy: 'deploy', 'go-live', 'producao', 'prod', 'ssh'
  - audit:  'auditoria', 'audit', 'revisar', 'review', 'verificar'
  - docs:   'documentar', 'runbook', 'adr', 'readme'
  - ops:    'backup', 'rollback', 'crontab', 'certificado', 'ssl', 'nginx'
  - code:   'implementar', 'criar', 'adicionar', 'refatorar', 'fix', 'bug'
  - question (default quando só há '?')

Risco alto: deploy | ops | 'rm ' | 'drop ' | 'force' no texto.
Risco médio: code | audit.
Risco baixo: docs | question.

Registra em logs/claude-runtime.jsonl como 'prompt_submitted'.
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _ledger import emit, read_input, session_id  # noqa: E402


def classify(text: str) -> tuple[str, str]:
    t = (text or "").lower()
    # Ordem importa: deploy > ops > audit > docs > code > question
    if any(k in t for k in ("deploy", "go-live", "go live", "producao", "prod ", "ssh ")):
        return "deploy", "alto"
    if any(k in t for k in ("backup", "rollback", "crontab", "certificado", "ssl", "nginx", "reiniciar")):
        return "ops", "alto"
    if any(k in t for k in ("rm -rf", "drop table", "--force", "reset --hard")):
        return "ops", "alto"
    if any(k in t for k in ("auditoria", "auditar", "audit ", "revisar", "review", "verificar", "checar")):
        return "audit", "medio"
    if any(k in t for k in ("documentar", "runbook", "adr ", "readme", "changelog")):
        return "docs", "baixo"
    if any(k in t for k in ("implementar", "criar", "adicionar", "refatorar", "fix ", "bug", "corrigir", "build")):
        return "code", "medio"
    if "?" in t and len(t) < 400:
        return "question", "baixo"
    return "unknown", "baixo"


def main() -> int:
    data = read_input()
    prompt = data.get("prompt") or data.get("user_prompt") or ""
    categoria, risco = classify(prompt)

    emit(
        "runtime",
        event="prompt_submitted",
        session_id_=session_id(data),
        category=categoria,
        risk=risco,
        prompt_len=len(prompt),
        preview=prompt[:120].replace("\n", " "),
        actor_mode="audit",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
