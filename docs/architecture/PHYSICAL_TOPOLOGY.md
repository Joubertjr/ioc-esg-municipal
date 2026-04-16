# Topologia Física — IOC ESG Municipal

> **Documento único, versionado.** Define onde cada tipo de artefato da arquitetura Claude Code vive no filesystem e por quê.
> Complementa `docs/architecture/CLAUDE_CODE_ADOCAO_IOC_ESG.md` §2.7 (Estrutura física).
> Revisão: quando criar, renomear, mover ou remover diretório de primeiro/segundo nível.

---

## 0. Princípio

Cada diretório tem **uma responsabilidade única**:

- **source of truth** (instrução, política, código): versionado em git, humano escreve.
- **estado** (machine-readable): versionado ou não, máquina escreve/lê.
- **trilha** (logs, audit): append-only, máquina escreve, humano lê para auditoria.
- **evidência** (screenshots, relatórios): versionado, máquina ou humano anexa.
- **rascunho** (planos, backups): versionado parcial, transitório.

Mistura entre categorias produz ambiguidade. Este documento deixa explícita a fronteira.

---

## 1. Mapa canônico

| Diretório                   | Categoria        | Versionado  | Escrito por     | Lido por               | Retenção                   |
| --------------------------- | ---------------- | ----------- | --------------- | ---------------------- | -------------------------- |
| `backend/`                  | source of truth  | sim         | humano + agente | runtime                | ∞ (código)                 |
| `frontend/`                 | source of truth  | sim         | humano + agente | runtime                | ∞ (código)                 |
| `shared/`                   | source of truth  | sim         | humano + agente | runtime                | ∞ (código)                 |
| `prisma/`                   | source of truth  | sim         | humano + agente | runtime                | ∞ (schema + migrations)    |
| `scripts/`                  | source of truth  | sim         | humano + agente | humano/CI              | ∞ (operação)               |
| `monitoring/`               | source of truth  | sim         | humano          | Prometheus/Grafana     | ∞ (config)                 |
| `nginx/`                    | source of truth  | sim         | humano          | nginx                  | ∞ (config)                 |
| `.claude/rules/`            | source of truth  | sim         | humano          | agente (toda sessão)   | ∞ (política)               |
| `.claude/skills/`           | source of truth  | sim         | humano          | agente + skill tool    | ∞ (workflow)               |
| `.claude/agents/`           | source of truth  | sim         | humano          | Agent tool             | ∞ (persona)                |
| `.claude/commands/`         | source of truth  | sim         | humano          | slash invocation       | ∞ (atalho)                 |
| `.claude/hooks/`            | source of truth  | sim         | humano          | runtime hooks          | ∞ (enforcement)            |
| `CLAUDE.md`                 | source of truth  | sim         | humano          | agente (toda sessão)   | ∞ (instrução)              |
| `docs/architecture/`        | source of truth  | sim         | humano          | auditor + agente       | ∞ (arquitetura)            |
| `docs/decisions/`           | source of truth  | sim         | humano          | auditor                | ∞ (ADRs imutáveis)         |
| `docs/RUNBOOK_PRODUCAO.md`  | source of truth  | sim         | humano          | oncall                 | ∞ (ops)                    |
| `docs/ESTADO_ATUAL_SC.md`   | estado (humana)  | sim         | humano          | humano (início sessão) | ativa (atualizada manual)  |
| `docs/evidence/`            | evidência        | sim         | skill + humano  | auditor                | ∞ (rastro de UI)           |
| `docs/plans/`               | rascunho         | sim         | agente + humano | sessão em curso        | até conclusão do plano     |
| `logs/`                     | trilha           | sim (tail)  | hooks           | auditor                | rotação (50MB → tail 5000) |
| `logs/SCHEMA.md`            | source of truth  | sim         | humano          | auditor                | ∞ (esquema de eventos)     |
| `state/`                    | estado (máquina) | condicional | máquina         | máquina                | conforme consumidor futuro |
| `.claude/backups/`          | rascunho         | ignorado    | hook PreCompact | máquina/humano         | últimos N backups          |
| `.claude/logs/activity.log` | trilha (humana)  | ignorado    | hook Stop       | humano                 | append-only local          |
| `.claude/projects/`         | runtime privado  | ignorado    | runtime Claude  | runtime                | sessão                     |

---

## 2. Regras de fronteira

### 2.1 Source of truth nunca cita estado vivo

