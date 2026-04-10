#!/usr/bin/env bash
# =============================================================================
# scripts/mcp-vault-server.sh
#
# Wrapper portável para o MCP server filesystem apontando ao Obsidian vault.
#
# Por que existe:
#   O .mcp.json original hardcodava /Users/joubert/obsidian-vault/... que só
#   funciona na máquina do dev original. Em VPS, Sandbox ou máquina de outro
#   dev o MCP falha silenciosamente e a memória de longo prazo é perdida.
#
# Como resolve:
#   1. Lê $OBSIDIAN_VAULT_PATH se definido; caso contrário usa
#      $HOME/obsidian-vault/ioc-esg-municipal
#   2. Cria o diretório se não existir (fail-loud em vez de fail-silent)
#   3. Invoca o MCP server filesystem apontando ao caminho resolvido
#
# Uso:
#   .mcp.json chama este script; nada manual.
#
# Override manual:
#   export OBSIDIAN_VAULT_PATH=/path/to/custom/vault
#   (ou adicione ao .env / shell rc)
# =============================================================================

set -euo pipefail

DEFAULT_VAULT="${HOME}/obsidian-vault/ioc-esg-municipal"
VAULT_PATH="${OBSIDIAN_VAULT_PATH:-${DEFAULT_VAULT}}"

if [ ! -d "${VAULT_PATH}" ]; then
  echo "[mcp-vault] Vault não existe em ${VAULT_PATH} — criando estrutura mínima" >&2
  mkdir -p "${VAULT_PATH}/long-term" \
           "${VAULT_PATH}/short-term" \
           "${VAULT_PATH}/daily"
  echo "[mcp-vault] Estrutura criada. Popule os arquivos via memory-manager." >&2
fi

exec npx -y @modelcontextprotocol/server-filesystem "${VAULT_PATH}"
