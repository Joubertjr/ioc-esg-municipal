# Hardening Checklist — Arquitetura Claude Code IOC ESG Municipal

> **Documento único, versionado.** Define os critérios formais para dizer que a arquitetura Claude Code deste projeto está **madura** — ou seja, apta a auditoria externa aleatória sem trabalho adicional.
> Complementa `docs/architecture/CLAUDE_CODE_ADOCAO_IOC_ESG.md` §4 (critério de fechamento).
> Revisão: a cada release de produção; mínimo trimestral.

---

## 0. Dois modos de operação

### Audit mode (default operacional)

- **Quando:** operação normal, todas as sessões.
- **O que faz:** hooks **observam** tudo — registram em `logs/*.jsonl` toda instrução carregada, prompt submetido, tool invocado, mutação feita. **Não bloqueiam**, exceto onde política explícita exige (ex.: leitura de `.env`).
- **Garantia:** é possível reconstruir a sessão post-mortem com evidência.
- **Custo:** latência desprezível (hooks assíncronos em PostTool; síncronos apenas onde o bloqueio é requisito).

### Blocking mode (enforcement ativo)

- **Quando:** `PreToolUse(Bash)` e `PreToolUse(Write|Edit)` sempre. Outros hooks em audit mode.
- **O que faz:** hooks **rejeitam** a ação antes dela ocorrer se pattern proibido for detectado.
  - `pre_bash_guard.py` — 14 padrões bloqueados (rm -rf /, sudo, git push --force, curl|bash, chmod 777, etc.)
  - `pre_write_guard.py` — bloqueia escrita em `.env`, chaves privadas, PEM.
- **Garantia:** ação proibida não chega ao disco nem ao shell.
- **Custo:** latência de ~5s por ferramenta afetada (timeout declarado em `settings.json`).

**Regra:** blocking mode **não** substitui audit mode — eles coexistem. Toda ação permitida ainda é registrada.

---

## 1. As seis provas de maturidade

A arquitetura Claude Code é **madura** se, para uma sessão escolhida aleatoriamente pelo auditor, for possível responder **com evidência em arquivo** às seis perguntas abaixo em menos de 5 minutos:

| #   | Pergunta                                              | Onde provar                                                                                                                  |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Que instrução persistente foi carregada?              | `logs/claude-sessions.jsonl` → evento `instructions_loaded` (SHA de CLAUDE.md + rules)                                       |
| 2   | Que prompt foi submetido e como foi classificado?     | `logs/claude-runtime.jsonl` → evento `prompt_submitted` (categoria + risco)                                                  |
| 3   | Que tool foi permitida/bloqueada e por quê?           | `logs/claude-runtime.jsonl` (`pretool_allow`) + `logs/claude-violations.jsonl` (`pretool_block`)                             |
| 4   | Que mutação relevante ocorreu?                        | `git log --all` + `logs/claude-runtime.jsonl` → evento `write_mutation`                                                      |
| 5   | Que política estava ativa (qual versão de que regra)? | `logs/claude-sessions.jsonl` → `instructions_loaded.shas` + `git show <sha>:.claude/rules/<arquivo>.md`                      |
| 6   | Memory não está substituindo política?                | `.claude/rules/memory-policy.md` define escada de 5 critérios + `docs/architecture/RULES_MAP.md` classifica o que é política |

Se alguma pergunta não tem resposta em arquivo → não está madura, retornar ao bundle arquitetural correspondente.

---

## 2. Checklist final de aderência

### 2.1 Instrução e política

- [x] `CLAUDE.md` sem status table volátil (só instrução persistente)
- [x] `.claude/rules/` com 10 arquivos classificados em `RULES_MAP.md`
- [x] `.claude/rules/README.md` indexa e cruza com docs de arquitetura
- [x] `docs/architecture/` contém 6 documentos canônicos (ADOCAO, RULES_MAP, SKILLS_PATTERN, AGENTS_DELEGATION, SETTINGS_TOPOLOGIA, MCP_HYGIENE, PHYSICAL_TOPOLOGY, HARDENING_CHECKLIST)