`CLAUDE.md`, `.claude/rules/*.md`, `docs/architecture/*.md` **não** podem conter tabelas de status com ✅/⚠️/❌ ou frases como "atualmente 295 municípios seed'd". Esse conteúdo é **estado**, vai em `docs/ESTADO_ATUAL_SC.md`.

### 2.2 Trilha é append-only

`logs/*.jsonl` só recebem escrita por hooks via `ledger.py`. Não editar manualmente — corrompe a auditoria. Para retenção, usar rotação automática já implementada (50MB → tail 5000 linhas).

### 2.3 Evidência não se confunde com rascunho

`docs/evidence/YYYY-MM-DD-<feature>/` guarda screenshots/relatórios ligados a um commit específico. **Não** é lugar para planos, esboços ou notas. Esses vão em `docs/plans/` (transitório) ou em ADR (permanente).

### 2.4 ADR é imutável

`docs/decisions/ADR-XXX-*.md` não são editáveis após aprovação. Para revogar um ADR, criar novo ADR que cite o anterior como `Supersedes: ADR-XXX`. **Jamais** reescrever.

### 2.5 `.claude/projects/` é privado ao runtime

Esse diretório é escrito pelo Claude Code (transcript, backups automáticos) e **não** entra em commits. Está no `.gitignore` — confirmado pelo `git status` não listando seus arquivos.

### 2.6 `state/` só existe se tiver consumidor

Diretório `state/` é **reservado** para machine-readable projections (ex.: `runtime-state.json`, `adoption-status.json`). Enquanto não houver consumidor automatizado, o diretório mantém apenas um `README.md` explicando o propósito. **Não criar arquivos só para "ocupar"**.

---

## 3. Decisões tomadas

### 3.1 `state/` fica, com README mínimo

Avaliação considerou remover `state/` (vazio hoje). Decisão: **manter** com README que declara o propósito futuro e aponta para o ADR que o ativará. Razão: o diretório já é referenciado em `docs/architecture/CLAUDE_CODE_ADOCAO_IOC_ESG.md` §2.7 e em §2.2 como "NÃO ADOTAR AGORA — backlog". Remover agora exigiria editar três documentos e reintroduzir no futuro. Custo de manter = 1 README; custo de remover+reintroduzir = 3 edits futuras.

### 3.2 `logs/` versionado

`logs/` entra em git (tail-rotacionado) para que auditor externo consiga reconstruir sessões a partir do clone. `.gitignore` protege linhas novas de quebrar rebase (rotação é append-only com tail).

### 3.3 `.claude/backups/` ignorado

Backups do PreCompact são locais — outro operador não precisa dos meus backups. `.gitignore` exclui.

### 3.4 `docs/plans/` commitado

Planos em `docs/plans/` entram em git para rastreabilidade. São transitórios por natureza (deletados ao fechar feature), mas enquanto vivos servem como contexto compartilhado.

---

## 4. Checklist antes de criar diretório novo

- [ ] Qual categoria? (source of truth / estado / trilha / evidência / rascunho)
- [ ] Há consumidor real hoje? Se não, não crie — use README apontando para o ADR futuro.
- [ ] Caminho é portátil (sem `/Users/...`, sem `~/`)?
- [ ] Versionado ou em `.gitignore`? Ambos OK, mas precisa ser intencional.
- [ ] Retenção clara? (∞, rotacionada, transitória)
- [ ] Tabela acima atualizada no mesmo commit?

---

## 5. Auditoria

```bash
# Diretórios com menos de 2 arquivos (candidatos a documentar ou remover)
find . -maxdepth 2 -type d -not -path '*/node_modules*' -not -path '*/.git*' \
  -exec sh -c 'n=$(find "$1" -maxdepth 1 -type f | wc -l); [ "$n" -lt 2 ] && echo "$n  $1"' _ {} \;

# Confirmar que .claude/projects/ e .claude/backups/ estão no gitignore
grep -E "\.claude/(projects|backups)" .gitignore
```

---

## 6. Referências

- `docs/architecture/CLAUDE_CODE_ADOCAO_IOC_ESG.md` §2.7 — matriz de estrutura física
- `docs/architecture/SETTINGS_TOPOLOGIA.md` — settings.json × settings.local.json
- `logs/SCHEMA.md` — esquema dos eventos da trilha
- `.claude/rules/memory-policy.md` — onde memória do operador vive (não é trilha, não é source of truth)

---

## 7. Histórico

- **2026-04-16** — criado no bundle P2 (Fase 11). Formaliza fronteira entre source of truth, estado, trilha, evidência e rascunho. Decide manter `state/` com README mínimo.
