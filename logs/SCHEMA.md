# Audit Trail — Esquema de Eventos

> Formato: **JSONL append-only** (um evento por linha). Escrito por hooks
> do Claude Code em `$CLAUDE_PROJECT_DIR/logs/`. **Nunca** edite à mão —
> este log é a prova do que aconteceu na sessão.

## Arquivos

| Arquivo                   | Propósito                                          | Eventos típicos                                                         |
| ------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| `claude-sessions.jsonl`   | Ciclo de vida de sessão                            | `session_start`, `instructions_loaded`, `session_stop`                  |
| `claude-runtime.jsonl`    | Eventos de runtime (prompts, permissões, mutações) | `prompt_submitted`, `pretool_allow`, `write_mutation`, `compact_backup` |
| `claude-violations.jsonl` | Tudo que foi bloqueado ou falhou                   | `pretool_block`, `tool_failure`                                         |

Cada arquivo rotaciona ao atingir 50 MB (mantém o tail das últimas ~5000 linhas
no arquivo ativo; versão anterior vai para `<arquivo>.jsonl.1`).

## Campos canônicos (todos os eventos)

| Campo        | Tipo   | Descrição                                                    |
| ------------ | ------ | ------------------------------------------------------------ |
| `ts`         | string | Timestamp ISO-8601 em UTC (segundos)                         |
| `session_id` | string | ID estável da sessão (payload do Claude > env > hash do pid) |
| `event`      | string | Nome do evento (tabela abaixo)                               |
| `git_branch` | string | Branch ativa (`git branch --show-current`)                   |
| `git_sha`    | string | SHA curto do HEAD (`git rev-parse --short HEAD`)             |

## Campos comuns (quando aplicável)

| Campo           | Quando aparece               | Exemplo                                             |
| --------------- | ---------------------------- | --------------------------------------------------- |
| `tool`          | eventos de tool              | `"Write"`, `"Bash"`, `"Edit"`                       |
| `target`        | alvo da ação                 | `"docs/X.md"` ou `"npm install"` truncado em 200 ch |
| `decision`      | controle de fluxo            | `"allow"`, `"block"`, `"failure"`                   |
| `reason`        | motivo quando bloqueia       | `"Bloqueado: 'rm -rf /'"`                           |
| `rule`          | qual regra disparou bloqueio | `"rm -rf /"` ou `"PATTERN:.*\\.pem$"`               |
| `actor_mode`    | natureza do hook             | `"blocking"`, `"audit"`, `"observe"`                |
| `exit_code`     | Bash failures                | `1`, `2`, `127`                                     |
| `error_preview` | primeiras 300 chars do erro  | `"ENOENT: no such file..."`                         |

## Eventos — catálogo

### `session_start`

- **Arquivo**: `claude-sessions.jsonl`
- **Emissor**: `session_start.py`
- **Campos extras**: `branch`, `dirty_files`, `claude_md_sha`

### `instructions_loaded`

- **Arquivo**: `claude-sessions.jsonl`
- **Emissor**: `session_start.py`
- **Campos extras**: `claude_md_sha`, `rules` (objeto `{nome: sha}`), `rules_count`, `state_file_present`
- **Por que**: prova determinística de qual CLAUDE.md e quais regras estavam carregadas.

### `session_stop`

- **Arquivo**: `claude-sessions.jsonl`
- **Emissor**: `stop_activity_log.py`
- **Campos extras**: `branch`, `dirty_files`

### `prompt_submitted`

- **Arquivo**: `claude-runtime.jsonl`
- **Emissor**: `user_prompt_submit.py`
- **Campos extras**: `category` (code/audit/deploy/docs/ops/question/unknown), `risk` (baixo/medio/alto), `prompt_len`, `preview` (primeiros 120 ch)

### `pretool_allow` / `pretool_block`

- **Arquivo**: `runtime` / `violations` respectivamente
- **Emissor**: `pre_bash_guard.py`, `pre_write_guard.py`
- **Campos extras**: `tool`, `target`, `rule`, `reason`, `decision`
- **Por que**: prova que o guard rodou e qual regra casou (ou não casou).

### `write_mutation`

- **Arquivo**: `claude-runtime.jsonl`
- **Emissor**: `post_tool_audit.py`
- **Campos extras**: `tool`, `target`
- **Por que**: rastreia toda escrita de arquivo feita pelo Claude, em ordem.

### `tool_failure`

- **Arquivo**: `claude-violations.jsonl`
- **Emissor**: `post_tool_audit.py`
- **Campos extras**: `tool`, `target`, `exit_code`, `error_preview`
- **Critério**: `success == False` no `tool_response`, ou `Bash` com `exit_code != 0`.

### `compact_backup`

- **Arquivo**: `claude-runtime.jsonl`
- **Emissor**: `pre_compact_save.py`
- **Campos extras**: `target` (caminho do snapshot), `size_bytes`

## Como consultar

```bash
# Últimas sessões
tail -20 logs/claude-sessions.jsonl | jq .

# Todas as violações de hoje
grep "$(date -u +%Y-%m-%d)" logs/claude-violations.jsonl | jq .

# Quantas mutações de arquivo nesta sessão?
jq -c 'select(.event=="write_mutation")' logs/claude-runtime.jsonl | wc -l

# Qual CLAUDE.md estava carregado em cada sessão?
jq -r 'select(.event=="instructions_loaded") | "\(.ts) \(.session_id) \(.claude_md_sha)"' \
  logs/claude-sessions.jsonl | tail -10
```

## Garantias e limitações

- **Append-only**: hooks nunca truncam o log fora da rotação por tamanho.
- **Silencioso em erro**: `_ledger.emit` captura e ignora exceções — o audit
  trail **nunca** deve quebrar o runtime. Consequência: um dia ruim em disco
  pode perder um evento; é aceitável, porque o hook é observacional.
- **Não é criptograficamente selado**: log é tamper-evident apenas por
  `git log` (o diretório `logs/` é commitado só quanto a `SCHEMA.md`; os
  `.jsonl` ficam fora do git — ver `.gitignore`).
