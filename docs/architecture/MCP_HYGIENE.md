# Higiene de MCP — IOC ESG Municipal

> **Documento único, versionado.** Define quais MCPs o projeto depende, quais são do operador, e por que a distinção importa.
> Fonte canônica — nenhum agente ou skill pode assumir capacidade de MCP que não esteja classificada aqui.
> Revisão: quando um MCP for adicionado, removido ou mudar de categoria.

---

## 0. Princípio

Um **MCP (Model Context Protocol) server** é uma capacidade externa injetada no runtime do Claude Code. Ele pode ser:

- **Baseline do projeto** — qualquer operador que abre o repo precisa dele para operar o fluxo canônico.
- **Local do operador** — conveniência individual; outro operador pode não ter e o projeto ainda funciona.
- **Experimental** — em avaliação; não pode ser caminho crítico.
- **Runtime do Claude.ai** — provido pelo host (Gmail, GCal, etc.), fora do escopo do projeto.

**Regra de ferro:** nenhuma skill, agente ou regra pode depender de MCP que não seja **baseline do projeto**. Se depende, ou promove-se o MCP a baseline (com documentação e commit em `.claude/settings.json`), ou a dependência é removida.

---

## 1. Inventário canônico (2026-04-16)

| MCP                         | Categoria            | Invocado por                                              | Fallback                                         |
| --------------------------- | -------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| `obsidian-vault`            | local do operador    | `memory-manager` agent (opt-in via habilitação na sessão) | N/A — agente falha explicitamente se MCP ausente |
| `claude.ai Gmail`           | runtime do Claude.ai | Nenhum agente, skill ou regra deste projeto               | N/A — não usado                                  |
| `claude.ai Google Calendar` | runtime do Claude.ai | Nenhum agente, skill ou regra deste projeto               | N/A — não usado                                  |

**Baseline do projeto:** zero MCPs. O fluxo canônico (hooks, rules, skills, agents) funciona sem nenhum MCP habilitado.

**Experimental:** zero MCPs.

---

## 2. Classificação por categoria

### 2.1 Baseline do projeto (commit em `.claude/settings.json`)

Nada hoje. Para promover um MCP a esta categoria é necessário:

1. **ADR** em `docs/decisions/` justificando a dependência.
2. Entrada em `mcpServers` no `.claude/settings.json` com caminho portátil (sem `/Users/<operador>/...`).
3. Documentação do propósito e do modo de falha neste arquivo.
4. Smoke test que prova que o MCP sobe numa máquina limpa.

### 2.2 Local do operador (`.claude/settings.local.json` — não commitado)

**`obsidian-vault`** — filesystem server apontando para `~/obsidian-vault/ioc-esg-municipal/`.

- **Propósito:** persistir memória de longo prazo do operador em vault pessoal do Obsidian. Complementa, não substitui, o audit trail em `logs/` ou a política em `.claude/rules/`.
- **Declarado em:** `.claude/settings.local.json` (este operador). `enableAllProjectMcpServers: true` + `enabledMcpjsonServers: ["obsidian-vault"]`.
- **Permissões:** prefixo `mcp__obsidian-vault__*` em `permissions.allow` local.
- **Consumidores:** **apenas** o agente `memory-manager`. Nenhuma regra, skill ou outro agente depende dele.
- **Fallback:** se o MCP não estiver disponível, o agente `memory-manager` deve falhar com mensagem explícita ("MCP obsidian-vault ausente; operador sem vault pessoal — não é bloqueador para o projeto"). Ele **não** é crítico para deploy, coleta, cálculo de ODS, simulação ou QA.

### 2.3 Experimental

Nenhum.

### 2.4 Runtime do Claude.ai (fora de escopo)

- `mcp__claude_ai_Gmail__*` e `mcp__claude_ai_Google_Calendar__*` aparecem nas ferramentas expostas pelo runtime. **Nenhum agente, skill ou regra deste projeto os invoca.** Permanecem como capacidade latente do host, sem dependência do projeto.