### 2.2 Skills e agents

- [x] 15 skills com frontmatter canônico (CSV `allowed-tools`, model ID completo)
- [x] 26 agents com frontmatter canônico
- [x] Overlaps conhecidos documentados em `AGENTS_DELEGATION.md` §4
- [x] Skills que exigem argumento declaram sintaxe explicitamente

### 2.3 Governança e runtime

- [x] `.claude/settings.json` sem flags experimentais (isoladas em `.local`)
- [x] `.claude/settings.json` com 11 allow + 14 deny robustos
- [x] 6 eventos de hook configurados (SessionStart, UserPromptSubmit, 2×PreToolUse, 2×PostToolUse, PreCompact, Stop)
- [x] MCP baseline zero — projeto funciona sem MCP (ver `MCP_HYGIENE.md`)
- [x] MCP local (`obsidian-vault`) apenas em `settings.local.json`, consumido só por `memory-manager`

### 2.4 Audit trail

- [x] `logs/claude-runtime.jsonl` com eventos de prompt, allow, write mutation
- [x] `logs/claude-violations.jsonl` com eventos de block e tool failure
- [x] `logs/claude-sessions.jsonl` com session_start + instructions_loaded (SHAs) + session_stop
- [x] `logs/SCHEMA.md` documenta todos os event types
- [x] Rotação automática em 50 MB → tail 5000 linhas

### 2.5 Estrutura física

- [x] `docs/architecture/PHYSICAL_TOPOLOGY.md` descreve cada diretório por categoria
- [x] `state/` reservado mas não criado por criar — README explicita propósito futuro
- [x] Fronteira clara: source of truth ≠ estado ≠ trilha ≠ evidência ≠ rascunho

### 2.6 Adoção declarada

- [x] `CLAUDE_CODE_ADOCAO_IOC_ESG.md` §2 matriz OK em todas as dimensões adotadas
- [x] §3 declara explicitamente o que **não** é adotado e por quê
- [x] §4 define critério de fechamento auditável

---

## 3. Operação contínua — cadência de auditoria

### 3.1 Por sessão (automático via hooks)

Cada sessão produz, sem ação humana adicional:

- Um `session_start` + `instructions_loaded` em `logs/claude-sessions.jsonl`
- N `prompt_submitted` em `logs/claude-runtime.jsonl`
- M `pretool_allow` / `pretool_block` em `logs/claude-runtime.jsonl` / `logs/claude-violations.jsonl`
- K `write_mutation` em `logs/claude-runtime.jsonl`
- Um `session_stop` em `logs/claude-sessions.jsonl`

Nenhuma intervenção humana necessária. Se o hook falha, ele mesmo registra `tool_failure`.

### 3.2 Por release (manual)

Antes de cada release de produção:

1. Rodar checklist §2 deste documento — todos os [x] devem estar verdes.
2. Correlacionar `logs/claude-violations.jsonl` com git history — violations sem commit de mitigação são bloqueadoras.
3. Revisar `docs/architecture/CLAUDE_CODE_ADOCAO_IOC_ESG.md` — marcar mudanças na matriz se houve promoção/demoção entre release anterior e esta.

### 3.3 Trimestral (obrigatório)

- Revisar `.claude/rules/` — alguma regra não foi acionada em `logs/` nos últimos 90 dias? Rebaixar ou remover.
- Revisar agents — algum invocado zero vezes? Aposentar via ADR.
- Revisar skills — alguma não invocada? Aposentar ou consolidar com outra.
- Revisar MCP — algum declarado em permissões mas nunca chamado? Remover permissão.
- Atualizar SHA/data no rodapé dos documentos de arquitetura revisados.

### 3.4 Em resposta a incidente

Se violação de política detectada:

