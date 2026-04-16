# Topologia de Settings do Claude Code

> Onde cada flag vive, por quê, e o que pode migrar entre níveis.

## Três arquivos, três escopos

| Arquivo                       | Escopo                        | Commitado? | Conteúdo típico                                       |
| ----------------------------- | ----------------------------- | ---------- | ----------------------------------------------------- |
| `.claude/settings.json`       | Projeto — todos os operadores | ✅ Sim     | Modelo, `allow`/`deny` universais, hooks obrigatórios |
| `.claude/settings.local.json` | Projeto — este operador       | ❌ Não     | MCPs pessoais, experimentais opt-in, overrides locais |
| `~/.claude/settings.json`     | Global do usuário             | n/a        | Preferências pessoais de todos os projetos            |

Precedência (maior → menor): **user global > settings.local.json > settings.json (projeto)**.
O Claude Code faz merge nas chaves, mas `env`, `permissions.allow`, `permissions.deny` e `hooks` se acumulam; em conflito, o nível mais específico vence.

## Regras de alocação

### Vai em `.claude/settings.json` (committed)

- **Modelo** (`model`) e flags de comportamento (`autoCompact`, `autoMemoryEnabled`)
- **Subagente modelo** (`CLAUDE_CODE_SUBAGENT_MODEL`) — barato, compartilhado
- **Permissões universais** — allow/deny que todo operador deve ter
- **Hooks de projeto** — enforcement canônico do runtime (ver `.claude/hooks/`)
- **Features estáveis** — `ENABLE_TOOL_SEARCH=auto`

### Vai em `.claude/settings.local.json` (NÃO commitado)

- **Flags experimentais** — `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, features beta
- **MCPs com caminho absoluto do usuário** — ex.: `obsidian-vault` em `/Users/joubert/...`
- **Permissões específicas** de ferramentas que nem todo operador tem
- **Overrides temporários** durante experimentação

### Vai em `~/.claude/settings.json` (global)

- Atalhos pessoais, templates favoritos, preferências de apresentação
- Nada de específico ao projeto

## Checklist ao editar settings.json

Antes de commitar uma mudança em `.claude/settings.json`:

1. **Não é experimental?** Experimentais ficam em `.local`.
2. **Funciona para outro operador do projeto?** Se depende de caminho absoluto ou de uma MCP específica, vai em `.local`.
3. **É enforcement?** Hooks que **devem** rodar para todo mundo ficam no projeto.
4. **Expõe segredo?** Jamais — variáveis de segredo só via shell do sistema, nunca em settings.

## Estado atual (2026-04-16)

### `.claude/settings.json` (projeto)

```json
{
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-sonnet-4-6",
    "ENABLE_TOOL_SEARCH": "auto",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "75"
  },
  "permissions": { "allow": [...], "deny": [ "Bash(rm -rf *)", "Read(**/.env)", ... ] },
  "hooks": { SessionStart, UserPromptSubmit, PreToolUse (Bash + Write/Edit),
             PostToolUse (format + audit), PreCompact, Stop }
}
```

### `.claude/settings.local.json` (operador)

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": { "allow": [ "mcp__obsidian-vault__*", ... ] },
  "enabledMcpjsonServers": [ "obsidian-vault" ]
}
```

## Decisões históricas

- **2026-04-16** — `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` movido de projeto → local.
  Razão: flag experimental não deve ser default para todo operador. Fica opt-in.
- **2026-04-16** — Hooks `UserPromptSubmit` e `PostToolUse(*)` audit adicionados ao projeto.
  Razão: audit trail é enforcement universal, não preferência local.

## Auditabilidade

O evento `instructions_loaded` em `logs/claude-sessions.jsonl` registra o SHA do
`CLAUDE.md` e de cada arquivo de `.claude/rules/*.md`. Para auditar quais
settings estavam ativos em uma sessão, correlacione pelo `session_id` com `git log`
(commit do projeto) — as settings pessoais (`.local`) não deixam rastro no git
por desenho, mas os hooks que elas habilitam sempre deixam eventos no ledger.