---

## 3. Regras de higiene

### 3.1 MCP local não é baseline

Qualquer skill, regra ou agente que pressuponha que `obsidian-vault` (ou qualquer outro MCP local) "sempre estará lá" está **incorreto por construção**. Se a funcionalidade é crítica, promova o MCP a baseline via ADR — não esconda a dependência.

### 3.2 Sem MCP absoluto em settings commitados

`.claude/settings.json` **não pode** conter `mcpServers` com caminhos absolutos do operador (`/Users/joubert/...`). Caminhos pessoais ficam apenas em `.claude/settings.local.json` (fora do git, por construção).

### 3.3 Toda permissão `mcp__*` precisa de MCP correspondente

Se `permissions.allow` lista `mcp__foo__*`, então ou o MCP `foo` está em `mcpServers` (projeto ou local), ou a permissão é ruído e deve ser removida.

### 3.4 Falha explícita, nunca silenciosa

Agente que depende de MCP deve:

- Detectar ausência logo no início da execução.
- Reportar ao operador com mensagem específica sobre qual MCP falta.
- Nunca continuar com resultado parcial disfarçado de sucesso.

### 3.5 Sem escalada via runtime

MCPs providos pelo runtime (Gmail, GCal) **não** podem ser usados para contornar regras do projeto. Ex.: nenhuma skill pode usar GCal para "registrar audit trail alternativo" — o audit trail canônico é `logs/*.jsonl`.

---

## 4. Processo para adicionar um MCP

1. **Identificar categoria pretendida.** Local ou baseline? Se baseline, pular para passo 2; se local, ir para passo 4.
2. **Abrir ADR** em `docs/decisions/ADR-0XX-mcp-<nome>.md` com: propósito, alternativa sem MCP, modo de falha, custo operacional, quem instala.
3. **Após aprovação do ADR**, adicionar em `.claude/settings.json` (`mcpServers` + `permissions.allow` com prefixo restrito — nunca `mcp__<nome>__*` wildcard sem justificativa).
4. **Se local**, adicionar em `.claude/settings.local.json` do próprio operador; atualizar este documento com entrada em §2.2.
5. **Atualizar inventário** em §1 no mesmo commit.
6. **Smoke test** — agente/skill que usa o MCP deve ter teste de presença em seu fluxo.

---

## 5. Processo para remover um MCP

1. Confirmar que nenhum consumidor ativo depende (grep `mcp__<nome>__` em `.claude/` e `docs/`).
2. Se houver consumidor, primeiro migrá-lo ou desativá-lo.
3. Remover entrada de `mcpServers`, permissões e deste inventário num único commit.
4. Se era baseline com ADR, abrir ADR de revogação.

---

## 6. Auditoria

Cada evento de tool-use é registrado em `logs/claude-runtime.jsonl`. Greps úteis:

```bash
# Quais MCPs foram efetivamente invocados em sessões recentes
grep -oE '"tool":"mcp__[^"]+"' logs/claude-runtime.jsonl | sort -u

# Permissões MCP declaradas vs usadas (detecta ruído em allow list)
grep -oE "mcp__[a-z_]+__[a-z_]+" .claude/settings*.json | sort -u
```

Violação típica a procurar: permissão `mcp__foo__*` em settings sem uma única invocação correspondente em 30 dias → remover.

---

## 7. Referências

- `docs/architecture/SETTINGS_TOPOLOGIA.md` — onde cada flag de settings vive (projeto × local × global)
- `docs/architecture/CLAUDE_CODE_ADOCAO_IOC_ESG.md` §2.5 — status de governança
- `.claude/rules/memory-policy.md` — política de memória (interage com obsidian-vault)
- `.claude/agents/memory-manager.md` — único consumidor de MCP local neste projeto

---

## 8. Histórico

- **2026-04-16** — criado no bundle P2 (Fase 10). Estabelece inventário zero-baseline e classifica `obsidian-vault` como local do operador.