1. Achado → `docs/evidence/YYYY-MM-DD-incident-<id>/` com log relevante extraído.
2. Causa-raiz → ADR em `docs/decisions/` se exigir mudança de regra.
3. Correção → commit atômico citando o ADR.
4. Verificação → rodar checklist §2 novamente.

---

## 4. O que **não** é exigido para maturidade

Explícito para evitar expansão de escopo:

| Item                                    | Razão de não exigir                                                |
| --------------------------------------- | ------------------------------------------------------------------ |
| `state/runtime-state.json` machine-read | Sem consumidor automatizado hoje (ver `PHYSICAL_TOPOLOGY.md` §3.1) |
| Dashboard de métricas Claude Code       | Auditoria manual dos JSONL é suficiente para volume atual          |
| MCP próprio do projeto                  | Baseline zero é decisão arquitetural, não débito                   |
| Agent Teams como orquestração padrão    | Experimental, isolado em settings.local                            |
| Plugins próprios                        | Custo > benefício para 1 projeto (ADR futura pode reabrir)         |
| CI que valida `.claude/` a cada push    | Pre-commit hooks locais cobrem; CI gate exigiria ADR separado      |

---

## 5. Comandos de verificação

```bash
# 1. Últimos 5 eventos session_start com SHA das rules
tail -n 20 logs/claude-sessions.jsonl | jq -c 'select(.event=="instructions_loaded") | {session_id, shas}'

# 2. Violations do último release
git log --since="<data>" --pretty=format:"%H %s" | head -20
jq -c 'select(.event=="pretool_block")' logs/claude-violations.jsonl | tail -20

# 3. Write mutations por arquivo no último mês
jq -r 'select(.event=="write_mutation") | .path' logs/claude-runtime.jsonl | sort | uniq -c | sort -rn | head -20

# 4. Skills / agents nunca invocados nos últimos 90 dias
# (cruza arquivos em .claude/{skills,agents}/ com logs)
ls .claude/skills/*.md | awk -F/ '{print $NF}' | while read s; do
  n=$(grep -c "\"skill\":\"${s%.md}\"" logs/claude-runtime.jsonl 2>/dev/null || echo 0)
  echo "$n  $s"
done | sort -n | head -10

# 5. Aderência a frontmatter canônico (skills + agents)
for f in .claude/skills/*.md .claude/agents/*.md; do
  head -20 "$f" | grep -qE "^allowed-tools:" || echo "NAO-CONFORME: $f"
done
```

---

## 6. Sinalização em caso de regressão

Se qualquer item da §2 ficar vermelho após estar verde:

1. Abrir task imediato — não acumular com outros fixes.
2. Registrar em `docs/decisions/` se a regressão foi consciente (ex.: remoção temporária de hook para debug).
3. Atualizar `CLAUDE_CODE_ADOCAO_IOC_ESG.md` §2 para refletir estado corrente (PARCIAL/AUSENTE).
4. Planejar restauração no próximo commit.

Maturidade não é ponto alcançado — é propriedade contínua. O checklist deve permanecer verde, não apenas ter sido verde uma vez.

---

## 7. Referências

- `docs/architecture/CLAUDE_CODE_ADOCAO_IOC_ESG.md` §4 — critério de fechamento
- `docs/architecture/RULES_MAP.md` — política enforçável
- `docs/architecture/SKILLS_PATTERN.md` — contrato de workflow
- `docs/architecture/AGENTS_DELEGATION.md` — matriz de persona
- `docs/architecture/SETTINGS_TOPOLOGIA.md` — governança
- `docs/architecture/MCP_HYGIENE.md` — capacidade externa
- `docs/architecture/PHYSICAL_TOPOLOGY.md` — topologia do filesystem
- `logs/SCHEMA.md` — esquema dos eventos auditáveis

---

## 8. Histórico

- **2026-04-16** — criado no bundle P2 (Fase 13). Formaliza audit mode × blocking mode, as 6 provas de maturidade e a cadência de auditoria trimestral.
