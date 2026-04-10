#!/usr/bin/env python3
"""
scripts/fix-env-dev.py

Corrige o arquivo .env de desenvolvimento alinhando as credenciais de banco
com o docker-compose.yml e gerando segredos fortes quando ainda estão com
valores placeholder.

Motivo:
  O .env.example (e portanto muitos .env recém-copiados) usa
  postgres:postgres@localhost:5432/ioc_esg_municipal, mas o
  docker-compose.yml real sobe o Postgres com ioc:ioc_dev_2026/ioc_esg.
  Essa divergência causa HTTP 500 no login ("Erro interno ao autenticar")
  porque o Prisma não consegue conectar ao banco.

Uso:
  python3 scripts/fix-env-dev.py            # aplica correções
  python3 scripts/fix-env-dev.py --dry-run  # mostra o que mudaria

Idempotente: rodar de novo não produz mudanças se o .env já está correto.
"""
from __future__ import annotations

import re
import secrets
import sys
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"

# Valores canônicos do docker-compose.yml
DEV_DB_USER = "ioc"
DEV_DB_PASS = "ioc_dev_2026"
DEV_DB_NAME = "ioc_esg"
DEV_DB_URL = f"postgresql://{DEV_DB_USER}:{DEV_DB_PASS}@localhost:5432/{DEV_DB_NAME}?schema=public"

PLACEHOLDER_JWT = "troque-por-chave-segura-em-producao"


def fix_line(line: str) -> tuple[str, str | None]:
    """Retorna (nova_linha, descricao_mudanca_ou_None)."""
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return line, None

    if "=" not in stripped:
        return line, None

    key, _, value = stripped.partition("=")
    key = key.strip()
    value = value.strip()

    if key == "DATABASE_URL":
        if value != DEV_DB_URL:
            return f"{key}={DEV_DB_URL}\n", f"DATABASE_URL: {value} -> {DEV_DB_URL}"
    elif key == "DATABASE_USER":
        if value != DEV_DB_USER:
            return f"{key}={DEV_DB_USER}\n", f"DATABASE_USER: {value} -> {DEV_DB_USER}"
    elif key == "DATABASE_PASSWORD":
        if value != DEV_DB_PASS:
            return f"{key}={DEV_DB_PASS}\n", f"DATABASE_PASSWORD: {value} -> {DEV_DB_PASS}"
    elif key == "DATABASE_NAME":
        if value != DEV_DB_NAME:
            return f"{key}={DEV_DB_NAME}\n", f"DATABASE_NAME: {value} -> {DEV_DB_NAME}"
    elif key == "JWT_SECRET":
        if value == PLACEHOLDER_JWT or not value:
            new_secret = secrets.token_hex(32)
            return f"{key}={new_secret}\n", "JWT_SECRET: placeholder -> random 64-char"

    return line, None


def main() -> int:
    dry_run = "--dry-run" in sys.argv

    if not ENV_PATH.exists():
        print(f"[fix-env] {ENV_PATH} nao existe", file=sys.stderr)
        return 1

    original = ENV_PATH.read_text(encoding="utf-8")
    lines = original.splitlines(keepends=True)

    new_lines: list[str] = []
    changes: list[str] = []
    for line in lines:
        new_line, change = fix_line(line)
        new_lines.append(new_line)
        if change:
            changes.append(change)

    if not changes:
        print("[fix-env] .env ja esta correto - nenhuma mudanca.")
        return 0

    print("[fix-env] Mudancas detectadas:")
    for c in changes:
        # Oculta segredos na saida
        if "JWT_SECRET" in c:
            print("  - JWT_SECRET: placeholder -> random 64-char hex")
        else:
            print(f"  - {c}")

    if dry_run:
        print("[fix-env] dry-run: nada foi escrito.")
        return 0

    # Backup antes de sobrescrever (.env.bak ao lado de .env)
    backup = ENV_PATH.with_name(".env.bak")
    backup.write_text(original, encoding="utf-8")
    ENV_PATH.write_text("".join(new_lines), encoding="utf-8")

    print(f"[fix-env] .env atualizado. Backup: {backup}")
    print("[fix-env] Reinicie o backend para pegar os novos valores:")
    print("          pkill -f 'tsx watch backend/index.ts' ; pnpm dev")
    return 0


if __name__ == "__main__":
    sys.exit(main())
